-- CRM Sales — schema iniziale
-- Esegui da Supabase Dashboard → SQL Editor (oppure: supabase db push)

create table if not exists public.clients (
    id text primary key,
    name text not null,
    type text not null default 'Cliente Diretto',
    owner text not null default 'Jeck',
    relationship text not null default 'Nuovo Cliente',
    manual_relationship boolean not null default false,
    rev_2025 numeric not null default 0,
    rev_2026 numeric not null default 0,
    action text not null default '',
    action_date date,
    email text not null default '',
    description text not null default '',
    needs_profile_completion boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ideas (
    id text primary key,
    name text not null,
    category text not null default 'Content',
    client_id text references public.clients(id) on delete set null,
    status text not null default 'Da fare',
    description text not null default '',
    date_added date not null default current_date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.daily_recall (
    recall_date date primary key,
    items jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

create index if not exists idx_clients_relationship on public.clients(relationship);
create index if not exists idx_clients_name on public.clients(name);
create index if not exists idx_ideas_client_id on public.ideas(client_id);
create index if not exists idx_ideas_status on public.ideas(status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
    before update on public.clients
    for each row execute function public.set_updated_at();

drop trigger if exists ideas_set_updated_at on public.ideas;
create trigger ideas_set_updated_at
    before update on public.ideas
    for each row execute function public.set_updated_at();

drop trigger if exists daily_recall_set_updated_at on public.daily_recall;
create trigger daily_recall_set_updated_at
    before update on public.daily_recall
    for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.ideas enable row level security;
alter table public.daily_recall enable row level security;

-- Uso personale / demo: accesso completo con anon key.
-- Per produzione: sostituire con policy basate su auth.uid().
drop policy if exists "crm_clients_all" on public.clients;
create policy "crm_clients_all" on public.clients
    for all using (true) with check (true);

drop policy if exists "crm_ideas_all" on public.ideas;
create policy "crm_ideas_all" on public.ideas
    for all using (true) with check (true);

drop policy if exists "crm_daily_recall_all" on public.daily_recall;
create policy "crm_daily_recall_all" on public.daily_recall
    for all using (true) with check (true);
