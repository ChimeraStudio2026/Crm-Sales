import { resolveClientFunnelTrack } from '@/lib/commercial-funnel/track';
import {
  ACCOUNTING_CLOSE_ACTION_TYPE,
  DEFAULT_RED_AFTER_DAYS,
} from '@/lib/types/client-actions';
import type { AccountObjective, AccountingOutcome, ClientAction } from '@/lib/types/client-actions';
import type { FunnelTrack } from '@/lib/types/commercial-funnel';
import type { Client } from '@/lib/types/crm';

export type AccountingSemaforo = 'green' | 'red';

export type AccountingStatus = 'open' | AccountingOutcome;

/** Un cliente dentro un obiettivo: solo le azioni fatte per quell'obiettivo. */
export interface AccountingClientRow {
  objective: AccountObjective;
  client: Client;
  status: AccountingStatus;
  /** Ultima azione del ciclo (aperto o appena chiuso); null se sul cliente non c'è ancora un'azione. */
  lastAction: ClientAction | null;
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

export interface AccountingObjectiveRow {
  objective: AccountObjective;
  /** Obiettivo con più clienti: le azioni sono preimpostate per ogni cliente, come una campagna. */
  isGroup: boolean;
  clients: AccountingClientRow[];
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

/** Clienti che si possono mettere in un obiettivo del funnel (caldi in Account, senza fatturato in Sales). */
export function isObjectiveClient(client: Client, track: FunnelTrack, allClients?: readonly Client[]): boolean {
  // Le ragioni sociali non si seguono a parte: si lavora sul loro macro cliente.
  return !client.parentClientId
    && client.relationship !== 'Eliminato'
    && resolveClientFunnelTrack(client, allClients) === track;
}


/** Il semaforo diventa rosso quando passano N giorni dall'ultima azione senza un'azione nuova. */
export function resolveAccountingDue(
  fromDate: string,
  redAfterDays: number | null,
  today: string,
): { dueDate: string; daysToDue: number | null; semaforo: AccountingSemaforo } {
  const actionDay = parseDay(fromDate);
  const todayTime = parseDay(today);
  if (actionDay === null || todayTime === null) return { dueDate: '', daysToDue: null, semaforo: 'green' };
  const dueTime = actionDay + (redAfterDays ?? DEFAULT_RED_AFTER_DAYS) * DAY_MS;
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

const STATUS_RANK: Record<AccountingStatus, number> = { open: 0, won: 1, lost: 2 };

function compareClientUrgency(left: AccountingClientRow, right: AccountingClientRow): number {
  if (STATUS_RANK[left.status] !== STATUS_RANK[right.status]) {
    return STATUS_RANK[left.status] - STATUS_RANK[right.status];
  }
  if (left.status === 'open' && left.semaforo !== right.semaforo) return left.semaforo === 'red' ? -1 : 1;
  if (left.daysToDue !== null && right.daysToDue !== null) return left.daysToDue - right.daysToDue;
  return 0;
}

function compareClientRows(left: AccountingClientRow, right: AccountingClientRow): number {
  return compareClientUrgency(left, right) || left.client.name.localeCompare(right.client.name, 'it');
}

function buildClientRow(
  objective: AccountObjective,
  client: Client,
  actions: ClientAction[],
  today: string,
): AccountingClientRow {
  const cycles = splitIntoCycles(actions);
  const cycle = cycles[cycles.length - 1] || { actions: [], closure: null };
  const cycleActions = [...cycle.actions].sort(compareActionsDesc);
  const lastAction = cycleActions[0] || cycle.closure || null;
  const base = {
    objective,
    client,
    lastAction,
    actions: cycleActions,
    closure: cycle.closure,
    previousCycles: Math.max(cycles.length - 1, 0),
  };
  if (cycle.closure?.outcome) {
    return { ...base, status: cycle.closure.outcome, semaforo: 'green', dueDate: '', daysToDue: null };
  }
  // Senza azioni il semaforo parte dalla creazione dell'obiettivo.
  const due = lastAction
    ? resolveAccountingDue(lastAction.actionDate, lastAction.redAfterDays, today)
    : resolveAccountingDue(objective.createdAt.slice(0, 10), null, today);
  return { ...base, status: 'open', ...due };
}

/**
 * Ogni obiettivo mostra i suoi clienti con le sole azioni registrate per quell'obiettivo
 * (la scheda cliente invece le mostra tutte). Su ogni cliente, una chiusura won/lost chiude
 * il ciclo; un'azione registrata dopo ne apre uno nuovo.
 */
export function buildAccountingObjectiveRows(
  objectives: AccountObjective[],
  clients: Client[],
  actions: ClientAction[],
  today: string,
): AccountingObjectiveRow[] {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const actionsByKey = new Map<string, ClientAction[]>();
  actions.forEach((action) => {
    if (!action.objectiveId) return;
    const key = `${action.objectiveId}|${action.clientId}`;
    const list = actionsByKey.get(key) || [];
    list.push(action);
    actionsByKey.set(key, list);
  });
  const rows = objectives.map((objective) => {
    const clientRows = objective.clientIds
      .map((clientId) => clientById.get(clientId))
      .filter((client): client is Client => Boolean(client))
      .map((client) => buildClientRow(objective, client, actionsByKey.get(`${objective.id}|${client.id}`) || [], today))
      .sort(compareClientRows);
    return { objective, isGroup: objective.clientIds.length > 1, clients: clientRows };
  });
  // L'obiettivo si ordina sul suo cliente più urgente, poi per titolo.
  return rows.sort((left, right) => {
    const leftFirst = left.clients[0];
    const rightFirst = right.clients[0];
    if (leftFirst && rightFirst) {
      const byUrgency = compareClientUrgency(leftFirst, rightFirst);
      if (byUrgency !== 0) return byUrgency;
    } else if (leftFirst || rightFirst) {
      return leftFirst ? -1 : 1;
    }
    return left.objective.title.localeCompare(right.objective.title, 'it');
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
