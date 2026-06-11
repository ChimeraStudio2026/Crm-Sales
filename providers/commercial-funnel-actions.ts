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
  promoteColdClientToMainList: (clientId: string) => Promise<void>;
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
      if (!actionType) return { type: '' as const, date: '', note: '' };
      return {
        ...action,
        type: actionType,
        date: new Date().toISOString().slice(0, 10),
      };
    });
    if (actionType === 'Convertito') {
      if (entry.clientSource === 'main') {
        const nextEntry: CommercialFunnelEntry = { ...entry, actions: nextActions };
        await applyEntries(state.map((item) => (item.id === entryId ? nextEntry : item)));
        deps.showToast('Cliente segnato come convertito. Resta in Lista Clienti.', 'success');
        return;
      }
      if (deps.db) await deleteCommercialFunnelEntry(deps.db, entryId);
      await deps.promoteColdClientToMainList(entry.clientId);
      await applyEntries(state.filter((item) => item.id !== entryId));
      deps.showToast('Cliente convertito e spostato in Lista Clienti.', 'success');
      return;
    }
    const nextEntry: CommercialFunnelEntry = {
      ...entry,
      actions: nextActions,
    };
    await applyEntries(state.map((item) => (item.id === entryId ? nextEntry : item)));
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

  const removeFunnelEntriesByCampaign = async (campaignId: string): Promise<void> => {
    const state = getEntries();
    if (deps.db) await deleteCommercialFunnelEntriesByCampaign(deps.db, campaignId);
    await applyEntries(state.filter((entry) => entry.campaignId !== campaignId));
  };

  return {
    addClientsToFunnel,
    updateFunnelAction,
    updateFunnelLostReason,
    updateFunnelActionNote,
    removeFunnelEntry,
    removeFunnelEntriesByCampaign,
  };
}
