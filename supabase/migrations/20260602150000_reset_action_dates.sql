-- Baseline action dates: 2026-01-01 for clients with action text, null otherwise.
UPDATE clients
SET action_date = '2026-01-01'
WHERE action IS NOT NULL AND btrim(action) <> '';

UPDATE clients
SET action_date = NULL
WHERE action IS NULL OR btrim(action) = '';
