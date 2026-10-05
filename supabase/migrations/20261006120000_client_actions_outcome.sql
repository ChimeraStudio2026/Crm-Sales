-- Accounting: un ciclo di azioni su un cliente si chiude con un'azione di chiusura
-- che ne registra l'esito (won / lost). Una nuova azione dopo la chiusura apre un nuovo ciclo.

ALTER TABLE public.client_actions
  ADD COLUMN IF NOT EXISTS outcome text;

ALTER TABLE public.client_actions
  ADD CONSTRAINT client_actions_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('won', 'lost'));
