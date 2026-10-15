-- Rapporto cliente automatico dal fatturato (anno corrente 2026, come ANALYSIS_YEAR nell'app):
--   Freddo: mai fatturato; Nuovo Cliente: fattura nel 2026 ed è il primo anno;
--   Ricorrente: fattura nel 2026 e anche in un anno precedente; Da recuperare: ha fatturato
--   in passato ma non nel 2026. Solo «Eliminato» si sceglie a mano e resta tale.
-- Un cliente principale conta anche il fatturato delle sue ragioni sociali (parent_client_id).

CREATE OR REPLACE FUNCTION public.resolve_client_relationship(
  p_rev_2023 numeric, p_rev_2024 numeric, p_rev_2025 numeric, p_rev_2026 numeric
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN COALESCE(p_rev_2026, 0) > 0 THEN
      CASE WHEN COALESCE(p_rev_2023, 0) > 0 OR COALESCE(p_rev_2024, 0) > 0 OR COALESCE(p_rev_2025, 0) > 0
        THEN 'Ricorrente' ELSE 'Nuovo Cliente' END
    WHEN COALESCE(p_rev_2023, 0) > 0 OR COALESCE(p_rev_2024, 0) > 0 OR COALESCE(p_rev_2025, 0) > 0
      THEN 'Da recuperare'
    ELSE 'Freddo'
  END;
$$;

CREATE OR REPLACE FUNCTION public.clients_auto_relationship()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_children record;
BEGIN
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

CREATE OR REPLACE TRIGGER clients_auto_relationship
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_auto_relationship();

-- Quando cambia una ragione sociale, si ricalcola il suo cliente principale.
CREATE OR REPLACE FUNCTION public.clients_refresh_parent_relationship()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.parent_client_id IS NOT NULL THEN
    UPDATE public.clients SET relationship = relationship WHERE id = OLD.parent_client_id;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.parent_client_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.parent_client_id IS DISTINCT FROM OLD.parent_client_id
      OR NEW.rev_2023 IS DISTINCT FROM OLD.rev_2023 OR NEW.rev_2024 IS DISTINCT FROM OLD.rev_2024
      OR NEW.rev_2025 IS DISTINCT FROM OLD.rev_2025 OR NEW.rev_2026 IS DISTINCT FROM OLD.rev_2026) THEN
    UPDATE public.clients SET relationship = relationship WHERE id = NEW.parent_client_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER clients_refresh_parent_relationship
  AFTER INSERT OR UPDATE OF parent_client_id, rev_2023, rev_2024, rev_2025, rev_2026 OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_refresh_parent_relationship();

-- Ricalcolo una tantum di tutti i clienti non eliminati.
UPDATE public.clients SET relationship = relationship WHERE relationship <> 'Eliminato';
