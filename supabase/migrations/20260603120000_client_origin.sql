-- Origine cliente: chi ha portato il cliente nel CRM
alter table public.clients
  add column if not exists client_origin text not null default '';

alter table public.clients
  drop constraint if exists clients_client_origin_check;

alter table public.clients
  add constraint clients_client_origin_check
  check (client_origin in ('', 'Jeck', 'Inbound', 'Instagram', 'Community', 'Outbound'));

create index if not exists idx_clients_client_origin on public.clients(client_origin);
