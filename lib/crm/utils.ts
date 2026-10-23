import type { Client, ClientContact, Relationship } from '@/lib/types/crm';
import { ACTION_DATE_STALE_DAYS, ANALYSIS_YEAR, COLD_CLIENT_REV_THRESHOLD, DEFAULT_ACTION_DATE, EXCEL_IMPORT_ACTION_PREFIX } from '@/lib/constants/crm';
import {
  applyAutoRelationships,
  normalizeStoredRelationship,
  resolveAutoRelationship,
} from '@/lib/crm/relationship-rules';
import { normalizeClientProductOffers } from '@/lib/crm/product-offers';
import { REVENUE_FIELDS, getClientRevenue } from '@/lib/crm/revenue';

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

/** "2026-09-28" → "28 set 2026" (compact, for table cells). */
export function formatShortItalianDate(dateStr: string): string {
  const date = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
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

export function isFreddoRelationship(relationship: Relationship): boolean {
  return relationship === 'Freddo';
}

export function syncClientColdRelationship(client: Client): Client {
  const next = { ...client };
  if (next.relationship === 'Eliminato') {
    return next;
  }
  if (next.relationship === 'Freddo' || next.isColdClient) {
    next.relationship = 'Freddo';
    next.isColdClient = true;
    next.manualRelationship = true;
    return next;
  }
  next.isColdClient = false;
  return next;
}

export function isClientInColdSection(client: Client): boolean {
  return client.relationship === 'Freddo';
}

/** Lista clienti unificata: tutti i clienti del workspace (inclusi Freddo ed Eliminato). */
export function isClientInMainList(_client: Client): boolean {
  return true;
}

/** Clienti attivi per analisi e totali fatturato (esclusi Freddo ed Eliminato). */
export function isClientInActiveSection(client: Client): boolean {
  return client.relationship !== 'Freddo' && client.relationship !== 'Eliminato';
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
      phone: '',
    });
  }
  client.contacts = client.contacts.map((contact) => ({
    id: contact.id || createUniqueId('contact'),
    email: contact.email || '',
    name: contact.name || '',
    role: contact.role || '',
    phone: contact.phone || '',
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
    .map((contact) => [contact.name || '', contact.email || '', contact.role || '', contact.phone || ''].join(' '))
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
  return applyAutoRelationships(clients);
}

export function applyColdClientPromotion(
  client: Client,
): { promoted: boolean; client: Client } {
  const synced = syncClientColdRelationship(client);
  if (synced.relationship !== 'Freddo') {
    return { promoted: false, client: synced };
  }
  if (getClientRevenue(synced, ANALYSIS_YEAR) > COLD_CLIENT_REV_THRESHOLD) {
    return {
      promoted: true,
      client: {
        ...synced,
        isColdClient: false,
        relationship: resolveAutoRelationship(synced),
        manualRelationship: false,
      },
    };
  }
  return { promoted: false, client: synced };
}

export function applyColdClientPromotionToAll(clients: Client[]): Client[] {
  return clients.map((client) => applyColdClientPromotion(client).client);
}

/** Clients from OKR/Excel imports belong in the main list, not cold prospects. */
export function reconcileImportedClientsToMainList(clients: Client[]): Client[] {
  return clients.map((client) => {
    const isColdLike = client.isColdClient || client.relationship === 'Freddo';
    if (!isColdLike) return client;
    if ((client.rev2025 || 0) > 0) {
      return {
        ...client,
        isColdClient: false,
        relationship: client.relationship === 'Freddo' ? 'Nuovo Cliente' : client.relationship,
      };
    }
    if ((client.action || '').startsWith(EXCEL_IMPORT_ACTION_PREFIX)) {
      return {
        ...client,
        isColdClient: false,
        relationship: client.relationship === 'Freddo' ? 'Nuovo Cliente' : client.relationship,
      };
    }
    return syncClientColdRelationship(client);
  });
}

export function normalizeClients(clients: Client[]): Client[] {
  return clients.map((client) => {
    const normalized = { ...client };
    for (const field of REVENUE_FIELDS) {
      normalized[field] = Number(normalized[field]) || 0;
    }
    if (normalized.clientOrigin === undefined) {
      normalized.clientOrigin = '';
    }
    normalized.relationship = normalizeStoredRelationship(normalized.relationship || 'Nuovo Cliente');
    if (
      normalized.relationship === 'Freddo'
      || normalized.relationship === 'Da recuperare'
      || normalized.relationship === 'Eliminato'
    ) {
      normalized.manualRelationship = true;
    }
    if (normalized.isColdClient && normalized.relationship !== 'Eliminato' && normalized.relationship !== 'Freddo') {
      normalized.relationship = 'Freddo';
      normalized.manualRelationship = true;
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
    return syncClientColdRelationship(normalized);
  });
}
