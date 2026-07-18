import type { Dispatch, SetStateAction } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyCreativeProposalStageChange, resolveProgressPctForStage } from '@/lib/propositivita/index';
import { isOwner } from '@/lib/constants/crm';
import { getDefaultOwnerForWorkspace } from '@/lib/crm/workspace-clients';
import { createUniqueId, getTodayString } from '@/lib/crm/utils';
import {
  deleteCreativeProposal,
  deleteSpecialDiscount,
  persistSingleCreativeProposal,
  persistSingleSpecialDiscount,
} from '@/lib/supabase/propositivita-database';
import type {
  CreativeProposal,
  CreativeProposalAction,
  CreativeProposalStage,
  SpecialDiscount,
  SpecialDiscountType,
} from '@/lib/types/propositivita';
import type { Client } from '@/lib/types/crm';

interface PropositivitaPersistDeps {
  db: SupabaseClient | null;
  setCreativeProposals: Dispatch<SetStateAction<CreativeProposal[]>>;
  setSpecialDiscounts: Dispatch<SetStateAction<SpecialDiscount[]>>;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'danger') => void;
  getClientById: (clientId: string) => Client | undefined;
}

export interface CreateCreativeProposalInput {
  clientId: string;
  workspaceId: string;
  title: string;
  owner?: string;
  stage?: CreativeProposalStage;
  notes?: string;
}

export interface CreateSpecialDiscountInput {
  clientId: string;
  workspaceId: string;
  owner?: string;
  type: SpecialDiscountType;
  amount: number;
  reason?: string;
  date?: string;
  notes?: string;
}

