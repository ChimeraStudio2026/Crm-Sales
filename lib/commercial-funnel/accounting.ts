import { resolveClientFunnelTrack } from '@/lib/commercial-funnel/track';
import {
  ACCOUNTING_ACTION_TYPE,
  ACCOUNTING_CLOSE_ACTION_TYPE,
  DEFAULT_RED_AFTER_DAYS,
} from '@/lib/types/client-actions';
import type { AccountingOutcome, ClientAction } from '@/lib/types/client-actions';
import type { Client } from '@/lib/types/crm';

export type AccountingSemaforo = 'green' | 'red';

export type AccountingStatus = 'open' | AccountingOutcome;

export interface AccountingRow {
  client: Client;
  status: AccountingStatus;
  /** Ultima azione del ciclo (aperto o appena chiuso). */
  lastAction: ClientAction;
  /** Azioni del ciclo, dalla più recente (esclusa la chiusura). */
  actions: ClientAction[];
  /** Azione di chiusura con l'esito, se il ciclo è chiuso. */
  closure: ClientAction | null;
  /** Cicli già chiusi prima di quello mostrato. */
  previousCycles: number;
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

export function isAccountingClient(client: Client, allClients?: readonly Client[]): boolean {
  return client.relationship !== 'Eliminato' && resolveClientFunnelTrack(client, allClients) === 'warm';
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

function compareByRegistration(left: ClientAction, right: ClientAction): number {
  return left.createdAt.localeCompare(right.createdAt);
}

export function isAccountingClosure(action: ClientAction): boolean {
  return action.actionType === ACCOUNTING_CLOSE_ACTION_TYPE && Boolean(action.outcome);
}

function isAccountingRecord(action: ClientAction): boolean {
  return action.actionType === ACCOUNTING_ACTION_TYPE || isAccountingClosure(action);
}

interface AccountingCycle {
  actions: ClientAction[];
  closure: ClientAction | null;
}

/**
 * Divide le azioni di un cliente in cicli: ogni chiusura (won/lost) chiude tutto ciò che è
 * stato registrato prima; un'azione registrata dopo apre un nuovo ciclo.
 */
function splitIntoCycles(actions: ClientAction[]): AccountingCycle[] {
  const cycles: AccountingCycle[] = [];
  let current: ClientAction[] = [];
  [...actions].sort(compareByRegistration).forEach((action) => {
    if (isAccountingClosure(action)) {
      cycles.push({ actions: current, closure: action });
      current = [];
      return;
    }
    current.push(action);
  });
  if (current.length > 0) cycles.push({ actions: current, closure: null });
  return cycles.filter((cycle) => cycle.actions.length > 0 || cycle.closure);
}

/**
 * Accounting parte vuoto: compaiono solo i clienti su cui qualcuno ha registrato
 * almeno un'azione Accounting (le note della scheda cliente non contano).
 * Ogni riga mostra il ciclo in corso, oppure l'ultimo ciclo chiuso con il suo esito.
 */
export function buildAccountingRows(
  clients: Client[],
  actions: ClientAction[],
  today: string,
): AccountingRow[] {
  const actionsByClient = new Map<string, ClientAction[]>();
  actions.forEach((action) => {
    if (!isAccountingRecord(action)) return;
    const list = actionsByClient.get(action.clientId) || [];
    list.push(action);
    actionsByClient.set(action.clientId, list);
  });
  const rows: AccountingRow[] = [];
  clients.forEach((client) => {
    const cycles = splitIntoCycles(actionsByClient.get(client.id) || []);
    const cycle = cycles[cycles.length - 1];
    if (!cycle) return;
    const cycleActions = [...cycle.actions].sort(compareActionsDesc);
    const lastAction = cycleActions[0] || cycle.closure;
    if (!lastAction) return;
    const base = {
      client,
      lastAction,
      actions: cycleActions,
      closure: cycle.closure,
      previousCycles: cycles.length - 1,
    };
    if (cycle.closure?.outcome) {
      rows.push({ ...base, status: cycle.closure.outcome, semaforo: 'green', dueDate: '', daysToDue: null });
      return;
    }
    rows.push({ ...base, status: 'open', ...resolveAccountingDue(lastAction, today) });
  });
  const statusRank: Record<AccountingStatus, number> = { open: 0, won: 1, lost: 2 };
  return rows.sort((left, right) => {
    if (statusRank[left.status] !== statusRank[right.status]) {
      return statusRank[left.status] - statusRank[right.status];
    }
    if (left.status === 'open' && left.semaforo !== right.semaforo) return left.semaforo === 'red' ? -1 : 1;
    if (left.daysToDue !== null && right.daysToDue !== null && left.daysToDue !== right.daysToDue) {
      return left.daysToDue - right.daysToDue;
    }
    if (left.closure && right.closure) return compareActionsDesc(left.closure, right.closure);
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
