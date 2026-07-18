-- Propositività: creatività propositive + sconti ed extra

CREATE TABLE IF NOT EXISTS public.creative_proposals (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES public.crm_workspaces(id),
  title text NOT NULL,
  owner text,
  stage text NOT NULL DEFAULT 'idea_nata'
    CHECK (stage IN (
      'idea_nata',
      'assegnata',
      'in_sviluppo',
      'inviata_cliente',
      'feedback_ricevuto',
      'chiusa_approvata',
      'chiusa_rifiutata'
    )),
  progress_pct int NOT NULL DEFAULT 10,
  born_at timestamptz DEFAULT now(),
  assigned_at timestamptz,
  sent_at timestamptz,
  feedback_at timestamptz,
  client_feedback text,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creative_proposals_client
  ON public.creative_proposals(client_id);

CREATE INDEX IF NOT EXISTS idx_creative_proposals_workspace
  ON public.creative_proposals(workspace_id);

CREATE INDEX IF NOT EXISTS idx_creative_proposals_stage
  ON public.creative_proposals(stage);

CREATE TABLE IF NOT EXISTS public.special_discounts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES public.crm_workspaces(id),
  owner text,
  type text NOT NULL CHECK (type IN ('sconto', 'spesa_extra', 'omaggio')),
  amount numeric NOT NULL,
  reason text,
  date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_special_discounts_client
  ON public.special_discounts(client_id);

CREATE INDEX IF NOT EXISTS idx_special_discounts_workspace
  ON public.special_discounts(workspace_id);

CREATE INDEX IF NOT EXISTS idx_special_discounts_date
  ON public.special_discounts(date DESC);

CREATE OR REPLACE FUNCTION public.sync_creative_proposal_progress()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.progress_pct := CASE NEW.stage
    WHEN 'idea_nata' THEN 10
    WHEN 'assegnata' THEN 25
    WHEN 'in_sviluppo' THEN 50
    WHEN 'inviata_cliente' THEN 75
    WHEN 'feedback_ricevuto' THEN 90
    WHEN 'chiusa_approvata' THEN 100
    WHEN 'chiusa_rifiutata' THEN 100
    ELSE NEW.progress_pct
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creative_proposals_sync_progress ON public.creative_proposals;
CREATE TRIGGER creative_proposals_sync_progress
  BEFORE INSERT OR UPDATE OF stage ON public.creative_proposals
  FOR EACH ROW EXECUTE FUNCTION public.sync_creative_proposal_progress();

DROP TRIGGER IF EXISTS creative_proposals_set_updated_at ON public.creative_proposals;
CREATE TRIGGER creative_proposals_set_updated_at
  BEFORE UPDATE ON public.creative_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS special_discounts_set_updated_at ON public.special_discounts;
CREATE TRIGGER special_discounts_set_updated_at
  BEFORE UPDATE ON public.special_discounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.creative_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_creative_proposals_select"
  ON public.creative_proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_creative_proposals_insert"
  ON public.creative_proposals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_creative_proposals_update"
  ON public.creative_proposals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_creative_proposals_delete"
  ON public.creative_proposals FOR DELETE TO authenticated USING (true);

CREATE POLICY "crm_special_discounts_select"
  ON public.special_discounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_special_discounts_insert"
  ON public.special_discounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_special_discounts_update"
  ON public.special_discounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_special_discounts_delete"
  ON public.special_discounts FOR DELETE TO authenticated USING (true);
