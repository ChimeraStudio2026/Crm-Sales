import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeCreativeProposalActions } from '@/lib/propositivita/index';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';
import type {
  CreativeProposal,
  CreativeProposalStage,
  SpecialDiscount,
  SpecialDiscountType,
} from '@/lib/types/propositivita';
import { isCreativeProposalStage, isSpecialDiscountType } from '@/lib/types/propositivita';

interface CreativeProposalRow {
  id: string;
  client_id: string;
  workspace_id: string | null;
  title: string;
  owner: string | null;
  stage: string;
  progress_pct: number;
  born_at: string | null;
  assigned_at: string | null;
  sent_at: string | null;
  feedback_at: string | null;
  client_feedback: string | null;
  actions: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SpecialDiscountRow {
  id: string;
  client_id: string;
  workspace_id: string | null;
  owner: string | null;
  type: string;
  amount: number | string;
  reason: string | null;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeStage(value: string | null | undefined): CreativeProposalStage {
  if (value && isCreativeProposalStage(value)) return value;
  return 'idea_nata';
}

function normalizeDiscountType(value: string | null | undefined): SpecialDiscountType {
  if (value && isSpecialDiscountType(value)) return value;
  return 'sconto';
}

function rowToCreativeProposal(row: CreativeProposalRow): CreativeProposal {
  return {
    id: row.id,
    clientId: row.client_id,
    workspaceId: row.workspace_id || DEFAULT_WORKSPACE_ID,
    title: row.title,
    owner: row.owner || '',
    stage: normalizeStage(row.stage),
    progressPct: Number(row.progress_pct) || 0,
    bornAt: row.born_at || '',
    assignedAt: row.assigned_at || '',
    sentAt: row.sent_at || '',
    feedbackAt: row.feedback_at || '',
    clientFeedback: row.client_feedback || '',
    actions: normalizeCreativeProposalActions(row.actions),
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function creativeProposalToRow(proposal: CreativeProposal): Record<string, unknown> {
  return {
    id: proposal.id,
    client_id: proposal.clientId,
    workspace_id: proposal.workspaceId || DEFAULT_WORKSPACE_ID,
    title: proposal.title,
    owner: proposal.owner || '',
    stage: proposal.stage,
    progress_pct: proposal.progressPct,
    born_at: proposal.bornAt || new Date().toISOString(),
    assigned_at: proposal.assignedAt || null,
    sent_at: proposal.sentAt || null,
    feedback_at: proposal.feedbackAt || null,
    client_feedback: proposal.clientFeedback || '',
    actions: proposal.actions,
    notes: proposal.notes || '',
    updated_at: new Date().toISOString(),
  };
}

function rowToSpecialDiscount(row: SpecialDiscountRow): SpecialDiscount {
  return {
    id: row.id,
    clientId: row.client_id,
    workspaceId: row.workspace_id || DEFAULT_WORKSPACE_ID,
    owner: row.owner || '',
    type: normalizeDiscountType(row.type),
    amount: Number(row.amount) || 0,
    reason: row.reason || '',
    date: row.date || '',
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function specialDiscountToRow(discount: SpecialDiscount): Record<string, unknown> {
  return {
    id: discount.id,
    client_id: discount.clientId,
    workspace_id: discount.workspaceId || DEFAULT_WORKSPACE_ID,
    owner: discount.owner || '',
    type: discount.type,
    amount: discount.amount,
    reason: discount.reason || '',
    date: discount.date,
    notes: discount.notes || '',
    updated_at: new Date().toISOString(),
  };
}

export async function fetchCreativeProposals(db: SupabaseClient): Promise<CreativeProposal[]> {
  const { data, error } = await db
    .from('creative_proposals')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => rowToCreativeProposal(row as CreativeProposalRow));
}

export async function fetchSpecialDiscounts(db: SupabaseClient): Promise<SpecialDiscount[]> {
  const { data, error } = await db
    .from('special_discounts')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => rowToSpecialDiscount(row as SpecialDiscountRow));
}

export async function persistSingleCreativeProposal(
  db: SupabaseClient,
  proposal: CreativeProposal,
): Promise<void> {
  const { error } = await db
    .from('creative_proposals')
    .upsert(creativeProposalToRow(proposal), { onConflict: 'id' });
  if (error) throw error;
}

export async function persistSingleSpecialDiscount(
  db: SupabaseClient,
  discount: SpecialDiscount,
): Promise<void> {
  const { error } = await db
    .from('special_discounts')
    .upsert(specialDiscountToRow(discount), { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteCreativeProposal(db: SupabaseClient, proposalId: string): Promise<void> {
  const { error } = await db.from('creative_proposals').delete().eq('id', proposalId);
  if (error) throw error;
}

export async function deleteSpecialDiscount(db: SupabaseClient, discountId: string): Promise<void> {
  const { error } = await db.from('special_discounts').delete().eq('id', discountId);
  if (error) throw error;
}
