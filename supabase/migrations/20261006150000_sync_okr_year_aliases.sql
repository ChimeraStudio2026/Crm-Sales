-- sync_okr_year riconosce le ragioni sociali collegate (client_aliases): le righe Cerbero
-- intestate a un'altra ragione sociale dello stesso cliente finiscono sul cliente principale
-- e il fatturato dell'anno si somma su di lui.
-- Contiene un DELETE (sostituzione delle righe OKR dell'anno): va installata dall'SQL Editor di Supabase.

CREATE OR REPLACE FUNCTION public.sync_okr_year(
  p_year integer,
  p_batch_id text,
  p_dry_run boolean DEFAULT true,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_old_count integer;
  v_old_total numeric;
  v_new_count integer;
  v_new_total numeric;
  v_added_clients jsonb;
  v_updated_clients jsonb;
  v_changes jsonb;
  v_unmatched_products integer;
BEGIN
  IF p_year NOT BETWEEN 2023 AND 2026 THEN
    RAISE EXCEPTION 'Anno % non supportato dal CRM (colonne rev_2023..rev_2026).', p_year;
  END IF;
  SELECT jsonb_agg(element ORDER BY staging.chunk, element_index)
  INTO v_rows
  FROM public.okr_sync_staging AS staging
  CROSS JOIN LATERAL jsonb_array_elements(staging.rows) WITH ORDINALITY AS item(element, element_index)
  WHERE staging.batch_id = p_batch_id;
  IF v_rows IS NULL OR jsonb_array_length(v_rows) = 0 THEN
    RAISE EXCEPTION 'Nessuna riga OKR nel batch %: sync annullata.', p_batch_id;
  END IF;

  CREATE TEMP TABLE okr_sync_input ON COMMIT DROP AS
  SELECT
    NULLIF(BTRIM(r.c), '') AS code,
    REGEXP_REPLACE(BTRIM(r.n), '\s+', ' ', 'g') AS client_name,
    ROUND(COALESCE(r.a, 0)) AS amount,
    r.m AS month_number,
    BTRIM(COALESCE(r.o, '')) AS owner,
    BTRIM(COALESCE(r.p, '')) AS project_code,
    r.u AS source_updated_at
  -- Chiavi corte: c codice proposta, n cliente, a importo, m mese, o owner, p progetto, u ultimo aggiornamento.
  FROM jsonb_to_recordset(v_rows) AS r(c text, n text, a numeric, m integer, o text, p text, u timestamptz)
  WHERE COALESCE(BTRIM(r.n), '') <> ''
    AND r.m BETWEEN 1 AND 12;

  -- Prodotto e codice progetto dalla proposta (stessa normalizzazione di normalizeProductType).
  CREATE TEMP TABLE okr_sync_rows ON COMMIT DROP AS
  WITH proposal AS (
    SELECT DISTINCT ON (code) code, nome, categoria
    FROM public.sales_proposals
    WHERE code IS NOT NULL
    ORDER BY code, ultimo_aggiornamento DESC NULLS LAST
  ),
  enriched AS (
    SELECT
      input.*,
      COALESCE(NULLIF(BTRIM(proposal.nome), ''), input.project_code) AS resolved_project_code,
      proposal.code IS NULL AS missing_proposal,
      LOWER(BTRIM(COALESCE(proposal.categoria, ''))) AS category_key
    FROM okr_sync_input AS input
    LEFT JOIN proposal ON proposal.code = input.code
  )
  SELECT
    client_name,
    resolved_project_code AS project_code,
    owner,
    month_number,
    CASE
      WHEN category_key = '' THEN 'Content'
      WHEN category_key LIKE '%big%' OR category_key LIKE '%motion%' OR category_key = 'prod' THEN 'Prod'
      WHEN category_key LIKE '%mini%' THEN 'Mini Prod'
      WHEN category_key LIKE '%event%' THEN 'Evento'
      ELSE 'Content'
    END AS product_type,
    amount,
    source_updated_at,
    missing_proposal
  FROM enriched;

  SELECT COUNT(*) FILTER (WHERE missing_proposal) INTO v_unmatched_products FROM okr_sync_rows;

  -- Cliente CRM corrispondente: prima le ragioni sociali collegate (client_aliases),
  -- poi il nome identico ignorando le maiuscole, come l'import Excel.
  -- Più ragioni sociali dello stesso cliente si sommano sul cliente principale.
  CREATE TEMP TABLE okr_sync_name_map ON COMMIT DROP AS
  WITH imported AS (
    SELECT
      LOWER(client_name) AS name_key,
      MIN(client_name) AS client_name,
      SUM(amount) AS revenue,
      COUNT(*) AS record_count
    FROM okr_sync_rows
    GROUP BY LOWER(client_name)
  )
  SELECT
    imported.*,
    COALESCE(alias.client_id, direct.id) AS client_id
  FROM imported
  LEFT JOIN public.client_aliases AS alias
    ON alias.alias_key = public.normalize_client_alias_key(imported.client_name)
  LEFT JOIN LATERAL (
    SELECT client.id
    FROM public.clients AS client
    WHERE LOWER(BTRIM(client.name)) = imported.name_key
    ORDER BY (client.workspace_id = 'chimera') DESC, client.created_at
    LIMIT 1
  ) AS direct ON true;

  CREATE TEMP TABLE okr_sync_clients ON COMMIT DROP AS
  WITH grouped AS (
    SELECT
      COALESCE(map.client_id, 'new:' || map.name_key) AS group_key,
      map.client_id,
      MIN(map.name_key) AS name_key,
      MIN(map.client_name) AS client_name,
      SUM(map.revenue) AS revenue,
      SUM(map.record_count) AS record_count
    FROM okr_sync_name_map AS map
    GROUP BY 1, 2
  )
  SELECT
    grouped.*,
    matched.name AS crm_name,
    CASE p_year
      WHEN 2023 THEN matched.rev_2023
      WHEN 2024 THEN matched.rev_2024
      WHEN 2025 THEN matched.rev_2025
      ELSE matched.rev_2026
    END AS current_revenue
  FROM grouped
  LEFT JOIN public.clients AS matched ON matched.id = grouped.client_id;

  -- Righe OKR finali, raggruppate come mergeDuplicates dell'export annuale.
  CREATE TEMP TABLE okr_sync_records ON COMMIT DROP AS
  SELECT
    COALESCE(clients.crm_name, MIN(src.client_name)) AS client_name,
    clients.client_id,
    src.product_type,
    SUM(src.amount) AS amount,
    src.month_number,
    MIN(src.project_code) AS project_code,
    MIN(src.owner) AS owner,
    MAX(src.source_updated_at) AS source_updated_at
  FROM okr_sync_rows AS src
  JOIN okr_sync_name_map AS map ON map.name_key = LOWER(src.client_name)
  JOIN okr_sync_clients AS clients ON clients.group_key = COALESCE(map.client_id, 'new:' || map.name_key)
  GROUP BY
    clients.group_key, clients.crm_name, clients.client_id, src.month_number,
    src.product_type, LOWER(src.project_code), LOWER(src.owner);

  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_old_count, v_old_total
  FROM public.okr_records WHERE year = p_year;
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_new_count, v_new_total
  FROM okr_sync_records;

  -- Protezione: un export Cerbero monco non deve azzerare l'anno.
  IF NOT p_force AND v_old_total > 0 AND v_new_total < v_old_total * 0.5 THEN
    RAISE EXCEPTION 'Totale Cerbero % molto inferiore al CRM % per il %: sync annullata (usa p_force se è corretto).',
      v_new_total, v_old_total, p_year;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('cliente', client_name, 'fatturato', revenue) ORDER BY revenue DESC), '[]'::jsonb)
  INTO v_added_clients
  FROM okr_sync_clients WHERE client_id IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('cliente', crm_name, 'prima', current_revenue, 'dopo', revenue) ORDER BY ABS(revenue - current_revenue) DESC), '[]'::jsonb)
  INTO v_updated_clients
  FROM okr_sync_clients
  WHERE client_id IS NOT NULL AND ABS(COALESCE(current_revenue, 0) - revenue) > 0.005;

  -- Differenze per progetto e mese rispetto agli OKR attuali.
  WITH old_rows AS (
    SELECT SPLIT_PART(project_code, ' ', 1) AS code_key, MIN(project_code) AS project_code, month_number, SUM(amount) AS amount
    FROM public.okr_records WHERE year = p_year
    GROUP BY 1, month_number
  ),
  new_rows AS (
    SELECT SPLIT_PART(project_code, ' ', 1) AS code_key, MIN(project_code) AS project_code, month_number, SUM(amount) AS amount
    FROM okr_sync_records
    GROUP BY 1, month_number
  ),
  diff AS (
    SELECT
      COALESCE(new_rows.project_code, old_rows.project_code) AS progetto,
      COALESCE(new_rows.month_number, old_rows.month_number) AS mese,
      COALESCE(old_rows.amount, 0) AS prima,
      COALESCE(new_rows.amount, 0) AS dopo
    FROM old_rows
    FULL JOIN new_rows ON new_rows.code_key = old_rows.code_key AND new_rows.month_number = old_rows.month_number
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(diff) ORDER BY ABS(dopo - prima) DESC), '[]'::jsonb)
  INTO v_changes
  FROM (SELECT * FROM diff WHERE ABS(dopo - prima) > 0.005 ORDER BY ABS(dopo - prima) DESC LIMIT 40) AS diff;

  IF NOT p_dry_run THEN
    -- Clienti nuovi (stessi default dell'import Excel).
    INSERT INTO public.clients (
      id, workspace_id, name, type, owner, relationship, manual_relationship,
      rev_2023, rev_2024, rev_2025, rev_2026,
      action, action_date, description, needs_profile_completion, is_cold_client
    )
    SELECT
      'client-cerbero-' || MD5(name_key),
      'chimera',
      client_name,
      'Cliente Diretto',
      'Jeck Scardy',
      'Nuovo Cliente',
      false,
      CASE WHEN p_year = 2023 THEN revenue ELSE 0 END,
      CASE WHEN p_year = 2024 THEN revenue ELSE 0 END,
      CASE WHEN p_year = 2025 THEN revenue ELSE 0 END,
      CASE WHEN p_year = 2026 THEN revenue ELSE 0 END,
      'Import Cerbero (' || record_count || ' record uniti)',
      DATE '2026-01-01',
      'Cliente creato da sync Cerbero. Completa contatti, azione e note.',
      true,
      false
    FROM okr_sync_clients
    WHERE client_id IS NULL
    ON CONFLICT (id) DO NOTHING;

    UPDATE okr_sync_clients
    SET client_id = 'client-cerbero-' || MD5(name_key), crm_name = client_name
    WHERE client_id IS NULL;

    UPDATE okr_sync_records AS records
    SET client_id = clients.client_id, client_name = clients.crm_name
    FROM okr_sync_clients AS clients
    WHERE records.client_id IS NULL AND LOWER(records.client_name) = LOWER(clients.client_name);

    -- Fatturato dell'anno sui clienti esistenti.
    UPDATE public.clients AS client
    SET
      rev_2023 = CASE WHEN p_year = 2023 THEN sync.revenue ELSE client.rev_2023 END,
      rev_2024 = CASE WHEN p_year = 2024 THEN sync.revenue ELSE client.rev_2024 END,
      rev_2025 = CASE WHEN p_year = 2025 THEN sync.revenue ELSE client.rev_2025 END,
      rev_2026 = CASE WHEN p_year = 2026 THEN sync.revenue ELSE client.rev_2026 END,
      is_cold_client = false,
      relationship = CASE WHEN client.relationship = 'Freddo' THEN 'Nuovo Cliente' ELSE client.relationship END,
      manual_relationship = CASE
        WHEN client.relationship IN ('Da recuperare', 'Eliminato') THEN client.manual_relationship
        ELSE false
      END,
      updated_at = now()
    FROM okr_sync_clients AS sync
    WHERE sync.client_id = client.id
      AND ABS(COALESCE(sync.current_revenue, 0) - sync.revenue) > 0.005;

    -- Sostituzione delle righe OKR dell'anno.
    DELETE FROM public.okr_records WHERE year = p_year;
    INSERT INTO public.okr_records (
      id, client_name, client_id, product_type, amount, month_label, month_number,
      quarter, project_code, owner, year, source_updated_at, imported_at
    )
    SELECT
      'okr-' || p_year || '-c' || LPAD(ROW_NUMBER() OVER (
        ORDER BY month_number, project_code, client_name, product_type, owner
      )::text, 4, '0'),
      client_name,
      client_id,
      product_type,
      amount,
      (ARRAY['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'])[month_number],
      month_number,
      CEIL(month_number / 3.0)::integer,
      project_code,
      owner,
      p_year,
      source_updated_at,
      now()
    FROM okr_sync_records;

    -- Pulizia del batch applicato e di eventuali batch vecchi rimasti a metà.
    DELETE FROM public.okr_sync_staging
    WHERE batch_id = p_batch_id OR created_at < now() - interval '2 days';
  END IF;

  RETURN jsonb_build_object(
    'anno', p_year,
    'batch', p_batch_id,
    'dry_run', p_dry_run,
    'okr_prima', jsonb_build_object('righe', v_old_count, 'totale', v_old_total),
    'okr_dopo', jsonb_build_object('righe', v_new_count, 'totale', v_new_total),
    'proposte_non_trovate', v_unmatched_products,
    'clienti_nuovi', v_added_clients,
    'clienti_aggiornati', v_updated_clients,
    'differenze', v_changes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_okr_year(integer, text, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_okr_year(integer, text, boolean, boolean) FROM anon, authenticated;
