-- Due casi distinti:
-- 1) Errore di nome (stesso cliente, stessa ragione sociale): merge_clients unisce ed elimina,
--    il nome sbagliato resta solo come alias nascosto (kind = 'merged') per gli import.
-- 2) Gruppo (es. Campari): più ragioni sociali, ognuna un cliente con i suoi dati, sotto un
--    cliente principale (clients.parent_client_id). Un solo livello: il principale non ha a sua
--    volta un principale e una ragione sociale non ha ragioni sociali sotto.
-- Gli alias 'entity' restano le ragioni sociali solo-nome mostrate nella scheda cliente.

ALTER TABLE public.client_aliases
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'entity'
  CHECK (kind IN ('entity', 'merged'));

-- Alias già creati dalle unioni: sono errori di nome tranne le ragioni sociali vere.
UPDATE public.client_aliases
SET kind = 'merged'
WHERE alias_name NOT IN (
  'Deloitte Italy S.P.A',
  'CAMPARI INTERNATIONAL Srl',
  'PUBLICIS S.R.L.',
  'ASICS ITALIA S.R.L.',
  'FONDAZIONE DOMPÉ ETS',
  'Publicis Media Italy S.r.l.',
  'M&C SAATCHI PR S.R.L.'
);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS parent_client_id text REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_parent_client_id_idx ON public.clients (parent_client_id);

CREATE OR REPLACE FUNCTION public.check_client_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_client_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_client_id = NEW.id THEN
    RAISE EXCEPTION 'Un cliente non può essere ragione sociale di sé stesso.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clients WHERE id = NEW.parent_client_id AND parent_client_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Il cliente principale è a sua volta una ragione sociale di un altro cliente.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clients WHERE parent_client_id = NEW.id) THEN
    RAISE EXCEPTION 'Questo cliente ha già ragioni sociali sotto: non può finire sotto un altro.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_check_parent
  BEFORE INSERT OR UPDATE OF parent_client_id ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.check_client_parent();

