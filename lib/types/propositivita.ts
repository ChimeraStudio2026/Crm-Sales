export const CREATIVE_PROPOSAL_STAGES = [
  'idea_nata',
  'assegnata',
  'in_sviluppo',
  'inviata_cliente',
  'feedback_ricevuto',
  'chiusa_approvata',
  'chiusa_rifiutata',
] as const;

export type CreativeProposalStage = typeof CREATIVE_PROPOSAL_STAGES[number];

export const SPECIAL_DISCOUNT_TYPES = [
  'sconto',
  'spesa_extra',
  'omaggio',
] as const;

export type SpecialDiscountType = typeof SPECIAL_DISCOUNT_TYPES[number];

export interface CreativeProposalAction {
  stage: CreativeProposalStage;
  timestamp: string;
  note: string;
}

export interface CreativeProposal {
  id: string;
  clientId: string;
  workspaceId: string;
  title: string;
  owner: string;
  stage: CreativeProposalStage;
  progressPct: number;
  bornAt: string;
  assignedAt: string;
  sentAt: string;
  feedbackAt: string;
  clientFeedback: string;
  actions: CreativeProposalAction[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpecialDiscount {
  id: string;
  clientId: string;
  workspaceId: string;
  owner: string;
  type: SpecialDiscountType;
  amount: number;
  reason: string;
  date: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export function isCreativeProposalStage(value: string): value is CreativeProposalStage {
  return (CREATIVE_PROPOSAL_STAGES as readonly string[]).includes(value);
}

export function isSpecialDiscountType(value: string): value is SpecialDiscountType {
  return (SPECIAL_DISCOUNT_TYPES as readonly string[]).includes(value);
}
