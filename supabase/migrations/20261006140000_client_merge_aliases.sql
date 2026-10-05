-- Duplicati e ragioni sociali.
-- client_aliases: altri nomi (ragioni sociali, vecchi nomi) che appartengono a un cliente.
--   Le sync (Cerbero OKR) e la scheda cliente li usano per attribuire tutto al cliente principale.
-- client_duplicate_dismissals: coppie che l'utente ha segnato come "non sono duplicati".
-- merge_clients(source, target): sposta tutto da source a target e registra il nome di source
--   come ragione sociale di target. L'app elimina poi source (le righe rimaste in conflitto
--   sulle stesse campagne spariscono con lui).

CREATE TABLE IF NOT EXISTS public.client_aliases (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  alias_name text NOT NULL,
  alias_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_aliases_client_id_idx ON public.client_aliases (client_id);

ALTER TABLE public.client_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_client_aliases_select" ON public.client_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_client_aliases_insert" ON public.client_aliases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_client_aliases_update" ON public.client_aliases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_client_aliases_delete" ON public.client_aliases FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.client_duplicate_dismissals (
  pair_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_duplicate_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_client_duplicate_dismissals_select" ON public.client_duplicate_dismissals FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_client_duplicate_dismissals_insert" ON public.client_duplicate_dismissals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_client_duplicate_dismissals_delete" ON public.client_duplicate_dismissals FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.normalize_client_alias_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LOWER(REGEXP_REPLACE(BTRIM(COALESCE(p_name, '')), '\s+', ' ', 'g'));
$$;

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

  -- Ragioni sociali: quelle del vecchio cliente passano al principale, più il suo nome.
  UPDATE public.client_aliases SET client_id = p_target_id WHERE client_id = p_source_id;
  IF public.normalize_client_alias_key(v_source.name) <> public.normalize_client_alias_key(v_target.name) THEN
    INSERT INTO public.client_aliases (client_id, alias_name, alias_key)
    VALUES (p_target_id, v_source.name, public.normalize_client_alias_key(v_source.name))
    ON CONFLICT (alias_key) DO UPDATE SET client_id = EXCLUDED.client_id, alias_name = EXCLUDED.alias_name;
  END IF;

  RETURN jsonb_build_object(
    'principale', v_target.name,
    'unito', v_source.name,
    'spostati', v_moved
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_clients(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_clients(text, text) TO authenticated;
