-- Macro cliente: un cliente (ragione sociale) messo sotto un altro cliente esistente perde le sue
-- proprietà commerciali e il CRM ragiona sul macro cliente. Un solo livello: se il cliente aveva
-- già ragioni sociali sotto, passano anche loro sotto il nuovo macro cliente.
--   - rapporto, owner e "freddo" della ragione sociale seguono sempre quelli del macro cliente;
--   - il rapporto del macro si calcola sul fatturato di tutto il gruppo (trigger già esistente).

CREATE OR REPLACE FUNCTION public.clients_auto_relationship()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_macro public.clients%ROWTYPE;
  v_children record;
BEGIN
  IF NEW.parent_client_id IS NOT NULL THEN
    SELECT * INTO v_macro FROM public.clients WHERE id = NEW.parent_client_id;
    IF v_macro.id IS NOT NULL THEN
      NEW.relationship := v_macro.relationship;
      NEW.owner := v_macro.owner;
      NEW.manual_relationship := v_macro.manual_relationship;
      NEW.is_cold_client := v_macro.is_cold_client;
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.relationship = 'Eliminato' THEN
    NEW.manual_relationship := true;
    RETURN NEW;
  END IF;
  SELECT
    COALESCE(SUM(rev_2023), 0) AS rev_2023,
    COALESCE(SUM(rev_2024), 0) AS rev_2024,
    COALESCE(SUM(rev_2025), 0) AS rev_2025,
    COALESCE(SUM(rev_2026), 0) AS rev_2026
  INTO v_children
  FROM public.clients
  WHERE parent_client_id = NEW.id AND id <> NEW.id;
  NEW.relationship := public.resolve_client_relationship(
    COALESCE(NEW.rev_2023, 0) + v_children.rev_2023,
    COALESCE(NEW.rev_2024, 0) + v_children.rev_2024,
    COALESCE(NEW.rev_2025, 0) + v_children.rev_2025,
    COALESCE(NEW.rev_2026, 0) + v_children.rev_2026
  );
  NEW.manual_relationship := false;
  NEW.is_cold_client := NEW.relationship = 'Freddo';
  RETURN NEW;
END;
$$;

-- Quando cambiano rapporto o owner del macro cliente, le sue ragioni sociali si allineano.
CREATE OR REPLACE FUNCTION public.clients_sync_macro_children()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.parent_client_id IS NULL
    AND (NEW.relationship IS DISTINCT FROM OLD.relationship OR NEW.owner IS DISTINCT FROM OLD.owner
      OR NEW.is_cold_client IS DISTINCT FROM OLD.is_cold_client) THEN
    UPDATE public.clients
    SET relationship = NEW.relationship
    WHERE parent_client_id = NEW.id
      AND (relationship IS DISTINCT FROM NEW.relationship OR owner IS DISTINCT FROM NEW.owner
        OR is_cold_client IS DISTINCT FROM NEW.is_cold_client);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER clients_sync_macro_children
  AFTER UPDATE OF relationship, owner, is_cold_client ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_sync_macro_children();

-- Mette un cliente sotto un macro cliente (o lo stacca con p_macro_id NULL).
CREATE OR REPLACE FUNCTION public.set_client_macro(p_client_id text, p_macro_id text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_macro_id text := p_macro_id;
  v_moved integer := 0;
BEGIN
  IF v_macro_id IS NULL THEN
    UPDATE public.clients SET parent_client_id = NULL WHERE id = p_client_id;
    -- Tornato cliente a sé: il rapporto si ricalcola sul suo fatturato.
    UPDATE public.clients SET relationship = 'Nuovo Cliente' WHERE id = p_client_id AND relationship <> 'Eliminato';
    RETURN jsonb_build_object('client_id', p_client_id, 'macro_id', NULL);
  END IF;
  -- Se il macro scelto è a sua volta sotto un altro, si usa quello in cima.
  SELECT COALESCE(parent_client_id, id) INTO v_macro_id FROM public.clients WHERE id = p_macro_id;
  IF v_macro_id IS NULL THEN
    RAISE EXCEPTION 'Macro cliente non trovato.';
  END IF;
  IF v_macro_id = p_client_id THEN
    RAISE EXCEPTION 'Un cliente non può stare sotto sé stesso.';
  END IF;
  UPDATE public.clients SET parent_client_id = v_macro_id WHERE parent_client_id = p_client_id;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  UPDATE public.clients SET parent_client_id = v_macro_id WHERE id = p_client_id;
  -- Il macro ricalcola il rapporto sul fatturato del gruppo, le ragioni sociali lo seguono.
  UPDATE public.clients SET relationship = relationship WHERE id = v_macro_id;
  UPDATE public.clients SET relationship = relationship WHERE parent_client_id = v_macro_id;
  RETURN jsonb_build_object('client_id', p_client_id, 'macro_id', v_macro_id, 'moved_children', v_moved);
END;
$$;

REVOKE ALL ON FUNCTION public.set_client_macro(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_client_macro(text, text) TO authenticated;

-- Allinea subito le ragioni sociali già esistenti al loro macro cliente.
UPDATE public.clients SET relationship = relationship WHERE parent_client_id IS NOT NULL;
