import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAliasKey } from '@/lib/crm/client-duplicates';

/**
 * entity: ragione sociale (solo nome) mostrata nella scheda cliente.
 * merged: nome sbagliato di un cliente unito ed eliminato; nascosto, serve solo agli import.
 */
export type ClientAliasKind = 'entity' | 'merged';

export interface ClientAlias {
  id: string;
  clientId: string;
  aliasName: string;
  kind: ClientAliasKind;
  createdAt: string;
}

interface ClientAliasRow {
  id: string;
  client_id: string;
  alias_name: string;
  kind?: string | null;
  created_at: string;
}

function rowToAlias(row: ClientAliasRow): ClientAlias {
  return {
    id: row.id,
    clientId: row.client_id,
    aliasName: row.alias_name,
    kind: row.kind === 'merged' ? 'merged' : 'entity',
    createdAt: row.created_at || '',
  };
}

export async function fetchClientAliases(
  db: SupabaseClient,
  clientIds?: string | string[],
): Promise<ClientAlias[]> {
  let query = db.from('client_aliases').select('*').order('alias_name');
  if (typeof clientIds === 'string') query = query.eq('client_id', clientIds);
  else if (Array.isArray(clientIds)) query = query.in('client_id', clientIds);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => rowToAlias(row as ClientAliasRow));
}

/** Collega una ragione sociale (solo nome) a un cliente; se era di un altro cliente, passa a questo. */
export async function upsertClientAlias(
  db: SupabaseClient,
  clientId: string,
  aliasName: string,
): Promise<ClientAlias> {
  const { data, error } = await db
    .from('client_aliases')
    .upsert(
      { client_id: clientId, alias_name: aliasName.trim(), alias_key: normalizeAliasKey(aliasName), kind: 'entity' },
      { onConflict: 'alias_key' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return rowToAlias(data as ClientAliasRow);
}

export async function deleteClientAlias(db: SupabaseClient, aliasId: string): Promise<void> {
  const { error } = await db.from('client_aliases').delete().eq('id', aliasId);
  if (error) throw error;
}

export async function fetchDuplicateDismissals(db: SupabaseClient): Promise<string[]> {
  const { data, error } = await db.from('client_duplicate_dismissals').select('pair_key');
  if (error) throw error;
  return (data || []).map((row) => String((row as { pair_key: string }).pair_key));
}

export async function insertDuplicateDismissal(db: SupabaseClient, pairKey: string): Promise<void> {
  const { error } = await db
    .from('client_duplicate_dismissals')
    .upsert({ pair_key: pairKey }, { onConflict: 'pair_key' });
  if (error) throw error;
}

export interface MergeClientsResult {
  principale: string;
  unito: string;
  spostati: Record<string, number>;
}

/**
 * Errore di nome: sposta tutto da source a target (funzione SQL merge_clients), poi source va
 * eliminato. Il nome di source resta solo come alias nascosto per gli import.
 */
export async function mergeClientsRecord(
  db: SupabaseClient,
  sourceId: string,
  targetId: string,
): Promise<MergeClientsResult> {
  const { data, error } = await db.rpc('merge_clients', { p_source_id: sourceId, p_target_id: targetId });
  if (error) throw error;
  return data as MergeClientsResult;
}
