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
  RecallItem,
} from '@/lib/types/crm';
import { ANALYSIS_YEAR, PREVIOUS_ANALYSIS_YEAR } from '@/lib/constants/crm';
import { createDefaultForecasts, parseOkrMonthNumber } from '@/lib/analysis/index';
import { resolveClientProductOffers } from '@/lib/crm/product-offers';
import { parseFunctionInvokeError } from '@/lib/supabase/function-errors';

interface ClientRow {
  id: string;
  name: string;
  type: string;
  owner: string;
  relationship: string;
  manual_relationship: boolean;
  rev_2025: number;
  rev_2026: number;
  action: string;
  action_date: string | null;
  email: string;
  description: string;
  contacts: ClientContact[] | null;
  product_offers: string[] | null;
  needs_profile_completion: boolean;
  is_cold_client: boolean;
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
    }));
  }
  if (legacyEmail || legacyDescription) {
    return [{
      id: `contact-legacy-${Date.now()}`,
      email: legacyEmail || '',
      name: '',
      role: '',
    }];
  }
  return [];
}

function clientToRow(client: Client): ClientRow {
  const normalizedContacts = normalizeContactsArray(
    client.contacts,
    client.email,
    client.description,
  );
  return {
    id: client.id,
    name: client.name,
    type: client.type || 'Cliente Diretto',
    owner: client.owner || 'Jeck',
    relationship: client.relationship || 'Nuovo Cliente',
    manual_relationship: !!client.manualRelationship,
    rev_2025: Number(client.rev2025) || 0,
    rev_2026: Number(client.rev2026) || 0,
    action: client.action || '',
    action_date: client.actionDate ? client.actionDate : null,
    email: normalizedContacts[0]?.email || client.email || '',
    description: client.description || '',
    contacts: normalizedContacts,
    product_offers: client.productOffers || [],
    needs_profile_completion: !!client.needsProfileCompletion,
    is_cold_client: !!client.isColdClient,
  };
}

function rowToClient(row: ClientRow): Client {
  const contacts = normalizeContactsArray(row.contacts, row.email, row.description);
  const clientType = row.type as Client['type'];
  return {
    id: row.id,
    name: row.name,
    type: clientType,
    owner: row.owner as Client['owner'],
    relationship: row.relationship as Client['relationship'],
    manualRelationship: row.manual_relationship,
    rev2025: Number(row.rev_2025) || 0,
    rev2026: Number(row.rev_2026) || 0,
    action: row.action || '',
    actionDate: row.action_date || '',
    email: contacts[0]?.email || row.email || '',
    description: row.description || '',
    contacts,
    productOffers: resolveClientProductOffers(clientType, row.product_offers),
    needsProfileCompletion: row.needs_profile_completion || false,
    isColdClient: row.is_cold_client === true,
  };
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
    assignees: Array.isArray(row.assignees)
      ? row.assignees.filter((value: unknown): value is Idea['assignees'][number] =>
        value === 'Jeck' || value === 'Virgi')
      : [],
  }));
}

export async function persistClients(db: SupabaseClient, allClients: Client[]): Promise<void> {
  const rows = allClients.map(clientToRow);
  if (rows.length === 0) {
    const { error } = await db.from('clients').delete().neq('id', '');
    if (error) throw error;
    return;
  }
  const { error: upsertError } = await db.from('clients').upsert(rows, { onConflict: 'id' });
  if (upsertError) throw upsertError;
  await removeOrphanRows(db, 'clients', rows.map((r) => r.id));
}

export async function persistIdeas(db: SupabaseClient, allIdeas: Idea[]): Promise<void> {
  const rows = allIdeas.map((idea) => ({
    id: idea.id,
    name: idea.name,
    category: idea.category || 'Content',
    client_id: idea.clientId || null,
    status: idea.status || 'Da fare',
    description: idea.description || '',
    date_added: idea.dateAdded || null,
    item_type: idea.itemType || 'idea',
    due_date: idea.dueDate || null,
    assignees: idea.assignees || [],
  }));
  if (rows.length === 0) {
    const { error } = await db.from('ideas').delete().neq('id', '');
    if (error) throw error;
    return;
  }
  const { error: upsertError } = await db.from('ideas').upsert(rows, { onConflict: 'id' });
  if (upsertError) throw upsertError;
  await removeOrphanRows(db, 'ideas', rows.map((r) => r.id));
}

export async function fetchDailyRecall(
  db: SupabaseClient,
  recallDate: string,
): Promise<RecallItem[] | null> {
  const { data, error } = await db
    .from('daily_recall')
    .select('items')
    .eq('recall_date', recallDate)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.items as RecallItem[]) : null;
}

export async function saveDailyRecall(
  db: SupabaseClient,
  recallDate: string,
  items: RecallItem[],
): Promise<void> {
  const { error } = await db.from('daily_recall').upsert(
    { recall_date: recallDate, items },
    { onConflict: 'recall_date' },
  );
  if (error) throw error;
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
    assignee: row.assignee || 'Jeck',
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
    assignee: task.assignee || 'Jeck',
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
  return (data || []).map((row) => ({
    id: row.id,
    clientName: row.client_name,
    clientId: row.client_id || '',
    productType: row.product_type,
    amount: Number(row.amount) || 0,
    monthLabel: row.month_label || '',
    monthNumber: Number(row.month_number) || parseOkrMonthNumber(row.month_label),
    quarter: Number(row.quarter) || 0,
    projectCode: row.project_code || '',
    owner: row.owner || '',
    year: Number(row.year) || ANALYSIS_YEAR,
  }));
}

export async function fetchOkrRecords(
  db: SupabaseClient,
  year = ANALYSIS_YEAR,
): Promise<OkrRecord[]> {
  const { data, error } = await db.from('okr_records').select('*').eq('year', year);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    clientName: row.client_name,
    clientId: row.client_id || '',
    productType: row.product_type,
    amount: Number(row.amount) || 0,
    monthLabel: row.month_label || '',
    monthNumber: Number(row.month_number) || parseOkrMonthNumber(row.month_label),
    quarter: Number(row.quarter) || 0,
    projectCode: row.project_code || '',
    owner: row.owner || '',
    year: Number(row.year) || ANALYSIS_YEAR,
  }));
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
    owner: record.owner || '',
    year: Number(record.year) || ANALYSIS_YEAR,
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
  const byYear: AnalysisForecastsByYear = {
    [PREVIOUS_ANALYSIS_YEAR]: createDefaultForecasts(),
    [ANALYSIS_YEAR]: createDefaultForecasts(),
  };
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
