import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';
import { buildPersistedFunnelEntry, normalizeFunnelActions, normalizeFunnelStage } from '@/lib/commercial-funnel/index';
import type {
  CommercialFunnelEntry,
  FunnelBrandSearchResult,
  FunnelClientSource,
} from '@/lib/types/commercial-funnel';

interface CommercialFunnelEntryRow {
  id: string;
  workspace_id: string | null;
  campaign_id: string;
  client_id: string;
  contact_id: string | null;
  client_source: string | null;
  owner: string | null;
  stage: string | null;
  actions: unknown;
  lost_reason: string;
  created_at: string;
}

function normalizeClientSource(value: string | null | undefined): FunnelClientSource {
  return value === 'main' ? 'main' : 'cold';
}

function rowToEntry(row: CommercialFunnelEntryRow): CommercialFunnelEntry {
  const actions = normalizeFunnelActions(row.actions);
  const lostReason = row.lost_reason || '';
  const entry: CommercialFunnelEntry = {
    id: row.id,
    workspaceId: row.workspace_id || DEFAULT_WORKSPACE_ID,
    campaignId: row.campaign_id,
    clientId: row.client_id,
    contactId: row.contact_id || '',
    clientSource: normalizeClientSource(row.client_source),
    owner: row.owner || '',
    stage: normalizeFunnelStage(row.stage),
    actions,
    lostReason,
    createdAt: row.created_at || '',
  };
  return buildPersistedFunnelEntry(entry);
}

function entryToRow(entry: CommercialFunnelEntry): Record<string, unknown> {
  const persisted = buildPersistedFunnelEntry(entry);
  return {
    id: persisted.id,
    workspace_id: persisted.workspaceId || DEFAULT_WORKSPACE_ID,
    campaign_id: persisted.campaignId,
    client_id: persisted.clientId,
    contact_id: persisted.contactId || '',
    client_source: persisted.clientSource,
    owner: persisted.owner || '',
    stage: persisted.stage,
    actions: persisted.actions,
    lost_reason: persisted.lostReason || '',
    updated_at: new Date().toISOString(),
  };
}

export async function fetchCommercialFunnelEntries(
  db: SupabaseClient,
): Promise<CommercialFunnelEntry[]> {
  const { data, error } = await db
    .from('commercial_funnel_entries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => rowToEntry(row as CommercialFunnelEntryRow));
}

export async function persistCommercialFunnelEntries(
  db: SupabaseClient,
  entries: CommercialFunnelEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map((entry) => entryToRow(entry));
  const { error } = await db.from('commercial_funnel_entries').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function persistSingleCommercialFunnelEntry(
  db: SupabaseClient,
  entry: CommercialFunnelEntry,
): Promise<void> {
  const { error } = await db
    .from('commercial_funnel_entries')
    .upsert(entryToRow(entry), { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteCommercialFunnelEntry(
  db: SupabaseClient,
  entryId: string,
): Promise<void> {
  const { error } = await db.from('commercial_funnel_entries').delete().eq('id', entryId);
  if (error) throw error;
}

export async function deleteCommercialFunnelEntriesByCampaign(
  db: SupabaseClient,
  campaignId: string,
): Promise<void> {
  const { error } = await db.from('commercial_funnel_entries').delete().eq('campaign_id', campaignId);
  if (error) throw error;
}

export async function clearCommercialFunnelData(db: SupabaseClient): Promise<void> {
  await db.from('commercial_funnel_entries').delete().neq('id', '');
}

interface FunnelBrandSearchRow {
  id: string;
  client_id: string;
  campaign_id: string;
  client_source: string | null;
  clients: { name: string } | { name: string }[] | null;
  mail_campaigns: { name: string } | { name: string }[] | null;
}

function resolveJoinedName(
  relation: { name: string } | { name: string }[] | null | undefined,
): string {
  if (!relation) return '';
  if (Array.isArray(relation)) return relation[0]?.name || '';
  return relation.name;
}

export async function searchCommercialFunnelByBrand(
  db: SupabaseClient,
  searchQuery: string,
  workspaceId?: string,
): Promise<FunnelBrandSearchResult[]> {
  const query = searchQuery.trim();
  if (query.length < 2) return [];
  let request = db
    .from('commercial_funnel_entries')
    .select(`
      id,
      client_id,
      campaign_id,
      client_source,
      clients!inner ( name ),
      mail_campaigns!inner ( name )
    `)
    .ilike('clients.name', `%${query}%`);
  if (workspaceId) {
    request = request.eq('workspace_id', workspaceId);
  }
  const { data, error } = await request;
  return (data || []).map((row: FunnelBrandSearchRow) => ({
    entryId: row.id,
    clientId: row.client_id,
    clientName: resolveJoinedName(row.clients),
    campaignId: row.campaign_id,
    campaignName: resolveJoinedName(row.mail_campaigns),
    clientSource: normalizeClientSource(row.client_source),
  }));
}
