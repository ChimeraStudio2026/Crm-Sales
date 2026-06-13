-- Pulizia dati storici 2023 e 2024 (eseguire in Supabase SQL Editor)
-- Rimuove OKR, azzera rev_2023/rev_2024 sui clienti, elimina forecast analisi.

BEGIN;

DELETE FROM public.okr_records WHERE year IN (2023, 2024);

UPDATE public.clients
SET rev_2023 = 0, rev_2024 = 0
WHERE rev_2023 <> 0 OR rev_2024 <> 0;

DELETE FROM public.analysis_forecasts WHERE year IN (2023, 2024);

COMMIT;
