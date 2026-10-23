import { parseProposalDate } from '@/lib/sales-proposals/parse';
import {
  KNOWN_PROPOSAL_CATEGORIES,
  PROPOSAL_STATUS_ACCEPTED,
  PROPOSAL_STATUS_REJECTED,
  PROPOSAL_FUTURE_YEARS,
  PROPOSAL_YEAR_OPTIONS_BASE,
  type CategoryTicketStat,
  type ProposalDetailGroup,
  type ProposalDetailFilter,
  type ProposalKpiSummary,
  type ProposalRejectionReasonStat,
  type ProposalIsoWeekRef,
  type ProposalWeeklyReviewSummary,
  type RejectedClientStat,
  type SalesProposal,
} from '@/lib/types/sales-proposals';

const EMPTY_CATEGORY_LABEL = 'Senza categoria';
const EMPTY_CLIENT_LABEL = 'Senza cliente';
const EMPTY_REJECTION_REASON_LABEL = 'Senza motivazione';

export function formatProposalCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatProposalPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0,0%';
  return `${(ratio * 100).toLocaleString('it-IT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function formatProposalDateLabel(value: string): string {
  // Accepts both "YYYY-MM-DD" and full timestamps ("2026-10-02T06:53:00+00:00").
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function normalizeProposalStatus(stato: string): string {
  const normalized = stato.trim().toLowerCase();
  if (normalized === 'si' || normalized === 'sì') return PROPOSAL_STATUS_ACCEPTED;
  if (normalized === 'no') return PROPOSAL_STATUS_REJECTED;
  return stato.trim();
}

export function isAcceptedProposal(proposal: SalesProposal): boolean {
  return normalizeProposalStatus(proposal.stato) === PROPOSAL_STATUS_ACCEPTED;
}

export function isRejectedProposal(proposal: SalesProposal): boolean {
  return normalizeProposalStatus(proposal.stato) === PROPOSAL_STATUS_REJECTED;
}

/** NCC = costi interni di Chimera registrati come proposte (codice "NCC_…"), non vendite. */
export function isNccProposal(proposal: SalesProposal): boolean {
  return /^ncc/i.test((proposal.code || proposal.nome).trim());
}

export function isPendingProposal(proposal: SalesProposal): boolean {
  return !isAcceptedProposal(proposal) && !isRejectedProposal(proposal);
}

export function resolveProposalValue(proposal: SalesProposal): number | null {
  if (proposal.budgetFinale !== null) return proposal.budgetFinale;
  if (proposal.ultimoPrezzo !== null) return proposal.ultimoPrezzo;
  return null;
}

export function getProposalCreatedYear(proposal: SalesProposal): number | null {
  const date = new Date(proposal.creatoIl);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear();
}

/** Anno in cui la proposta conta: quello in cui è stata spostata, altrimenti quello di creazione. */
export function getProposalYear(proposal: SalesProposal): number | null {
  return proposal.annoRiferimento ?? getProposalCreatedYear(proposal);
}

/** Anni successivi alla creazione in cui si può spostare la proposta (fino all'anno prossimo). */
export function getProposalMoveYears(proposal: SalesProposal, currentYear: number): number[] {
  const createdYear = getProposalCreatedYear(proposal);
  if (!createdYear) return [];
  const years: number[] = [];
  for (let year = createdYear + 1; year <= currentYear + PROPOSAL_FUTURE_YEARS; year += 1) years.push(year);
  return years;
}

export function filterProposalsByYear(proposals: SalesProposal[], year: number): SalesProposal[] {
  return proposals.filter((proposal) => getProposalYear(proposal) === year);
}

export function collectProposalYears(proposals: SalesProposal[], currentYear: number): number[] {
  const years = new Set<number>(PROPOSAL_YEAR_OPTIONS_BASE);
  for (let year = currentYear; year <= currentYear + PROPOSAL_FUTURE_YEARS; year += 1) years.add(year);
  proposals.forEach((proposal) => {
    const year = getProposalYear(proposal);
    if (year) years.add(year);
  });
  return Array.from(years).sort((left, right) => left - right);
}

export function resolveLatestImportBatch(proposals: SalesProposal[]): string | null {
  if (proposals.length === 0) return null;
  return proposals.reduce((latest, proposal) => {
    if (!proposal.importBatch) return latest;
    if (!latest || proposal.importBatch > latest) return proposal.importBatch;
    return latest;
  }, '' as string) || null;
}

export function buildProposalKpis(proposals: SalesProposal[]): ProposalKpiSummary {
  const accepted = proposals.filter(isAcceptedProposal);
  const rejected = proposals.filter(isRejectedProposal);
  const pending = proposals.filter(isPendingProposal);
  const acceptedCount = accepted.length;
  const rejectedCount = rejected.length;
  const totalCount = proposals.length;
  const decidedCount = acceptedCount + rejectedCount;
  const acceptedTotal = sumProposalValues(accepted);
  const acceptedValuedCount = countProposalsWithValue(accepted);
  const conversionStats = buildAverageConversionStats(proposals);
  return {
    totalCount,
    acceptedCount,
    rejectedCount,
    openCount: pending.length,
    acceptedTotal,
    rejectedTotal: sumProposalValues(rejected),
    pendingTotal: sumProposalValues(pending),
    acceptedAverageTicket: acceptedValuedCount > 0 ? acceptedTotal / acceptedValuedCount : 0,
    acceptedValuedCount,
    averageConversionDays: conversionStats.averageDays,
    conversionSampleCount: conversionStats.sampleCount,
    conversionOnTotal: totalCount > 0 ? acceptedCount / totalCount : 0,
    conversionOnDecided: decidedCount > 0 ? acceptedCount / decidedCount : 0,
  };
}

export function normalizeProposalDateKey(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  const parsedIso = parseProposalDate(value);
  if (parsedIso) return parsedIso.slice(0, 10);
  const trimmed = value.trim();
  const isoPrefixMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefixMatch) {
    const isoDate = isoPrefixMatch[1];
    const date = new Date(`${isoDate}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) return isoDate;
  }
  return null;
}

