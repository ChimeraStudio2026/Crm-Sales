-- Contatti multipli per cliente (email, ruolo, note)
alter table public.clients
    add column if not exists contacts jsonb not null default '[]'::jsonb;

-- Migra email e descrittivo legacy nel primo contatto
update public.clients
set contacts = jsonb_build_array(
    jsonb_build_object(
        'id', 'contact-' || id,
        'email', coalesce(email, ''),
        'role', '',
        'description', coalesce(description, '')
    )
)
where contacts = '[]'::jsonb
  and (coalesce(email, '') <> '' or coalesce(description, '') <> '');
