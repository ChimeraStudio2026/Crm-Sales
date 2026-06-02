-- Unify Task & Idee on ideas table

alter table public.ideas
  add column if not exists item_type text not null default 'idea'
  check (item_type in ('idea', 'task'));

alter table public.ideas
  add column if not exists due_date date;

alter table public.ideas
  add column if not exists assignees jsonb not null default '[]'::jsonb;

create index if not exists idx_ideas_item_type on public.ideas(item_type);
create index if not exists idx_ideas_due_date on public.ideas(due_date);

insert into public.ideas (
  id,
  name,
  category,
  client_id,
  status,
  description,
  date_added,
  item_type,
  due_date,
  assignees
)
select
  ct.id,
  ct.title,
  'Content',
  ct.client_id,
  case when ct.completed then 'Fatto' else 'Da fare' end,
  coalesce(nullif(trim(ct.notes), ''), 'Task importata da client_tasks'),
  coalesce(ct.due_date, (ct.created_at at time zone 'utc')::date, current_date),
  'task',
  ct.due_date,
  jsonb_build_array(coalesce(nullif(trim(ct.assignee), ''), 'Jeck'))
from public.client_tasks ct
where not exists (
  select 1 from public.ideas i where i.id = ct.id
)
  and ct.client_id is not null;
