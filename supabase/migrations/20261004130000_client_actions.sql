-- Registro azioni per cliente (caldo o freddo): ogni scambio rilevante con data e nota.
-- La scheda cliente mostra l'ultima azione, unendo questo registro con le azioni del funnel.

CREATE TABLE IF NOT EXISTS public.client_actions (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action_type text NOT NULL DEFAULT 'Nota',
  action_date date NOT NULL DEFAULT CURRENT_DATE,
  note text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_actions_client_date_idx
  ON public.client_actions (client_id, action_date DESC, created_at DESC);

ALTER TABLE public.client_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_client_actions_select" ON public.client_actions;
CREATE POLICY "crm_client_actions_select"
  ON public.client_actions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_client_actions_insert" ON public.client_actions;
CREATE POLICY "crm_client_actions_insert"
  ON public.client_actions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crm_client_actions_update" ON public.client_actions;
CREATE POLICY "crm_client_actions_update"
  ON public.client_actions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "crm_client_actions_delete" ON public.client_actions;
CREATE POLICY "crm_client_actions_delete"
  ON public.client_actions FOR DELETE TO authenticated USING (true);

-- Porta nel registro le note scritte a mano nel vecchio campo "azione" (esclusi i marcatori di import Excel).
INSERT INTO public.client_actions (id, client_id, action_type, action_date, note)
SELECT
  'client-action-legacy-' || client.id,
  client.id,
  'Nota',
  COALESCE(client.action_date, CURRENT_DATE),
  BTRIM(client.action)
FROM public.clients AS client
WHERE COALESCE(BTRIM(client.action), '') <> ''
  AND client.action NOT ILIKE 'Import Excel%'
ON CONFLICT (id) DO NOTHING;
