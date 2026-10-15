-- Obiettivi Account: ogni obiettivo raccoglie uno o più clienti e le azioni fatte per raggiungerlo.
-- Le azioni restano nel registro client_actions (visibili tutte nella scheda cliente) con objective_id.

CREATE TABLE IF NOT EXISTS public.account_objectives (
  id text PRIMARY KEY,
  workspace_id text NOT NULL DEFAULT 'chimera',
  title text NOT NULL,
  note text NOT NULL DEFAULT '',
  owner text NOT NULL DEFAULT '',
  client_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_account_objectives_select"
  ON public.account_objectives FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_account_objectives_insert"
  ON public.account_objectives FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_account_objectives_update"
  ON public.account_objectives FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_account_objectives_delete"
  ON public.account_objectives FOR DELETE TO authenticated USING (true);

ALTER TABLE public.client_actions
  ADD COLUMN IF NOT EXISTS objective_id text REFERENCES public.account_objectives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS client_actions_objective_idx ON public.client_actions (objective_id);

-- Le azioni Accounting già registrate diventano un obiettivo per cliente: il titolo è l'ultimo
-- obiettivo scritto sulle azioni, l'owner chi ha registrato l'ultima azione.
INSERT INTO public.account_objectives (id, workspace_id, title, owner, client_ids, created_at)
SELECT
  'objective-legacy-' || action.client_id,
  COALESCE(MAX(client.workspace_id), 'chimera'),
  COALESCE(
    (ARRAY_AGG(NULLIF(BTRIM(action.objective), '') ORDER BY action.created_at DESC)
      FILTER (WHERE NULLIF(BTRIM(action.objective), '') IS NOT NULL))[1],
    'Obiettivo da definire'
  ),
  COALESCE(
    (ARRAY_AGG(action.author ORDER BY action.created_at DESC)
      FILTER (WHERE action.action_type = 'Accounting' AND action.author <> ''))[1],
    ''
  ),
  ARRAY[action.client_id],
  MIN(action.created_at)
FROM public.client_actions AS action
LEFT JOIN public.clients AS client ON client.id = action.client_id
WHERE action.action_type IN ('Accounting', 'Chiusura Accounting')
  AND action.objective_id IS NULL
GROUP BY action.client_id
ON CONFLICT (id) DO NOTHING;

UPDATE public.client_actions AS action
SET objective_id = 'objective-legacy-' || action.client_id
WHERE action.action_type IN ('Accounting', 'Chiusura Accounting')
  AND action.objective_id IS NULL
  AND EXISTS (SELECT 1 FROM public.account_objectives WHERE id = 'objective-legacy-' || action.client_id);
