-- Anno 2027: colonna di fatturato, anno corrente automatico e funzioni che lavorano per anno.
--
-- L'anno corrente (lo stesso di ANALYSIS_YEAR nell'app) segue la data: resta 2026 fino al
-- 31 dicembre e diventa 2027 dal 1° gennaio (fuso Europe/Rome). Il rapporto cliente salvato
-- si ricalcola al cambio d'anno con refresh_client_relationships() (pg_cron, 1° gennaio).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS rev_2027 numeric NOT NULL DEFAULT 0;

-- Ultimo anno con una colonna rev_YYYY: va aggiornato quando si aggiunge il 2028.
CREATE OR REPLACE FUNCTION public.crm_current_year()
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT LEAST(GREATEST(EXTRACT(YEAR FROM now() AT TIME ZONE 'Europe/Rome')::integer, 2023), 2027);
$$;

-- Rapporto automatico dal fatturato rispetto all'anno corrente:
--   Freddo: mai fatturato; Nuovo Cliente: fattura nell'anno corrente (o in uno successivo già
--   registrato) ed è la prima volta; Ricorrente: fattura ora e anche prima; Da recuperare:
--   ha fatturato in passato ma non nell'anno corrente.
CREATE OR REPLACE FUNCTION public.resolve_client_relationship(
  p_rev_2023 numeric, p_rev_2024 numeric, p_rev_2025 numeric, p_rev_2026 numeric, p_rev_2027 numeric,
  p_current_year integer
)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH revs(year, revenue) AS (
    VALUES (2023, p_rev_2023), (2024, p_rev_2024), (2025, p_rev_2025), (2026, p_rev_2026), (2027, p_rev_2027)
  )
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM revs WHERE year >= p_current_year AND COALESCE(revenue, 0) > 0) THEN
      CASE WHEN EXISTS (SELECT 1 FROM revs WHERE year < p_current_year AND COALESCE(revenue, 0) > 0)
        THEN 'Ricorrente' ELSE 'Nuovo Cliente' END
    WHEN EXISTS (SELECT 1 FROM revs WHERE year < p_current_year AND COALESCE(revenue, 0) > 0)
      THEN 'Da recuperare'
    ELSE 'Freddo'
  END;
$$;

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
    COALESCE(SUM(rev_2026), 0) AS rev_2026,
    COALESCE(SUM(rev_2027), 0) AS rev_2027
  INTO v_children
  FROM public.clients
  WHERE parent_client_id = NEW.id AND id <> NEW.id;
  NEW.relationship := public.resolve_client_relationship(
    COALESCE(NEW.rev_2023, 0) + v_children.rev_2023,
    COALESCE(NEW.rev_2024, 0) + v_children.rev_2024,
    COALESCE(NEW.rev_2025, 0) + v_children.rev_2025,
    COALESCE(NEW.rev_2026, 0) + v_children.rev_2026,
    COALESCE(NEW.rev_2027, 0) + v_children.rev_2027,
    public.crm_current_year()
  );
  NEW.manual_relationship := false;
  NEW.is_cold_client := NEW.relationship = 'Freddo';
  RETURN NEW;
END;
$$;

-- La vecchia resolve_client_relationship a 4 argomenti resta ma non è più usata.

CREATE OR REPLACE FUNCTION public.clients_refresh_parent_relationship()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.parent_client_id IS NOT NULL THEN
    UPDATE public.clients SET relationship = relationship WHERE id = OLD.parent_client_id;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.parent_client_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.parent_client_id IS DISTINCT FROM OLD.parent_client_id
      OR NEW.rev_2023 IS DISTINCT FROM OLD.rev_2023 OR NEW.rev_2024 IS DISTINCT FROM OLD.rev_2024
      OR NEW.rev_2025 IS DISTINCT FROM OLD.rev_2025 OR NEW.rev_2026 IS DISTINCT FROM OLD.rev_2026
      OR NEW.rev_2027 IS DISTINCT FROM OLD.rev_2027) THEN
    UPDATE public.clients SET relationship = relationship WHERE id = NEW.parent_client_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER clients_refresh_parent_relationship
  AFTER INSERT OR UPDATE OF parent_client_id, rev_2023, rev_2024, rev_2025, rev_2026, rev_2027 OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_refresh_parent_relationship();

-- Ricalcola il rapporto di tutti i clienti (il trigger lo rifà dal fatturato): al cambio d'anno.
CREATE OR REPLACE FUNCTION public.refresh_client_relationships()
RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  -- Prima i macro clienti e i clienti singoli, poi le ragioni sociali che li seguono.
  UPDATE public.clients SET relationship = relationship WHERE parent_client_id IS NULL AND relationship <> 'Eliminato';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.clients SET relationship = relationship WHERE parent_client_id IS NOT NULL;
  RETURN v_count;
END;
$$;

-- Unione clienti, sync OKR e azzeramento orfani: aggiungono il 2027 alle colonne per anno.
DO $migration$
DECLARE
  v_def text;
  v_old text;
