export const PROPOSAL_STATUS_ACCEPTED = 'Si' as const;
export const PROPOSAL_STATUS_REJECTED = 'No' as const;

export const PROPOSAL_YEAR_OPTIONS_BASE = [2025, 2026] as const;

export const KNOWN_PROPOSAL_CATEGORIES = [
  'Mini Prod',
  'Content Base',
  'Eventi',
  'Prod',
  'Big Prod',
  'Content Complesso',
  'NOVA',
] as const;

export interface SalesProposal {
  id: number;
  code: string;
  nome: string;
  stato: string;
  ultimoPrezzo: number | null;
  descrizione: string;
  categoria: string;
  cliente: string;
  motivoRifiuto: string;
  dataRifiuto: string | null;
  dataAccettazione: string | null;
  ultimoAggiornamento: string | null;
  creatoIl: string;
  contattatoDa: string;
  tipo: string;
  budgetFinale: number | null;
  workspaceId: string;
  importBatch: string;
  createdAt: string;
}

export interface SalesProposalImportRow {
  code: string;
  nome: string;
  stato: string;
  ultimoPrezzo: number | null;
  descrizione: string;
  categoria: string;
  cliente: string;
  motivoRifiuto: string;
  dataRifiuto: string | null;
  dataAccettazione: string | null;
  ultimoAggiornamento: string | null;
  creatoIl: string;
  contattatoDa: string;
  tipo: string;
  budgetFinale: number | null;
}

export interface SalesProposalParseIssue {
  rowNumber: number;
  nome: string;
  reason: string;
}

export interface SalesProposalParseResult {
  rows: SalesProposalImportRow[];
  skipped: SalesProposalParseIssue[];
  duplicateInFile: number;
}

export interface ProposalKpiSummary {
  totalCount: number;
  acceptedCount: number;
  rejectedCount: number;
  openCount: number;
  acceptedTotal: number;
  rejectedTotal: number;
  pendingTotal: number;
  acceptedAverageTicket: number;
  acceptedValuedCount: number;
  conversionOnTotal: number;
  conversionOnDecided: number;
}

export type ProposalDetailFilter = 'accepted' | 'rejected' | 'pending';

export interface ProposalDetailGroup {
  label: string;
  proposals: SalesProposal[];
  count: number;
  totalValue: number;
}

export interface ProposalRejectionReasonStat {
  motivo: string;
  count: number;
  totalValue: number;
}

export interface RejectedClientStat {
  cliente: string;
  rejectedCount: number;
  rejectedTotal: number;
}

export interface CategoryTicketStat {
  categoria: string;
  count: number;
  valuedCount: number;
  totalValue: number;
  averageTicket: number;
}

export interface ClientProposalStat {
  cliente: string;
  acceptedCount: number;
  acceptedTotal: number;
  countsByCategory: Record<string, number>;
}
