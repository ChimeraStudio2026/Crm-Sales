import type { Client, ClientContact } from '@/lib/types/crm';

export function getCreativeProposalContacts(client: Client): ClientContact[] {
  if (client.contacts.length === 0) {
    return [{
      id: '',
      name: client.name,
      email: client.email || '',
      role: '',
      phone: '',
    }];
  }
  return client.contacts;
}

export function resolveCreativeProposalContact(
  client: Client | undefined,
  contactId: string,
): ClientContact | undefined {
  if (!client) return undefined;
  if (!contactId) {
    return getCreativeProposalContacts(client)[0];
  }
  return client.contacts.find((contact) => contact.id === contactId)
    || getCreativeProposalContacts(client)[0];
}

export function resolveCreativeProposalContactLabel(
  client: Client | undefined,
  contactId: string,
): string {
  const contact = resolveCreativeProposalContact(client, contactId);
  if (!contact) return '';
  if (contact.email.trim()) return contact.email.trim();
  if (contact.name.trim()) return contact.name.trim();
  return client?.email || '';
}
