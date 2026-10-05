import type { ClientAction, ClientActivityItem } from '@/lib/types/client-actions';
import type { ClientContact } from '@/lib/types/crm';
import type { CommercialFunnelEntry } from '@/lib/types/commercial-funnel';
import type { MailCampaign } from '@/lib/types/mail-campaigns';

/** Unisce il registro azioni del cliente con le azioni delle sue campagne funnel, dalla più recente. */
export function buildClientActivity(
  clientActions: ClientAction[],
  funnelEntries: CommercialFunnelEntry[],
  campaigns: MailCampaign[],
  contacts: ClientContact[] = [],
): ClientActivityItem[] {
  const campaignNameById = new Map(campaigns.map((campaign) => [campaign.id, campaign.name.trim()]));
  const contactNameById = new Map(contacts.map((contact) => [contact.id, contact.name.trim() || contact.email.trim()]));
  const manualItems: ClientActivityItem[] = clientActions.map((action) => {
    const contactName = action.contactId ? contactNameById.get(action.contactId) : '';
    const author = action.author ? `Registrata da ${action.author}` : 'Registrata nella scheda cliente';
    return {
      key: `client-${action.id}`,
      source: 'client',
      actionType: action.outcome ? `Chiusura · ${action.outcome === 'won' ? 'Won' : 'Lost'}` : action.actionType,
      date: action.actionDate,
      note: action.note,
      detail: contactName ? `${author} · con ${contactName}` : author,
      sortStamp: `${action.actionDate}|${action.createdAt}`,
    };
  });
  const funnelItems: ClientActivityItem[] = funnelEntries.flatMap((entry) => (
    entry.actions
      .map((action, index) => ({ action, index }))
      .filter(({ action }) => action.type && action.date)
      .map(({ action, index }) => ({
        key: `funnel-${entry.id}-${index}`,
        source: 'funnel' as const,
        actionType: action.type,
        date: action.date,
        note: action.note,
        detail: `Campagna ${campaignNameById.get(entry.campaignId) || 'funnel'}`,
        // Stessa data: l'azione successiva nella campagna è la più recente.
        sortStamp: `${action.date}|${String(index).padStart(3, '0')}`,
      }))
  ));
  return [...manualItems, ...funnelItems].sort((left, right) => right.sortStamp.localeCompare(left.sortStamp));
}