function parseProposalDateKey(value: string | null | undefined): number | null {
  const key = normalizeProposalDateKey(value);
  if (!key) return null;
  const date = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

export function resolveProposalClosedDate(proposal: SalesProposal): string | null {
  if (isAcceptedProposal(proposal)) {
    return normalizeProposalDateKey(proposal.dataAccettazione);
  }
  if (isRejectedProposal(proposal)) {
    return normalizeProposalDateKey(proposal.dataRifiuto);
  }
  return null;
}

/**
 * Giorno di chiusura per la weekly review: Cerbero spesso non compila la data di
 * accettazione/rifiuto, quindi si ripiega su «Ultimo aggiornamento» (quando è cambiato lo stato).
 */
export function resolveProposalWeeklyCloseDate(proposal: SalesProposal): string | null {
  if (isAcceptedProposal(proposal)) {
    return normalizeProposalDateKey(proposal.dataAccettazione || proposal.ultimoAggiornamento);
  }
  if (isRejectedProposal(proposal)) {
    return normalizeProposalDateKey(proposal.dataRifiuto || proposal.ultimoAggiornamento);
  }
  return null;
}

export function buildAverageConversionStats(proposals: SalesProposal[]): {
  averageDays: number | null;
  sampleCount: number;
} {
  const durations: number[] = [];
  proposals.forEach((proposal) => {
    const createdKey = normalizeProposalDateKey(proposal.creatoIl);
    const closedKey = resolveProposalClosedDate(proposal);
    if (!createdKey || !closedKey) return;
    const createdMs = parseProposalDateKey(createdKey);
    const closedMs = parseProposalDateKey(closedKey);
    if (createdMs === null || closedMs === null || closedMs < createdMs) return;
    const days = (closedMs - createdMs) / (1000 * 60 * 60 * 24);
    durations.push(days);
  });
  if (durations.length === 0) {
    return { averageDays: null, sampleCount: 0 };
  }
  const totalDays = durations.reduce((sum, days) => sum + days, 0);
  return { averageDays: totalDays / durations.length, sampleCount: durations.length };
}

export function formatProposalConversionDuration(averageDays: number | null): string {
  if (averageDays === null || !Number.isFinite(averageDays)) return '—';
  if (averageDays < 7) {
    return `${Math.round(averageDays)} gg`;
  }
  const weeks = averageDays / 7;
  return `${weeks.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sett.`;
}

export interface ProposalWeekRange {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateKeyFromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function getIsoWeekRefFromDate(date: Date): ProposalIsoWeekRef {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const isoYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7);
  return { isoYear, isoWeek };
}

export function getIsoWeeksInYear(isoYear: number): number {
  return getIsoWeekRefFromDate(new Date(Date.UTC(isoYear, 11, 28))).isoWeek;
}

export function getWeekRangeFromIsoWeek(isoYear: number, isoWeek: number): ProposalWeekRange {
  const simple = new Date(Date.UTC(isoYear, 0, 1 + (isoWeek - 1) * 7));
  const dayOfWeek = simple.getUTCDay();
  const weekStartDate = new Date(simple);
  if (dayOfWeek <= 4) {
    weekStartDate.setUTCDate(simple.getUTCDate() - dayOfWeek + 1);
  } else {
    weekStartDate.setUTCDate(simple.getUTCDate() + 8 - dayOfWeek);
  }
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);
  const weekStart = dateKeyFromUtcMs(weekStartDate.getTime());
  const weekEnd = dateKeyFromUtcMs(weekEndDate.getTime());
  const weekLabel = `${formatProposalDateLabel(weekStart)} – ${formatProposalDateLabel(weekEnd)}`;
  return { weekStart, weekEnd, weekLabel };
}

