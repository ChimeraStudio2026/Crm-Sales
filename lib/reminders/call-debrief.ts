import { REVENUE_YEARS } from '@/lib/constants/crm';
import { getClientRevenue } from '@/lib/crm/revenue';
import {
  DAY_MS,
  addDays,
  dayTime,
  getClientGroup,
  getClientGroupKeys,
  normalizeClientKey,
  toDay,
} from '@/lib/reminders/shared';
import { PROPOSAL_STATUS_ACCEPTED } from '@/lib/types/sales-proposals';
import type { SalesProposal } from '@/lib/types/sales-proposals';
import type { Client } from '@/lib/types/crm';

/** Giorni dopo la prima proposta accettata in cui ricordare la call di presentazione. */
export const CALL_DEBRIEF_DELAY_DAYS = 7;

/** Oltre questa finestra un cliente non è più «nuovo»: il reminder non compare più. */
export const CALL_DEBRIEF_WINDOW_DAYS = 60;

export interface CallDebriefReminder {
  client: Client;
  /** Prima proposta accettata del cliente: quella che lo rende cliente. */
  proposal: SalesProposal;
  acceptedOn: string;
  dueOn: string;
  /** Giorni alla scadenza: 0 o negativo = da fare adesso. */
  daysToDue: number;
}

function resolveAcceptedOn(proposal: SalesProposal): string {
  return toDay(proposal.dataAccettazione) || toDay(proposal.ultimoAggiornamento) || toDay(proposal.creatoIl);
}

/** Fatturato negli anni prima di quello dell'accettazione: se c'è, il cliente non è nuovo. */
function hasRevenueBefore(clients: Client[], year: number): boolean {
  return clients.some((client) => REVENUE_YEARS.some(
    (revenueYear) => revenueYear < year && getClientRevenue(client, revenueYear) > 0,
  ));
}

/**
 * Clienti nuovi: la loro prima proposta passa a «Si» e dopo 7 giorni va fatta la call per
 * presentare Chimera. Il reminder sparisce quando la call è segnata come fatta.
 * Un gruppo (cliente principale + ragioni sociali + alias) conta come un solo cliente.
 */
export function buildCallDebriefReminders({
  clients,
  proposals,
  aliasesByClientId,
  doneClientIds,
  today,
}: {
  clients: Client[];
  proposals: SalesProposal[];
  aliasesByClientId: ReadonlyMap<string, string[]>;
  doneClientIds: ReadonlySet<string>;
  today: string;
}): CallDebriefReminder[] {
  const accepted = proposals.filter((proposal) => proposal.stato === PROPOSAL_STATUS_ACCEPTED && proposal.cliente);
  const acceptedByKey = new Map<string, SalesProposal[]>();
  accepted.forEach((proposal) => {
    const key = normalizeClientKey(proposal.cliente);
    const list = acceptedByKey.get(key) || [];
    list.push(proposal);
    acceptedByKey.set(key, list);
  });
  const todayTime = dayTime(today);
  const reminders: CallDebriefReminder[] = [];
  clients
    .filter((client) => !client.parentClientId && client.relationship !== 'Eliminato')
    .forEach((client) => {
      const group = getClientGroup(client, clients);
      if (group.some((item) => doneClientIds.has(item.id))) return;
      const keys = getClientGroupKeys(group, aliasesByClientId);
      const groupAccepted = [...keys].flatMap((key) => acceptedByKey.get(key) || []);
      if (groupAccepted.length === 0) return;
      const first = groupAccepted.reduce((earliest, proposal) => (
        resolveAcceptedOn(proposal) < resolveAcceptedOn(earliest) ? proposal : earliest
      ));
      const acceptedOn = resolveAcceptedOn(first);
      if (!acceptedOn) return;
      const ageDays = Math.round((todayTime - dayTime(acceptedOn)) / DAY_MS);
      if (ageDays < 0 || ageDays > CALL_DEBRIEF_WINDOW_DAYS) return;
      if (hasRevenueBefore(group, Number(acceptedOn.slice(0, 4)))) return;
      const dueOn = addDays(acceptedOn, CALL_DEBRIEF_DELAY_DAYS);
      reminders.push({
        client,
        proposal: first,
        acceptedOn,
        dueOn,
        daysToDue: Math.round((dayTime(dueOn) - todayTime) / DAY_MS),
      });
    });
  return reminders.sort((left, right) => left.dueOn.localeCompare(right.dueOn)
    || left.client.name.localeCompare(right.client.name, 'it'));
}
