import type { Client } from '@/lib/types/crm';

/** Forme giuridiche e parole di servizio ignorate nel confronto dei nomi. */
const LEGAL_FORM_TOKENS = new Set([
  'srl', 'srls', 'spa', 'sas', 'snc', 'sb', 'ltd', 'llc', 'inc', 'gmbh', 'bv', 'nv', 'sa', 'sarl',
  'sl', 'doo', 'plc', 'ag', 'societa', 'benefit', 'unipersonale', 'limitata', 'responsabilita',
  'per', 'azioni', 'a', 's', 'r', 'l', 'p', 'b', 'v', 'n', 'o', 'd', 'e', 'ets', 'co', 'the', 'di',
  'de', 'del', 'della', 'dei', 'and',
]);

/** Parole troppo comuni per indicare da sole lo stesso marchio. */
const GENERIC_TOKENS = new Set([
  'italia', 'italy', 'italiana', 'italian', 'international', 'group', 'groupe', 'studio', 'studios',
  'media', 'communications', 'communication', 'comunicazione', 'agency', 'agenzia', 'company',
  'holding', 'pictures', 'production', 'productions', 'film', 'films', 'milano', 'roma', 'torino',
  'europe', 'advertising', 'marketing', 'digital', 'services', 'service', 'partners', 'eventi',
  'events', 'creative', 'design', 'management', 'fashion', 'social', 'global', 'world', 'club',
  'industries', 'operation', 'entertainment', 'music', 'sports', 'sport', 'wines', 'winery',
  'foundation', 'fondazione', 'associazione', 'farmaceutici', 'appliances', 'value', 'public',
  'wellness', 'forno', 'next', 'giacomo', 'paolo',
]);

export type DuplicateReason = 'alias' | 'same-name' | 'contained' | 'similar' | 'same-brand';

export const DUPLICATE_REASON_LABELS: Record<DuplicateReason, string> = {
  alias: 'Il nome è già una ragione sociale collegata',
  'same-name': 'Stesso nome, forma giuridica diversa',
  contained: 'Un nome contiene l’altro',
  similar: 'Nomi molto simili (possibile errore di battitura)',
  'same-brand': 'Stesso marchio: ragioni sociali dello stesso gruppo?',
};

export interface DuplicateCandidate {
  pairKey: string;
  first: Client;
  second: Client;
  reason: DuplicateReason;
  score: number;
}

export interface ClientAliasRef {
  clientId: string;
  aliasName: string;
}

export function normalizeAliasKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function tokenizeCompanyName(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token && !LEGAL_FORM_TOKENS.has(token));
}

/** Nome "pulito" per il confronto: minuscole, senza accenti, punteggiatura e forme giuridiche. */
export function normalizeCompanyName(name: string): string {
  return tokenizeCompanyName(name).join(' ');
}

function bigrams(value: string): Map<string, number> {
  const compact = value.replace(/\s+/g, '');
  const result = new Map<string, number>();
  for (let index = 0; index < compact.length - 1; index += 1) {
    const gram = compact.slice(index, index + 2);
    result.set(gram, (result.get(gram) || 0) + 1);
  }
  return result;
}

/** Coefficiente di Dice sui bigrammi: 1 = identici. */
export function nameSimilarity(left: string, right: string): number {
  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  const total = Array.from(leftGrams.values()).reduce((sum, count) => sum + count, 0)
    + Array.from(rightGrams.values()).reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;
  let shared = 0;
  leftGrams.forEach((count, gram) => {
    shared += Math.min(count, rightGrams.get(gram) || 0);
  });
  return (2 * shared) / total;
}

function containsWholeWords(longer: string, shorter: string): boolean {
  return longer === shorter
    || longer.startsWith(`${shorter} `)
    || longer.endsWith(` ${shorter}`)
    || longer.includes(` ${shorter} `);
}

function distinctiveTokens(name: string): Set<string> {
  return new Set(
    tokenizeCompanyName(name).filter((token) => token.length >= 5 && !GENERIC_TOKENS.has(token) && !/^\d+$/.test(token)),
  );
}

/** Perché due nomi sembrano lo stesso cliente, oppure null se non si somigliano. */
export function compareClientNames(
  leftName: string,
  rightName: string,
): { reason: DuplicateReason; score: number } | null {
  const left = normalizeCompanyName(leftName);
  const right = normalizeCompanyName(rightName);
  if (!left || !right) return null;
  if (left === right) return { reason: 'same-name', score: 1 };
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length >= 3 && containsWholeWords(longer, shorter)) return { reason: 'contained', score: 0.9 };
  if (Math.min(left.length, right.length) >= 5) {
    const similarity = nameSimilarity(left, right);
    if (similarity >= 0.82) return { reason: 'similar', score: similarity };
  }
  const leftTokens = distinctiveTokens(leftName);
  const sharedBrand = Array.from(distinctiveTokens(rightName)).some((token) => leftTokens.has(token));
  if (sharedBrand) return { reason: 'same-brand', score: 0.6 };
  return null;
}

