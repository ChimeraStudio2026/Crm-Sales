import {
  KNOWN_PROPOSAL_CATEGORIES,
  PROPOSAL_STATUS_ACCEPTED,
  PROPOSAL_STATUS_REJECTED,
  PROPOSAL_YEAR_OPTIONS_BASE,
  type CategoryTicketStat,
  type ClientProposalStat,
  type ProposalDetailGroup,
  type ProposalDetailFilter,
  type ProposalKpiSummary,
  type ProposalRejectionReasonStat,
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
  const date = new Date(`${value}T00:00:00Z`);
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

export function filterProposalsByYear(proposals: SalesProposal[], year: number): SalesProposal[] {
  return proposals.filter((proposal) => getProposalCreatedYear(proposal) === year);
}

export function collectProposalYears(proposals: SalesProposal[], currentYear: number): number[] {
  const years = new Set<number>(PROPOSAL_YEAR_OPTIONS_BASE);
  years.add(currentYear);
  proposals.forEach((proposal) => {
    const year = getProposalCreatedYear(proposal);
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
    conversionOnTotal: totalCount > 0 ? acceptedCount / totalCount : 0,
    conversionOnDecided: decidedCount > 0 ? acceptedCount / decidedCount : 0,
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

export function buildClientProposalStats(proposals: SalesProposal[]): ClientProposalStat[] {
  const accepted = proposals.filter(isAcceptedProposal);
  const grouped = new Map<string, ClientProposalStat>();
  accepted.forEach((proposal) => {
    const cliente = resolveClientLabel(proposal.cliente);
    const categoria = resolveCategoryLabel(proposal.categoria);
    const current = grouped.get(cliente) || {
      cliente,
      acceptedCount: 0,
      acceptedTotal: 0,
      countsByCategory: {},
    };
    current.acceptedCount += 1;
    const value = resolveProposalValue(proposal);
    if (value !== null) current.acceptedTotal += value;
    current.countsByCategory[categoria] = (current.countsByCategory[categoria] || 0) + 1;
    grouped.set(cliente, current);
  });
  return Array.from(grouped.values()).sort((left, right) => {
    if (right.acceptedCount !== left.acceptedCount) return right.acceptedCount - left.acceptedCount;
    return left.cliente.localeCompare(right.cliente, 'it');
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

export function collectClientTableCategories(stats: ClientProposalStat[]): string[] {
  const categories = new Set<string>();
  stats.forEach((stat) => {
    Object.keys(stat.countsByCategory).forEach((categoria) => categories.add(categoria));
  });
  return sortProposalCategories(Array.from(categories));
}