CREATE OR REPLACE FUNCTION public.merge_clients(p_source_id text, p_target_id text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_source public.clients%ROWTYPE;
  v_target public.clients%ROWTYPE;
  v_total_revenue numeric;
  v_moved jsonb;
  v_count integer;
BEGIN
  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'Scegli due clienti diversi da unire.';
  END IF;
  SELECT * INTO v_source FROM public.clients WHERE id = p_source_id FOR UPDATE;
  SELECT * INTO v_target FROM public.clients WHERE id = p_target_id FOR UPDATE;
  IF v_source.id IS NULL OR v_target.id IS NULL THEN
    RAISE EXCEPTION 'Cliente non trovato: forse è già stato unito.';
  END IF;

  v_total_revenue := v_target.rev_2023 + v_source.rev_2023 + v_target.rev_2024 + v_source.rev_2024
    + v_target.rev_2025 + v_source.rev_2025 + v_target.rev_2026 + v_source.rev_2026;

  -- Dati anagrafici: il principale tiene i suoi, eredita ciò che gli manca e somma fatturato e contatti.
  UPDATE public.clients
  SET
    contacts = COALESCE(v_target.contacts, '[]'::jsonb) || COALESCE(v_source.contacts, '[]'::jsonb),
    product_offers = (
      SELECT COALESCE(jsonb_agg(DISTINCT offer), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(v_target.product_offers, '[]'::jsonb) || COALESCE(v_source.product_offers, '[]'::jsonb)) AS offer
    ),
    rev_2023 = v_target.rev_2023 + v_source.rev_2023,
    rev_2024 = v_target.rev_2024 + v_source.rev_2024,
    rev_2025 = v_target.rev_2025 + v_source.rev_2025,
    rev_2026 = v_target.rev_2026 + v_source.rev_2026,
    client_origin = CASE WHEN COALESCE(v_target.client_origin, '') = '' THEN v_source.client_origin ELSE v_target.client_origin END,
    email = CASE WHEN COALESCE(v_target.email, '') = '' THEN v_source.email ELSE v_target.email END,
    description = CASE
      WHEN COALESCE(BTRIM(v_source.description), '') = '' THEN v_target.description
      WHEN COALESCE(BTRIM(v_target.description), '') = '' THEN v_source.description
      ELSE v_target.description || E'\n\n[Da ' || v_source.name || '] ' || v_source.description
    END,
    is_cold_client = v_total_revenue <= 0 AND v_target.is_cold_client,
    relationship = CASE
      WHEN v_total_revenue > 0 AND v_target.relationship = 'Freddo' THEN 'Nuovo Cliente'
      ELSE v_target.relationship
    END,
    updated_at = now()
  WHERE id = p_target_id;

  v_moved := '{}'::jsonb;

  UPDATE public.client_actions SET client_id = p_target_id WHERE client_id = p_source_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('azioni', v_count);

  UPDATE public.client_tasks SET client_id = p_target_id WHERE client_id = p_source_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('task', v_count);

  UPDATE public.ideas SET client_id = p_target_id WHERE client_id = p_source_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('idee', v_count);

  UPDATE public.creative_proposals SET client_id = p_target_id WHERE client_id = p_source_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('proposte_creative', v_count);

  UPDATE public.special_discounts SET client_id = p_target_id WHERE client_id = p_source_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('sconti', v_count);

  UPDATE public.okr_records SET client_id = p_target_id, client_name = v_target.name WHERE client_id = p_source_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('okr', v_count);

  -- Campagne: si sposta solo ciò che non è già presente sul principale (stessa campagna e contatto).
  UPDATE public.commercial_funnel_entries AS entry
  SET client_id = p_target_id
  WHERE entry.client_id = p_source_id
    AND NOT EXISTS (
      SELECT 1 FROM public.commercial_funnel_entries AS existing
      WHERE existing.client_id = p_target_id
        AND existing.campaign_id = entry.campaign_id
        AND existing.contact_id IS NOT DISTINCT FROM entry.contact_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('funnel', v_count);

  UPDATE public.mail_campaign_contacts AS contact
  SET client_id = p_target_id
  WHERE contact.client_id = p_source_id
    AND NOT EXISTS (
      SELECT 1 FROM public.mail_campaign_contacts AS existing
      WHERE existing.client_id = p_target_id
        AND existing.campaign_id = contact.campaign_id
        AND existing.contact_id IS NOT DISTINCT FROM contact.contact_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT; v_moved := v_moved || jsonb_build_object('campagne_mail', v_count);

  -- Ragioni sociali: quelle del vecchio cliente passano al principale. Il nome sbagliato resta
  -- solo come alias nascosto ('merged'), così gli import che lo usano finiscono sul principale.
  UPDATE public.client_aliases SET client_id = p_target_id WHERE client_id = p_source_id;
  IF public.normalize_client_alias_key(v_source.name) <> public.normalize_client_alias_key(v_target.name) THEN
    INSERT INTO public.client_aliases (client_id, alias_name, alias_key, kind)
    VALUES (p_target_id, v_source.name, public.normalize_client_alias_key(v_source.name), 'merged')
    ON CONFLICT (alias_key) DO UPDATE
      SET client_id = EXCLUDED.client_id, alias_name = EXCLUDED.alias_name, kind = 'merged';
  END IF;

  -- Gruppo: le ragioni sociali agganciate al vecchio cliente passano al principale.
  UPDATE public.clients SET parent_client_id = NULL WHERE id = p_target_id AND parent_client_id = p_source_id;
  UPDATE public.clients SET parent_client_id = p_target_id WHERE parent_client_id = p_source_id;

  RETURN jsonb_build_object(
    'principale', v_target.name,
    'unito', v_source.name,
    'spostati', v_moved
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_clients(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_clients(text, text) TO authenticated;
