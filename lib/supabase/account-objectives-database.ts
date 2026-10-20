import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountObjective } from '@/lib/types/client-actions';

interface AccountObjectiveRow {
  id: string;
  workspace_id: string;
  funnel_track: string | null;
  title: string;
  note: string | null;
  owner: string | null;
  client_ids: string[] | null;
  created_at: string;
}

function rowToObjective(row: AccountObjectiveRow): AccountObjective {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    // Gli obiettivi nati prima di Sales sono tutti di Account.
    track: row.funnel_track === 'cold' ? 'cold' : 'warm',
    title: row.title || '',
    note: row.note || '',
    owner: row.owner || '',
    clientIds: Array.isArray(row.client_ids) ? row.client_ids : [],
    createdAt: row.created_at || '',
  };
}

export async function fetchAccountObjectives(
  db: SupabaseClient,
  workspaceId: string,
): Promise<AccountObjective[]> {
  const { data, error } = await db
    .from('account_objectives')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => rowToObjective(row as AccountObjectiveRow));
}

export async function insertAccountObjective(
  db: SupabaseClient,
  objective: AccountObjective,
): Promise<AccountObjective> {
  const { data, error } = await db
    .from('account_objectives')
    .insert({
      id: objective.id,
      workspace_id: objective.workspaceId,
      funnel_track: objective.track,
      title: objective.title,
      note: objective.note,
      owner: objective.owner,
      client_ids: objective.clientIds,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToObjective(data as AccountObjectiveRow);
}

export async function updateAccountObjective(
  db: SupabaseClient,
  objectiveId: string,
  patch: Partial<Pick<AccountObjective, 'title' | 'note' | 'owner' | 'clientIds'>>,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.note !== undefined) update.note = patch.note;
  if (patch.owner !== undefined) update.owner = patch.owner;
  if (patch.clientIds !== undefined) update.client_ids = patch.clientIds;
  const { error } = await db.from('account_objectives').update(update).eq('id', objectiveId);
  if (error) throw error;
  // Il titolo è copiato sulle azioni: la scheda cliente lo mostra accanto a ogni azione.
  if (patch.title !== undefined) {
    const { error: actionsError } = await db
      .from('client_actions')
      .update({ objective: patch.title })
      .eq('objective_id', objectiveId);
    if (actionsError) throw actionsError;
  }
}

export async function deleteAccountObjective(db: SupabaseClient, objectiveId: string): Promise<void> {
  const { error } = await db.from('account_objectives').delete().eq('id', objectiveId);
  if (error) throw error;
}
