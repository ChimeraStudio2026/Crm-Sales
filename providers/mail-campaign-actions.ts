import type { Dispatch, SetStateAction } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';
import { createUniqueId } from '@/lib/crm/utils';
import { getStepsForCampaign } from '@/lib/mail-campaigns/index';
import type {
  MailCampaign,
  MailCampaignContact,
  MailCampaignContactRef,
  MailCampaignContactStatus,
  MailCampaignSendTracking,
  MailCampaignStep,
  MailSendStatus,
} from '@/lib/types/mail-campaigns';
import {
  deleteMailCampaign,
  deleteMailCampaignContact,
  persistMailCampaignContacts,
  persistMailCampaigns,
  persistMailCampaignSteps,
  persistMailCampaignTracking,
  persistSingleMailCampaign,
} from '@/lib/supabase/mail-campaigns-database';

interface MailCampaignStateSlice {
  mailCampaigns: MailCampaign[];
  mailCampaignSteps: MailCampaignStep[];
  mailCampaignContacts: MailCampaignContact[];
  mailCampaignSendTracking: MailCampaignSendTracking[];
}

interface MailCampaignPersistDeps {
  db: SupabaseClient | null;
  setMailCampaigns: Dispatch<SetStateAction<MailCampaign[]>>;
  setMailCampaignSteps: Dispatch<SetStateAction<MailCampaignStep[]>>;
  setMailCampaignContacts: Dispatch<SetStateAction<MailCampaignContact[]>>;
  setMailCampaignSendTracking: Dispatch<SetStateAction<MailCampaignSendTracking[]>>;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'danger') => void;
}

export function createDefaultCampaignSteps(campaignId: string): MailCampaignStep[] {
  return [
    {
      id: createUniqueId('mail-step'),
      campaignId,
      orderNumber: 1,
      title: 'Mail 1: Presentazione',
      templateText: '',
      waitDaysFromPrevious: 0,
    },
    {
      id: createUniqueId('mail-step'),
      campaignId,
      orderNumber: 2,
      title: 'Mail 2: Follow-up',
      templateText: '',
      waitDaysFromPrevious: 3,
    },
    {
      id: createUniqueId('mail-step'),
      campaignId,
      orderNumber: 3,
      title: 'Mail 3: Chiusura',
      templateText: '',
      waitDaysFromPrevious: 5,
    },
  ];
}

export async function persistMailCampaignBundle(
  deps: MailCampaignPersistDeps,
  state: MailCampaignStateSlice,
): Promise<void> {
  if (!deps.db) return;
  await persistMailCampaigns(deps.db, state.mailCampaigns);
  const campaignIds = new Set(state.mailCampaigns.map((campaign) => campaign.id));
  for (const campaignId of campaignIds) {
    const steps = getStepsForCampaign(state.mailCampaignSteps, campaignId);
    await persistMailCampaignSteps(deps.db, campaignId, steps);
  }
  await persistMailCampaignContacts(deps.db, state.mailCampaignContacts);
  await persistMailCampaignTracking(deps.db, state.mailCampaignSendTracking);
}

export function buildTrackingForNewContacts(
  campaignId: string,
  newContacts: MailCampaignContact[],
  steps: MailCampaignStep[],
): MailCampaignSendTracking[] {
  const campaignSteps = getStepsForCampaign(steps, campaignId);
  return newContacts.flatMap((contact) =>
    campaignSteps.map((step) => ({
      id: createUniqueId('mail-track'),
      campaignContactId: contact.id,
      stepId: step.id,
      sendStatus: 'Da Inviare' as MailSendStatus,
      sentAt: '',
    })),
  );
}

