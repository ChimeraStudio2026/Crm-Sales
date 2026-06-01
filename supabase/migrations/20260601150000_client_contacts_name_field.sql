-- Normalizza i contatti jsonb includendo il campo name (Nome)
UPDATE public.clients
SET contacts = (
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', coalesce(elem->>'id', 'contact-' || clients.id || '-' || ordinality),
        'email', coalesce(elem->>'email', ''),
        'name', coalesce(elem->>'name', ''),
        'role', coalesce(elem->>'role', '')
      )
      ORDER BY ordinality
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(clients.contacts) WITH ORDINALITY AS t(elem, ordinality)
)
WHERE jsonb_array_length(contacts) > 0;
