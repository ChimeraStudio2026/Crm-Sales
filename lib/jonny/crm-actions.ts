import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client, ClientTask, Idea } from '@/lib/types/crm';
import { ANALYSIS_YEAR } from '@/lib/constants/crm';
import { getTodayString } from '@/lib/crm/utils';
import {
  fetchClients,
  fetchIdeas,
} from '@/lib/supabase/database';

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function findClientByQuery(clients: Client[], query: string): Client | undefined {
  const normalizedQuery = normalizeSearch(query);
  return clients.find((client) => normalizeSearch(client.name).includes(normalizedQuery))
    ?? clients.find((client) => normalizeSearch(client.name) === normalizedQuery);
}

export async function getCrmSummary(db: SupabaseClient): Promise<Record<string, unknown>> {
  const clients = await fetchClients(db);
  const activeClients = clients.filter((client) => !client.isColdClient);
  const coldClients = clients.filter((client) => client.isColdClient);
  const totalRev2025 = activeClients.reduce((sum, client) => sum + (client.rev2025 || 0), 0);
  const totalRev2026 = activeClients.reduce((sum, client) => sum + (client.rev2026 || 0), 0);
  const byRelationship = activeClients.reduce<Record<string, number>>((acc, client) => {
    acc[client.relationship] = (acc[client.relationship] || 0) + 1;
    return acc;
  }, {});
  const topByRev2026 = [...activeClients]
    .sort((a, b) => (b.rev2026 || 0) - (a.rev2026 || 0))
    .slice(0, 5)
    .map((client) => ({
      name: client.name,
      rev2026: client.rev2026,
      relationship: client.relationship,
    }));
  return {
    yearCurrent: ANALYSIS_YEAR,
    yearPrevious: ANALYSIS_YEAR - 1,
    totalClients: clients.length,
    activeClients: activeClients.length,
    coldClients: coldClients.length,
    totalRev2025,
    totalRev2026,
    byRelationship,
    topByRev2026,
  };
}

export async function searchClientsAction(
  db: SupabaseClient,
  params: { query?: string; relationship?: string; owner?: string; limit?: number },
): Promise<Record<string, unknown>> {
  const limit = params.limit ?? 15;
  let clients = await fetchClients(db);
  if (params.query) {
    const normalizedQuery = normalizeSearch(params.query);
    clients = clients.filter((client) => normalizeSearch(client.name).includes(normalizedQuery));
  }
  if (params.relationship) {
    clients = clients.filter((client) => client.relationship === params.relationship);
  }
  if (params.owner) {
    clients = clients.filter((client) => client.owner === params.owner);
  }
  return {
    count: clients.length,
    clients: clients.slice(0, limit).map((client) => ({
      id: client.id,
      name: client.name,
      type: client.type,
      owner: client.owner,
      relationship: client.relationship,
      rev2025: client.rev2025,
      rev2026: client.rev2026,
      action: client.action,
      actionDate: client.actionDate,
      isColdClient: client.isColdClient,
    })),
  };
}

export async function getClientDetailsAction(
  db: SupabaseClient,
  params: { clientName: string },
): Promise<Record<string, unknown>> {
  const clients = await fetchClients(db);
  const client = findClientByQuery(clients, params.clientName);
  if (!client) {
    return { found: false, message: `Cliente "${params.clientName}" non trovato.` };
  }
  return {
    found: true,
    client: {
      id: client.id,
      name: client.name,
      type: client.type,
      owner: client.owner,
      relationship: client.relationship,
      rev2025: client.rev2025,
      rev2026: client.rev2026,
      action: client.action,
      actionDate: client.actionDate,
      email: client.email,
      description: client.description,
      contacts: client.contacts,
      productOffers: client.productOffers,
      isColdClient: client.isColdClient,
    },
  };
}

export async function listOpenTasksAction(
  db: SupabaseClient,
  params: { limit?: number },
): Promise<Record<string, unknown>> {
  const limit = params.limit ?? 20;
  const [ideas, clients] = await Promise.all([fetchIdeas(db), fetchClients(db)]);
  const clientNames = new Map(clients.map((client) => [client.id, client.name]));
  const openTasks = ideas
    .filter((idea) => idea.itemType === 'task' && idea.status !== 'Fatto')
    .slice(0, limit)
    .map((idea) => ({
      id: idea.id,
      title: idea.name,
      clientName: clientNames.get(idea.clientId) || '—',
      dueDate: idea.dueDate,
      assignees: idea.assignees,
      status: idea.status,
    }));
  return { count: openTasks.length, tasks: openTasks };
}

export async function listIdeasAction(
  db: SupabaseClient,
  params: { status?: Idea['status']; limit?: number },
): Promise<Record<string, unknown>> {
  const limit = params.limit ?? 20;
  const [ideas, clients] = await Promise.all([fetchIdeas(db), fetchClients(db)]);
  const clientNames = new Map(clients.map((client) => [client.id, client.name]));
  let filtered = ideas;
  if (params.status) {
    filtered = filtered.filter((idea) => idea.status === params.status);
  }
  return {
    count: filtered.length,
    ideas: filtered.slice(0, limit).map((idea) => ({
      id: idea.id,
      name: idea.name,
      status: idea.status,
      category: idea.category,
      itemType: idea.itemType,
      clientName: clientNames.get(idea.clientId) || '—',
      description: idea.description,
      dueDate: idea.dueDate,
      assignees: idea.assignees,
    })),
  };
}

export async function updateClientActionText(
  db: SupabaseClient,
  params: { clientName: string; action: string },
): Promise<Record<string, unknown>> {
  const clients = await fetchClients(db);
  const client = findClientByQuery(clients, params.clientName);
  if (!client) {
    return { ok: false, message: `Cliente "${params.clientName}" non trovato.` };
  }
  const trimmedAction = params.action.trim();
  const today = getTodayString();
  const { error } = await db
    .from('clients')
    .update({
      action: trimmedAction,
      action_date: trimmedAction ? today : null,
    })
    .eq('id', client.id);
  if (error) {
    return { ok: false, message: error.message };
  }
  return {
    ok: true,
    clientName: client.name,
    action: trimmedAction,
    actionDate: trimmedAction ? today : '',
  };
}

export async function createClientTaskAction(
  db: SupabaseClient,
  params: {
    clientName: string;
    title: string;
    taskType?: ClientTask['taskType'];
    dueDate?: string;
    assignee?: ClientTask['assignee'];
    notes?: string;
  },
): Promise<Record<string, unknown>> {
  const clients = await fetchClients(db);
  const client = findClientByQuery(clients, params.clientName);
  if (!client) {
    return { ok: false, message: `Cliente "${params.clientName}" non trovato.` };
  }
  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const assignee = params.assignee || 'Jeck';
  const description = params.notes?.trim()
    || (params.taskType ? `Tipo: ${params.taskType}` : 'Task creata da Jonny');
  const row = {
    id: taskId,
    name: params.title.trim(),
    category: 'Content',
    client_id: client.id,
    status: 'Da fare',
    description,
    date_added: getTodayString(),
    item_type: 'task',
    due_date: params.dueDate || null,
    assignees: [assignee],
  };
  const { error } = await db.from('ideas').upsert(row, { onConflict: 'id' });
  if (error) {
    return { ok: false, message: error.message };
  }
  return {
    ok: true,
    taskId,
    clientName: client.name,
    title: row.name,
  };
}
