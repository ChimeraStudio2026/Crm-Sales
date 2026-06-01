-- Task per cliente (collegate alla lista clienti CRM)
create table if not exists public.client_tasks (
    id text primary key,
    client_id text not null references public.clients(id) on delete cascade,
    title text not null,
    task_type text not null default 'follow-up',
    due_date date,
    assignee text not null default 'Jeck',
    completed boolean not null default false,
    notes text not null default '',
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

create index if not exists idx_client_tasks_client_id on public.client_tasks(client_id);
create index if not exists idx_client_tasks_due_date on public.client_tasks(due_date);
create index if not exists idx_client_tasks_completed on public.client_tasks(completed);

alter table public.client_tasks enable row level security;

drop policy if exists "crm_client_tasks_all" on public.client_tasks;
create policy "crm_client_tasks_all" on public.client_tasks
    for all using (true) with check (true);
