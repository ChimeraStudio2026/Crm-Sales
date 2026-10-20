-- Obiettivi anche in Sales: ogni obiettivo appartiene a un funnel.
-- 'warm' = Account (clienti che hanno fatturato), 'cold' = Sales (new business).
-- Gli obiettivi esistenti sono tutti di Account.

ALTER TABLE public.account_objectives
  ADD COLUMN IF NOT EXISTS funnel_track text NOT NULL DEFAULT 'warm';

ALTER TABLE public.account_objectives
  DROP CONSTRAINT IF EXISTS account_objectives_funnel_track_check;

ALTER TABLE public.account_objectives
  ADD CONSTRAINT account_objectives_funnel_track_check CHECK (funnel_track IN ('cold', 'warm'));
