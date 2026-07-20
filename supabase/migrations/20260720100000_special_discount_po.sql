ALTER TABLE public.special_discounts
  ADD COLUMN IF NOT EXISTS po text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_special_discounts_po
  ON public.special_discounts(po)
  WHERE po <> '';
