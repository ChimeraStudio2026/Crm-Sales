-- Accounting: ogni azione registra il contatto del cliente e dopo quanti giorni
-- senza una nuova azione il semaforo diventa rosso (3, 7 o 30).

ALTER TABLE public.client_actions
  ADD COLUMN IF NOT EXISTS contact_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS red_after_days integer;

ALTER TABLE public.client_actions
  ADD CONSTRAINT client_actions_red_after_days_check
  CHECK (red_after_days IS NULL OR red_after_days IN (3, 7, 30));

CREATE INDEX IF NOT EXISTS client_actions_action_date_idx
  ON public.client_actions (action_date DESC, created_at DESC);
