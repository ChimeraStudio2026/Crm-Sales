import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeFunnelActions } from '@/lib/commercial-funnel/index';
import type { CommercialFunnelEntry, FunnelClientSource } from '@/lib/types/commercial-funnel';

interface CommercialFunnelEntryRow {
  id: string;
  campaign_id: string;
  client_id: string;
  client_source: string | null;
  actions: unknown;
  lost_reason: string;
  created_at: string;
}

function normalizeClientSource(value: string | null | undefined): FunnelClientSource {
  return value === 'main' ? 'main' : 'cold';
}

function rowToEntry(row: CommercialFunnelEntryRow): CommercialFunnelEntry {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    clientId: row.client_id,
    clientSource: normalizeClientSource(row.client_source),
    actions: normalizeFunnelActions(row.actions),
    lostReason: row.lost_reason || '',
    createdAt: row.created_at || '',
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
  const rows = entries.map((entry) => ({
    id: entry.id,
    campaign_id: entry.campaignId,
    client_id: entry.clientId,
    client_source: entry.clientSource,
    actions: entry.actions,
    lost_reason: entry.lostReason || '',
    updated_at: new Date().toISOString(),
  }));
  const { error } = await db.from('commercial_funnel_entries').upsert(rows, { onConflict: 'id' });
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
