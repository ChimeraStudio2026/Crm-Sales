import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnalysisForecasts,
  AnalysisForecastsByYear,
  ApolloEnrichResult,
  Client,
  ClientContact,
  ClientTask,
  Idea,
  OkrRecord,
  TaskAttachment,
  TaskSubtask,
} from '@/lib/types/crm';
import { ANALYSIS_YEAR } from '@/lib/constants/crm';
import {
  normalizeOwner,
  normalizeOwnerDisplay,
  normalizeOwnerList,
  OWNER_JECK_SCARDY,
} from '@/lib/crm/owners';
import { getDefaultOwnerForWorkspace } from '@/lib/crm/workspace-clients';
import { createDefaultForecasts, createEmptyForecastsByYear, parseOkrMonthNumber } from '@/lib/analysis/index';
import { isClientOrigin } from '@/lib/crm/client-origin';
import { normalizeStoredRelationship } from '@/lib/crm/relationship-rules';
import { resolveClientProductOffers } from '@/lib/crm/product-offers';
import { parseFunctionInvokeError } from '@/lib/supabase/function-errors';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';

interface ClientRow {
  id: string;
  workspace_id: string | null;
  name: string;
  type: string;
  owner: string;
  client_origin: string;
  relationship: string;
  manual_relationship: boolean;
  rev_2023: number;
  rev_2024: number;
  rev_2025: number;
  rev_2026: number;
  rev_2027: number;
  action: string;
  action_date: string | null;
  email: string;
  description: string;
  contacts: ClientContact[] | null;
  product_offers: string[] | null;
  needs_profile_completion: boolean;
  is_cold_client: boolean;
  parent_client_id?: string | null;
}

function normalizeContactsArray(
  contacts: ClientContact[] | null | undefined,
  legacyEmail?: string,
  legacyDescription?: string,
): ClientContact[] {
  if (Array.isArray(contacts) && contacts.length > 0) {
    return contacts.map((contact) => ({
      id: contact.id || `contact-${Date.now()}`,
      email: contact.email || '',
      name: contact.name || '',
      role: contact.role || '',
      phone: contact.phone || '',
    }));
  }
  if (legacyEmail || legacyDescription) {
    return [{
      id: `contact-legacy-${Date.now()}`,
      email: legacyEmail || '',
      name: '',
      role: '',
      phone: '',
    }];
  }
  return [];
}

function normalizeTaskSubtasks(value: unknown): TaskSubtask[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((subtask): subtask is Partial<TaskSubtask> => (
      typeof subtask === 'object' &&
      subtask !== null &&
      typeof subtask.title === 'string'
    ))
    .map((subtask) => ({
      id: subtask.id || `subtask-${Date.now()}`,
      title: subtask.title || '',
      completed: !!subtask.completed,
    }));
}

function normalizeTaskAttachments(value: unknown): TaskAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((attachment): attachment is Partial<TaskAttachment> => (
      typeof attachment === 'object' &&
      attachment !== null &&
      typeof attachment.name === 'string' &&
      typeof attachment.path === 'string'
    ))
    .map((attachment) => ({
      id: attachment.id || `attachment-${Date.now()}`,
      name: attachment.name || 'Documento',
      path: attachment.path || '',
      size: Number(attachment.size) || 0,
      type: attachment.type || 'application/octet-stream',
      uploadedAt: attachment.uploadedAt || new Date().toISOString(),
    }));
}

export const HISTORICAL_REVENUE_MIGRATION_SQL = `ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS rev_2023 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rev_2024 numeric NOT NULL DEFAULT 0;`;

export const SUPABASE_SQL_EDITOR_URL =
  'https://supabase.com/dashboard/project/ftkqrtzovyezlhlabmpn/sql/new';

let historicalRevenueSchemaCache: boolean | null = null;

export async function isHistoricalRevenueSchemaAvailable(db: SupabaseClient): Promise<boolean> {
  if (historicalRevenueSchemaCache !== null) return historicalRevenueSchemaCache;
  const { error } = await db.from('clients').select('rev_2023, rev_2024').limit(1);
  historicalRevenueSchemaCache = !error;
  return historicalRevenueSchemaCache;
}

export function resetHistoricalRevenueSchemaCache(): void {
  historicalRevenueSchemaCache = null;
}

