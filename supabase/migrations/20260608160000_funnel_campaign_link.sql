-- Link funnel entries to mail campaigns (unified funnel campaigns)

ALTER TABLE public.commercial_funnel_entries
  ADD COLUMN IF NOT EXISTS campaign_id text REFERENCES public.mail_campaigns(id) ON DELETE CASCADE;

INSERT INTO public.mail_campaigns (id, name, description, status)
SELECT
  'funnel-legacy-default',
  'Funnel Generale',
  'Campagna creata automaticamente per i clienti funnel esistenti.',
  'Attiva'
WHERE EXISTS (
  SELECT 1 FROM public.commercial_funnel_entries WHERE campaign_id IS NULL
)
AND NOT EXISTS (
  SELECT 1 FROM public.mail_campaigns WHERE id = 'funnel-legacy-default'
);

UPDATE public.commercial_funnel_entries
SET campaign_id = 'funnel-legacy-default'
WHERE campaign_id IS NULL
  AND EXISTS (SELECT 1 FROM public.mail_campaigns WHERE id = 'funnel-legacy-default');

ALTER TABLE public.commercial_funnel_entries
  DROP CONSTRAINT IF EXISTS commercial_funnel_entries_client_id_key;

ALTER TABLE public.commercial_funnel_entries
  DROP CONSTRAINT IF EXISTS commercial_funnel_entries_campaign_client_unique;

ALTER TABLE public.commercial_funnel_entries
  ADD CONSTRAINT commercial_funnel_entries_campaign_client_unique
  UNIQUE (campaign_id, client_id);

CREATE INDEX IF NOT EXISTS commercial_funnel_entries_campaign_id_idx
  ON public.commercial_funnel_entries(campaign_id);
