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
  contact_id: string | null;
  red_after_days: number | null;
  outcome: string | null;
  objective: string | null;
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
    contactId: row.contact_id || '',
    redAfterDays: row.red_after_days ?? null,
    outcome: row.outcome === 'won' || row.outcome === 'lost' ? row.outcome : null,
    objective: row.objective || '',
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

/** Tutte le azioni dei clienti, dalla più recente: alimentano la vista Accounting. */
export async function fetchAllClientActions(db: SupabaseClient): Promise<ClientAction[]> {
  const { data, error } = await db
    .from('client_actions')
    .select('*')
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
      contact_id: action.contactId,
      red_after_days: action.redAfterDays,
      outcome: action.outcome,
      objective: action.objective?.trim() || null,
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

/** Cambia l'owner (autore) di un gruppo di azioni, es. tutte quelle di un ciclo Accounting. */
export async function updateClientActionsAuthor(
  db: SupabaseClient,
  actionIds: string[],
  author: string,
): Promise<void> {
  if (actionIds.length === 0) return;
  const { error } = await db.from('client_actions').update({ author }).in('id', actionIds);
  if (error) throw error;
}
