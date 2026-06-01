-- OKR da import Excel + previsioni Analisi
create table if not exists public.okr_records (
    id text primary key,
    client_name text not null,
    client_id text references public.clients(id) on delete set null,
    product_type text not null,
    amount numeric not null default 0,
    month_label text not null default '',
    quarter int not null check (quarter between 0 and 4),
    project_code text not null default '',
    owner text not null default '',
    year int not null default 2026,
    imported_at timestamptz not null default now()
);

create table if not exists public.analysis_forecasts (
    scope text primary key,
    year int not null default 2026,
    total_forecast numeric not null default 0,
    product_forecast_pct jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create index if not exists idx_okr_records_quarter on public.okr_records(year, quarter);
create index if not exists idx_okr_records_product on public.okr_records(product_type);
create index if not exists idx_okr_records_client on public.okr_records(client_id);

alter table public.okr_records enable row level security;
alter table public.analysis_forecasts enable row level security;

drop policy if exists "crm_okr_records_all" on public.okr_records;
create policy "crm_okr_records_all" on public.okr_records
    for all using (true) with check (true);

drop policy if exists "crm_analysis_forecasts_all" on public.analysis_forecasts;
create policy "crm_analysis_forecasts_all" on public.analysis_forecasts
    for all using (true) with check (true);
