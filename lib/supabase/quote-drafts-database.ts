import type { SupabaseClient } from '@supabase/supabase-js';
import { computeQuoteTotals } from '@/lib/quotes/calc';
import { createEmptyQuoteDraft } from '@/lib/quotes/draft';
import type { QuoteChatMessage, QuoteDraft, QuoteStatus } from '@/lib/quotes/types';

interface QuoteDraftRow {
  id: string;
  workspace_id: string;
  code: string;
  title: string;
  version: string;
  status: QuoteStatus;
  client_name: string;
  total: number | string;
  data: Partial<QuoteDraft> | null;
  chat: QuoteChatMessage[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteDraftSummary {
  id: string;
  code: string;
  title: string;
  version: string;
  status: QuoteStatus;
  clientName: string;
  total: number;
  createdBy: string;
  updatedAt: string;
}

function rowToQuoteDraft(row: QuoteDraftRow): QuoteDraft {
  const base = createEmptyQuoteDraft(row.created_by);
  return {
    ...base,
    ...(row.data || {}),
    id: row.id,
    code: row.code,
    title: row.title,
    version: row.version,
    status: row.status,
    clientName: row.client_name,
    chat: row.chat || [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchQuoteDraftSummaries(
  db: SupabaseClient,
  workspaceId: string,
): Promise<QuoteDraftSummary[]> {
  const { data, error } = await db
    .from('quote_drafts')
    .select('id, code, title, version, status, client_name, total, created_by, updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    code: row.code || '',
    title: row.title || '',
    version: row.version || 'V1',
    status: row.status as QuoteStatus,
    clientName: row.client_name || '',
    total: Number(row.total) || 0,
    createdBy: row.created_by || '',
    updatedAt: row.updated_at,
  }));
}

export async function fetchQuoteDraft(db: SupabaseClient, id: string): Promise<QuoteDraft | null> {
  const { data, error } = await db.from('quote_drafts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToQuoteDraft(data as QuoteDraftRow) : null;
}

export async function saveQuoteDraft(
  db: SupabaseClient,
  workspaceId: string,
  quote: QuoteDraft,
): Promise<QuoteDraft> {
  const { chat, id, createdAt, updatedAt, ...data } = quote;
  const { data: row, error } = await db
    .from('quote_drafts')
    .upsert({
      id,
      workspace_id: workspaceId,
      code: quote.code,
      title: quote.title,
      version: quote.version,
      status: quote.status,
      client_name: quote.clientName,
      total: computeQuoteTotals(quote).total,
      data,
      chat,
      created_by: quote.createdBy,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToQuoteDraft(row as QuoteDraftRow);
}

export async function deleteQuoteDraft(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('quote_drafts').delete().eq('id', id);
  if (error) throw error;
}
