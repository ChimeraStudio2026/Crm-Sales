-- Commercial quote/proposal requests imported from monthly CSV dumps.
-- Distinct from public.creative_proposals (creative production tracking).

CREATE TABLE IF NOT EXISTS public.sales_proposals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text,
  nome text NOT NULL,
  stato text,
  ultimo_prezzo numeric,
  descrizione text,
  categoria text,
  cliente text,
  motivo_rifiuto text,
  data_rifiuto timestamptz,
  data_accettazione timestamptz,
  ultimo_aggiornamento timestamptz,
  creato_il timestamptz NOT NULL,
  contattato_da text,
  tipo text,
  budget_finale numeric,
  workspace_id text NOT NULL DEFAULT 'chimera'
    REFERENCES public.crm_workspaces(id),
  import_batch date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome, creato_il)
);

CREATE INDEX IF NOT EXISTS idx_sales_proposals_categoria
  ON public.sales_proposals(categoria);

CREATE INDEX IF NOT EXISTS idx_sales_proposals_cliente
  ON public.sales_proposals(cliente);

CREATE INDEX IF NOT EXISTS idx_sales_proposals_stato
  ON public.sales_proposals(stato);

CREATE INDEX IF NOT EXISTS idx_sales_proposals_creato_il
  ON public.sales_proposals(creato_il);

CREATE INDEX IF NOT EXISTS idx_sales_proposals_workspace
  ON public.sales_proposals(workspace_id);

ALTER TABLE public.sales_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_sales_proposals_select" ON public.sales_proposals;
DROP POLICY IF EXISTS "crm_sales_proposals_insert" ON public.sales_proposals;
DROP POLICY IF EXISTS "crm_sales_proposals_update" ON public.sales_proposals;
DROP POLICY IF EXISTS "crm_sales_proposals_delete" ON public.sales_proposals;

CREATE POLICY "crm_sales_proposals_select" ON public.sales_proposals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_sales_proposals_insert" ON public.sales_proposals
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "crm_sales_proposals_update" ON public.sales_proposals
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "crm_sales_proposals_delete" ON public.sales_proposals
  FOR DELETE TO authenticated USING (true);
