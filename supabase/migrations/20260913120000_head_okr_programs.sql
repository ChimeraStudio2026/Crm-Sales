CREATE TABLE IF NOT EXISTS public.head_okr_programs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES public.crm_workspaces (id),
  head_name text NOT NULL,
  role_title text NOT NULL DEFAULT '',
  sheet_title text NOT NULL DEFAULT '',
  framework_label text NOT NULL DEFAULT '',
  framework_start_date date,
  intro_text text NOT NULL DEFAULT '',
  content jsonb NOT NULL DEFAULT '{"checkpoints":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS head_okr_programs_workspace_head_name_idx
  ON public.head_okr_programs (workspace_id, head_name);

CREATE INDEX IF NOT EXISTS head_okr_programs_workspace_idx
  ON public.head_okr_programs (workspace_id);

ALTER TABLE public.head_okr_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_head_okr_programs_select" ON public.head_okr_programs;
CREATE POLICY "crm_head_okr_programs_select" ON public.head_okr_programs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "crm_head_okr_programs_insert" ON public.head_okr_programs;
CREATE POLICY "crm_head_okr_programs_insert" ON public.head_okr_programs
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "crm_head_okr_programs_update" ON public.head_okr_programs;
CREATE POLICY "crm_head_okr_programs_update" ON public.head_okr_programs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "crm_head_okr_programs_delete" ON public.head_okr_programs;
CREATE POLICY "crm_head_okr_programs_delete" ON public.head_okr_programs
  FOR DELETE TO authenticated USING (true);
