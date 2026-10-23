import { ANALYSIS_YEARS, EXCEL_REV_EPSILON, isAnalysisYear } from '@/lib/constants/crm';
import { normalizeOkrClientName } from '@/lib/analysis/okr-timeline';
import { resolveCanonicalClientBrandName } from '@/lib/crm/client-brand-aliases';
import { getClientRevenue } from '@/lib/crm/revenue';
import { isClientInActiveSection } from '@/lib/crm/utils';
import type { Client, OkrRecord } from '@/lib/types/crm';

export type RetentionBucket = 'gained' | 'lost' | 'retained' | 'inactive';

export interface ClientYearRevenue {
  key: string;
  clientId: string | null;
  displayName: string;
  revenueByYear: Record<number, number>;
}

export interface RetentionClientRow {
  displayName: string;
  previousRevenue: number;
  currentRevenue: number;
  delta: number;
  bucket: RetentionBucket;
}

export interface RetentionYearTransition {
  previousYear: number;
  currentYear: number;
  gainedCount: number;
  gainedRevenue: number;
  lostCount: number;
  lostRevenue: number;
  retainedCount: number;
  retainedPreviousRevenue: number;
  retainedCurrentRevenue: number;
  netClientChange: number;
  netRevenueChange: number;
  retentionRate: number;
  rows: RetentionClientRow[];
}

function hasRevenue(amount: number): boolean {
  return amount > EXCEL_REV_EPSILON;
}

function createEmptyRevenueByYear(): Record<number, number> {
  return ANALYSIS_YEARS.reduce<Record<number, number>>((acc, year) => {
    acc[year] = 0;
    return acc;
  }, {});
}

/** Una ragione sociale conta sempre come il suo macro cliente. */
function resolveMacroClient(client: Client, clients: Client[]): Client {
  if (!client.parentClientId) return client;
  return clients.find((item) => item.id === client.parentClientId) || client;
}

function resolveOkrGroupKey(
  record: OkrRecord,
  clients: Client[],
): { key: string; displayName: string; clientId: string | null } {
  if (record.clientId) {
    const found = clients.find((client) => client.id === record.clientId);
    const linkedClient = found ? resolveMacroClient(found, clients) : undefined;
    if (linkedClient) {
      return { key: linkedClient.id, displayName: linkedClient.name, clientId: linkedClient.id };
    }
    return {
      key: record.clientId,
      displayName: resolveCanonicalClientBrandName(record.clientName),
      clientId: record.clientId,
    };
  }
  const nameMatch = clients.find(
    (client) => normalizeOkrClientName(client.name) === normalizeOkrClientName(record.clientName),
  );
  const matchedClient = nameMatch ? resolveMacroClient(nameMatch, clients) : undefined;
  if (matchedClient) {
    return { key: matchedClient.id, displayName: matchedClient.name, clientId: matchedClient.id };
  }
  const canonicalName = resolveCanonicalClientBrandName(record.clientName);
  return {
    key: `name:${normalizeOkrClientName(canonicalName)}`,
    displayName: canonicalName,
    clientId: null,
  };
}

function ensureClientYearRevenue(
  map: Map<string, ClientYearRevenue>,
  key: string,
  displayName: string,
  clientId: string | null,
): ClientYearRevenue {
  const existing = map.get(key);
  if (existing) {
    if (displayName.length > existing.displayName.length) {
      existing.displayName = displayName;
    }
    if (!existing.clientId && clientId) existing.clientId = clientId;
    return existing;
  }
  const entry: ClientYearRevenue = {
    key,
    clientId,
    displayName,
    revenueByYear: createEmptyRevenueByYear(),
  };
  map.set(key, entry);
  return entry;
}

