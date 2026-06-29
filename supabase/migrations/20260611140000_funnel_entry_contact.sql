-- Associate a specific client contact with each commercial funnel entry

ALTER TABLE public.commercial_funnel_entries
  ADD COLUMN IF NOT EXISTS contact_id text NOT NULL DEFAULT '';

UPDATE public.commercial_funnel_entries
SET contact_id = ''
WHERE contact_id IS NULL;

ALTER TABLE public.commercial_funnel_entries
  DROP CONSTRAINT IF EXISTS commercial_funnel_entries_campaign_client_unique;

ALTER TABLE public.commercial_funnel_entries
  ADD CONSTRAINT commercial_funnel_entries_campaign_client_contact_unique
  UNIQUE (campaign_id, client_id, contact_id);

CREATE INDEX IF NOT EXISTS commercial_funnel_entries_contact_id_idx
  ON public.commercial_funnel_entries (contact_id)
  WHERE contact_id <> '';