function clientToRow(client: Client, includeHistoricalRevenue: boolean): Record<string, unknown> {
  const normalizedContacts = normalizeContactsArray(
    client.contacts,
    client.email,
    client.description,
  );
  const row: Record<string, unknown> = {
    id: client.id,
    workspace_id: client.workspaceId || DEFAULT_WORKSPACE_ID,
    name: client.name,
    type: client.type || 'Cliente Diretto',
    owner: normalizeOwner(client.owner) || getDefaultOwnerForWorkspace(client.workspaceId),
    client_origin: client.clientOrigin || '',
    relationship: normalizeStoredRelationship(client.relationship || 'Nuovo Cliente'),
    manual_relationship: !!client.manualRelationship,
    rev_2025: Number(client.rev2025) || 0,
    rev_2026: Number(client.rev2026) || 0,
    rev_2027: Number(client.rev2027) || 0,
    action: client.action || '',
    action_date: client.actionDate ? client.actionDate : null,
    email: normalizedContacts[0]?.email || client.email || '',
    description: client.description || '',
    contacts: normalizedContacts,
    product_offers: client.productOffers || [],
    needs_profile_completion: !!client.needsProfileCompletion,
    is_cold_client: !!client.isColdClient,
  };
  if (includeHistoricalRevenue) {
    row.rev_2023 = Number(client.rev2023) || 0;
    row.rev_2024 = Number(client.rev2024) || 0;
  }
  return row;
}

function rowToClient(row: ClientRow): Client {
  const contacts = normalizeContactsArray(row.contacts, row.email, row.description);
  const clientType = row.type as Client['type'];
  return {
    id: row.id,
    workspaceId: row.workspace_id || DEFAULT_WORKSPACE_ID,
    name: row.name,
    type: clientType,
    owner: (normalizeOwner(row.owner) || getDefaultOwnerForWorkspace(row.workspace_id || DEFAULT_WORKSPACE_ID)) as Client['owner'],
    clientOrigin: isClientOrigin(row.client_origin) ? row.client_origin : '',
    relationship: normalizeStoredRelationship(row.relationship || 'Nuovo Cliente'),
    manualRelationship: row.manual_relationship,
    rev2023: Number(row.rev_2023) || 0,
    rev2024: Number(row.rev_2024) || 0,
    rev2025: Number(row.rev_2025) || 0,
    rev2026: Number(row.rev_2026) || 0,
    rev2027: Number(row.rev_2027) || 0,
    action: row.action || '',
    actionDate: row.action_date || '',
    email: contacts[0]?.email || row.email || '',
    description: row.description || '',
    contacts,
    productOffers: resolveClientProductOffers(clientType, row.product_offers),
    needsProfileCompletion: row.needs_profile_completion || false,
    isColdClient: row.is_cold_client === true,
    parentClientId: row.parent_client_id || undefined,
  };
}

/**
 * Mette un cliente sotto un macro cliente (o lo stacca con null). Il database sposta anche
 * le sue ragioni sociali e allinea rapporto e owner al macro.
 * parent_client_id non passa dal salvataggio generale dei clienti: si cambia solo da qui.
 */
export async function setClientMacro(
  db: SupabaseClient,
  clientId: string,
  macroClientId: string | null,
): Promise<void> {
  const { error } = await db.rpc('set_client_macro', { p_client_id: clientId, p_macro_id: macroClientId });
  if (error) throw error;
}

async function removeOrphanRows(
  db: SupabaseClient,
  tableName: string,
  activeIds: string[],
): Promise<void> {
  const { data: existing, error: fetchError } = await db.from(tableName).select('id');
  if (fetchError) throw fetchError;
  const orphanIds = (existing || [])
    .map((row: { id: string }) => row.id)
    .filter((id) => !activeIds.includes(id));
  if (orphanIds.length === 0) return;
  const { error: deleteError } = await db.from(tableName).delete().in('id', orphanIds);
  if (deleteError) throw deleteError;
}

export async function testSupabaseConnection(db: SupabaseClient): Promise<{ ok: boolean; message: string }> {
  const { error } = await db.from('clients').select('id').limit(1);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'Connesso a Supabase' };
}

export async function fetchClients(db: SupabaseClient): Promise<Client[]> {
  const { data, error } = await db.from('clients').select('*').order('name');
  if (error) throw error;
  return (data || []).map((row) => rowToClient(row as ClientRow));
}

