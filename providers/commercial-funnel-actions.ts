import type { Dispatch, SetStateAction } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createEmptyFunnelActions } from '@/lib/commercial-funnel/index';
import { createUniqueId } from '@/lib/crm/utils';
import {
  deleteCommercialFunnelEntry,
  deleteCommercialFunnelEntriesByCampaign,
  persistCommercialFunnelEntries,
} from '@/lib/supabase/commercial-funnel-database';
import type { CommercialFunnelEntry, FunnelActionType, FunnelClientRef } from '@/lib/types/commercial-funnel';

interface CommercialFunnelPersistDeps {
  db: SupabaseClient | null;
  setCommercialFunnelEntries: Dispatch<SetStateAction<CommercialFunnelEntry[]>>;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'danger') => void;
}

export function createCommercialFunnelActions(
  deps: CommercialFunnelPersistDeps,
  getEntries: () => CommercialFunnelEntry[],
) {
  const applyEntries = async (next: CommercialFunnelEntry[]): Promise<void> => {
    deps.setCommercialFunnelEntries(next);
    if (!deps.db) return;
    try {
      await persistCommercialFunnelEntries(deps.db, next);
    } catch (error) {
      deps.showToast(
        `Errore salvataggio funnel: ${error instanceof Error ? error.message : 'errore'}`,
        'danger',
      );
      throw error;
    }
  };

  const addClientsToFunnel = async (
    campaignId: string,
    clientRefs: FunnelClientRef[],
  ): Promise<void> => {
    const state = getEntries();
    const existingIds = new Set(
      state
        .filter((entry) => entry.campaignId === campaignId)
        .map((entry) => entry.clientId),
    );
    const newEntries: CommercialFunnelEntry[] = clientRefs
      .filter((ref) => !existingIds.has(ref.clientId))
      .map((ref) => ({
        id: createUniqueId('funnel-entry'),
        campaignId,
        clientId: ref.clientId,
        clientSource: ref.clientSource,
        actions: createEmptyFunnelActions(),
        lostReason: '',
        createdAt: new Date().toISOString(),
      }));
    if (newEntries.length === 0) {
      deps.showToast('Nessun nuovo cliente da aggiungere alla campagna.', 'info');
      return;
    }
    await applyEntries([...state, ...newEntries]);
    deps.showToast(`${newEntries.length} clienti aggiunti alla campagna.`, 'success');
  };

  const updateFunnelAction = async (
    entryId: string,
    slotIndex: number,
    actionType: FunnelActionType | '',
  ): Promise<void> => {
    const state = getEntries();
    const entry = state.find((item) => item.id === entryId);
    if (!entry) return;
    const nextActions = entry.actions.map((action, index) => {
      if (index !== slotIndex) return action;
      if (!actionType) return { type: '' as const, date: '', note: '', taskIds: [] };
      return {
        ...action,
        type: actionType,
        date: new Date().toISOString().slice(0, 10),
      };
    });
    if (actionType === 'Convertito') {
      const nextEntry: CommercialFunnelEntry = { ...entry, actions: nextActions };
      await applyEntries(state.map((item) => (item.id === entryId ? nextEntry : item)));
      deps.showToast('Cliente segnato come convertito. Resta nel funnel commerciale.', 'success');
      return;
    }
    const isLeavingPerso = entry.actions[slotIndex]?.type === 'Perso' && actionType !== 'Perso';
    const nextEntry: CommercialFunnelEntry = {
      ...entry,
      actions: nextActions,
      lostReason: isLeavingPerso ? '' : entry.lostReason,
    };
    await applyEntries(state.map((item) => (item.id === entryId ? nextEntry : item)));
    if (isLeavingPerso && actionType) {
      deps.showToast('Cliente riattivato nel funnel.', 'success');
    }
  };

  const updateFunnelLostReason = async (entryId: string, lostReason: string): Promise<void> => {
    const state = getEntries();
    await applyEntries(state.map((item) => (
      item.id === entryId ? { ...item, lostReason } : item
    )));
  };

  const updateFunnelActionNote = async (
    entryId: string,
    slotIndex: number,
    note: string,
  ): Promise<void> => {
    const state = getEntries();
    const entry = state.find((item) => item.id === entryId);
    if (!entry) return;
    const nextActions = entry.actions.map((action, index) => (
      index === slotIndex ? { ...action, note } : action
    ));
    await applyEntries(state.map((item) => (
      item.id === entryId ? { ...item, actions: nextActions } : item
    )));
  };

  const removeFunnelEntry = async (entryId: string): Promise<void> => {
    const state = getEntries();
    if (deps.db) await deleteCommercialFunnelEntry(deps.db, entryId);
    await applyEntries(state.filter((item) => item.id !== entryId));
    deps.showToast('Cliente rimosso dalla campagna.', 'info');
  };

  const moveFunnelEntryToCampaign = async (
    entryId: string,
    targetCampaignId: string,
  ): Promise<void> => {
    const state = getEntries();
    const entry = state.find((item) => item.id === entryId);
    if (!entry) return;
    if (entry.campaignId === targetCampaignId) {
      deps.showToast('Il cliente è già in questa campagna.', 'info');
      return;
    }
    const targetHasClient = state.some(
      (item) => item.campaignId === targetCampaignId && item.clientId === entry.clientId,
    );
    if (targetHasClient) {
      deps.showToast('Questo cliente è già presente nella campagna di destinazione.', 'warning');
      return;
    }
    const nextEntry: CommercialFunnelEntry = { ...entry, campaignId: targetCampaignId };
    await applyEntries(state.map((item) => (item.id === entryId ? nextEntry : item)));
    deps.showToast('Cliente spostato nella nuova campagna.', 'success');
  };

  const removeFunnelEntriesByCampaign = async (campaignId: string): Promise<void> => {
    const state = getEntries();
    if (deps.db) await deleteCommercialFunnelEntriesByCampaign(deps.db, campaignId);
    await applyEntries(state.filter((entry) => entry.campaignId !== campaignId));
  };

  const addTaskToFunnelAction = async (
    entryId: string,
    slotIndex: number,
    taskId: string,
  ): Promise<void> => {
    const state = getEntries();
    const entry = state.find((item) => item.id === entryId);
    if (!entry) return;
    const nextActions = entry.actions.map((action, index) => {
      if (index !== slotIndex) return action;
      const taskIds = action.taskIds || [];
      if (taskIds.includes(taskId)) return action;
      return { ...action, taskIds: [...taskIds, taskId] };
    });
    await applyEntries(state.map((item) => (
      item.id === entryId ? { ...item, actions: nextActions } : item
    )));
  };

  return {
    addClientsToFunnel,
    updateFunnelAction,
    updateFunnelLostReason,
    updateFunnelActionNote,
    addTaskToFunnelAction,
    removeFunnelEntry,
    removeFunnelEntriesByCampaign,
    moveFunnelEntryToCampaign,
  };
}
