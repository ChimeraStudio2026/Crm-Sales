CREATE TABLE IF NOT EXISTS public.commercial_funnel_entries (
  id text PRIMARY KEY,
  client_id text NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  lost_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_funnel_entries_client_id_idx
  ON public.commercial_funnel_entries(client_id);

ALTER TABLE public.commercial_funnel_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_commercial_funnel_entries_select"
  ON public.commercial_funnel_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_commercial_funnel_entries_insert"
  ON public.commercial_funnel_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_commercial_funnel_entries_update"
  ON public.commercial_funnel_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_commercial_funnel_entries_delete"
  ON public.commercial_funnel_entries FOR DELETE TO authenticated USING (true);
