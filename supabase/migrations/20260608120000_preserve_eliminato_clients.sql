-- Soft-delete: relationship = 'Eliminato' keeps the row in clients (no hard delete on status change).
-- Lock manual_relationship for Perso/Eliminato so auto-recalc does not overwrite commercial status.

COMMENT ON COLUMN public.clients.relationship IS
  'Client relationship. Eliminato is a soft-delete status: row stays in DB and remains visible in the main list.';

UPDATE public.clients
SET manual_relationship = true
WHERE relationship IN ('Perso', 'Eliminato')
  AND manual_relationship = false;

CREATE INDEX IF NOT EXISTS clients_relationship_idx
  ON public.clients (relationship);
