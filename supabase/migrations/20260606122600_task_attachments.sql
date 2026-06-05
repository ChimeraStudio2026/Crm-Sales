alter table public.ideas
  add column if not exists attachments jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "task_attachments_select" on storage.objects;
drop policy if exists "task_attachments_insert" on storage.objects;
drop policy if exists "task_attachments_update" on storage.objects;
drop policy if exists "task_attachments_delete" on storage.objects;

create policy "task_attachments_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-attachments');

create policy "task_attachments_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-attachments');

create policy "task_attachments_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'task-attachments')
  with check (bucket_id = 'task-attachments');

create policy "task_attachments_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'task-attachments');