export async function fetchIdeas(db: SupabaseClient): Promise<Idea[]> {
  const { data, error } = await db.from('ideas').select('*').order('date_added', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    clientId: row.client_id || '',
    status: row.status,
    description: row.description || '',
    dateAdded: row.date_added || '',
    itemType: row.item_type === 'task' ? 'task' : 'idea',
    dueDate: row.due_date || '',
    assignees: Array.isArray(row.assignees) ? normalizeOwnerList(row.assignees) : [],
    attachments: normalizeTaskAttachments(row.attachments),
    subtasks: normalizeTaskSubtasks(row.subtasks),
  }));
}

export async function persistClients(db: SupabaseClient, allClients: Client[]): Promise<void> {
  if (allClients.length === 0) return;
  const includeHistoricalRevenue = await isHistoricalRevenueSchemaAvailable(db);
  const rows = allClients.map((client) => clientToRow(client, includeHistoricalRevenue));
  const { error: upsertError } = await db.from('clients').upsert(rows, { onConflict: 'id' });
  if (upsertError) throw upsertError;
}

export async function assertClientsHistoricalRevenueSchema(db: SupabaseClient): Promise<void> {
  const available = await isHistoricalRevenueSchemaAvailable(db);
  if (available) return;
  throw new Error(
    `Database non aggiornato per fatturato 2023/2024. Apri SQL Editor Supabase ed esegui:\n${HISTORICAL_REVENUE_MIGRATION_SQL}`,
  );
}

export async function deleteClientRecord(
  db: SupabaseClient,
  clientId: string,
): Promise<void> {
  const { error } = await db.from('clients').delete().eq('id', clientId);
  if (error) throw error;
}

function ideaToRow(idea: Idea): Record<string, unknown> {
  return {
    id: idea.id,
    name: idea.name,
    category: idea.category || 'Content',
    client_id: idea.clientId || null,
    status: idea.status || 'Da fare',
    description: idea.description || '',
    date_added: idea.dateAdded || null,
    item_type: idea.itemType || 'idea',
    due_date: idea.dueDate || null,
    assignees: normalizeOwnerList(idea.assignees || []),
    attachments: idea.attachments || [],
    subtasks: idea.subtasks || [],
  };
}

