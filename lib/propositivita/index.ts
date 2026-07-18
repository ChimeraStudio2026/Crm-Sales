import type {
  CreativeProposal,
  CreativeProposalAction,
  CreativeProposalStage,
  SpecialDiscount,
} from '@/lib/types/propositivita';
import { CREATIVE_PROPOSAL_STAGES } from '@/lib/types/propositivita';

export const CREATIVE_PROPOSAL_STAGE_LABELS: Record<CreativeProposalStage, string> = {
  idea_nata: 'Idea nata',
  assegnata: 'Assegnata',
  in_sviluppo: 'In sviluppo',
  inviata_cliente: 'Inviata al cliente',
  feedback_ricevuto: 'Feedback ricevuto',
  chiusa_approvata: 'Chiusa approvata',
  chiusa_rifiutata: 'Chiusa rifiutata',
};

export const CREATIVE_PROPOSAL_STAGE_PROGRESS: Record<CreativeProposalStage, number> = {
  idea_nata: 10,
  assegnata: 25,
  in_sviluppo: 50,
  inviata_cliente: 75,
  feedback_ricevuto: 90,
  chiusa_approvata: 100,
  chiusa_rifiutata: 100,
};

export const SPECIAL_DISCOUNT_TYPE_LABELS = {
  sconto: 'Sconto',
  spesa_extra: 'Spesa extra',
  omaggio: 'Omaggio',
} as const;

export const TERMINAL_CREATIVE_STAGES: readonly CreativeProposalStage[] = [
  'chiusa_approvata',
  'chiusa_rifiutata',
];

export function resolveProgressPctForStage(stage: CreativeProposalStage): number {
  return CREATIVE_PROPOSAL_STAGE_PROGRESS[stage];
}

export function getNextCreativeProposalStage(stage: CreativeProposalStage): CreativeProposalStage | null {
  const index = CREATIVE_PROPOSAL_STAGES.indexOf(stage);
  if (index < 0 || index >= CREATIVE_PROPOSAL_STAGES.length - 1) return null;
  return CREATIVE_PROPOSAL_STAGES[index + 1];
}

export function getPreviousCreativeProposalStage(stage: CreativeProposalStage): CreativeProposalStage | null {
  const index = CREATIVE_PROPOSAL_STAGES.indexOf(stage);
  if (index <= 0) return null;
  return CREATIVE_PROPOSAL_STAGES[index - 1];
}

export function buildCreativeActionTimestamp(actionDate: string): string {
  return `${actionDate}T12:00:00.000Z`;
}

export function normalizeCreativeProposalActions(value: unknown): CreativeProposalAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const stage = typeof item.stage === 'string' && CREATIVE_PROPOSAL_STAGES.includes(item.stage as CreativeProposalStage)
        ? item.stage as CreativeProposalStage
        : 'idea_nata';
      const timestamp = typeof item.timestamp === 'string'
        ? item.timestamp
        : new Date().toISOString();
      const date = typeof item.date === 'string'
        ? item.date
        : timestamp.slice(0, 10);
      return {
        stage,
        date,
        timestamp,
        note: typeof item.note === 'string' ? item.note : '',
      };
    });
}

export function resolveLastCreativeActionAt(proposal: CreativeProposal): string {
  if (proposal.actions.length === 0) return proposal.updatedAt || proposal.createdAt;
  const sorted = [...proposal.actions].sort(
    (left, right) => right.timestamp.localeCompare(left.timestamp),
  );
  return sorted[0]?.timestamp || proposal.updatedAt || proposal.createdAt;
}

export function getCreativeProposalIdleDays(proposal: CreativeProposal, referenceDate = new Date()): number {
  const lastActionAt = resolveLastCreativeActionAt(proposal);
  const lastDate = new Date(lastActionAt);
  if (Number.isNaN(lastDate.getTime())) return 0;
  const diffMs = referenceDate.getTime() - lastDate.getTime();
  return Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 0);
}

