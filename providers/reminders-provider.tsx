'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { normalizeOwner } from '@/lib/crm/owners';
import { isClientInWorkspace } from '@/lib/crm/workspace-access';
import { createUniqueId, getTodayString } from '@/lib/crm/utils';
import { buildCallDebriefReminders } from '@/lib/reminders/call-debrief';
import type { CallDebriefReminder } from '@/lib/reminders/call-debrief';
import { useSalesProposals } from '@/lib/sales-proposals/use-sales-proposals';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fetchClientAliases } from '@/lib/supabase/client-aliases-database';
import { fetchAllClientActions, insertClientAction } from '@/lib/supabase/client-actions-database';
import { buildStaleClientReminders } from '@/lib/reminders/stale-clients';
import type { StaleClientReminder } from '@/lib/reminders/stale-clients';
import { CALL_DEBRIEF_ACTION_TYPE } from '@/lib/types/client-actions';
import type { ClientAction } from '@/lib/types/client-actions';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';

interface RemindersContextValue {
  /** Tutti i reminder call debrief del workspace (scaduti e in arrivo). */
  callDebriefReminders: CallDebriefReminder[];
  /** Clienti senza proposte né azioni da più di tre settimane. */
  staleClientReminders: StaleClientReminder[];
  isLoading: boolean;
  error: string;
  /** Reminder da fare adesso sui clienti di chi è collegato: alimenta il badge in sidebar. */
  myDueCount: number;
  markCallDebriefDone: (reminder: CallDebriefReminder, note: string) => Promise<void>;
  /** Un'azione registrata altrove (scheda cliente, obiettivi): aggiorna subito i reminder. */
  noteClientAction: (action: ClientAction) => void;
}

const RemindersContext = createContext<RemindersContextValue | null>(null);

export function isReminderDue(reminder: CallDebriefReminder): boolean {
  return reminder.daysToDue <= 0;
}

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const { clients, commercialFunnelEntries, currentOwner, showToast } = useCrm();
  const { workspaceId } = useWorkspace();
  const db = useMemo(() => createBrowserSupabaseClient(), []);
  const { proposals, isLoading: isLoadingProposals, error: proposalsError } = useSalesProposals(workspaceId);
  const [aliasesByClientId, setAliasesByClientId] = useState<Map<string, string[]>>(() => new Map());
  const [clientActions, setClientActions] = useState<ClientAction[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(Boolean(db));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    Promise.all([fetchClientAliases(db), fetchAllClientActions(db)])
      .then(([aliases, actions]) => {
        if (cancelled) return;
        const byClient = new Map<string, string[]>();
        aliases.forEach((alias) => {
          byClient.set(alias.clientId, [...(byClient.get(alias.clientId) || []), alias.aliasName]);
        });
        setAliasesByClientId(byClient);
        setClientActions(actions);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Errore lettura reminder.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingActions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const workspaceClients = useMemo(
    () => clients.filter((client) => isClientInWorkspace(client, workspaceId)),
    [clients, workspaceId],
  );
  const doneClientIds = useMemo(
    () => new Set(clientActions
      .filter((action) => action.actionType === CALL_DEBRIEF_ACTION_TYPE)
      .map((action) => action.clientId)),
    [clientActions],
  );

  const callDebriefReminders = useMemo(
    () => buildCallDebriefReminders({
      clients: workspaceClients,
      proposals,
      aliasesByClientId,
      doneClientIds,
      today: getTodayString(),
    }),
    [aliasesByClientId, doneClientIds, proposals, workspaceClients],
  );

  const staleClientReminders = useMemo(
    () => buildStaleClientReminders({
      clients: workspaceClients,
      proposals,
      aliasesByClientId,
      clientActions,
      funnelEntries: commercialFunnelEntries,
      today: getTodayString(),
    }),
    [aliasesByClientId, clientActions, commercialFunnelEntries, proposals, workspaceClients],
  );

  const myDueCount = useMemo(() => {
    const me = normalizeOwner(currentOwner);
    return callDebriefReminders
      .filter(isReminderDue)
      .filter((reminder) => !me || normalizeOwner(reminder.client.owner) === me)
      .length;
  }, [callDebriefReminders, currentOwner]);

  // Una volta per sessione, appena i dati sono pronti: un pop che ricorda le call da fare.
  const isReady = !isLoadingProposals && !isLoadingActions;
  useEffect(() => {
    if (!isReady || myDueCount === 0) return;
    const storageKey = 'crm-call-debrief-popped';
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, '1');
    } catch {
      // Senza sessionStorage il pop compare a ogni caricamento: va bene lo stesso.
    }
    showToast(
      myDueCount === 1
        ? 'Reminder: hai 1 call debrief da fare con un cliente nuovo.'
        : `Reminder: hai ${myDueCount} call debrief da fare con clienti nuovi.`,
      'info',
    );
  }, [isReady, myDueCount, showToast]);

  const markCallDebriefDone = useCallback(async (reminder: CallDebriefReminder, note: string): Promise<void> => {
    if (!db) return;
    try {
      const action: ClientAction = {
        id: createUniqueId('client-action'),
        clientId: reminder.client.id,
        actionType: CALL_DEBRIEF_ACTION_TYPE,
        actionDate: getTodayString(),
        note: note.trim() || 'Call di presentazione Chimera fatta.',
        author: currentOwner || '',
        createdAt: '',
        contactId: '',
        redAfterDays: null,
        outcome: null,
      };
      const saved = await insertClientAction(db, action);
      setClientActions((prev) => [saved, ...prev]);
      showToast(`Call debrief con ${reminder.client.name} segnata come fatta.`, 'success');
    } catch (saveError) {
      showToast(`Errore salvataggio: ${saveError instanceof Error ? saveError.message : 'errore'}`, 'danger');
      throw saveError;
    }
  }, [currentOwner, db, showToast]);

  const noteClientAction = useCallback((action: ClientAction): void => {
    setClientActions((prev) => [action, ...prev.filter((item) => item.id !== action.id)]);
  }, []);

  const value = useMemo<RemindersContextValue>(() => ({
    callDebriefReminders,
    staleClientReminders,
    isLoading: isLoadingProposals || isLoadingActions,
    error: proposalsError || error,
    myDueCount,
    markCallDebriefDone,
    noteClientAction,
  }), [noteClientAction, callDebriefReminders, staleClientReminders, error, isLoadingActions, isLoadingProposals, markCallDebriefDone, myDueCount, proposalsError]);

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

export function useReminders(): RemindersContextValue {
  const context = useContext(RemindersContext);
  if (!context) throw new Error('useReminders must be used inside RemindersProvider');
  return context;
}

/** Per chi sta anche fuori dal provider (es. sidebar durante il caricamento). */
export function useOptionalReminders(): RemindersContextValue | null {
  return useContext(RemindersContext);
}
