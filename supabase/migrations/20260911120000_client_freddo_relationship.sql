-- Allinea rapporto Freddo ai clienti cold già presenti
UPDATE public.clients
SET
  relationship = 'Freddo',
  manual_relationship = true,
  updated_at = now()
WHERE is_cold_client = true
  AND coalesce(relationship, '') NOT IN ('Freddo', 'Eliminato');
