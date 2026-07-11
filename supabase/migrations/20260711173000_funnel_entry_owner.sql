-- Per-lead owner inside funnel campaigns

ALTER TABLE public.commercial_funnel_entries
  ADD COLUMN IF NOT EXISTS owner text NOT NULL DEFAULT '';

UPDATE public.commercial_funnel_entries AS entry
SET owner = COALESCE(clients.owner, '')
FROM public.clients
WHERE clients.id = entry.client_id
  AND entry.owner = '';

CREATE INDEX IF NOT EXISTS commercial_funnel_entries_owner_idx
  ON public.commercial_funnel_entries (owner);
