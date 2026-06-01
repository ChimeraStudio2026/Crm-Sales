-- Clienti freddi (Sezione 5)
alter table public.clients
    add column if not exists is_cold_client boolean not null default false;

create index if not exists idx_clients_is_cold_client on public.clients(is_cold_client);
