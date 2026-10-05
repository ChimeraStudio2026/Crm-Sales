-- Cerbero è la fonte di verità del fatturato: dopo sync_okr_year, i clienti Chimera che
-- hanno fatturato nell'anno ma nessuna riga OKR (cioè nessuna suddivisione di prezzo in
-- Cerbero) tornano a 0 per quell'anno. Chiamata dalla routine subito dopo la sync.

CREATE OR REPLACE FUNCTION public.sync_okr_year_orphans(
  p_year integer,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_orphans jsonb;
BEGIN
  IF p_year NOT BETWEEN 2023 AND 2026 THEN
    RAISE EXCEPTION 'Anno % non supportato dal CRM (colonne rev_2023..rev_2026).', p_year;
  END IF;
  -- Senza OKR dell'anno la sync non è andata: non azzerare nulla.
  IF NOT EXISTS (SELECT 1 FROM public.okr_records WHERE year = p_year) THEN
    RAISE EXCEPTION 'Nessuna riga OKR per il %: azzeramento annullato.', p_year;
  END IF;

  WITH orphan AS (
    SELECT
      client.id,
      client.name,
      CASE p_year
        WHEN 2023 THEN client.rev_2023
        WHEN 2024 THEN client.rev_2024
        WHEN 2025 THEN client.rev_2025
        ELSE client.rev_2026
      END AS revenue
    FROM public.clients AS client
    WHERE client.workspace_id = 'chimera'
      AND NOT EXISTS (
        SELECT 1 FROM public.okr_records AS record
        WHERE record.year = p_year AND record.client_id = client.id
      )
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('cliente', name, 'prima', revenue) ORDER BY revenue DESC), '[]'::jsonb)
  INTO v_orphans
  FROM orphan
  WHERE revenue <> 0;

  IF NOT p_dry_run THEN
    UPDATE public.clients AS client
    SET
      rev_2023 = CASE WHEN p_year = 2023 THEN 0 ELSE client.rev_2023 END,
      rev_2024 = CASE WHEN p_year = 2024 THEN 0 ELSE client.rev_2024 END,
      rev_2025 = CASE WHEN p_year = 2025 THEN 0 ELSE client.rev_2025 END,
      rev_2026 = CASE WHEN p_year = 2026 THEN 0 ELSE client.rev_2026 END,
      updated_at = now()
    WHERE client.workspace_id = 'chimera'
      AND CASE p_year
        WHEN 2023 THEN client.rev_2023
        WHEN 2024 THEN client.rev_2024
        WHEN 2025 THEN client.rev_2025
        ELSE client.rev_2026
      END <> 0
      AND NOT EXISTS (
        SELECT 1 FROM public.okr_records AS record
        WHERE record.year = p_year AND record.client_id = client.id
      );
  END IF;

  RETURN jsonb_build_object('anno', p_year, 'dry_run', p_dry_run, 'azzerati', v_orphans);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_okr_year_orphans(integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_okr_year_orphans(integer, boolean) FROM anon, authenticated;