export function buildDuplicatePairKey(firstId: string, secondId: string): string {
  return [firstId, secondId].sort().join('|');
}

/** Coppie di clienti dello stesso workspace che potrebbero essere lo stesso cliente. */
/** Ragioni sociali già raggruppate sotto lo stesso cliente principale: non sono duplicati. */
export function areClientsInSameGroup(first: Client, second: Client): boolean {
  const firstRoot = first.parentClientId || first.id;
  const secondRoot = second.parentClientId || second.id;
  return firstRoot === secondRoot;
}

export function findDuplicateCandidates(
  clients: Client[],
  aliases: ClientAliasRef[],
  dismissedPairKeys: ReadonlySet<string>,
): DuplicateCandidate[] {
  const activeClients = clients.filter((client) => client.relationship !== 'Eliminato' && client.name.trim());
  const aliasOwnerByKey = new Map(aliases.map((alias) => [normalizeAliasKey(alias.aliasName), alias.clientId]));
  const clientById = new Map(activeClients.map((client) => [client.id, client]));
  const candidates: DuplicateCandidate[] = [];
  const seen = new Set<string>();

  const push = (first: Client, second: Client, reason: DuplicateReason, score: number): void => {
    if (first.id === second.id || first.workspaceId !== second.workspaceId) return;
    if (areClientsInSameGroup(first, second)) return;
    const pairKey = buildDuplicatePairKey(first.id, second.id);
    if (seen.has(pairKey) || dismissedPairKeys.has(pairKey)) return;
    seen.add(pairKey);
    candidates.push({ pairKey, first, second, reason, score });
  };

  activeClients.forEach((client) => {
    const ownerId = aliasOwnerByKey.get(normalizeAliasKey(client.name));
    const owner = ownerId ? clientById.get(ownerId) : undefined;
    if (owner) push(owner, client, 'alias', 1);
  });

  for (let leftIndex = 0; leftIndex < activeClients.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < activeClients.length; rightIndex += 1) {
      const left = activeClients[leftIndex];
      const right = activeClients[rightIndex];
      const match = compareClientNames(left.name, right.name);
      if (match) push(left, right, match.reason, match.score);
    }
  }

  return candidates.sort((left, right) => right.score - left.score
    || left.first.name.localeCompare(right.first.name, 'it'));
}

/** Clienti esistenti con un nome simile a quello che si sta per creare. */
export function findSimilarClients(
  name: string,
  clients: Client[],
  aliases: ClientAliasRef[] = [],
  limit = 3,
): Array<{ client: Client; reason: DuplicateReason }> {
  if (!name.trim()) return [];
  const results: Array<{ client: Client; reason: DuplicateReason; score: number }> = [];
  const aliasOwnerId = aliases.find((alias) => normalizeAliasKey(alias.aliasName) === normalizeAliasKey(name))?.clientId;
  clients.forEach((client) => {
    if (client.relationship === 'Eliminato') return;
    if (client.id === aliasOwnerId) {
      results.push({ client, reason: 'alias', score: 1 });
      return;
    }
    const match = compareClientNames(name, client.name);
    if (match) results.push({ client, ...match });
  });
  return results
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ client, reason }) => ({ client, reason }));
}

function resolveClientCreatedAt(client: Client): number {
  const match = /^client-(\d{10,})/.exec(client.id);
  return match ? Number(match[1]) : 0;
}

function resolveTotalRevenue(client: Client): number {
  return (client.rev2023 || 0) + (client.rev2024 || 0) + (client.rev2025 || 0) + (client.rev2026 || 0);
}

/**
 * Cliente proposto come principale: quello con più fatturato (di solito il nome ufficiale
 * arrivato da Cerbero), poi quello creato più di recente.
 */
export function suggestPrimaryClient(first: Client, second: Client): Client {
  const revenueDiff = resolveTotalRevenue(first) - resolveTotalRevenue(second);
  if (revenueDiff !== 0) return revenueDiff > 0 ? first : second;
  if (first.contacts.length !== second.contacts.length) {
    return first.contacts.length > second.contacts.length ? first : second;
  }
  return resolveClientCreatedAt(first) >= resolveClientCreatedAt(second) ? first : second;
}
