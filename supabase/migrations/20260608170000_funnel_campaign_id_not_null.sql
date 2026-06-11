-- Enforce campaign_id on funnel entries (all entries belong to a campaign)

UPDATE public.commercial_funnel_entries
SET campaign_id = 'funnel-legacy-default'
WHERE campaign_id IS NULL
  AND EXISTS (SELECT 1 FROM public.mail_campaigns WHERE id = 'funnel-legacy-default');

ALTER TABLE public.commercial_funnel_entries
  ALTER COLUMN campaign_id SET NOT NULL;