export function createMailCampaignActions(
  deps: MailCampaignPersistDeps,
  getState: () => MailCampaignStateSlice,
) {
  const applyState = async (next: MailCampaignStateSlice): Promise<boolean> => {
    deps.setMailCampaigns(next.mailCampaigns);
    deps.setMailCampaignSteps(next.mailCampaignSteps);
    deps.setMailCampaignContacts(next.mailCampaignContacts);
    deps.setMailCampaignSendTracking(next.mailCampaignSendTracking);
    try {
      await persistMailCampaignBundle(deps, next);
      return true;
    } catch (error) {
      deps.showToast(
        `Errore salvataggio campagne: ${error instanceof Error ? error.message : 'errore'}`,
        'danger',
      );
      throw error;
    }
  };

  const updateMailCampaignOwner = async (campaignId: string, owner: string): Promise<void> => {
    const state = getState();
    const campaign = state.mailCampaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    const updatedCampaign: MailCampaign = { ...campaign, owner };
    deps.setMailCampaigns(state.mailCampaigns.map((item) => (
      item.id === campaignId ? updatedCampaign : item
    )));
    if (!deps.db) return;
    try {
      await persistSingleMailCampaign(deps.db, updatedCampaign);
      deps.showToast('Owner aggiornato.', 'success');
    } catch (error) {
      deps.showToast(
        `Errore salvataggio owner: ${error instanceof Error ? error.message : 'errore'}`,
        'danger',
      );
      throw error;
    }
  };

  const updateMailCampaignStatus = async (
    campaignId: string,
    status: MailCampaign['status'],
  ): Promise<void> => {
    const state = getState();
    const campaign = state.mailCampaigns.find((item) => item.id === campaignId);
    if (!campaign || campaign.status === status) return;
    const updatedCampaign: MailCampaign = { ...campaign, status };
    deps.setMailCampaigns(state.mailCampaigns.map((item) => (
      item.id === campaignId ? updatedCampaign : item
    )));
    if (!deps.db) return;
    try {
      await persistSingleMailCampaign(deps.db, updatedCampaign);
      deps.showToast('Stato campagna aggiornato.', 'success');
    } catch (error) {
      deps.showToast(
        `Errore salvataggio stato: ${error instanceof Error ? error.message : 'errore'}`,
        'danger',
      );
      throw error;
    }
  };

  const saveMailCampaign = async (
    input: Partial<MailCampaign> & { name: string },
    steps?: MailCampaignStep[],
  ): Promise<string> => {
    const state = getState();
    const campaignId = input.id || createUniqueId('mail-campaign');
    const existingCampaign = state.mailCampaigns.find((item) => item.id === campaignId);
    const campaign: MailCampaign = {
      id: campaignId,
      workspaceId: input.workspaceId || existingCampaign?.workspaceId || DEFAULT_WORKSPACE_ID,
      name: input.name,
      description: input.description || '',
      status: input.status || 'Bozza',
      startDate: input.startDate || '',
      endDate: input.endDate || '',
      owner: input.owner || '',
      funnelTrack: input.funnelTrack || existingCampaign?.funnelTrack || 'cold',
      createdAt: input.createdAt || new Date().toISOString(),
    };
    const nextCampaigns = input.id
      ? state.mailCampaigns.map((item) => (item.id === campaignId ? campaign : item))
      : [...state.mailCampaigns, campaign];
    let nextSteps = state.mailCampaignSteps;
    if (steps) {
      nextSteps = [
        ...state.mailCampaignSteps.filter((step) => step.campaignId !== campaignId),
        ...steps.map((step) => ({ ...step, campaignId })),
      ];
    }
    const saved = await applyState({
      ...state,
      mailCampaigns: nextCampaigns,
      mailCampaignSteps: nextSteps,
    });
    if (saved) {
      deps.showToast(input.id ? 'Campagna aggiornata.' : 'Campagna creata.', 'success');
    }
    return campaignId;
  };

  const deleteMailCampaignById = async (campaignId: string): Promise<void> => {
    const state = getState();
    if (deps.db) await deleteMailCampaign(deps.db, campaignId);
    await applyState({
      mailCampaigns: state.mailCampaigns.filter((campaign) => campaign.id !== campaignId),
      mailCampaignSteps: state.mailCampaignSteps.filter((step) => step.campaignId !== campaignId),
      mailCampaignContacts: state.mailCampaignContacts.filter((contact) => contact.campaignId !== campaignId),
      mailCampaignSendTracking: state.mailCampaignSendTracking.filter((item) => {
        const contact = state.mailCampaignContacts.find((entry) => entry.id === item.campaignContactId);
        return contact?.campaignId !== campaignId;
      }),
    });
    deps.showToast('Campagna eliminata.', 'info');
  };

  const addContactsToCampaign = async (
    campaignId: string,
    refs: MailCampaignContactRef[],
  ): Promise<void> => {
    const state = getState();
    const existingKeys = new Set(
      state.mailCampaignContacts
        .filter((contact) => contact.campaignId === campaignId)
        .map((contact) => `${contact.clientId}:${contact.contactId}`),
    );
    const newContacts: MailCampaignContact[] = refs
      .filter((ref) => !existingKeys.has(`${ref.clientId}:${ref.contactId}`))
      .map((ref) => ({
        id: createUniqueId('mail-ccontact'),
        campaignId,
        clientId: ref.clientId,
        contactId: ref.contactId,
        status: 'In Corso',
        outcomeNotes: '',
        createdAt: new Date().toISOString(),
      }));
    if (newContacts.length === 0) {
      deps.showToast('Nessun nuovo contatto da aggiungere.', 'info');
      return;
    }
    const newTracking = buildTrackingForNewContacts(
      campaignId,
      newContacts,
      state.mailCampaignSteps,
    );
    await applyState({
      ...state,
      mailCampaignContacts: [...state.mailCampaignContacts, ...newContacts],
      mailCampaignSendTracking: [...state.mailCampaignSendTracking, ...newTracking],
    });
    deps.showToast(`${newContacts.length} contatti aggiunti alla campagna.`, 'success');
  };

  const removeContactFromCampaign = async (campaignContactId: string): Promise<void> => {
    const state = getState();
    if (deps.db) await deleteMailCampaignContact(deps.db, campaignContactId);
    await applyState({
      ...state,
      mailCampaignContacts: state.mailCampaignContacts.filter(
        (contact) => contact.id !== campaignContactId,
      ),
      mailCampaignSendTracking: state.mailCampaignSendTracking.filter(
        (item) => item.campaignContactId !== campaignContactId,
      ),
    });
    deps.showToast('Contatto rimosso dalla campagna.', 'info');
  };

  const updateCampaignContactStatus = async (
    campaignContactId: string,
    status: MailCampaignContactStatus,
  ): Promise<void> => {
    const state = getState();
    await applyState({
      ...state,
      mailCampaignContacts: state.mailCampaignContacts.map((contact) => (
        contact.id === campaignContactId ? { ...contact, status } : contact
      )),
    });
  };

  const updateCampaignContactNotes = async (
    campaignContactId: string,
    outcomeNotes: string,
  ): Promise<void> => {
    const state = getState();
    await applyState({
      ...state,
      mailCampaignContacts: state.mailCampaignContacts.map((contact) => (
        contact.id === campaignContactId ? { ...contact, outcomeNotes } : contact
      )),
    });
  };

  const updateMailSendStatus = async (
    trackingId: string,
    sendStatus: MailSendStatus,
  ): Promise<void> => {
    const state = getState();
    await applyState({
      ...state,
      mailCampaignSendTracking: state.mailCampaignSendTracking.map((item) => {
        if (item.id !== trackingId) return item;
        return {
          ...item,
          sendStatus,
          sentAt: sendStatus === 'Inviata' ? new Date().toISOString() : '',
        };
      }),
    });
  };

  const markMailSentToday = async (trackingId: string): Promise<void> => {
    await updateMailSendStatus(trackingId, 'Inviata');
    deps.showToast('Mail segnata come inviata.', 'success');
  };

  const saveCampaignSteps = async (
    campaignId: string,
    steps: MailCampaignStep[],
  ): Promise<void> => {
    const state = getState();
    await applyState({
      ...state,
      mailCampaignSteps: [
        ...state.mailCampaignSteps.filter((step) => step.campaignId !== campaignId),
        ...steps.map((step) => ({ ...step, campaignId })),
      ],
    });
    deps.showToast('Flusso mail aggiornato.', 'success');
  };

  return {
    saveMailCampaign,
    updateMailCampaignOwner,
    updateMailCampaignStatus,
    deleteMailCampaignById,
    addContactsToCampaign,
    removeContactFromCampaign,
    updateCampaignContactStatus,
    updateCampaignContactNotes,
    updateMailSendStatus,
    markMailSentToday,
    saveCampaignSteps,
  };
}
