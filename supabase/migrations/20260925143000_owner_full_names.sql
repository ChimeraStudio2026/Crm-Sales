-- Canonical CRM owner display names (legacy short names → full names)

CREATE OR REPLACE FUNCTION public.crm_normalize_owner_text(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE trim(coalesce(raw, ''))
    WHEN 'Jeck' THEN 'Jeck Scardy'
    WHEN 'Virgi' THEN 'Virginia Velcich'
    WHEN 'Virginia' THEN 'Virginia Velcich'
    WHEN 'Martina' THEN 'Martina Gavazzi'
    ELSE trim(coalesce(raw, ''))
  END;
$$;

UPDATE public.clients
SET owner = public.crm_normalize_owner_text(owner)
WHERE owner IN ('Jeck', 'Virgi', 'Virginia', 'Martina');

UPDATE public.client_tasks
SET assignee = public.crm_normalize_owner_text(assignee)
WHERE assignee IN ('Jeck', 'Virgi', 'Virginia', 'Martina');

UPDATE public.mail_campaigns
SET owner = public.crm_normalize_owner_text(owner)
WHERE owner IN ('Jeck', 'Virgi', 'Virginia', 'Martina');

UPDATE public.commercial_funnel_entries
SET owner = public.crm_normalize_owner_text(owner)
WHERE owner IN ('Jeck', 'Virgi', 'Virginia', 'Martina');

UPDATE public.okr_records
SET owner = public.crm_normalize_owner_text(owner)
WHERE owner IN ('Jeck', 'Virgi', 'Virginia', 'Martina');

UPDATE public.creative_proposals
SET owner = public.crm_normalize_owner_text(owner)
WHERE owner IN ('Jeck', 'Virgi', 'Virginia', 'Martina');

UPDATE public.special_discounts
SET owner = public.crm_normalize_owner_text(owner)
WHERE owner IN ('Jeck', 'Virgi', 'Virginia', 'Martina');

UPDATE public.ideas
SET assignees = (
  SELECT coalesce(
    jsonb_agg(to_jsonb(public.crm_normalize_owner_text(elem))),
    '[]'::jsonb
  )
  FROM jsonb_array_elements_text(assignees) AS elem
)
WHERE assignees IS NOT NULL
  AND jsonb_typeof(assignees) = 'array'
  AND jsonb_array_length(assignees) > 0
  AND assignees::text ~ '(Jeck|Virgi|Virginia|Martina)';

UPDATE public.mail_campaigns
SET description = replace(description, '<!--crm-campaign-owner:Jeck-->', '<!--crm-campaign-owner:Jeck Scardy-->')
WHERE description LIKE '%<!--crm-campaign-owner:Jeck-->%';

UPDATE public.mail_campaigns
SET description = replace(description, '<!--crm-campaign-owner:Virgi-->', '<!--crm-campaign-owner:Virginia Velcich-->')
WHERE description LIKE '%<!--crm-campaign-owner:Virgi-->%';

UPDATE public.mail_campaigns
SET description = replace(description, '<!--crm-campaign-owner:Martina-->', '<!--crm-campaign-owner:Martina Gavazzi-->')
WHERE description LIKE '%<!--crm-campaign-owner:Martina-->%';

ALTER TABLE public.clients ALTER COLUMN owner SET DEFAULT 'Jeck Scardy';
ALTER TABLE public.client_tasks ALTER COLUMN assignee SET DEFAULT 'Jeck Scardy';

DROP FUNCTION public.crm_normalize_owner_text(text);
