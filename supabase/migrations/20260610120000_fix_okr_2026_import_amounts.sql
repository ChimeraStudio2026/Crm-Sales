-- Fix OKR 2026 amounts imported with SheetJS EU CSV bug (4100,00 stored as 410000).
-- Applies only when the year total is clearly inflated (> 3M EUR).

DO $$
DECLARE
  year_total numeric;
  fixed_rows integer;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO year_total
  FROM public.okr_records
  WHERE year = 2026;

  IF year_total <= 3000000 THEN
    RAISE NOTICE 'OKR 2026 total % — skip centesimi fix (not inflated).', year_total;
    RETURN;
  END IF;

  UPDATE public.okr_records
  SET amount = ROUND(amount / 100, 2)
  WHERE year = 2026
    AND amount >= 1000
    AND MOD(amount::numeric, 100) = 0;

  GET DIAGNOSTICS fixed_rows = ROW_COUNT;
  RAISE NOTICE 'OKR 2026: corrected % rows (total before %).', fixed_rows, year_total;

  UPDATE public.clients AS c
  SET rev_2026 = COALESCE(agg.total, 0)
  FROM (
    SELECT
      o.client_id,
      SUM(o.amount) AS total
    FROM public.okr_records AS o
    WHERE o.year = 2026
      AND o.client_id IS NOT NULL
    GROUP BY o.client_id
  ) AS agg
  WHERE c.id = agg.client_id;

  UPDATE public.clients AS c
  SET rev_2026 = name_agg.total
  FROM (
    SELECT
      lower(trim(o.client_name)) AS name_key,
      SUM(o.amount) AS total
    FROM public.okr_records AS o
    WHERE o.year = 2026
    GROUP BY lower(trim(o.client_name))
  ) AS name_agg
  WHERE lower(trim(c.name)) = name_agg.name_key
    AND NOT EXISTS (
      SELECT 1
      FROM public.okr_records AS linked
      WHERE linked.year = 2026
        AND linked.client_id = c.id
    );
END $$;
