import type { Dispatch, SetStateAction } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createEmptyFunnelActions } from '@/lib/commercial-funnel/index';
import { createUniqueId } from '@/lib/crm/utils';
import {
  deleteCommercialFunnelEntry,
  persistCommercialFunnelEntries,
} from '@/lib/supabase/commercial-funnel-database';
import type { CommercialFunnelEntry, FunnelActionType } from '@/lib/types/commercial-funnel';

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

  const addClientsToFunnel = async (clientIds: string[]): Promise<void> => {
    const state = getEntries();
    const existingIds = new Set(state.map((entry) => entry.clientId));
    const newEntries: CommercialFunnelEntry[] = clientIds
      .filter((clientId) => !existingIds.has(clientId))
      .map((clientId) => ({
        id: createUniqueId('funnel-entry'),
        clientId,
        actions: createEmptyFunnelActions(),
        lostReason: '',
        createdAt: new Date().toISOString(),
      }));
    if (newEntries.length === 0) {
      deps.showToast('Nessun nuovo cliente da aggiungere al funnel.', 'info');
      return;
    }
    await applyEntries([...state, ...newEntries]);
    deps.showToast(`${newEntries.length} clienti aggiunti al funnel.`, 'success');
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
      if (!actionType) return { type: '' as const, date: '' };
      return { type: actionType, date: new Date().toISOString().slice(0, 10) };
    });
    if (actionType === 'Convertito') {
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
    if (actionType === 'Perso') {
      await applyEntries(state.map((item) => (item.id === entryId ? nextEntry : item)));
      return;
    }
    await applyEntries(state.map((item) => (item.id === entryId ? nextEntry : item)));
  };

  const updateFunnelLostReason = async (entryId: string, lostReason: string): Promise<void> => {
    const state = getEntries();
    await applyEntries(state.map((item) => (
      item.id === entryId ? { ...item, lostReason } : item
    )));
  };

  const removeFunnelEntry = async (entryId: string): Promise<void> => {
    const state = getEntries();
    if (deps.db) await deleteCommercialFunnelEntry(deps.db, entryId);
    await applyEntries(state.filter((item) => item.id !== entryId));
    deps.showToast('Cliente rimosso dal funnel.', 'info');
  };

  return {
    addClientsToFunnel,
    updateFunnelAction,
    updateFunnelLostReason,
    removeFunnelEntry,
  };
}