BEGIN
  v_def := pg_get_functiondef('public.merge_clients(text, text)'::regprocedure);
  v_old := v_def;
  v_def := replace(v_def,
    '+ v_target.rev_2025 + v_source.rev_2025 + v_target.rev_2026 + v_source.rev_2026;',
    '+ v_target.rev_2025 + v_source.rev_2025 + v_target.rev_2026 + v_source.rev_2026
    + v_target.rev_2027 + v_source.rev_2027;');
  v_def := replace(v_def,
    'rev_2026 = v_target.rev_2026 + v_source.rev_2026,',
    'rev_2026 = v_target.rev_2026 + v_source.rev_2026,
    rev_2027 = v_target.rev_2027 + v_source.rev_2027,');
  IF v_def = v_old OR position('rev_2027' IN v_def) = 0 THEN
    RAISE EXCEPTION 'merge_clients: definizione inattesa, aggiornamento 2027 non applicato.';
  END IF;
  EXECUTE v_def;

  v_def := pg_get_functiondef('public.sync_okr_year(integer, text, boolean, boolean)'::regprocedure);
  v_old := v_def;
  v_def := replace(v_def, 'p_year NOT BETWEEN 2023 AND 2026', 'p_year NOT BETWEEN 2023 AND 2027');
  v_def := replace(v_def, '(colonne rev_2023..rev_2026)', '(colonne rev_2023..rev_2027)');
  v_def := replace(v_def, 'ELSE matched.rev_2026', 'WHEN 2026 THEN matched.rev_2026
      ELSE matched.rev_2027');
  v_def := replace(v_def, 'rev_2023, rev_2024, rev_2025, rev_2026,', 'rev_2023, rev_2024, rev_2025, rev_2026, rev_2027,');
  v_def := replace(v_def,
    'CASE WHEN p_year = 2026 THEN revenue ELSE 0 END,',
    'CASE WHEN p_year = 2026 THEN revenue ELSE 0 END,
      CASE WHEN p_year = 2027 THEN revenue ELSE 0 END,');
  v_def := replace(v_def, 'DATE ''2026-01-01''', 'make_date(p_year, 1, 1)');
  v_def := replace(v_def,
    'rev_2026 = CASE WHEN p_year = 2026 THEN sync.revenue ELSE client.rev_2026 END,',
    'rev_2026 = CASE WHEN p_year = 2026 THEN sync.revenue ELSE client.rev_2026 END,
      rev_2027 = CASE WHEN p_year = 2027 THEN sync.revenue ELSE client.rev_2027 END,');
  IF v_def = v_old
    OR position('matched.rev_2027' IN v_def) = 0
    OR position('p_year = 2027 THEN revenue' IN v_def) = 0
    OR position('p_year = 2027 THEN sync.revenue' IN v_def) = 0
    OR position('BETWEEN 2023 AND 2027' IN v_def) = 0 THEN
    RAISE EXCEPTION 'sync_okr_year: definizione inattesa, aggiornamento 2027 non applicato.';
  END IF;
  EXECUTE v_def;

  v_def := pg_get_functiondef('public.sync_okr_year_orphans(integer, boolean)'::regprocedure);
  v_old := v_def;
  v_def := replace(v_def, 'p_year NOT BETWEEN 2023 AND 2026', 'p_year NOT BETWEEN 2023 AND 2027');
  v_def := replace(v_def, '(colonne rev_2023..rev_2026)', '(colonne rev_2023..rev_2027)');
  v_def := replace(v_def,
    'rev_2026 = CASE WHEN p_year = 2026 THEN 0 ELSE client.rev_2026 END,',
    'rev_2026 = CASE WHEN p_year = 2026 THEN 0 ELSE client.rev_2026 END,
      rev_2027 = CASE WHEN p_year = 2027 THEN 0 ELSE client.rev_2027 END,');
  -- Solo le CASE p_year (ELSE seguito da a capo), non le righe di aggiornamento.
  v_def := replace(v_def, 'ELSE client.rev_2026' || chr(10),
    'WHEN 2026 THEN client.rev_2026' || chr(10) || '        ELSE client.rev_2027' || chr(10));
  IF v_def = v_old
    OR position('ELSE client.rev_2027' || chr(10) IN v_def) = 0
    OR position('p_year = 2027 THEN 0' IN v_def) = 0 THEN
    RAISE EXCEPTION 'sync_okr_year_orphans: definizione inattesa, aggiornamento 2027 non applicato.';
  END IF;
  EXECUTE v_def;
END;
$migration$;

-- Al cambio d'anno il rapporto salvato va ricalcolato sul nuovo anno corrente.
-- 23:05 UTC del 31/12 = 00:05 del 1° gennaio a Roma; ripetuto alle 6 UTC del 1° gennaio.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('crm-refresh-relationships-new-year', '5 23 31 12 *', 'select public.refresh_client_relationships()');
SELECT cron.schedule('crm-refresh-relationships-new-year-check', '0 6 1 1 *', 'select public.refresh_client_relationships()');
