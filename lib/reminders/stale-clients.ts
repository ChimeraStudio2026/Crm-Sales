import { DEFAULT_ACTION_DATE } from '@/lib/constants/crm';
import {
  daysBetween,
  getClientGroup,
  getClientGroupKeys,
  normalizeClientKey,
  toDay,
} from '@/lib/reminders/shared';
import type { ClientAction } from '@/lib/types/client-actions';
import type { CommercialFunnelEntry } from '@/lib/types/commercial-funnel';
import type { Client, Relationship } from '@/lib/types/crm';
import type { SalesProposal } from '@/lib/types/sales-proposals';

/** Senza proposte né azioni da più di questi giorni il cliente compare tra i clienti fermi. */
export const STALE_CLIENT_DAYS = 21;

/** Clienti veri (non prospect freddi né eliminati): sono quelli da non lasciare fermi. */
const STALE_CLIENT_RELATIONSHIPS: readonly Relationship[] = ['Nuovo Cliente', 'Ricorrente', 'Top 20%', 'Da recuperare'];

export type StaleClientActivityKind = 'azione' | 'campagna' | 'proposta';

export interface StaleClientActivity {
  day: string;
  kind: StaleClientActivityKind;
  label: string;
}

export interface StaleClientReminder {
  client: Client;
  /** Ultima proposta o azione del gruppo; null = niente di registrato. */
  lastActivity: StaleClientActivity | null;
  /** Giorni dall'ultima attività; null = nessuna attività. */
  daysSince: number | null;
}

function latest(current: StaleClientActivity | null, next: StaleClientActivity): StaleClientActivity {
  return !current || next.day > current.day ? next : current;
}

function resolveProposalDay(proposal: SalesProposal): string {
  return [proposal.creatoIl, proposal.ultimoAggiornamento, proposal.dataAccettazione, proposal.dataRifiuto]
    .map(toDay)
    .reduce((max, day) => (day > max ? day : max), '');
}

/**
 * Clienti (principale + ragioni sociali + alias) senza proposte Cerbero né azioni nel CRM
 * (azioni cliente, obiettivi, campagne, «ultima azione») da più di tre settimane.
 */
export function buildStaleClientReminders({
  clients,
  proposals,
  aliasesByClientId,
  clientActions,
  funnelEntries,
  today,
}: {
  clients: Client[];
  proposals: SalesProposal[];
  aliasesByClientId: ReadonlyMap<string, string[]>;
  clientActions: ClientAction[];
  funnelEntries: CommercialFunnelEntry[];
  today: string;
}): StaleClientReminder[] {
  const proposalsByKey = new Map<string, SalesProposal[]>();
  proposals.forEach((proposal) => {
    if (!proposal.cliente) return;
    const key = normalizeClientKey(proposal.cliente);
    proposalsByKey.set(key, [...(proposalsByKey.get(key) || []), proposal]);
  });
  const actionsByClient = new Map<string, ClientAction[]>();
  clientActions.forEach((action) => {
    actionsByClient.set(action.clientId, [...(actionsByClient.get(action.clientId) || []), action]);
  });
  const entriesByClient = new Map<string, CommercialFunnelEntry[]>();
  funnelEntries.forEach((entry) => {
    entriesByClient.set(entry.clientId, [...(entriesByClient.get(entry.clientId) || []), entry]);
  });

  const reminders: StaleClientReminder[] = [];
  clients
    .filter((client) => !client.parentClientId && !client.isColdClient
      && STALE_CLIENT_RELATIONSHIPS.includes(client.relationship))
    .forEach((client) => {
      const group = getClientGroup(client, clients);
      let last: StaleClientActivity | null = null;
      group.forEach((item) => {
        const actionDay = toDay(item.actionDate);
        if (item.action.trim() && actionDay && actionDay !== DEFAULT_ACTION_DATE) {
          last = latest(last, { day: actionDay, kind: 'azione', label: item.action.trim() });
        }
        (actionsByClient.get(item.id) || []).forEach((action) => {
          const day = toDay(action.actionDate);
          if (day) last = latest(last, { day, kind: 'azione', label: action.actionType });
        });
        (entriesByClient.get(item.id) || []).forEach((entry) => {
          entry.actions.forEach((slot) => {
            const day = toDay(slot.date);
            if (slot.type && day) last = latest(last, { day, kind: 'campagna', label: slot.type });
          });
        });
      });
      getClientGroupKeys(group, aliasesByClientId).forEach((key) => {
        (proposalsByKey.get(key) || []).forEach((proposal) => {
          const day = resolveProposalDay(proposal);
          if (day) last = latest(last, { day, kind: 'proposta', label: proposal.nome });
        });
      });
      // «last» è assegnato nei forEach: TypeScript non lo vede e lo restringe a null.
      const lastActivity = last as StaleClientActivity | null;
      const daysSince = lastActivity ? daysBetween(lastActivity.day, today) : null;
      if (daysSince !== null && daysSince <= STALE_CLIENT_DAYS) return;
      reminders.push({ client, lastActivity, daysSince });
    });
  // Prima chi non ha mai avuto attività, poi chi è fermo da più tempo.
  return reminders.sort((left, right) => (right.daysSince ?? Infinity) - (left.daysSince ?? Infinity)
    || left.client.name.localeCompare(right.client.name, 'it'));
}