export function getPreviousIsoWeekRef(referenceDate: Date = new Date()): ProposalIsoWeekRef {
  const currentRange = getWeekRangeFromIsoWeek(
    getIsoWeekRefFromDate(referenceDate).isoYear,
    getIsoWeekRefFromDate(referenceDate).isoWeek,
  );
  const currentMondayMs = parseProposalDateKey(currentRange.weekStart) ?? referenceDate.getTime();
  const previousMondayMs = currentMondayMs - 7 * MS_PER_DAY;
  return getIsoWeekRefFromDate(new Date(previousMondayMs));
}

export function collectProposalIsoYears(proposals: SalesProposal[], currentYear: number): number[] {
  const years = new Set<number>([currentYear]);
  proposals.forEach((proposal) => {
    const createdKey = normalizeProposalDateKey(proposal.creatoIl);
    if (createdKey) years.add(getIsoWeekRefFromDate(new Date(`${createdKey}T00:00:00Z`)).isoYear);
    const closedKey = resolveProposalWeeklyCloseDate(proposal);
    if (closedKey) years.add(getIsoWeekRefFromDate(new Date(`${closedKey}T00:00:00Z`)).isoYear);
  });
  return Array.from(years).sort((left, right) => right - left);
}

export function getPreviousWeekRange(referenceDate: Date = new Date()): ProposalWeekRange {
  const previous = getPreviousIsoWeekRef(referenceDate);
  return getWeekRangeFromIsoWeek(previous.isoYear, previous.isoWeek);
}

function isDateKeyInRange(dateKey: string, startKey: string, endKey: string): boolean {
  return dateKey >= startKey && dateKey <= endKey;
}

function wasProposalPendingAtWeekEnd(
  proposal: SalesProposal,
  weekStart: string,
  weekEnd: string,
): boolean {
  const createdKey = normalizeProposalDateKey(proposal.creatoIl);
  if (!createdKey || !isDateKeyInRange(createdKey, weekStart, weekEnd)) {
    return false;
  }
  const closedKey = resolveProposalWeeklyCloseDate(proposal);
  return !closedKey || closedKey > weekEnd;
}

