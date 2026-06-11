import type { Client, ClientContact } from '@/lib/types/crm';
import { ACTION_DATE_STALE_DAYS, COLD_CLIENT_REV_THRESHOLD, DEFAULT_ACTION_DATE, EXCEL_IMPORT_ACTION_PREFIX } from '@/lib/constants/crm';
import { normalizeClientProductOffers } from '@/lib/crm/product-offers';

export function createUniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function resolveActionDateOnTextChange(
  previousAction: string,
  nextAction: string,
  currentActionDate: string,
): string {
  const previous = previousAction.trim();
  const next = nextAction.trim();
  if (!next) return '';
  if (next !== previous) return getTodayString();
  return currentActionDate || DEFAULT_ACTION_DATE;
}

export function formatCurrency(value: number): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function escapeHtml(text: string | null | undefined): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatItalianDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function shuffleArray<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function extractDomainFromEmail(email: string): string {
  if (!email || !email.includes('@')) return '';
  const domain = email.split('@')[1].trim().toLowerCase();
  if (
    !domain ||
    domain.includes('gmail.') ||
    domain.includes('yahoo.') ||
    domain.includes('hotmail.')
  ) {
    return '';
  }
  return domain;
}

export function isClientInColdSection(client: Client): boolean {
  return client.isColdClient === true && client.relationship !== 'Eliminato';
}

/** Clienti nella lista principale (inclusi Eliminato), esclusi i freddi. */
export function isClientInMainList(client: Client): boolean {
  return !client.isColdClient;
}

/** Clienti attivi per analisi, recall e totali fatturato (esclusi Eliminato). */
export function isClientInActiveSection(client: Client): boolean {
  return !client.isColdClient && client.relationship !== 'Eliminato';
}

export function isManualRelationshipLocked(client: Client): boolean {
  return client.manualRelationship
    || client.relationship === 'Perso'
    || client.relationship === 'Eliminato';
}

export function hasExcelRevenueDifference(
  currentValue: number,
  importedValue: number,
  epsilon = 0.005,
): boolean {
  const current = Number(currentValue) || 0;
  const imported = Number(importedValue) || 0;
  return Math.abs(current - imported) > epsilon;
}

export function isClientProfileComplete(client: Client): boolean {
  normalizeClientContacts(client);
  const hasName = !!(client.name && client.name.trim());
  const hasType = !!client.type;
  const hasOwner = !!client.owner;
  const hasOrigin = !!(client.clientOrigin && client.clientOrigin.trim());
  const hasContactEmail = client.contacts.some((contact) => (contact.email || '').trim());
  return hasName && hasType && hasOwner && hasOrigin && hasContactEmail;
}

/** Clienti completi non vengono modificati da un re-import OKR/Excel. */
export function shouldPreserveClientOnImport(client: Client): boolean {
  return isClientProfileComplete(client);
}

export function shouldHighlightIncompleteClient(client: Client): boolean {
  return !isClientProfileComplete(client);
}

export function updateClientProfileCompletion(client: Client): void {
  client.needsProfileCompletion = !isClientProfileComplete(client);
}

export function syncClientsProfileCompletion(clients: Client[]): Client[] {
  return clients.map((client) => {
    const normalized = { ...client };
    updateClientProfileCompletion(normalized);
    return normalized;
  });
}

export function normalizeClientContacts(client: Client): ClientContact[] {
  if (!Array.isArray(client.contacts)) {
    client.contacts = [];
  }
  if (client.contacts.length === 0 && client.email?.trim()) {
    client.contacts.push({
      id: createUniqueId('contact'),
      email: client.email,
      name: '',
      role: '',
    });
  }
  client.contacts = client.contacts.map((contact) => ({
    id: contact.id || createUniqueId('contact'),
    email: contact.email || '',
    name: contact.name || '',
    role: contact.role || '',
  }));
  return client.contacts;
}

export function syncClientLegacyFields(client: Client): void {
  normalizeClientContacts(client);
  const primaryContact =
    client.contacts.find((contact) => (contact.email || '').trim()) ||
    client.contacts[0];
  client.email = primaryContact?.email || '';
}