export function isCreativeProposalStale(
  proposal: CreativeProposal,
  staleDays: number,
  referenceDate = new Date(),
): boolean {
  if (TERMINAL_CREATIVE_STAGES.includes(proposal.stage)) return false;
  return getCreativeProposalIdleDays(proposal, referenceDate) >= staleDays;
}

export function applyCreativeProposalStageChange(
  proposal: CreativeProposal,
  nextStage: CreativeProposalStage,
  actionDate: string,
  note = '',
): CreativeProposal {
  if (proposal.stage === nextStage) return proposal;
  const timestamp = buildCreativeActionTimestamp(actionDate);
  const nextAction: CreativeProposalAction = {
    stage: nextStage,
    date: actionDate,
    timestamp,
    note: note.trim(),
  };
  const nextProposal: CreativeProposal = {
    ...proposal,
    stage: nextStage,
    progressPct: resolveProgressPctForStage(nextStage),
    actions: [...proposal.actions, nextAction],
  };
  if (nextStage === 'assegnata' && !nextProposal.assignedAt) {
    nextProposal.assignedAt = timestamp;
  }
  if (nextStage === 'inviata_cliente' && !nextProposal.sentAt) {
    nextProposal.sentAt = timestamp;
  }
  if (nextStage === 'feedback_ricevuto' && !nextProposal.feedbackAt) {
    nextProposal.feedbackAt = timestamp;
  }
  return nextProposal;
}

export function filterCreativeProposalsByWorkspace(
  proposals: CreativeProposal[],
  workspaceId: string,
): CreativeProposal[] {
  return proposals.filter((proposal) => proposal.workspaceId === workspaceId);
}

export function filterSpecialDiscountsByWorkspace(
  discounts: SpecialDiscount[],
  workspaceId: string,
): SpecialDiscount[] {
  return discounts.filter((discount) => discount.workspaceId === workspaceId);
}

export interface ClientYearlyDiscountTotals {
  clientId: string;
  totalSconti: number;
  totalExtra: number;
  totalOmaggi: number;
}

export function buildYearlyDiscountTotalsByClient(
  discounts: SpecialDiscount[],
  year: number,
): ClientYearlyDiscountTotals[] {
  const totals = new Map<string, ClientYearlyDiscountTotals>();
  discounts.forEach((discount) => {
    const discountYear = Number(discount.date.slice(0, 4));
    if (discountYear !== year) return;
    const current = totals.get(discount.clientId) || {
      clientId: discount.clientId,
      totalSconti: 0,
      totalExtra: 0,
      totalOmaggi: 0,
    };
    if (discount.type === 'sconto') current.totalSconti += discount.amount;
    if (discount.type === 'spesa_extra') current.totalExtra += discount.amount;
    if (discount.type === 'omaggio') current.totalOmaggi += discount.amount;
    totals.set(discount.clientId, current);
  });
  return [...totals.values()];
}

export function getStaleCreativeProposals(
  proposals: CreativeProposal[],
  staleDays: number,
): CreativeProposal[] {
  return proposals
    .filter((proposal) => isCreativeProposalStale(proposal, staleDays))
    .sort((left, right) => resolveLastCreativeActionAt(left).localeCompare(resolveLastCreativeActionAt(right)));
}

export function getCreativeStageBadgeClass(stage: CreativeProposalStage): string {
  if (stage === 'chiusa_approvata') return 'propositivita-badge is-approved';
  if (stage === 'chiusa_rifiutata') return 'propositivita-badge is-rejected';
  if (stage === 'inviata_cliente' || stage === 'feedback_ricevuto') return 'propositivita-badge is-sent';
  return 'propositivita-badge is-neutral';
}

export function getDiscountTypeBadgeClass(type: SpecialDiscount['type']): string {
  if (type === 'sconto') return 'propositivita-badge is-discount';
  if (type === 'omaggio') return 'propositivita-badge is-gift';
  return 'propositivita-badge is-extra';
}