export function buildProposalWeeklyReview(
  proposals: SalesProposal[],
  isoWeekRef: ProposalIsoWeekRef,
): ProposalWeeklyReviewSummary {
  const { isoYear, isoWeek } = isoWeekRef;
  const { weekStart, weekEnd, weekLabel } = getWeekRangeFromIsoWeek(isoYear, isoWeek);
  // Le pending includono anche le proposte della settimana prima ancora aperte a fine settimana.
  const pendingStart = dateKeyFromUtcMs((parseProposalDateKey(weekStart) ?? 0) - 7 * MS_PER_DAY);
  const newProposals: SalesProposal[] = [];
  const acceptedProposals: SalesProposal[] = [];
  const rejectedProposals: SalesProposal[] = [];
  const pendingProposals: SalesProposal[] = [];
  proposals.forEach((proposal) => {
    if (isNccProposal(proposal)) return;
    const createdKey = normalizeProposalDateKey(proposal.creatoIl);
    if (createdKey && isDateKeyInRange(createdKey, weekStart, weekEnd)) {
      newProposals.push(proposal);
    }
    if (wasProposalPendingAtWeekEnd(proposal, pendingStart, weekEnd)) {
      pendingProposals.push(proposal);
    }
    const closedKey = resolveProposalWeeklyCloseDate(proposal);
    if (closedKey && isDateKeyInRange(closedKey, weekStart, weekEnd)) {
      if (isAcceptedProposal(proposal)) acceptedProposals.push(proposal);
      else rejectedProposals.push(proposal);
    }
  });
  const byCloseDateDesc = (left: SalesProposal, right: SalesProposal): number => {
    const leftKey = resolveProposalWeeklyCloseDate(left) || left.creatoIl;
    const rightKey = resolveProposalWeeklyCloseDate(right) || right.creatoIl;
    return rightKey.localeCompare(leftKey);
  };
  const sortByCloseOrCreate = (left: SalesProposal, right: SalesProposal): number => {
    return right.creatoIl.localeCompare(left.creatoIl);
  };
  newProposals.sort(sortByCloseOrCreate);
  acceptedProposals.sort(byCloseDateDesc);
  rejectedProposals.sort(byCloseDateDesc);
  pendingProposals.sort(sortByCloseOrCreate);
  return {
    isoYear,
    isoWeek,
    weekLabel,
    weekStart,
    weekEnd,
    newCount: newProposals.length,
    newTotalValue: sumProposalValues(newProposals),
    acceptedCount: acceptedProposals.length,
    acceptedTotalValue: sumProposalValues(acceptedProposals),
    rejectedCount: rejectedProposals.length,
    rejectedTotalValue: sumProposalValues(rejectedProposals),
    pendingCount: pendingProposals.length,
    pendingTotalValue: sumProposalValues(pendingProposals),
    newProposals,
    acceptedProposals,
    rejectedProposals,
    pendingProposals,
  };
}

function countProposalsWithValue(proposals: SalesProposal[]): number {
  return proposals.reduce((count, proposal) => {
    return resolveProposalValue(proposal) !== null ? count + 1 : count;
  }, 0);
}

export function sumProposalValues(proposals: SalesProposal[]): number {
  return proposals.reduce((total, proposal) => {
    const value = resolveProposalValue(proposal);
    return value !== null ? total + value : total;
  }, 0);
}

export function filterProposalsForDetail(
  proposals: SalesProposal[],
  filter: ProposalDetailFilter,
): SalesProposal[] {
  if (filter === 'accepted') return proposals.filter(isAcceptedProposal);
  if (filter === 'rejected') return proposals.filter(isRejectedProposal);
  return proposals.filter(isPendingProposal);
}

export function sortProposalsByCreatedDate(proposals: SalesProposal[]): SalesProposal[] {
  return [...proposals].sort((left, right) => {
    const byDate = right.creatoIl.localeCompare(left.creatoIl);
    if (byDate !== 0) return byDate;
    return left.nome.localeCompare(right.nome, 'it', { sensitivity: 'base' });
  });
}

function sortProposalItems(items: SalesProposal[]): SalesProposal[] {
  return sortProposalsByCreatedDate(items);
}

function buildProposalDetailGroups(
  proposals: SalesProposal[],
  resolveLabel: (proposal: SalesProposal) => string,
  sortLabels: (labels: string[]) => string[],
): ProposalDetailGroup[] {
  const grouped = new Map<string, SalesProposal[]>();
  proposals.forEach((proposal) => {
    const label = resolveLabel(proposal);
    const current = grouped.get(label) || [];
    current.push(proposal);
    grouped.set(label, current);
  });
  return sortLabels(Array.from(grouped.keys())).map((label) => {
    const items = grouped.get(label) || [];
    const sortedItems = sortProposalItems(items);
    return {
      label,
      proposals: sortedItems,
      count: sortedItems.length,
      totalValue: sumProposalValues(sortedItems),
    };
  });
}

export function buildProposalCategoryGroups(proposals: SalesProposal[]): ProposalDetailGroup[] {
  return buildProposalDetailGroups(
    proposals,
    (proposal) => resolveCategoryLabel(proposal.categoria),
    sortProposalCategories,
  );
}

export function buildProposalRejectionReasonGroups(proposals: SalesProposal[]): ProposalDetailGroup[] {
  return buildProposalDetailGroups(
    proposals,
    (proposal) => resolveRejectionReasonLabel(proposal.motivoRifiuto),
    sortRejectionReasonLabels,
  ).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.label.localeCompare(right.label, 'it', { sensitivity: 'base' });
  });
}

