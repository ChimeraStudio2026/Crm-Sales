import type { Dispatch, SetStateAction } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildPersistedFunnelEntry,
  createEmptyFunnelActionSlot,
  ensureActionSlot,
  finalizeFunnelActions,
  isFunnelActionLocked,
} from '@/lib/commercial-funnel/index';
import { buildFunnelEntryKey } from '@/lib/commercial-funnel/contacts';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';
import { isOwner } from '@/lib/constants/crm';
import { getDefaultOwnerForWorkspace } from '@/lib/crm/workspace-clients';
import { createUniqueId } from '@/lib/crm/utils';
import {
  deleteCommercialFunnelEntry,
  deleteCommercialFunnelEntriesByCampaign,
  persistCommercialFunnelEntries,
  persistSingleCommercialFunnelEntry,
} from '@/lib/supabase/commercial-funnel-database';
import type { CommercialFunnelEntry, FunnelActionType, FunnelClientRef } from '@/lib/types/commercial-funnel';
import type { MailCampaign } from '@/lib/types/mail-campaigns';
import type { Client } from '@/lib/types/crm';

interface CommercialFunnelPersistDeps {
  db: SupabaseClient | null;
  setCommercialFunnelEntries: Dispatch<SetStateAction<CommercialFunnelEntry[]>>;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'danger') => void;
  getCampaignById: (campaignId: string) => MailCampaign | undefined;
  getClientById: (clientId: string) => Client | undefined;
}

function persistableEntry(entry: CommercialFunnelEntry): CommercialFunnelEntry {
  return buildPersistedFunnelEntry(entry);
}

