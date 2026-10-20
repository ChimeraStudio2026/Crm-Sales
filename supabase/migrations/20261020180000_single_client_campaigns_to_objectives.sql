-- Sales e Account non sono più separati: un obiettivo è su un solo cliente, una campagna su più clienti.
-- Le campagne con un solo cliente diventano obiettivi: stesso titolo, owner e nota, e le azioni del
-- funnel passano nel registro client_actions (così si vedono anche nella scheda cliente).
-- «Convertito» e «Perso» diventano la chiusura dell'obiettivo con esito won / lost.

WITH single_client_campaigns AS (
  SELECT campaign.id AS campaign_id, MIN(entry.id) AS entry_id
  FROM public.mail_campaigns AS campaign
  JOIN public.commercial_funnel_entries AS entry ON entry.campaign_id = campaign.id
  GROUP BY campaign.id
  HAVING COUNT(*) = 1
)
INSERT INTO public.account_objectives (id, workspace_id, funnel_track, title, note, owner, client_ids, created_at)
SELECT
  'objective-from-' || campaign.id,
  campaign.workspace_id,
  campaign.funnel_track,
  BTRIM(campaign.name),
  COALESCE(campaign.description, ''),
  COALESCE(NULLIF(campaign.owner, ''), entry.owner, ''),
  ARRAY[entry.client_id],
  entry.created_at
FROM single_client_campaigns AS single
JOIN public.mail_campaigns AS campaign ON campaign.id = single.campaign_id
JOIN public.commercial_funnel_entries AS entry ON entry.id = single.entry_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.client_actions (
  id, client_id, action_type, action_date, note, author, contact_id, red_after_days, outcome, objective, objective_id
)
SELECT
  'client-action-from-' || entry.id || '-' || slot.position,
  entry.client_id,
  CASE WHEN slot.value ->> 'type' IN ('Convertito', 'Perso') THEN 'Chiusura Accounting' ELSE slot.value ->> 'type' END,
  COALESCE(NULLIF(slot.value ->> 'date', '')::date, entry.created_at::date),
  COALESCE(slot.value ->> 'note', ''),
  COALESCE(entry.owner, ''),
  COALESCE(entry.contact_id, ''),
  CASE WHEN (slot.value ->> 'redAfterDays') IN ('3', '7', '30') THEN (slot.value ->> 'redAfterDays')::int END,
  CASE slot.value ->> 'type' WHEN 'Convertito' THEN 'won' WHEN 'Perso' THEN 'lost' END,
  objective.title,
  objective.id
FROM public.account_objectives AS objective
JOIN public.commercial_funnel_entries AS entry
  ON objective.id = 'objective-from-' || entry.campaign_id
CROSS JOIN LATERAL jsonb_array_elements(entry.actions) WITH ORDINALITY AS slot(value, position)
WHERE COALESCE(slot.value ->> 'type', '') <> ''
ON CONFLICT (id) DO NOTHING;

-- Le campagne convertite non servono più (i loro clienti del funnel vanno via in cascata).
DELETE FROM public.mail_campaigns AS campaign
WHERE EXISTS (SELECT 1 FROM public.account_objectives WHERE id = 'objective-from-' || campaign.id);