export function buildClientYearRevenueMap(
  okrRecords: OkrRecord[],
  clients: Client[],
): Map<string, ClientYearRevenue> {
  const map = new Map<string, ClientYearRevenue>();
  okrRecords.forEach((record) => {
    if (!isAnalysisYear(record.year)) return;
    const { key, displayName, clientId } = resolveOkrGroupKey(record, clients);
    const entry = ensureClientYearRevenue(map, key, displayName, clientId);
    entry.revenueByYear[record.year] += Number(record.amount) || 0;
  });
  // Fatturato da anagrafica dove mancano gli OKR: un macro cliente somma le sue ragioni sociali,
  // che non compaiono mai come clienti a sé (non risultano «persi» se il gruppo fattura).
  const groupMembers = new Map<string, Client[]>();
  clients.forEach((client) => {
    const macro = resolveMacroClient(client, clients);
    groupMembers.set(macro.id, [...(groupMembers.get(macro.id) || []), client]);
  });
  clients
    .filter((client) => !client.parentClientId && isClientInActiveSection(client))
    .forEach((client) => {
      const members = groupMembers.get(client.id) || [client];
      const entry = ensureClientYearRevenue(map, client.id, client.name, client.id);
      ANALYSIS_YEARS.forEach((year) => {
        const okrRevenue = entry.revenueByYear[year] || 0;
        if (!hasRevenue(okrRevenue)) {
          entry.revenueByYear[year] = members.reduce((sum, member) => sum + getClientRevenue(member, year), 0);
        }
      });
    });
  return map;
}

function classifyRetentionBucket(previousRevenue: number, currentRevenue: number): RetentionBucket {
  const hadPrevious = hasRevenue(previousRevenue);
  const hasCurrent = hasRevenue(currentRevenue);
  if (!hadPrevious && hasCurrent) return 'gained';
  if (hadPrevious && !hasCurrent) return 'lost';
  if (hadPrevious && hasCurrent) return 'retained';
  return 'inactive';
}

export function buildRetentionYearTransition(
  clientYearRevenue: Iterable<ClientYearRevenue>,
  previousYear: number,
  currentYear: number,
): RetentionYearTransition {
  const rows: RetentionClientRow[] = [];
  let gainedCount = 0;
  let gainedRevenue = 0;
  let lostCount = 0;
  let lostRevenue = 0;
  let retainedCount = 0;
  let retainedPreviousRevenue = 0;
  let retainedCurrentRevenue = 0;
  for (const client of clientYearRevenue) {
    const previousRevenue = client.revenueByYear[previousYear] || 0;
    const currentRevenue = client.revenueByYear[currentYear] || 0;
    const bucket = classifyRetentionBucket(previousRevenue, currentRevenue);
    if (bucket === 'inactive') continue;
    rows.push({
      displayName: client.displayName,
      previousRevenue,
      currentRevenue,
      delta: currentRevenue - previousRevenue,
      bucket,
    });
    if (bucket === 'gained') {
      gainedCount += 1;
      gainedRevenue += currentRevenue;
      continue;
    }
    if (bucket === 'lost') {
      lostCount += 1;
      lostRevenue += previousRevenue;
      continue;
    }
    retainedCount += 1;
    retainedPreviousRevenue += previousRevenue;
    retainedCurrentRevenue += currentRevenue;
  }
  rows.sort((left, right) => {
    const bucketOrder: Record<RetentionBucket, number> = {
      lost: 0,
      gained: 1,
      retained: 2,
      inactive: 3,
    };
    const bucketDelta = bucketOrder[left.bucket] - bucketOrder[right.bucket];
    if (bucketDelta !== 0) return bucketDelta;
    return Math.abs(right.delta) - Math.abs(left.delta);
  });
  const activePreviousCount = retainedCount + lostCount;
  const retentionRate = activePreviousCount > 0
    ? (retainedCount / activePreviousCount) * 100
    : 0;
  const netRevenueChange = rows.reduce((acc, row) => acc + row.delta, 0);
  return {
    previousYear,
    currentYear,
    gainedCount,
    gainedRevenue,
    lostCount,
    lostRevenue,
    retainedCount,
    retainedPreviousRevenue,
    retainedCurrentRevenue,
    netClientChange: gainedCount - lostCount,
    netRevenueChange,
    retentionRate,
    rows,
  };
}

export function buildRetentionYearTransitions(
  okrRecords: OkrRecord[],
  clients: Client[],
): RetentionYearTransition[] {
  const clientYearRevenue = buildClientYearRevenueMap(okrRecords, clients);
  const entries = Array.from(clientYearRevenue.values());
  const transitions: RetentionYearTransition[] = [];
  for (let index = 1; index < ANALYSIS_YEARS.length; index += 1) {
    const previousYear = ANALYSIS_YEARS[index - 1];
    const currentYear = ANALYSIS_YEARS[index];
    transitions.push(buildRetentionYearTransition(entries, previousYear, currentYear));
  }
  return transitions;
}

export function getRetentionYearPairLabel(previousYear: number, currentYear: number): string {
  return `${previousYear} → ${currentYear}`;
}