export function createCommercialFunnelActions(
  deps: CommercialFunnelPersistDeps,
  getEntries: () => CommercialFunnelEntry[],
) {
  let mutationQueue: Promise<void> = Promise.resolve();

  const persistEntries = async (entries: CommercialFunnelEntry[]): Promise<void> => {
    if (!deps.db || entries.length === 0) return;
    if (entries.length === 1) {
      await persistSingleCommercialFunnelEntry(deps.db, entries[0]);
      return;
    }
    await persistCommercialFunnelEntries(deps.db, entries);
  };

  const applyEntries = async (
    next: CommercialFunnelEntry[],
    entriesToPersist?: CommercialFunnelEntry[],
  ): Promise<void> => {
    deps.setCommercialFunnelEntries(next);
    if (!deps.db) return;
    try {
      await persistEntries(entriesToPersist ?? next);
    } catch (error) {
      deps.showToast(
        `Errore salvataggio funnel: ${error instanceof Error ? error.message : 'errore'}`,
        'danger',
      );
      throw error;
    }
  };

  const runMutation = (operation: () => Promise<void>): Promise<void> => {
    mutationQueue = mutationQueue.then(operation, operation);
    return mutationQueue;
  };

  const resolveEntryOwner = (
    clientId: string,
    campaign: MailCampaign | undefined,
    workspaceId: string,
  ): string => {
    const client = deps.getClientById(clientId);
    if (client?.owner && isOwner(client.owner)) return client.owner;
    if (campaign?.owner && isOwner(campaign.owner)) return campaign.owner;
    return getDefaultOwnerForWorkspace(workspaceId);
  };

  const addClientsToFunnel = async (
    campaignId: string,
    clientRefs: FunnelClientRef[],
  ): Promise<void> => {
    await runMutation(async () => {
      const state = getEntries();
      const existingKeys = new Set(
        state
          .filter((entry) => entry.campaignId === campaignId)
          .map((entry) => buildFunnelEntryKey(entry.clientId, entry.contactId)),
      );
      const campaign = deps.getCampaignById(campaignId);
      const workspaceId = campaign?.workspaceId || DEFAULT_WORKSPACE_ID;
      const newEntries: CommercialFunnelEntry[] = clientRefs
        .filter((ref) => !existingKeys.has(buildFunnelEntryKey(ref.clientId, ref.contactId)))
        .map((ref) => persistableEntry({
          id: createUniqueId('funnel-entry'),
          workspaceId,
          campaignId,
          clientId: ref.clientId,
          contactId: ref.contactId || '',
          clientSource: ref.clientSource,
          owner: resolveEntryOwner(ref.clientId, campaign, workspaceId),
          stage: 'In contatto',
          actions: [],
          lostReason: '',
          createdAt: new Date().toISOString(),
        }));
      if (newEntries.length === 0) {
        deps.showToast('Nessun nuovo cliente da aggiungere alla campagna.', 'info');
        return;
      }
      await applyEntries([...state, ...newEntries], newEntries);
      deps.showToast(`${newEntries.length} clienti aggiunti alla campagna.`, 'success');
    });
  };

  const updateFunnelAction = async (
    entryId: string,
    slotIndex: number,
    actionType: FunnelActionType | '',
  ): Promise<void> => {
    await runMutation(async () => {
      const state = getEntries();
      const entry = state.find((item) => item.id === entryId);
      if (!entry) return;
      const canAppend = !isFunnelActionLocked(entry);
      let nextActions = ensureActionSlot(entry.actions, slotIndex);
      const isLeavingPerso = entry.actions[slotIndex]?.type === 'Perso' && actionType !== 'Perso';
      if (!actionType) {
        nextActions[slotIndex] = createEmptyFunnelActionSlot();
      } else {
        nextActions[slotIndex] = {
          ...nextActions[slotIndex],
          type: actionType,
          date: new Date().toISOString().slice(0, 10),
        };
      }
      nextActions = finalizeFunnelActions(nextActions, canAppend || isLeavingPerso);
      const nextLostReason = isLeavingPerso ? '' : entry.lostReason;
      const nextEntry = persistableEntry({
        ...entry,
        actions: nextActions,
        lostReason: nextLostReason,
      });
      await applyEntries(
        state.map((item) => (item.id === entryId ? nextEntry : item)),
        [nextEntry],
      );
      if (actionType === 'Convertito') {
        deps.showToast('Cliente segnato come convertito. Resta nel funnel commerciale.', 'success');
        return;
      }
      if (isLeavingPerso && actionType) {
        deps.showToast('Cliente riattivato nel funnel.', 'success');
      }
    });
  };

  const updateFunnelLostReason = async (entryId: string, lostReason: string): Promise<void> => {
    await runMutation(async () => {
      const state = getEntries();
      const nextEntry = state.find((item) => item.id === entryId);
      if (!nextEntry) return;
      const updatedEntry = persistableEntry({ ...nextEntry, lostReason });
      await applyEntries(
        state.map((item) => (item.id === entryId ? updatedEntry : item)),
        [updatedEntry],
      );
    });
  };

  const markFunnelEntryLost = async (
    entryId: string,
    slotIndex: number,
    lostReason: string,
  ): Promise<void> => {
    const trimmedReason = lostReason.trim();
    if (!trimmedReason) {
      deps.showToast('Inserisci il motivo della perdita.', 'warning');
      return;
    }
    await runMutation(async () => {
      const state = getEntries();
      const entry = state.find((item) => item.id === entryId);
      if (!entry) return;
      let nextActions = ensureActionSlot(entry.actions, slotIndex);
      nextActions[slotIndex] = {
        ...nextActions[slotIndex],
        type: 'Perso',
        date: new Date().toISOString().slice(0, 10),
      };
      nextActions = finalizeFunnelActions(nextActions, false);
      const nextEntry = persistableEntry({
        ...entry,
        actions: nextActions,
        lostReason: trimmedReason,
      });
      await applyEntries(
        state.map((item) => (item.id === entryId ? nextEntry : item)),
        [nextEntry],
      );
    });
  };

  const updateFunnelEntryOwner = async (entryId: string, owner: string): Promise<void> => {
    await runMutation(async () => {
      const state = getEntries();
      const entry = state.find((item) => item.id === entryId);
      if (!entry) return;
      const nextEntry = persistableEntry({ ...entry, owner });
      await applyEntries(
        state.map((item) => (item.id === entryId ? nextEntry : item)),
        [nextEntry],
      );
    });
  };

  const updateFunnelEntryContact = async (entryId: string, contactId: string): Promise<void> => {
    await runMutation(async () => {
      const state = getEntries();
      const entry = state.find((item) => item.id === entryId);
      if (!entry) return;
      if ((entry.contactId || '') === contactId) return;
      const nextKey = buildFunnelEntryKey(entry.clientId, contactId);
      const duplicate = state.some(
        (item) => item.id !== entryId
          && item.campaignId === entry.campaignId
          && buildFunnelEntryKey(item.clientId, item.contactId) === nextKey,
      );
      if (duplicate) {
        deps.showToast('Questo contatto è già presente nella campagna.', 'warning');
        return;
      }
      const nextEntry = persistableEntry({ ...entry, contactId });
      await applyEntries(
        state.map((item) => (item.id === entryId ? nextEntry : item)),
        [nextEntry],
      );
      deps.showToast('Contatto associato aggiornato.', 'success');
    });
  };

  const updateFunnelActionNote = async (
    entryId: string,
    slotIndex: number,
    note: string,
  ): Promise<void> => {
    await runMutation(async () => {
      const state = getEntries();
      const entry = state.find((item) => item.id === entryId);
      if (!entry) return;
      const nextActions = ensureActionSlot(entry.actions, slotIndex).map((action, index) => (
        index === slotIndex ? { ...action, note } : action
      ));
      const nextEntry = persistableEntry({ ...entry, actions: nextActions });
      await applyEntries(
        state.map((item) => (item.id === entryId ? nextEntry : item)),
        [nextEntry],
      );
    });
  };

  const removeFunnelEntry = async (entryId: string): Promise<void> => {
    await runMutation(async () => {
      const state = getEntries();
      const next = state.filter((item) => item.id !== entryId);
      deps.setCommercialFunnelEntries(next);
      if (deps.db) {
        try {
          await deleteCommercialFunnelEntry(deps.db, entryId);
        } catch (error) {
          deps.showToast(
            `Errore rimozione funnel: ${error instanceof Error ? error.message : 'errore'}`,
            'danger',
          );
          throw error;
        }
      }
      deps.showToast('Cliente rimosso dalla campagna.', 'info');
    });
  };

  const moveFunnelEntryToCampaign = async (
    entryId: string,
    targetCampaignId: string,
  ): Promise<void> => {
    await runMutation(async () => {
      const state = getEntries();
      const entry = state.find((item) => item.id === entryId);
      if (!entry) return;
      if (entry.campaignId === targetCampaignId) {
        deps.showToast('Il cliente è già in questa campagna.', 'info');
        return;
      }
      const targetHasEntry = state.some(
        (item) => item.campaignId === targetCampaignId
          && buildFunnelEntryKey(item.clientId, item.contactId)
            === buildFunnelEntryKey(entry.clientId, entry.contactId),
      );
      if (targetHasEntry) {
        deps.showToast('Questo contatto è già presente nella campagna di destinazione.', 'warning');
        return;
      }
      const targetCampaign = deps.getCampaignById(targetCampaignId);
      const workspaceId = targetCampaign?.workspaceId || entry.workspaceId || DEFAULT_WORKSPACE_ID;
      const nextEntry = persistableEntry({
        ...entry,
        campaignId: targetCampaignId,
        workspaceId,
      });
      await applyEntries(
        state.map((item) => (item.id === entryId ? nextEntry : item)),
        [nextEntry],
      );
      deps.showToast('Cliente spostato nella nuova campagna.', 'success');
    });
  };

  const removeFunnelEntriesByCampaign = async (campaignId: string): Promise<void> => {
    await runMutation(async () => {
      const state = getEntries();
      const next = state.filter((entry) => entry.campaignId !== campaignId);
      if (deps.db) await deleteCommercialFunnelEntriesByCampaign(deps.db, campaignId);
      deps.setCommercialFunnelEntries(next);
    });
  };

  const addTaskToFunnelAction = async (
    entryId: string,
    slotIndex: number,
    taskId: string,
  ): Promise<void> => {
    await runMutation(async () => {
      const state = getEntries();
      const entry = state.find((item) => item.id === entryId);
      if (!entry) return;
      const nextActions = ensureActionSlot(entry.actions, slotIndex).map((action, index) => {
        if (index !== slotIndex) return action;
        const taskIds = action.taskIds || [];
        if (taskIds.includes(taskId)) return action;
        return { ...action, taskIds: [...taskIds, taskId] };
      });
      const nextEntry = persistableEntry({ ...entry, actions: nextActions });
      await applyEntries(
        state.map((item) => (item.id === entryId ? nextEntry : item)),
        [nextEntry],
      );
    });
  };

  return {
    addClientsToFunnel,
    updateFunnelAction,
    updateFunnelLostReason,
    markFunnelEntryLost,
    updateFunnelEntryOwner,
    updateFunnelEntryContact,
    updateFunnelActionNote,
    addTaskToFunnelAction,
    removeFunnelEntry,
    removeFunnelEntriesByCampaign,
    moveFunnelEntryToCampaign,
  };
}
