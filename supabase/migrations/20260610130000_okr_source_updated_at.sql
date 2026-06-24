-- OKR source Updated At from Excel export (timeline / day-by-day comparison)

ALTER TABLE public.okr_records
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_okr_records_source_updated_at
  ON public.okr_records (source_updated_at);

CREATE INDEX IF NOT EXISTS idx_okr_records_year_source_updated_at
  ON public.okr_records (year, source_updated_at);