export async function upsertIdea(db: SupabaseClient, idea: Idea): Promise<void> {
  const { error } = await db.from('ideas').upsert(ideaToRow(idea), { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteIdeaRecord(db: SupabaseClient, ideaId: string): Promise<void> {
  const { error } = await db.from('ideas').delete().eq('id', ideaId);
  if (error) throw error;
}

export async function persistIdeas(db: SupabaseClient, allIdeas: Idea[]): Promise<void> {
  if (allIdeas.length === 0) return;
  const rows = allIdeas.map(ideaToRow);
  const { error: upsertError } = await db.from('ideas').upsert(rows, { onConflict: 'id' });
  if (upsertError) throw upsertError;
}

export async function persistIdeasReplace(db: SupabaseClient, allIdeas: Idea[]): Promise<void> {
  if (allIdeas.length === 0) {
    const { error } = await db.from('ideas').delete().neq('id', '');
    if (error) throw error;
    return;
  }
  const rows = allIdeas.map(ideaToRow);
  const { error: upsertError } = await db.from('ideas').upsert(rows, { onConflict: 'id' });
  if (upsertError) throw upsertError;
  await removeOrphanRows(db, 'ideas', rows.map((row) => row.id as string));
}

export async function fetchClientTasks(db: SupabaseClient): Promise<ClientTask[]> {
  const { data, error } = await db
    .from('client_tasks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    taskType: row.task_type || 'follow-up',
    dueDate: row.due_date || '',
    assignee: normalizeOwner(row.assignee) || OWNER_JECK_SCARDY,
    completed: !!row.completed,
    notes: row.notes || '',
    createdAt: row.created_at || '',
    completedAt: row.completed_at || '',
  }));
}

export async function persistClientTasks(
  db: SupabaseClient,
  tasks: ClientTask[],
): Promise<void> {
  await db.from('client_tasks').delete().neq('id', '');
  if (tasks.length === 0) return;
  const rows = tasks.map((task) => ({
    id: task.id,
    client_id: task.clientId,
    title: task.title,
    task_type: task.taskType || 'follow-up',
    due_date: task.dueDate || null,
    assignee: normalizeOwner(task.assignee) || OWNER_JECK_SCARDY,
    completed: !!task.completed,
    notes: task.notes || '',
    created_at: task.createdAt || new Date().toISOString(),
    completed_at: task.completedAt || null,
  }));
  const { error } = await db.from('client_tasks').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function fetchAllOkrRecords(db: SupabaseClient): Promise<OkrRecord[]> {
  const { data, error } = await db.from('okr_records').select('*').order('year', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => mapOkrRecordRow(row));
}

function mapOkrRecordRow(row: Record<string, unknown>): OkrRecord {
  return {
    id: String(row.id),
    clientName: String(row.client_name),
    clientId: String(row.client_id || ''),
    productType: String(row.product_type),
    amount: Number(row.amount) || 0,
    monthLabel: String(row.month_label || ''),
    monthNumber: Number(row.month_number) || parseOkrMonthNumber(String(row.month_label || '')),
    quarter: Number(row.quarter) || 0,
    projectCode: String(row.project_code || ''),
    owner: normalizeOwnerDisplay(String(row.owner || '')),
    year: Number(row.year) || ANALYSIS_YEAR,
    sourceUpdatedAt: row.source_updated_at ? String(row.source_updated_at) : undefined,
  };
}

export async function fetchOkrRecords(
  db: SupabaseClient,
  year = ANALYSIS_YEAR,
): Promise<OkrRecord[]> {
  const { data, error } = await db.from('okr_records').select('*').eq('year', year);
  if (error) throw error;
  return (data || []).map((row) => mapOkrRecordRow(row));
}

export async function deleteOkrRecordsForYear(
  db: SupabaseClient,
  year: number,
): Promise<void> {
  const { error } = await db.from('okr_records').delete().eq('year', year);
  if (error) throw error;
}

export const HISTORICAL_IMPORT_YEARS = [2023, 2024] as const;

export interface CleanHistoricalYearsResult {
  deletedOkrByYear: Record<number, number>;
  updatedClients: number;
  deletedForecastsByYear: Record<number, number>;
}

export async function cleanHistoricalYearsData(
  db: SupabaseClient,
): Promise<CleanHistoricalYearsResult> {
  const deletedOkrByYear: Record<number, number> = {};
  const deletedForecastsByYear: Record<number, number> = {};

  for (const year of HISTORICAL_IMPORT_YEARS) {
    const { count, error: countError } = await db
      .from('okr_records')
      .select('id', { count: 'exact', head: true })
      .eq('year', year);
    if (countError) throw countError;
    const { error: deleteError } = await db.from('okr_records').delete().eq('year', year);
    if (deleteError) throw deleteError;
    deletedOkrByYear[year] = count ?? 0;
  }

  const { count: clientsToUpdate, error: clientsCountError } = await db
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .or('rev_2023.neq.0,rev_2024.neq.0');
  if (clientsCountError) throw clientsCountError;

  const { error: clientsUpdateError } = await db
    .from('clients')
    .update({ rev_2023: 0, rev_2024: 0 })
    .or('rev_2023.neq.0,rev_2024.neq.0');
  if (clientsUpdateError) throw clientsUpdateError;

  for (const year of HISTORICAL_IMPORT_YEARS) {
    const { count, error: countError } = await db
      .from('analysis_forecasts')
      .select('scope', { count: 'exact', head: true })
      .eq('year', year);
    if (countError) throw countError;
    const { error: deleteError } = await db.from('analysis_forecasts').delete().eq('year', year);
    if (deleteError) throw deleteError;
    deletedForecastsByYear[year] = count ?? 0;
  }

  return {
    deletedOkrByYear,
    updatedClients: clientsToUpdate ?? 0,
    deletedForecastsByYear,
  };
}

export async function upsertOkrRecords(
  db: SupabaseClient,
  records: OkrRecord[],
): Promise<void> {
  if (records.length === 0) return;
  const uniqueRecords = Array.from(
    records.reduce((map, record) => map.set(record.id, record), new Map<string, OkrRecord>()).values(),
  );
  const rows = uniqueRecords.map((record) => ({
    id: record.id,
    client_name: record.clientName,
    client_id: record.clientId || null,
    product_type: record.productType,
    amount: Number(record.amount) || 0,
    month_label: record.monthLabel || '',
    month_number: record.monthNumber || parseOkrMonthNumber(record.monthLabel),
    quarter: Number(record.quarter) || 0,
    project_code: record.projectCode || '',
    owner: normalizeOwnerDisplay(record.owner || ''),
    year: Number(record.year) || ANALYSIS_YEAR,
    source_updated_at: record.sourceUpdatedAt || null,
  }));
  const chunkSize = 200;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const { error } = await db.from('okr_records').upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }
}

export async function persistOkrRecords(
  db: SupabaseClient,
  records: OkrRecord[],
  year = ANALYSIS_YEAR,
): Promise<void> {
  await upsertOkrRecords(db, records);
}

export async function fetchAnalysisForecasts(
  db: SupabaseClient,
  year = ANALYSIS_YEAR,
): Promise<AnalysisForecasts> {
  const all = await fetchAllAnalysisForecasts(db);
  return all[year] ?? createDefaultForecasts();
}

export async function fetchAllAnalysisForecasts(
  db: SupabaseClient,
): Promise<AnalysisForecastsByYear> {
  const { data, error } = await db.from('analysis_forecasts').select('*');
  if (error) throw error;
  const byYear: AnalysisForecastsByYear = createEmptyForecastsByYear();
  (data || []).forEach((row) => {
    const year = Number(row.year) || ANALYSIS_YEAR;
    if (!byYear[year]) {
      byYear[year] = createDefaultForecasts();
    }
    byYear[year][row.scope] = {
      totalForecast: Number(row.total_forecast) || 0,
      productPct: (row.product_forecast_pct as Record<string, number>) || {},
    };
  });
  return byYear;
}

export async function persistAnalysisForecasts(
  db: SupabaseClient,
  forecasts: AnalysisForecasts,
  year = ANALYSIS_YEAR,
): Promise<void> {
  const rows = Object.keys(forecasts).map((scope) => ({
    scope,
    year,
    total_forecast: Number(forecasts[scope].totalForecast) || 0,
    product_forecast_pct: forecasts[scope].productPct || {},
  }));
  if (rows.length === 0) return;
  const { error } = await db.from('analysis_forecasts').upsert(rows, { onConflict: 'scope,year' });
  if (error) throw error;
}

export async function clearAllData(db: SupabaseClient): Promise<void> {
  await db.from('client_tasks').delete().neq('id', '');
  await db.from('ideas').delete().neq('id', '');
  await db.from('clients').delete().neq('id', '');
  await db.from('okr_records').delete().neq('id', '');
  await db.from('analysis_forecasts').delete().neq('scope', '');
  await db.from('daily_recall').delete().neq('recall_date', '1900-01-01');
}

export async function getApolloStatus(
  db: SupabaseClient,
): Promise<{ ok: boolean; configured: boolean; message: string }> {
  try {
    const { data, error } = await db.functions.invoke('apollo-enrich', {
      body: { healthCheck: true },
    });
    if (error) {
      const message = await parseFunctionInvokeError(error);
      return { ok: false, configured: false, message };
    }
    return {
      ok: !!data?.configured,
      configured: !!data?.configured,
      message: data?.configured
        ? 'Apollo configurato'
        : 'APOLLO_API_KEY mancante su Supabase',
    };
  } catch (error) {
    return {
      ok: false,
      configured: false,
      message: error instanceof Error ? error.message : 'Apollo non disponibile',
    };
  }
}

export async function enrichClientWithApollo(
  db: SupabaseClient,
  params: { companyName?: string; email?: string; domain?: string },
): Promise<ApolloEnrichResult> {
  const { data, error } = await db.functions.invoke('apollo-enrich', {
    body: {
      companyName: params.companyName || '',
      email: params.email || '',
      domain: params.domain || '',
    },
  });
  if (error) {
    const message = await parseFunctionInvokeError(error);
    return { ok: false, error: message };
  }
  const result = data as ApolloEnrichResult;
  if (result && result.ok === false && result.error) {
    return { ok: false, error: result.error };
  }
  return result || { ok: false, error: 'Risposta Apollo vuota' };
}
