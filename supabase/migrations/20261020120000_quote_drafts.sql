-- Preventivi creati dal CRM (sezione "Crea preventivo"), nella struttura dei preventivi Cerbero.
-- Le righe, gli output e la chat con l'assistente stanno in jsonb: il preventivo si legge e si salva intero.

CREATE TABLE IF NOT EXISTS public.quote_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL DEFAULT 'chimera'
    REFERENCES public.crm_workspaces(id),
  code text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT 'V1',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'accepted', 'rejected')),
  client_name text NOT NULL DEFAULT '',
  total numeric NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  chat jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_drafts_workspace_updated
  ON public.quote_drafts(workspace_id, updated_at DESC);

ALTER TABLE public.quote_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_quote_drafts_select" ON public.quote_drafts;
DROP POLICY IF EXISTS "crm_quote_drafts_insert" ON public.quote_drafts;
DROP POLICY IF EXISTS "crm_quote_drafts_update" ON public.quote_drafts;
DROP POLICY IF EXISTS "crm_quote_drafts_delete" ON public.quote_drafts;

CREATE POLICY "crm_quote_drafts_select" ON public.quote_drafts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_quote_drafts_insert" ON public.quote_drafts
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "crm_quote_drafts_update" ON public.quote_drafts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "crm_quote_drafts_delete" ON public.quote_drafts
  FOR DELETE TO authenticated USING (true);
