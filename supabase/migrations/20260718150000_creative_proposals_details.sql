ALTER TABLE public.creative_proposals
  ADD COLUMN IF NOT EXISTS deadline date,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reference text NOT NULL DEFAULT '';
