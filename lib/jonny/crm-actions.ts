import type { Client, ClientTask, Idea } from '@/lib/types/crm';
import { ANALYSIS_YEAR } from '@/lib/constants/crm';
import { getTodayString } from '@/lib/crm/utils';
import type { CrmDataCache } from '@/lib/jonny/crm-data-cache';

const DEFAULT_SEARCH_LIMIT = 8;
const DEFAULT_LIST_LIMIT = 10;

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function findClientByQuery(clients: Client[], query: string): Client | undefined {
  const normalizedQuery = normalizeSearch(query);
  return clients.find((client) => normalizeSearch(client.name).includes(normalizedQuery))
    ?? clients.find((client) => normalizeSearch(client.name) === normalizedQuery);
}

function formatEuro(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export async function getCrmSummary(cache: CrmDataCache): Promise<Record<string, unknown>> {
  const clients = await cache.getClients();
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
      owner: client.owner,
      relationship: client.relationship,
    }));
  return {
    yearCurrent: ANALYSIS_YEAR,
    yearPrevious: ANALYSIS_YEAR - 1,
    totalClients: clients.length,
    activeClients: activeClients.length,
    coldClients: coldClients.length,
    totalRev2025: formatEuro(totalRev2025),
    totalRev2026: formatEuro(totalRev2026),
    byRelationship,
    topByRev2026,
  };
}

export async function searchClientsAction(
  cache: CrmDataCache,
  params: { query?: string; relationship?: string; owner?: string; limit?: number },
): Promise<Record<string, unknown>> {
  const limit = Math.min(params.limit ?? DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_LIMIT);
  let clients = await cache.getClients();
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
  const total = clients.length;
  return {
    count: total,
    truncated: total > limit,
    clients: clients.slice(0, limit).map((client) => ({
      name: client.name,
      owner: client.owner,
      relationship: client.relationship,
      rev2025: client.rev2025,
      rev2026: client.rev2026,
      action: client.action || null,
      actionDate: client.actionDate || null,
    })),
  };
}

export async function getClientDetailsAction(
  cache: CrmDataCache,
  params: { clientName: string },
): Promise<Record<string, unknown>> {
  const clients = await cache.getClients();
  const client = findClientByQuery(clients, params.clientName);
  if (!client) {
    return { found: false, message: `Cliente "${params.clientName}" non trovato.` };
  }
  return {
    found: true,
    client: {
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
  cache: CrmDataCache,
  params: { limit?: number; assignee?: string },
): Promise<Record<string, unknown>> {
  const limit = Math.min(params.limit ?? DEFAULT_LIST_LIMIT, DEFAULT_LIST_LIMIT);
  const [ideas, clients] = await Promise.all([cache.getIdeas(), cache.getClients()]);
  const clientNames = new Map(clients.map((client) => [client.id, client.name]));
  let openTasks = ideas.filter((idea) => idea.itemType === 'task' && idea.status !== 'Fatto');
  if (params.assignee) {
    openTasks = openTasks.filter((idea) => idea.assignees.includes(params.assignee as ClientTask['assignee']));
  }
  const total = openTasks.length;
  return {
    count: total,
    truncated: total > limit,
    tasks: openTasks.slice(0, limit).map((idea) => ({
      title: idea.name,
      clientName: clientNames.get(idea.clientId) || '—',
      dueDate: idea.dueDate || null,
      assignees: idea.assignees,
      status: idea.status,
    })),
  };
}

export async function listIdeasAction(
  cache: CrmDataCache,
  params: { status?: Idea['status']; limit?: number },
): Promise<Record<string, unknown>> {
  const limit = Math.min(params.limit ?? DEFAULT_LIST_LIMIT, DEFAULT_LIST_LIMIT);
  const [ideas, clients] = await Promise.all([cache.getIdeas(), cache.getClients()]);
  const clientNames = new Map(clients.map((client) => [client.id, client.name]));
  let filtered = ideas.filter((idea) => idea.itemType === 'idea');
  if (params.status) {
    filtered = filtered.filter((idea) => idea.status === params.status);
  }
  const total = filtered.length;
  return {
    count: total,
    truncated: total > limit,
    ideas: filtered.slice(0, limit).map((idea) => ({
      name: idea.name,
      status: idea.status,
      category: idea.category,
      clientName: clientNames.get(idea.clientId) || '—',
    })),
  };
}

export async function updateClientActionText(
  cache: CrmDataCache,
  params: { clientName: string; action: string },
): Promise<Record<string, unknown>> {
  const clients = await cache.getClients();
  const client = findClientByQuery(clients, params.clientName);
  if (!client) {
    return { ok: false, message: `Cliente "${params.clientName}" non trovato.` };
  }
  const trimmedAction = params.action.trim();
  const today = getTodayString();
  const { error } = await cache.db
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
  cache: CrmDataCache,
  params: {
    clientName: string;
    title: string;
    taskType?: ClientTask['taskType'];
    dueDate?: string;
    assignee?: ClientTask['assignee'];
    notes?: string;
  },
): Promise<Record<string, unknown>> {
  const clients = await cache.getClients();
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
  const { error } = await cache.db.from('ideas').upsert(row, { onConflict: 'id' });
  if (error) {
    return { ok: false, message: error.message };
  }
  return {
    ok: true,
    clientName: client.name,
    title: row.name,
    assignee,
  };
}