export function createPropositivitaActions(
  deps: PropositivitaPersistDeps,
  getState: () => { creativeProposals: CreativeProposal[]; specialDiscounts: SpecialDiscount[] },
) {
  let mutationQueue: Promise<void> = Promise.resolve();

  const runMutation = (operation: () => Promise<void>): Promise<void> => {
    mutationQueue = mutationQueue.then(operation, operation);
    return mutationQueue;
  };

  const resolveOwner = (clientId: string, workspaceId: string, owner?: string): string => {
    if (owner && isOwner(owner)) return owner;
    const client = deps.getClientById(clientId);
    if (client?.owner && isOwner(client.owner)) return client.owner;
    return getDefaultOwnerForWorkspace(workspaceId);
  };

  const persistCreativeProposal = async (proposal: CreativeProposal): Promise<void> => {
    if (!deps.db) return;
    await persistSingleCreativeProposal(deps.db, proposal);
  };

  const persistSpecialDiscount = async (discount: SpecialDiscount): Promise<void> => {
    if (!deps.db) return;
    await persistSingleSpecialDiscount(deps.db, discount);
  };

  const createCreativeProposal = async (input: CreateCreativeProposalInput): Promise<string> => {
    const stage = input.stage || 'idea_nata';
    const timestamp = new Date().toISOString();
    const initialAction: CreativeProposalAction = {
      stage,
      timestamp,
      note: 'Creatività registrata',
    };
    const proposal: CreativeProposal = {
      id: createUniqueId('creative'),
      clientId: input.clientId,
      workspaceId: input.workspaceId,
      title: input.title.trim(),
      owner: resolveOwner(input.clientId, input.workspaceId, input.owner),
      stage,
      progressPct: resolveProgressPctForStage(stage),
      bornAt: timestamp,
      assignedAt: stage === 'assegnata' ? timestamp : '',
      sentAt: stage === 'inviata_cliente' ? timestamp : '',
      feedbackAt: stage === 'feedback_ricevuto' ? timestamp : '',
      clientFeedback: '',
      actions: [initialAction],
      notes: input.notes?.trim() || '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await runMutation(async () => {
      deps.setCreativeProposals((prev) => [proposal, ...prev]);
      try {
        await persistCreativeProposal(proposal);
      } catch (error) {
        deps.setCreativeProposals((prev) => prev.filter((item) => item.id !== proposal.id));
        deps.showToast(
          `Errore salvataggio creatività: ${error instanceof Error ? error.message : 'errore'}`,
          'danger',
        );
        throw error;
      }
    });
    return proposal.id;
  };

  const updateCreativeProposalStage = async (
    proposalId: string,
    nextStage: CreativeProposalStage,
    note = '',
  ): Promise<void> => {
    await runMutation(async () => {
      const current = getState().creativeProposals.find((item) => item.id === proposalId);
      if (!current) return;
      const updated = applyCreativeProposalStageChange(current, nextStage, note);
      updated.updatedAt = new Date().toISOString();
      deps.setCreativeProposals((prev) => prev.map((item) => (item.id === proposalId ? updated : item)));
      try {
        await persistCreativeProposal(updated);
      } catch (error) {
        deps.setCreativeProposals((prev) => prev.map((item) => (item.id === proposalId ? current : item)));
        deps.showToast(
          `Errore aggiornamento stadio: ${error instanceof Error ? error.message : 'errore'}`,
          'danger',
        );
        throw error;
      }
    });
  };

  const updateCreativeProposalFields = async (
    proposalId: string,
    patch: Partial<Pick<CreativeProposal, 'title' | 'owner' | 'notes' | 'clientFeedback'>>,
  ): Promise<void> => {
    await runMutation(async () => {
      const current = getState().creativeProposals.find((item) => item.id === proposalId);
      if (!current) return;
      const updated: CreativeProposal = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      deps.setCreativeProposals((prev) => prev.map((item) => (item.id === proposalId ? updated : item)));
      try {
        await persistCreativeProposal(updated);
      } catch (error) {
        deps.setCreativeProposals((prev) => prev.map((item) => (item.id === proposalId ? current : item)));
        deps.showToast(
          `Errore aggiornamento creatività: ${error instanceof Error ? error.message : 'errore'}`,
          'danger',
        );
        throw error;
      }
    });
  };

  const removeCreativeProposal = async (proposalId: string): Promise<void> => {
    await runMutation(async () => {
      const current = getState().creativeProposals;
      const removed = current.find((item) => item.id === proposalId);
      if (!removed) return;
      deps.setCreativeProposals((prev) => prev.filter((item) => item.id !== proposalId));
      if (!deps.db) return;
      try {
        await deleteCreativeProposal(deps.db, proposalId);
      } catch (error) {
        deps.setCreativeProposals(current);
        deps.showToast(
          `Errore eliminazione creatività: ${error instanceof Error ? error.message : 'errore'}`,
          'danger',
        );
        throw error;
      }
    });
  };

  const createSpecialDiscount = async (input: CreateSpecialDiscountInput): Promise<string> => {
    const timestamp = new Date().toISOString();
    const discount: SpecialDiscount = {
      id: createUniqueId('discount'),
      clientId: input.clientId,
      workspaceId: input.workspaceId,
      owner: resolveOwner(input.clientId, input.workspaceId, input.owner),
      type: input.type,
      amount: Math.abs(input.amount),
      reason: input.reason?.trim() || '',
      date: input.date || getTodayString(),
      notes: input.notes?.trim() || '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await runMutation(async () => {
      deps.setSpecialDiscounts((prev) => [discount, ...prev]);
      try {
        await persistSpecialDiscount(discount);
      } catch (error) {
        deps.setSpecialDiscounts((prev) => prev.filter((item) => item.id !== discount.id));
        deps.showToast(
          `Errore salvataggio voce: ${error instanceof Error ? error.message : 'errore'}`,
          'danger',
        );
        throw error;
      }
    });
    return discount.id;
  };

  const removeSpecialDiscount = async (discountId: string): Promise<void> => {
    await runMutation(async () => {
      const current = getState().specialDiscounts;
      const removed = current.find((item) => item.id === discountId);
      if (!removed) return;
      deps.setSpecialDiscounts((prev) => prev.filter((item) => item.id !== discountId));
      if (!deps.db) return;
      try {
        await deleteSpecialDiscount(deps.db, discountId);
      } catch (error) {
        deps.setSpecialDiscounts(current);
        deps.showToast(
          `Errore eliminazione voce: ${error instanceof Error ? error.message : 'errore'}`,
          'danger',
        );
        throw error;
      }
    });
  };

  return {
    createCreativeProposal,
    updateCreativeProposalStage,
    updateCreativeProposalFields,
    removeCreativeProposal,
    createSpecialDiscount,
    removeSpecialDiscount,
  };
}
