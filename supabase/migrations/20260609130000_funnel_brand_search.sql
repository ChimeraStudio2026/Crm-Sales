-- Search commercial funnel entries by client brand name

CREATE INDEX IF NOT EXISTS idx_clients_name_lower
  ON public.clients (lower(name));

CREATE OR REPLACE FUNCTION public.search_commercial_funnel_by_brand(search_query text)
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
  ORDER BY c.name ASC, mc.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.search_commercial_funnel_by_brand(text) TO authenticated, anon;
