import { resolveClientFunnelTrack } from '@/lib/commercial-funnel/track';
import { DEFAULT_RED_AFTER_DAYS } from '@/lib/types/client-actions';
import type { ClientAction } from '@/lib/types/client-actions';
import type { Client } from '@/lib/types/crm';

export type AccountingSemaforo = 'green' | 'red' | 'none';

export interface AccountingRow {
  client: Client;
  lastAction: ClientAction | null;
  actions: ClientAction[];
  semaforo: AccountingSemaforo;
  dueDate: string;
  /** Giorni alla scadenza (negativi se già scaduta). */
  daysToDue: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(value: string): number | null {
  const time = new Date(`${value.slice(0, 10)}T00:00:00`).getTime();
  return Number.isNaN(time) ? null : time;
}

function formatDay(time: number): string {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isAccountingClient(client: Client): boolean {
  return client.relationship !== 'Eliminato' && resolveClientFunnelTrack(client) === 'warm';
}

/** Il semaforo diventa rosso quando passano N giorni dall'ultima azione senza un'azione nuova. */
export function resolveAccountingDue(
  action: ClientAction,
  today: string,
): { dueDate: string; daysToDue: number | null; semaforo: AccountingSemaforo } {
  const actionDay = parseDay(action.actionDate);
  const todayTime = parseDay(today);
  if (actionDay === null || todayTime === null) return { dueDate: '', daysToDue: null, semaforo: 'green' };
  const dueTime = actionDay + (action.redAfterDays ?? DEFAULT_RED_AFTER_DAYS) * DAY_MS;
  const daysToDue = Math.round((dueTime - todayTime) / DAY_MS);
  return { dueDate: formatDay(dueTime), daysToDue, semaforo: daysToDue < 0 ? 'red' : 'green' };
}

function compareActionsDesc(left: ClientAction, right: ClientAction): number {
  return `${right.actionDate}|${right.createdAt}`.localeCompare(`${left.actionDate}|${left.createdAt}`);
}

export function buildAccountingRows(
  clients: Client[],
  actions: ClientAction[],
  today: string,
): AccountingRow[] {
  const actionsByClient = new Map<string, ClientAction[]>();
  actions.forEach((action) => {
    const list = actionsByClient.get(action.clientId) || [];
    list.push(action);
    actionsByClient.set(action.clientId, list);
  });
  const rank: Record<AccountingSemaforo, number> = { red: 0, green: 1, none: 2 };
  return clients
    .filter(isAccountingClient)
    .map((client) => {
      const clientActions = (actionsByClient.get(client.id) || []).sort(compareActionsDesc);
      const lastAction = clientActions[0] || null;
      if (!lastAction) {
        return { client, lastAction, actions: clientActions, semaforo: 'none' as const, dueDate: '', daysToDue: null };
      }
      return { client, lastAction, actions: clientActions, ...resolveAccountingDue(lastAction, today) };
    })
    .sort((left, right) => {
      if (rank[left.semaforo] !== rank[right.semaforo]) return rank[left.semaforo] - rank[right.semaforo];
      if (left.daysToDue !== null && right.daysToDue !== null && left.daysToDue !== right.daysToDue) {
        return left.daysToDue - right.daysToDue;
      }
      return left.client.name.localeCompare(right.client.name, 'it');
    });
}

export function formatDaysToDue(daysToDue: number | null): string {
  if (daysToDue === null) return '';
  if (daysToDue < 0) {
    const late = Math.abs(daysToDue);
    return `In ritardo di ${late} ${late === 1 ? 'giorno' : 'giorni'}`;
  }
  if (daysToDue === 0) return 'Scade oggi';
  return `Rosso tra ${daysToDue} ${daysToDue === 1 ? 'giorno' : 'giorni'}`;
}
