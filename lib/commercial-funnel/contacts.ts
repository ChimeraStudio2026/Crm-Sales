import type { Client, ClientContact } from '@/lib/types/crm';
import type { CommercialFunnelEntry } from '@/lib/types/commercial-funnel';

export function buildFunnelEntryKey(clientId: string, contactId = ''): string {
  return `${clientId}:${contactId}`;
}

export function getFunnelEntryContactId(entry: Pick<CommercialFunnelEntry, 'contactId'>): string {
  return entry.contactId || '';
}

export function resolveFunnelContact(
  client: Client | undefined,
  contactId: string,
): ClientContact | undefined {
  if (!client) return undefined;
  if (!contactId) {
    if (client.contacts.length === 0) {
      return {
        id: '',
        name: client.name,
        email: client.email || '',
        role: '',
        phone: '',
      };
    }
    return client.contacts[0];
  }
  return client.contacts.find((contact) => contact.id === contactId);
}

export function resolveFunnelContactLabel(
  client: Client | undefined,
  contactId: string,
): string {
  const contact = resolveFunnelContact(client, contactId);
  if (!contact) return 'Contatto non trovato';
  const name = contact.name.trim() || client?.name || 'Contatto';
  if (contact.email.trim()) return `${name} · ${contact.email.trim()}`;
  return name;
}

export function getAvailableFunnelContacts(
  client: Client,
  existingEntryKeys: Set<string>,
): ClientContact[] {
  if (client.contacts.length === 0) {
    return existingEntryKeys.has(buildFunnelEntryKey(client.id, ''))
      ? []
      : [{
        id: '',
        name: client.name,
        email: client.email || '',
        role: '',
        phone: '',
      }];
  }
  return client.contacts.filter(
    (contact) => !existingEntryKeys.has(buildFunnelEntryKey(client.id, contact.id)),
  );
}

export function isFunnelClientFullyAdded(
  client: Client,
  existingEntryKeys: Set<string>,
): boolean {
  return getAvailableFunnelContacts(client, existingEntryKeys).length === 0;
}
