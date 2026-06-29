-- Separate cold contacts and commercial funnel per company workspace

CREATE TABLE IF NOT EXISTS public.crm_workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.crm_workspaces (id, name)
VALUES
  ('chimera', 'Chimera Studios'),
  ('icib', 'Icib')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'chimera'
    REFERENCES public.crm_workspaces (id);

ALTER TABLE public.mail_campaigns
  ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'chimera'
    REFERENCES public.crm_workspaces (id);

ALTER TABLE public.commercial_funnel_entries
  ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'chimera'
    REFERENCES public.crm_workspaces (id);

UPDATE public.clients
SET workspace_id = 'chimera'
WHERE workspace_id IS NULL OR workspace_id = '';

UPDATE public.mail_campaigns
SET workspace_id = 'chimera'
WHERE workspace_id IS NULL OR workspace_id = '';

UPDATE public.commercial_funnel_entries
SET workspace_id = 'chimera'
WHERE workspace_id IS NULL OR workspace_id = '';

UPDATE public.commercial_funnel_entries AS entry
SET workspace_id = campaign.workspace_id
FROM public.mail_campaigns AS campaign
WHERE entry.campaign_id = campaign.id
  AND entry.workspace_id <> campaign.workspace_id;

CREATE INDEX IF NOT EXISTS idx_clients_workspace_cold
  ON public.clients (workspace_id)
  WHERE is_cold_client = true;

CREATE INDEX IF NOT EXISTS idx_mail_campaigns_workspace
  ON public.mail_campaigns (workspace_id);

CREATE INDEX IF NOT EXISTS idx_commercial_funnel_entries_workspace
  ON public.commercial_funnel_entries (workspace_id);

CREATE INDEX IF NOT EXISTS idx_commercial_funnel_entries_workspace_campaign
  ON public.commercial_funnel_entries (workspace_id, campaign_id);

DROP FUNCTION IF EXISTS public.search_commercial_funnel_by_brand(text);

CREATE OR REPLACE FUNCTION public.search_commercial_funnel_by_brand(
  search_query text,
  filter_workspace_id text DEFAULT NULL
)
RETURNS TABLE (
  entry_id text,
  client_id text,
  client_name text,
  campaign_id text,
  campaign_name text,
  client_source text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    e.id,
    e.client_id,
    c.name,
    e.campaign_id,
    mc.name,
    COALESCE(e.client_source, 'cold')
  FROM public.commercial_funnel_entries e
  INNER JOIN public.clients c ON c.id = e.client_id
  INNER JOIN public.mail_campaigns mc ON mc.id = e.campaign_id
  WHERE length(trim(search_query)) >= 2
    AND c.name ILIKE '%' || trim(search_query) || '%'
    AND (
      filter_workspace_id IS NULL
      OR filter_workspace_id = ''
      OR e.workspace_id = filter_workspace_id
    )
  ORDER BY c.name ASC, mc.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.search_commercial_funnel_by_brand(text, text) TO authenticated, anon;

ALTER TABLE public.crm_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_workspaces_select" ON public.crm_workspaces;
CREATE POLICY "crm_workspaces_select" ON public.crm_workspaces
  FOR SELECT TO authenticated USING (true);