export function buildRejectionReasonStats(proposals: SalesProposal[]): ProposalRejectionReasonStat[] {
  const groups = buildProposalRejectionReasonGroups(proposals);
  return groups
    .map((group) => ({
      motivo: group.label,
      count: group.count,
      totalValue: group.totalValue,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.motivo.localeCompare(right.motivo, 'it', { sensitivity: 'base' });
    });
}

export function resolveProposalDetailTitle(filter: ProposalDetailFilter): string {
  if (filter === 'accepted') return 'Proposte accettate';
  if (filter === 'rejected') return 'Proposte rifiutate';
  return 'Proposte pending';
}

export function resolveProposalDetailGroupLabel(filter: ProposalDetailFilter): string {
  if (filter === 'rejected') return 'motivazione';
  return 'categoria';
}

function resolveCategoryLabel(categoria: string): string {
  return categoria.trim() || EMPTY_CATEGORY_LABEL;
}

function resolveRejectionReasonLabel(motivoRifiuto: string): string {
  return motivoRifiuto.trim() || EMPTY_REJECTION_REASON_LABEL;
}

function sortRejectionReasonLabels(labels: string[]): string[] {
  return [...labels].sort((left, right) => {
    if (left === EMPTY_REJECTION_REASON_LABEL) return 1;
    if (right === EMPTY_REJECTION_REASON_LABEL) return -1;
    return left.localeCompare(right, 'it', { sensitivity: 'base' });
  });
}

function resolveClientLabel(cliente: string): string {
  return cliente.trim() || EMPTY_CLIENT_LABEL;
}

export function sortProposalCategories(categories: string[]): string[] {
  const knownOrder = new Map<string, number>(
    KNOWN_PROPOSAL_CATEGORIES.map((name, index) => [name, index]),
  );
  return [...categories].sort((left, right) => {
    const leftKnown = knownOrder.get(left);
    const rightKnown = knownOrder.get(right);
    if (leftKnown !== undefined && rightKnown !== undefined) return leftKnown - rightKnown;
    if (leftKnown !== undefined) return -1;
    if (rightKnown !== undefined) return 1;
    if (left === EMPTY_CATEGORY_LABEL) return 1;
    if (right === EMPTY_CATEGORY_LABEL) return -1;
    return left.localeCompare(right, 'it');
  });
}

export function buildCategoryTicketStats(proposals: SalesProposal[]): CategoryTicketStat[] {
  const accepted = proposals.filter(isAcceptedProposal);
  const grouped = new Map<string, CategoryTicketStat>();
  accepted.forEach((proposal) => {
    const categoria = resolveCategoryLabel(proposal.categoria);
    const current = grouped.get(categoria) || {
      categoria,
      count: 0,
      valuedCount: 0,
      totalValue: 0,
      averageTicket: 0,
    };
    current.count += 1;
    const value = resolveProposalValue(proposal);
    if (value !== null) {
      current.valuedCount += 1;
      current.totalValue += value;
    }
    grouped.set(categoria, current);
  });
  return sortProposalCategories(Array.from(grouped.keys()))
    .map((categoria) => {
      const stat = grouped.get(categoria);
      if (!stat) {
        return { categoria, count: 0, valuedCount: 0, totalValue: 0, averageTicket: 0 };
      }
      return {
        ...stat,
        averageTicket: stat.valuedCount > 0 ? stat.totalValue / stat.valuedCount : 0,
      };
    });
}

export function buildRejectedClientStats(proposals: SalesProposal[]): RejectedClientStat[] {
  const rejected = proposals.filter(isRejectedProposal);
  const grouped = new Map<string, RejectedClientStat>();
  rejected.forEach((proposal) => {
    const cliente = resolveClientLabel(proposal.cliente);
    const current = grouped.get(cliente) || {
      cliente,
      rejectedCount: 0,
      rejectedTotal: 0,
    };
    current.rejectedCount += 1;
    const value = resolveProposalValue(proposal);
    if (value !== null) current.rejectedTotal += value;
    grouped.set(cliente, current);
  });
  return Array.from(grouped.values()).sort((left, right) => {
    if (right.rejectedCount !== left.rejectedCount) return right.rejectedCount - left.rejectedCount;
    if (right.rejectedTotal !== left.rejectedTotal) return right.rejectedTotal - left.rejectedTotal;
    return left.cliente.localeCompare(right.cliente, 'it', { sensitivity: 'base' });
  });
}