export function getClientContactsSearchText(client: Client): string {
  normalizeClientContacts(client);
  const contactText = client.contacts
    .map((contact) => [contact.name || '', contact.email || '', contact.role || ''].join(' '))
    .join(' ')
    .toLowerCase();
  return `${contactText} ${(client.description || '').toLowerCase()}`.trim();
}

export function getClientEmailDomains(client: Client): Set<string> {
  normalizeClientContacts(client);
  const domains = new Set<string>();
  client.contacts.forEach((contact) => {
    const domain = extractDomainFromEmail(contact.email);
    if (domain) domains.add(domain);
  });
  return domains;
}

export function getClientPrimaryEmail(client: Client): string {
  normalizeClientContacts(client);
  const withEmail = client.contacts.find((contact) => (contact.email || '').trim());
  return withEmail?.email || client.email || '';
}

export function isActionDateStale(actionDateStr: string): boolean {
  if (!actionDateStr) return false;
  const actionDate = new Date(`${actionDateStr}T00:00:00`);
  if (Number.isNaN(actionDate.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - actionDate.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= ACTION_DATE_STALE_DAYS;
}

export function formatActionDateDisplay(actionDateStr: string): string {
  if (!actionDateStr) return '—';
  const date = new Date(`${actionDateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return actionDateStr;
  return date.toLocaleDateString('it-IT');
}

export function recalculateRelationships(clients: Client[]): Client[] {
  const activeClientsWithRevenue2026 = clients.filter(
    (c) => c.relationship !== 'Eliminato' && c.rev2026 > 0,
  );
  activeClientsWithRevenue2026.sort((a, b) => b.rev2026 - a.rev2026);
  const top20Count = Math.ceil(activeClientsWithRevenue2026.length * 0.2);
  const top20Ids = new Set(
    activeClientsWithRevenue2026.slice(0, top20Count).map((c) => c.id),
  );
  return clients.map((c) => {
    if (isManualRelationshipLocked(c)) {
      return c;
    }
    if (top20Ids.has(c.id)) {
      return { ...c, relationship: 'Top 20%' };
    }
    if (c.rev2025 > 15000) {
      return { ...c, relationship: 'Ricorrente' };
    }
    return { ...c, relationship: 'Nuovo Cliente' };
  });
}

export function applyColdClientPromotion(
  client: Client,
): { promoted: boolean; client: Client } {
  if (!client.isColdClient) return { promoted: false, client };
  if (client.rev2026 > COLD_CLIENT_REV_THRESHOLD) {
    return {
      promoted: true,
      client: { ...client, isColdClient: false },
    };
  }
  return { promoted: false, client };
}

export function applyColdClientPromotionToAll(clients: Client[]): Client[] {
  return clients.map((client) => applyColdClientPromotion(client).client);
}

/** Clients from OKR/Excel imports belong in the main list, not cold prospects. */
export function reconcileImportedClientsToMainList(clients: Client[]): Client[] {
  return clients.map((client) => {
    if (!client.isColdClient) return client;
    if ((client.rev2025 || 0) > 0) {
      return { ...client, isColdClient: false };
    }
    if ((client.action || '').startsWith(EXCEL_IMPORT_ACTION_PREFIX)) {
      return { ...client, isColdClient: false };
    }
    return client;
  });
}

export function normalizeClients(clients: Client[]): Client[] {
  return clients.map((client) => {
    const normalized = { ...client };
    if (normalized.clientOrigin === undefined) {
      normalized.clientOrigin = '';
    }
    normalizeClientContacts(normalized);
    normalizeClientProductOffers(normalized);
    if (!Array.isArray(normalized.actionLog)) {
      normalized.actionLog = [];
    }
    if (
      normalized.actionLog.length === 0 &&
      normalized.action &&
      normalized.action.trim()
    ) {
      normalized.actionLog.push({
        id: createUniqueId('action'),
        text: normalized.action.trim(),
        date: normalized.actionDate || DEFAULT_ACTION_DATE,
      });
    }
    return normalized;
  });
}
