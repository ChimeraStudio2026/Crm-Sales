-- Funnel separati: clienti freddi (new business) e clienti caldi (hanno fatturato almeno 1€).
-- Il tipo di campagna non si sceglie: lo determina la sezione in cui la campagna viene creata.

ALTER TABLE public.mail_campaigns
  ADD COLUMN IF NOT EXISTS funnel_track text NOT NULL DEFAULT 'cold';

ALTER TABLE public.mail_campaigns
  DROP CONSTRAINT IF EXISTS mail_campaigns_funnel_track_check;

ALTER TABLE public.mail_campaigns
  ADD CONSTRAINT mail_campaigns_funnel_track_check
  CHECK (funnel_track IN ('cold', 'warm'));

CREATE INDEX IF NOT EXISTS mail_campaigns_funnel_track_idx
  ON public.mail_campaigns (funnel_track);

-- Backfill: una campagna esistente è "calda" se la maggioranza dei suoi clienti ha fatturato > 0.
WITH campaign_mix AS (
  SELECT
    entry.campaign_id,
    COUNT(*) FILTER (
      WHERE COALESCE(client.rev_2023, 0) + COALESCE(client.rev_2024, 0)
        + COALESCE(client.rev_2025, 0) + COALESCE(client.rev_2026, 0) > 0
    ) AS warm_count,
    COUNT(*) AS total_count
  FROM public.commercial_funnel_entries AS entry
  JOIN public.clients AS client ON client.id = entry.client_id
  GROUP BY entry.campaign_id
)
UPDATE public.mail_campaigns AS campaign
SET funnel_track = 'warm'
FROM campaign_mix AS mix
WHERE mix.campaign_id = campaign.id
  AND mix.warm_count * 2 > mix.total_count;
