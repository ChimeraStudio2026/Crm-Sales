-- Replace deprecated Perso relationship with Da recuperare

UPDATE public.clients
SET
  relationship = 'Da recuperare',
  manual_relationship = true
WHERE relationship = 'Perso';
