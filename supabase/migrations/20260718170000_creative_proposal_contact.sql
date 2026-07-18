ALTER TABLE public.creative_proposals
  ADD COLUMN IF NOT EXISTS contact_id text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_creative_proposals_contact
  ON public.creative_proposals(contact_id)
  WHERE contact_id <> '';
