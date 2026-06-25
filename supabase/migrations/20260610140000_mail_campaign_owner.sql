-- Owner profile for mail / funnel campaigns

ALTER TABLE public.mail_campaigns
  ADD COLUMN IF NOT EXISTS owner text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS mail_campaigns_owner_idx
  ON public.mail_campaigns (owner);
