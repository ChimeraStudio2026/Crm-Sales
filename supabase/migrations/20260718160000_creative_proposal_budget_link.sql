ALTER TABLE public.special_discounts
  ADD COLUMN IF NOT EXISTS creative_proposal_id text
    REFERENCES public.creative_proposals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_special_discounts_creative_proposal
  ON public.special_discounts(creative_proposal_id);
