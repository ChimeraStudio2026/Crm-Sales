-- Require Supabase Auth for all CRM data (shared team workspace)

drop policy if exists "crm_clients_all" on public.clients;
drop policy if exists "crm_ideas_all" on public.ideas;
drop policy if exists "crm_daily_recall_all" on public.daily_recall;
drop policy if exists "crm_okr_records_all" on public.okr_records;
drop policy if exists "crm_analysis_forecasts_all" on public.analysis_forecasts;
drop policy if exists "crm_client_tasks_all" on public.client_tasks;

create policy "crm_clients_select" on public.clients for select to authenticated using (true);
create policy "crm_clients_insert" on public.clients for insert to authenticated with check (true);
create policy "crm_clients_update" on public.clients for update to authenticated using (true) with check (true);
create policy "crm_clients_delete" on public.clients for delete to authenticated using (true);

create policy "crm_ideas_select" on public.ideas for select to authenticated using (true);
create policy "crm_ideas_insert" on public.ideas for insert to authenticated with check (true);
create policy "crm_ideas_update" on public.ideas for update to authenticated using (true) with check (true);
create policy "crm_ideas_delete" on public.ideas for delete to authenticated using (true);

create policy "crm_daily_recall_select" on public.daily_recall for select to authenticated using (true);
create policy "crm_daily_recall_insert" on public.daily_recall for insert to authenticated with check (true);
create policy "crm_daily_recall_update" on public.daily_recall for update to authenticated using (true) with check (true);
create policy "crm_daily_recall_delete" on public.daily_recall for delete to authenticated using (true);

create policy "crm_okr_records_select" on public.okr_records for select to authenticated using (true);
create policy "crm_okr_records_insert" on public.okr_records for insert to authenticated with check (true);
create policy "crm_okr_records_update" on public.okr_records for update to authenticated using (true) with check (true);
create policy "crm_okr_records_delete" on public.okr_records for delete to authenticated using (true);

create policy "crm_analysis_forecasts_select" on public.analysis_forecasts for select to authenticated using (true);
create policy "crm_analysis_forecasts_insert" on public.analysis_forecasts for insert to authenticated with check (true);
create policy "crm_analysis_forecasts_update" on public.analysis_forecasts for update to authenticated using (true) with check (true);
create policy "crm_analysis_forecasts_delete" on public.analysis_forecasts for delete to authenticated using (true);

create policy "crm_client_tasks_select" on public.client_tasks for select to authenticated using (true);
create policy "crm_client_tasks_insert" on public.client_tasks for insert to authenticated with check (true);
create policy "crm_client_tasks_update" on public.client_tasks for update to authenticated using (true) with check (true);
create policy "crm_client_tasks_delete" on public.client_tasks for delete to authenticated using (true);
