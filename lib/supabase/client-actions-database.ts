import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClientAction } from '@/lib/types/client-actions';

interface ClientActionRow {
  id: string;
  client_id: string;
  action_type: string;
  action_date: string;
  note: string;
  author: string;
  created_at: string;
}

function rowToClientAction(row: ClientActionRow): ClientAction {
  return {
    id: row.id,
    clientId: row.client_id,
    actionType: row.action_type || 'Nota',
    actionDate: row.action_date || '',
    note: row.note || '',
    author: row.author || '',
    createdAt: row.created_at || '',
  };
}

export async function fetchClientActions(
  db: SupabaseClient,
  clientId: string,
): Promise<ClientAction[]> {
  const { data, error } = await db
    .from('client_actions')
    .select('*')
    .eq('client_id', clientId)
    .order('action_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => rowToClientAction(row as ClientActionRow));
}

export async function insertClientAction(
  db: SupabaseClient,
  action: ClientAction,
): Promise<ClientAction> {
  const { data, error } = await db
    .from('client_actions')
    .insert({
      id: action.id,
      client_id: action.clientId,
      action_type: action.actionType,
      action_date: action.actionDate,
      note: action.note,
      author: action.author,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToClientAction(data as ClientActionRow);
}

export async function deleteClientAction(db: SupabaseClient, actionId: string): Promise<void> {
  const { error } = await db.from('client_actions').delete().eq('id', actionId);
  if (error) throw error;
}
