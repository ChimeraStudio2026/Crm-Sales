import type { Client, Relationship } from '@/lib/types/crm';
import { ANALYSIS_YEAR, RELATIONSHIPS, REVENUE_YEARS } from '@/lib/constants/crm';
import { addRevenueByYear, createEmptyRevenueByYear, getClientRevenue } from '@/lib/crm/revenue';
import type { ClientRevenueByYear } from '@/lib/crm/revenue';

export const RELATIONSHIP_INDEX: Record<Relationship, number | null> = {
  Freddo: null,
  'Nuovo Cliente': 1,
  Ricorrente: 2,
  'Top 20%': null,
  'Da recuperare': null,
  Eliminato: null,
};

export const RELATIONSHIP_STARS: Record<Relationship, string> = {
  Freddo: '❄️',
  'Nuovo Cliente': '⭐',
  Ricorrente: '⭐⭐',
  'Top 20%': '⭐⭐',
  'Da recuperare': '—',
  Eliminato: '—',
};

export function normalizeStoredRelationship(value: string): Relationship {
  if (value === 'Perso') return 'Da recuperare';
  if ((RELATIONSHIPS as readonly string[]).includes(value)) {
    return value as Relationship;
  }
  return 'Nuovo Cliente';
}

/** L'unico rapporto scelto a mano: tutti gli altri si calcolano dal fatturato. */
export function isManualOnlyRelationship(relationship: Relationship): boolean {
  return relationship === 'Eliminato';
}

/**
 * Rapporto automatico dal fatturato (anno corrente = ANALYSIS_YEAR, il 2027 dal 1° gennaio):
 * - Freddo: mai fatturato;
 * - Nuovo Cliente: fattura quest'anno (o ha già fatturato registrato per l'anno dopo) ed è il primo anno;
 * - Ricorrente: fattura quest'anno e anche in almeno un anno precedente;
 * - Da recuperare: ha fatturato in passato ma non quest'anno.
 * Stessa regola del trigger clients_auto_relationship nel database.
 */
export function resolveAutoRelationship(client: ClientRevenueByYear): Relationship {
  const hasCurrentYear = REVENUE_YEARS.some((year) => year >= ANALYSIS_YEAR && getClientRevenue(client, year) > 0);
  const hasPreviousYears = REVENUE_YEARS.some((year) => year < ANALYSIS_YEAR && getClientRevenue(client, year) > 0);
  if (hasCurrentYear) return hasPreviousYears ? 'Ricorrente' : 'Nuovo Cliente';
  return hasPreviousYears ? 'Da recuperare' : 'Freddo';
}

export function isManualRelationshipLocked(client: Client): boolean {
  return client.relationship === 'Eliminato';
}

export function getRelationshipIndex(relationship: Relationship): number {
  return RELATIONSHIP_INDEX[relationship] ?? 99;
}

export function getRelationshipStars(relationship: Relationship): string {
  return RELATIONSHIP_STARS[relationship];
}

/** Fatturato del cliente più quello delle sue ragioni sociali (clienti con parentClientId). */
function buildGroupRevenue(clients: Client[]): Map<string, ClientRevenueByYear> {
  const totals = new Map<string, ClientRevenueByYear>();
  const add = (id: string, client: Client): void => {
    totals.set(id, addRevenueByYear(totals.get(id) || createEmptyRevenueByYear(), client));
  };
  clients.forEach((client) => {
    add(client.id, client);
    if (client.parentClientId && client.parentClientId !== client.id) add(client.parentClientId, client);
  });
  return totals;
}

/**
 * Ricalcola il rapporto di ogni cliente; solo «Eliminato» resta com'è.
 * Un macro cliente conta anche il fatturato delle sue ragioni sociali, come nel database;
 * le ragioni sociali prendono rapporto e owner del macro.
 */
export function applyAutoRelationships(clients: Client[]): Client[] {
  const groupRevenue = buildGroupRevenue(clients);
  const macros = clients.filter((client) => !client.parentClientId).map((client) => {
    if (client.relationship === 'Eliminato') {
      return client.manualRelationship ? client : { ...client, manualRelationship: true };
    }
    const relationship = resolveAutoRelationship(groupRevenue.get(client.id) || client);
    const isColdClient = relationship === 'Freddo';
    if (client.relationship === relationship && !client.manualRelationship && client.isColdClient === isColdClient) {
      return client;
    }
    return { ...client, relationship, manualRelationship: false, isColdClient };
  });
  // Le ragioni sociali seguono il loro macro cliente: stesso rapporto, owner e stato freddo.
  const macroById = new Map(macros.map((client) => [client.id, client]));
  return clients.map((client) => {
    if (!client.parentClientId) return macroById.get(client.id) || client;
    const macro = macroById.get(client.parentClientId);
    if (!macro) return client;
    if (client.relationship === macro.relationship && client.owner === macro.owner
      && client.isColdClient === macro.isColdClient && client.manualRelationship === macro.manualRelationship) {
      return client;
    }
    return {
      ...client,
      relationship: macro.relationship,
      owner: macro.owner,
      isColdClient: macro.isColdClient,
      manualRelationship: macro.manualRelationship,
    };
  });
}
