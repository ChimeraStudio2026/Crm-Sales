'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AnalysisForecasts,
  AnalysisForecastsByYear,
  Client,
  ClientContact,
  ClientTask,
  Idea,
  OkrRecord,
  Owner,
  ParsedExcelClient,
  RecallItem,
  Relationship,
  TaskAttachment,
} from '@/lib/types/crm';
import {
  ANALYSIS_YEAR,
  COLD_CLIENT_REV_THRESHOLD,
  DEFAULT_ACTION_DATE,
  isAnalysisYear,
  resolveOwnerFromEmail,
} from '@/lib/constants/crm';
import { createDefaultForecasts, createEmptyForecastsByYear } from '@/lib/analysis/index';
import type {
  MailCampaign,
  MailCampaignContact,
  MailCampaignContactRef,
  MailCampaignContactStatus,
  MailCampaignSendTracking,
  MailCampaignStep,
  MailSendStatus,
} from '@/lib/types/mail-campaigns';
import type { CommercialFunnelEntry, FunnelActionType, FunnelClientRef } from '@/lib/types/commercial-funnel';
import {
  clearMailCampaignData,
  fetchMailCampaignData,
} from '@/lib/supabase/mail-campaigns-database';
import {
  clearCommercialFunnelData,
  fetchCommercialFunnelEntries,
} from '@/lib/supabase/commercial-funnel-database';
import { createMailCampaignActions } from '@/providers/mail-campaign-actions';
import { createCommercialFunnelActions } from '@/providers/commercial-funnel-actions';
import {
  isRowPerOkrImportFormat,
  parseExcelImportBuffer,
  type ExcelImportFormat,
  type ExcelImportParseResult,
} from '@/lib/crm/excel';
import { mergeClientsWithExcelImport, mergeOkrRecordsWithImport, linkOkrRecordsToClients } from '@/lib/crm/import-merge';
import {
  applyColdClientPromotion,
  applyColdClientPromotionToAll,
  createUniqueId,
  getTodayString,
  isClientInActiveSection,
  isClientInColdSection,
  normalizeClients,
  recalculateRelationships,
  reconcileImportedClientsToMainList,
  resolveActionDateOnTextChange,
  syncClientLegacyFields,
  syncClientsProfileCompletion,
} from '@/lib/crm/utils';
import { appendApolloDescription, resolveActionWithWebsite } from '@/lib/crm/apollo';
import {
  reconcileProductOffersForTypeChange,
  resolveClientProductOffers,
} from '@/lib/crm/product-offers';
import type { ProductOfferId } from '@/lib/constants/product-offers';
import {
  filterValidRecallItems,
  generateRandomRecallSelection,
  isRecallSelectionValid,
  normalizeStoredRecallItems,
  refreshRecallSelectionPreservingDone,
  RECALL_SELECTION_VERSION,
} from '@/lib/crm/recall';
import { createBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  clearAllData,
  enrichClientWithApollo,
  fetchAllAnalysisForecasts,
  fetchClientTasks,
  fetchClients,
  assertClientsHistoricalRevenueSchema,
  fetchDailyRecall,
  fetchIdeas,
  fetchAllOkrRecords,
  fetchOkrRecords,
  deleteOkrRecordsForYear,
  cleanHistoricalYearsData,
  HISTORICAL_IMPORT_YEARS,
  getApolloStatus,
  persistAnalysisForecasts,
  persistClientTasks,
  persistClients,
  deleteClientRecord,
  persistIdeas,
  persistIdeasReplace,
  upsertIdea,
  deleteIdeaRecord,
  upsertOkrRecords,
  persistOkrRecords,
  saveDailyRecall,
  testSupabaseConnection,
} from '@/lib/supabase/database';

export type ToastType = 'success' | 'danger' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

const TASK_ATTACHMENTS_BUCKET = 'task-attachments';

function sanitizeStorageSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'file';
}

interface CrmContextValue {
  isLoading: boolean;
  isSupabaseConnected: boolean;
  isSupabaseConfigured: boolean;
  apolloStatus: { ok: boolean; configured: boolean; message: string };
  clients: Client[];
  ideas: Idea[];
  clientTasks: ClientTask[];
  okrRecords: OkrRecord[];
  analysisYear: number;
  analysisForecasts: AnalysisForecasts;
  analysisExpanded: Set<string>;
  dailyRecallItems: RecallItem[];
  recallFilterStatus: string;
  totalRevenue2026: number;
  currentOwner: Owner | null;
  showToast: (message: string, type?: ToastType) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  refreshApolloStatus: () => Promise<void>;
  saveClient: (client: Partial<Client> & { name: string }, options?: { isCold?: boolean; isEdit?: boolean; id?: string }) => Promise<void>;
  saveClients: (clients: Array<Partial<Client> & { name: string }>, options?: { isCold?: boolean }) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  updateClientField: (clientId: string, field: keyof Client, value: unknown) => Promise<void>;
  updateClientContacts: (clientId: string, contacts: ClientContact[]) => Promise<void>;
  updateClientAction: (clientId: string, action: string) => Promise<void>;
  updateClientProductOffers: (clientId: string, offerIds: ProductOfferId[]) => Promise<void>;
  saveIdea: (idea: Partial<Idea> & { name: string; description?: string; clientId?: string }) => Promise<void>;
  deleteIdea: (ideaId: string) => Promise<void>;
  moveIdeaStatus: (ideaId: string, newStatus: Idea['status']) => Promise<void>;
  uploadTaskAttachment: (ideaId: string, file: File) => Promise<void>;
  downloadTaskAttachment: (attachment: TaskAttachment) => Promise<void>;
  removeTaskAttachment: (ideaId: string, attachment: TaskAttachment) => Promise<void>;
  saveTask: (task: Partial<ClientTask> & { title: string; clientId: string }) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskCompleted: (taskId: string, completed: boolean) => Promise<void>;
  setAnalysisForecast: (scope: string, field: 'totalForecast' | 'productPct', value: number, product?: string) => Promise<void>;
  setAnalysisYear: (year: number) => void;
  toggleAnalysisScope: (scope: string) => void;
  refreshRecall: () => Promise<void>;
  updateRecallStatus: (clientId: string, status: RecallItem['status']) => Promise<void>;
  completeRecallWithAction: (clientId: string, action: string) => Promise<void>;
  processExcelImport: (
    parsedClients: ParsedExcelClient[],
    okrRecords: OkrRecord[],
    importYear: number,
    format?: ExcelImportFormat,
    replaceYearOkr?: boolean,
  ) => Promise<void>;
  parseExcelBuffer: (buffer: ArrayBuffer, filename?: string) => ExcelImportParseResult;
  resetAllData: () => Promise<void>;
  cleanHistoricalYears: () => Promise<void>;
  exportJsonBackup: () => void;
  importJsonBackup: (json: string) => Promise<void>;
  enrichClientApollo: (clientId: string) => Promise<void>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setIdeas: React.Dispatch<React.SetStateAction<Idea[]>>;
  setClientTasks: React.Dispatch<React.SetStateAction<ClientTask[]>>;
  setDailyRecallItems: React.Dispatch<React.SetStateAction<RecallItem[]>>;
  setRecallFilterStatus: React.Dispatch<React.SetStateAction<string>>;
  persistClientsNow: (nextClients?: Client[]) => Promise<void>;
  persistIdeasNow: (nextIdeas?: Idea[]) => Promise<void>;
  persistTasksNow: (nextTasks?: ClientTask[]) => Promise<void>;
  persistAnalysisNow: (
    nextOkr?: OkrRecord[],
    nextForecasts?: AnalysisForecasts,
    forecastYear?: number,
  ) => Promise<void>;
  loadDailyRecall: () => Promise<RecallItem[]>;
  mailCampaigns: MailCampaign[];
  mailCampaignSteps: MailCampaignStep[];
  mailCampaignContacts: MailCampaignContact[];
  mailCampaignSendTracking: MailCampaignSendTracking[];
  saveMailCampaign: (input: Partial<MailCampaign> & { name: string }, steps?: MailCampaignStep[]) => Promise<string>;
  updateMailCampaignOwner: (campaignId: string, owner: string) => Promise<void>;
  deleteMailCampaignById: (campaignId: string) => Promise<void>;
  addContactsToCampaign: (campaignId: string, refs: MailCampaignContactRef[]) => Promise<void>;
  removeContactFromCampaign: (campaignContactId: string) => Promise<void>;
  updateCampaignContactStatus: (campaignContactId: string, status: MailCampaignContactStatus) => Promise<void>;
  updateCampaignContactNotes: (campaignContactId: string, outcomeNotes: string) => Promise<void>;
  updateMailSendStatus: (trackingId: string, sendStatus: MailSendStatus) => Promise<void>;
  markMailSentToday: (trackingId: string) => Promise<void>;
  saveCampaignSteps: (campaignId: string, steps: MailCampaignStep[]) => Promise<void>;
  commercialFunnelEntries: CommercialFunnelEntry[];
  addClientsToFunnel: (campaignId: string, clientRefs: FunnelClientRef[]) => Promise<void>;
  updateFunnelAction: (entryId: string, slotIndex: number, actionType: FunnelActionType | '') => Promise<void>;
  updateFunnelLostReason: (entryId: string, lostReason: string) => Promise<void>;
  updateFunnelActionNote: (entryId: string, slotIndex: number, note: string) => Promise<void>;
  addTaskToFunnelAction: (entryId: string, slotIndex: number, taskId: string) => Promise<void>;
  removeFunnelEntry: (entryId: string) => Promise<void>;
  moveFunnelEntryToCampaign: (entryId: string, targetCampaignId: string) => Promise<void>;
}

const CrmContext = createContext<CrmContextValue | null>(null);

export function useCrm(): CrmContextValue {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error('useCrm must be used within CrmProvider');
  return ctx;
}

interface CrmProviderProps {
  children: ReactNode;
}

export function CrmProvider({ children }: CrmProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [apolloStatus, setApolloStatus] = useState({ ok: false, configured: false, message: '—' });
  const [clients, setClients] = useState<Client[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [clientTasks, setClientTasks] = useState<ClientTask[]>([]);
  const [okrRecords, setOkrRecords] = useState<OkrRecord[]>([]);
  const [analysisYear, setAnalysisYear] = useState<number>(ANALYSIS_YEAR);
  const [forecastsByYear, setForecastsByYear] = useState<AnalysisForecastsByYear>(() => createEmptyForecastsByYear());
  const analysisForecasts = useMemo(
    () => forecastsByYear[analysisYear] ?? createDefaultForecasts(),
    [analysisYear, forecastsByYear],
  );
  const [analysisExpanded, setAnalysisExpanded] = useState<Set<string>>(new Set());
  const [dailyRecallItems, setDailyRecallItems] = useState<RecallItem[]>([]);
  const [recallFilterStatus, setRecallFilterStatus] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [currentOwner, setCurrentOwner] = useState<Owner | null>(null);
  const [mailCampaigns, setMailCampaigns] = useState<MailCampaign[]>([]);
  const [mailCampaignSteps, setMailCampaignSteps] = useState<MailCampaignStep[]>([]);
  const [mailCampaignContacts, setMailCampaignContacts] = useState<MailCampaignContact[]>([]);
  const [mailCampaignSendTracking, setMailCampaignSendTracking] = useState<MailCampaignSendTracking[]>([]);
  const [commercialFunnelEntries, setCommercialFunnelEntries] = useState<CommercialFunnelEntry[]>([]);

  const mailCampaignStateRef = useRef({
    mailCampaigns,
    mailCampaignSteps,
    mailCampaignContacts,
    mailCampaignSendTracking,
  });
  mailCampaignStateRef.current = {
    mailCampaigns,
    mailCampaignSteps,
    mailCampaignContacts,
    mailCampaignSendTracking,
  };

  const commercialFunnelStateRef = useRef({ commercialFunnelEntries });
  commercialFunnelStateRef.current = { commercialFunnelEntries };

  const supabaseConfigured = isSupabaseConfigured();
  const db = useMemo(() => createBrowserSupabaseClient(), []);
  const ideasMutationRef = useRef(0);
  const clientsMutationRef = useRef(0);
  const clientsRef = useRef<Client[]>([]);
  const ideasRef = useRef<Idea[]>([]);
  const clientsMutationQueueRef = useRef<Promise<Client[]>>(Promise.resolve([]));
  const ideasMutationQueueRef = useRef<Promise<Idea[]>>(Promise.resolve([]));
  const jonnyReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  useEffect(() => {
    ideasRef.current = ideas;
  }, [ideas]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = createUniqueId('toast');
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const mailCampaignActions = useMemo(
    () => createMailCampaignActions(
      {
        db,
        setMailCampaigns,
        setMailCampaignSteps,
        setMailCampaignContacts,
        setMailCampaignSendTracking,
        showToast,
      },
      () => mailCampaignStateRef.current,
    ),
    [db, showToast],
  );

  const persistClientsNow = useCallback(async (nextClients?: Client[]) => {
    const data = nextClients ?? clientsRef.current;
    if (!db) {
      throw new Error('Supabase non configurato');
    }
    await persistClients(db, data);
    setIsSupabaseConnected(true);
  }, [db]);

  const mutateClients = useCallback((
    buildNext: (prev: Client[]) => Client[],
    options?: { recalculate?: boolean },
  ): Promise<Client[]> => {
    const runMutation = async (): Promise<Client[]> => {
      if (!db) {
        throw new Error('Supabase non configurato');
      }
      clientsMutationRef.current += 1;
      try {
        let nextClients = buildNext(clientsRef.current);
        if (options?.recalculate !== false) {
          nextClients = recalculateRelationships(nextClients);
        }
        nextClients = syncClientsProfileCompletion(nextClients);
        clientsRef.current = nextClients;
        setClients(nextClients);
        await persistClients(db, nextClients);
        setIsSupabaseConnected(true);
        return nextClients;
      } catch (error) {
        showToast(
          `Errore salvataggio clienti: ${error instanceof Error ? error.message : 'errore'}`,
          'danger',
        );
        throw error;
      } finally {
        clientsMutationRef.current -= 1;
      }
    };
    clientsMutationQueueRef.current = clientsMutationQueueRef.current
      .then(runMutation, runMutation);
    return clientsMutationQueueRef.current;
  }, [db, showToast]);

  const commercialFunnelActions = useMemo(
    () => createCommercialFunnelActions(
      {
        db,
        setCommercialFunnelEntries,
        showToast,
        getCampaignById: (campaignId) => (
          mailCampaignStateRef.current.mailCampaigns.find((campaign) => campaign.id === campaignId)
        ),
      },
      () => commercialFunnelStateRef.current.commercialFunnelEntries,
    ),
    [db, showToast],
  );

  const deleteMailCampaignById = useCallback(async (campaignId: string): Promise<void> => {
    await mailCampaignActions.deleteMailCampaignById(campaignId);
    await commercialFunnelActions.removeFunnelEntriesByCampaign(campaignId);
  }, [commercialFunnelActions, mailCampaignActions]);

  const persistIdeasNow = useCallback(async (nextIdeas?: Idea[], replace = false) => {
    const data = nextIdeas ?? ideasRef.current;
    if (db) {
      ideasMutationRef.current += 1;
      try {
        if (replace) {
          await persistIdeasReplace(db, data);
          ideasRef.current = data;
        } else {
          await persistIdeas(db, data);
        }
        setIsSupabaseConnected(true);
      } finally {
        ideasMutationRef.current -= 1;
      }
    }
  }, [db]);

  const mutateIdeas = useCallback((
    buildNext: (prev: Idea[]) => Idea[],
    persist?: { upsert?: Idea | Idea[]; deleteId?: string },
  ): Promise<Idea[]> => {
    const runMutation = async (): Promise<Idea[]> => {
      if (!db) {
        throw new Error('Supabase non configurato');
      }
      ideasMutationRef.current += 1;
      try {
        const nextIdeas = buildNext(ideasRef.current);
        ideasRef.current = nextIdeas;
        setIdeas(nextIdeas);
        if (persist?.deleteId) {
          await deleteIdeaRecord(db, persist.deleteId);
        }
        if (persist?.upsert) {
          const rows = Array.isArray(persist.upsert) ? persist.upsert : [persist.upsert];
          for (const idea of rows) {
            await upsertIdea(db, idea);
          }
        }
        setIsSupabaseConnected(true);
        return nextIdeas;
      } finally {
        ideasMutationRef.current -= 1;
      }
    };
    ideasMutationQueueRef.current = ideasMutationQueueRef.current.then(runMutation, runMutation);
    return ideasMutationQueueRef.current;
  }, [db]);

  const persistTasksNow = useCallback(async (nextTasks?: ClientTask[]) => {
    const data = nextTasks ?? clientTasks;
    if (db) {
      await persistClientTasks(db, data);
      setIsSupabaseConnected(true);
    }
  }, [clientTasks, db]);

  const persistAnalysisNow = useCallback(async (
    nextOkr?: OkrRecord[],
    nextForecasts?: AnalysisForecasts,
    forecastYear?: number,
  ) => {
    if (!db) return;
    const year = forecastYear ?? analysisYear;
    if (nextOkr !== undefined) {
      await upsertOkrRecords(db, nextOkr);
    }
    if (nextForecasts !== undefined) {
      await persistAnalysisForecasts(db, nextForecasts, year);
      setForecastsByYear((prev) => ({ ...prev, [year]: nextForecasts }));
    }
    setIsSupabaseConnected(true);
  }, [analysisYear, db]);

  const loadDailyRecall = useCallback(async (): Promise<RecallItem[]> => {
    const today = getTodayString();
    if (db && isSupabaseConnected) {
      const stored = await fetchDailyRecall(db, today);
      if (stored && isRecallSelectionValid(stored)) {
        const normalized = normalizeStoredRecallItems(stored);
        setDailyRecallItems(normalized);
        return normalized;
      }
      const generated = generateRandomRecallSelection(clients);
      await saveDailyRecall(db, today, generated);
      setDailyRecallItems(generated);
      return generated;
    }
    const storedRaw = localStorage.getItem('crm_sales_daily_recall');
    if (storedRaw) {
      try {
        const parsed = JSON.parse(storedRaw);
        if (
          parsed.date === today &&
          parsed.version === RECALL_SELECTION_VERSION &&
          Array.isArray(parsed.items) &&
          isRecallSelectionValid(parsed.items)
        ) {
          const normalized = normalizeStoredRecallItems(parsed.items);
          setDailyRecallItems(normalized);
          return normalized;
        }
      } catch {
        /* regenerate */
      }
    }
    const generated = generateRandomRecallSelection(clients);
    localStorage.setItem('crm_sales_daily_recall', JSON.stringify({
      date: today,
      version: RECALL_SELECTION_VERSION,
      items: generated,
    }));
    setDailyRecallItems(generated);
    return generated;
  }, [clients, db, isSupabaseConnected]);

  const refreshApolloStatus = useCallback(async () => {
    if (!db) {
      setApolloStatus({ ok: false, configured: false, message: 'Supabase non configurato' });
      return;
    }
    const status = await getApolloStatus(db);
    setApolloStatus(status);
  }, [db]);

  const reloadRemoteCrmState = useCallback(async (): Promise<void> => {
    if (!db) return;
    if (ideasMutationRef.current > 0 || clientsMutationRef.current > 0) return;
    try {
      const [loadedClients, loadedIdeas, loadedTasks, loadedOkr, loadedForecasts, loadedMailCampaigns, loadedFunnelEntries] = await Promise.all([
        fetchClients(db),
        fetchIdeas(db),
        fetchClientTasks(db),
        fetchAllOkrRecords(db),
        fetchAllAnalysisForecasts(db),
        fetchMailCampaignData(db),
        fetchCommercialFunnelEntries(db),
      ]);
      let normalized = normalizeClients(loadedClients);
      normalized = reconcileImportedClientsToMainList(normalized);
      normalized = applyColdClientPromotionToAll(normalized);
      normalized = recalculateRelationships(normalized);
      normalized = syncClientsProfileCompletion(normalized);
      setClients(normalized);
      clientsRef.current = normalized;
      setIdeas(loadedIdeas);
      ideasRef.current = loadedIdeas;
      setClientTasks(loadedTasks);
      setOkrRecords(linkOkrRecordsToClients(loadedOkr, normalized));
      if (Object.keys(loadedForecasts).length > 0) {
        setForecastsByYear(loadedForecasts);
      }
      setMailCampaigns(loadedMailCampaigns.campaigns);
      setMailCampaignSteps(loadedMailCampaigns.steps);
      setMailCampaignContacts(loadedMailCampaigns.contacts);
      setMailCampaignSendTracking(loadedMailCampaigns.tracking);
      setCommercialFunnelEntries(loadedFunnelEntries);
    } catch (reloadError) {
      console.error('Remote CRM reload failed:', reloadError);
    }
  }, [db]);

  useEffect(() => {
    const scheduleReload = (timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>, delayMs: number): void => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void (async () => {
          if (ideasMutationRef.current > 0 || clientsMutationRef.current > 0) {
            scheduleReload(timerRef, 800);
            return;
          }
          await reloadRemoteCrmState();
        })();
      }, delayMs);
    };
    const handleJonnyUpdated = (): void => {
      scheduleReload(jonnyReloadTimerRef, 600);
    };
    const handleFocusReload = (): void => {
      if (document.visibilityState !== 'visible') return;
      scheduleReload(focusReloadTimerRef, 400);
    };
    window.addEventListener('jonny:crm-updated', handleJonnyUpdated);
    document.addEventListener('visibilitychange', handleFocusReload);
    window.addEventListener('focus', handleFocusReload);
    return () => {
      window.removeEventListener('jonny:crm-updated', handleJonnyUpdated);
      document.removeEventListener('visibilitychange', handleFocusReload);
      window.removeEventListener('focus', handleFocusReload);
      if (jonnyReloadTimerRef.current) clearTimeout(jonnyReloadTimerRef.current);
      if (focusReloadTimerRef.current) clearTimeout(focusReloadTimerRef.current);
    };
  }, [reloadRemoteCrmState]);

  useEffect(() => {
    if (!db) return;
    db.auth.getUser().then(({ data }) => {
      setCurrentOwner(resolveOwnerFromEmail(data.user?.email));
    }).catch(() => setCurrentOwner(null));
  }, [db]);

  useEffect(() => {
    async function loadState(): Promise<void> {
      try {
        if (db) {
          const status = await testSupabaseConnection(db);
          if (!status.ok) throw new Error(status.message);
          const [loadedClients, loadedIdeas, loadedTasks, loadedOkr, loadedForecasts, loadedMailCampaigns, loadedFunnelEntries] = await Promise.all([
            fetchClients(db),
            fetchIdeas(db),
            fetchClientTasks(db),
            fetchAllOkrRecords(db),
            fetchAllAnalysisForecasts(db),
            fetchMailCampaignData(db),
            fetchCommercialFunnelEntries(db),
          ]);
          let normalized = normalizeClients(loadedClients);
          normalized = reconcileImportedClientsToMainList(normalized);
          normalized = applyColdClientPromotionToAll(normalized);
          normalized = recalculateRelationships(normalized);
          normalized = syncClientsProfileCompletion(normalized);
          setClients(normalized);
          clientsRef.current = normalized;
          setIdeas(loadedIdeas);
          ideasRef.current = loadedIdeas;
          setClientTasks(loadedTasks);
          setOkrRecords(linkOkrRecordsToClients(loadedOkr, normalized));
          if (Object.keys(loadedForecasts).length > 0) {
            setForecastsByYear(loadedForecasts);
          }
          setMailCampaigns(loadedMailCampaigns.campaigns);
          setMailCampaignSteps(loadedMailCampaigns.steps);
          setMailCampaignContacts(loadedMailCampaigns.contacts);
          setMailCampaignSendTracking(loadedMailCampaigns.tracking);
          setCommercialFunnelEntries(loadedFunnelEntries);
          setIsSupabaseConnected(true);
          await refreshApolloStatus();
        } else {
          setIsSupabaseConnected(false);
          if (!supabaseConfigured) {
            showToast('Supabase non configurato. Imposta NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.', 'warning');
          }
        }
      } catch (error) {
        console.error('Load failed:', error);
        setIsSupabaseConnected(false);
        showToast(
          `Errore dati: ${error instanceof Error ? error.message : 'errore'}. Verifica di essere autenticato.`,
          'warning',
        );
      } finally {
        setIsLoading(false);
      }
    }
    loadState();
  }, [db, refreshApolloStatus, showToast, supabaseConfigured]);

  useEffect(() => {
    if (!isLoading && clients.length >= 0) {
      loadDailyRecall().catch(console.error);
    }
  }, [isLoading, clients.length, loadDailyRecall]);

  const totalRevenue2026 = useMemo(
    () => clients.filter(isClientInActiveSection).reduce((sum, c) => sum + (c.rev2026 || 0), 0),
    [clients],
  );

  const saveClient = useCallback(async (
    input: Partial<Client> & { name: string },
    options?: { isCold?: boolean; isEdit?: boolean; id?: string },
  ) => {
    const id = options?.id || input.id;
    const isCold = options?.isCold ?? false;
    await mutateClients((prev) => {
      if (id) {
        return prev.map((c) => {
          if (c.id !== id) return c;
          const { action: inputAction, actionDate: _ignoredActionDate, ...restInput } = input;
          const trimmedAction = inputAction !== undefined ? inputAction.trim() : undefined;
          const updated: Client = {
            ...c,
            ...restInput,
            id: c.id,
            contacts: input.contacts ?? c.contacts,
            productOffers: input.productOffers ?? c.productOffers,
            manualRelationship: input.manualRelationship ?? c.manualRelationship,
            actionDate: c.actionDate,
          };
          if (input.relationship !== undefined && input.relationship !== c.relationship) {
            updated.manualRelationship = true;
          }
          if (trimmedAction !== undefined) {
            updated.action = trimmedAction;
            updated.actionDate = resolveActionDateOnTextChange(c.action || '', trimmedAction, c.actionDate);
          }
          if (isCold || isClientInColdSection(updated)) {
            updated.isColdClient = (updated.rev2026 || 0) <= COLD_CLIENT_REV_THRESHOLD;
          }
          return applyColdClientPromotion(updated).client;
        });
      }
      const trimmedAction = (input.action || '').trim();
      const newClient: Client = {
        id: createUniqueId('client'),
        name: input.name,
        type: input.type || 'Cliente Diretto',
        owner: input.owner || 'Jeck',
        clientOrigin: input.clientOrigin || '',
        relationship: input.relationship || 'Nuovo Cliente',
        manualRelationship: false,
        rev2023: 0,
        rev2024: 0,
        rev2025: input.rev2025 || 0,
        rev2026: input.rev2026 || 0,
        action: trimmedAction,
        actionDate: trimmedAction
          ? resolveActionDateOnTextChange('', trimmedAction, DEFAULT_ACTION_DATE)
          : '',
        email: input.email || '',
        description: input.description || '',
        contacts: input.contacts || [],
        productOffers: resolveClientProductOffers(
          input.type || 'Cliente Diretto',
          input.productOffers,
        ),
        needsProfileCompletion: true,
        isColdClient: isCold || (input.rev2026 || 0) <= COLD_CLIENT_REV_THRESHOLD,
      };
      return [...prev, applyColdClientPromotion(newClient).client];
    });
    showToast(id ? `Cliente "${input.name}" aggiornato.` : `Cliente "${input.name}" creato.`, 'success');
  }, [mutateClients, showToast]);

  const saveClients = useCallback(async (
    inputs: Array<Partial<Client> & { name: string }>,
    options?: { isCold?: boolean },
  ) => {
    const isCold = options?.isCold ?? false;
    const validInputs = inputs.filter((input) => input.name.trim());
    if (validInputs.length === 0) return;
    await mutateClients((prev) => {
      const newClients = validInputs.map((input) => {
        const trimmedAction = (input.action || '').trim();
        const newClient: Client = {
          id: createUniqueId('client'),
          name: input.name.trim(),
          type: input.type || 'Cliente Diretto',
          owner: input.owner || 'Jeck',
          clientOrigin: input.clientOrigin || '',
          relationship: input.relationship || 'Nuovo Cliente',
          manualRelationship: false,
          rev2023: 0,
          rev2024: 0,
          rev2025: input.rev2025 || 0,
          rev2026: input.rev2026 || 0,
          action: trimmedAction,
          actionDate: trimmedAction
            ? resolveActionDateOnTextChange('', trimmedAction, DEFAULT_ACTION_DATE)
            : '',
          email: input.email || '',
          description: input.description || '',
          contacts: input.contacts || [],
          productOffers: resolveClientProductOffers(
            input.type || 'Cliente Diretto',
            input.productOffers,
          ),
          needsProfileCompletion: true,
          isColdClient: isCold || (input.rev2026 || 0) <= COLD_CLIENT_REV_THRESHOLD,
        };
        return applyColdClientPromotion(newClient).client;
      });
      return [...prev, ...newClients];
    });
    showToast(`${validInputs.length} clienti creati.`, 'success');
  }, [mutateClients, showToast]);

  const deleteClient = useCallback(async (clientId: string) => {
    if (!db) {
      throw new Error('Supabase non configurato');
    }
    await deleteClientRecord(db, clientId);
    await mutateClients((prev) => prev.filter((c) => c.id !== clientId), { recalculate: false });
    showToast('Cliente rimosso dal database.', 'info');
  }, [db, mutateClients, showToast]);

  const updateClientField = useCallback(async (
    clientId: string,
    field: keyof Client,
    value: unknown,
  ) => {
    await mutateClients((prev) => prev.map((c) => {
      if (c.id !== clientId) return c;
      const updated = { ...c, [field]: value } as Client;
      if (field === 'relationship') updated.manualRelationship = true;
      if (field === 'type') {
        updated.productOffers = reconcileProductOffersForTypeChange(
          updated.type,
          updated.productOffers,
        );
      }
      return applyColdClientPromotion(updated).client;
    }));
  }, [mutateClients]);

  const updateClientContacts = useCallback(async (
    clientId: string,
    contacts: ClientContact[],
  ) => {
    const normalizedContacts = contacts.map((contact) => ({
      id: contact.id || createUniqueId('contact'),
      email: contact.email || '',
      name: contact.name || '',
      role: contact.role || '',
      phone: contact.phone || '',
    }));
    await mutateClients((prev) => prev.map((c) => {
      if (c.id !== clientId) return c;
      const updated = { ...c, contacts: normalizedContacts };
      syncClientLegacyFields(updated);
      return applyColdClientPromotion(updated).client;
    }));
  }, [mutateClients]);

  const updateClientAction = useCallback(async (clientId: string, action: string) => {
    const trimmedAction = action.trim();
    await mutateClients((prev) => prev.map((c) => {
      if (c.id !== clientId) return c;
      return {
        ...c,
        action: trimmedAction,
        actionDate: resolveActionDateOnTextChange(c.action || '', trimmedAction, c.actionDate),
      };
    }), { recalculate: false });
  }, [mutateClients]);

  const updateClientProductOffers = useCallback(async (
    clientId: string,
    offerIds: ProductOfferId[],
  ) => {
    await mutateClients((prev) => prev.map((c) => (
      c.id === clientId ? { ...c, productOffers: offerIds } : c
    )), { recalculate: false });
  }, [mutateClients]);

  const saveIdea = useCallback(async (
    input: Partial<Idea> & { name: string; description?: string; clientId?: string },
  ) => {
    const prev = ideasRef.current;
    const normalizedAssignees: Owner[] = input.itemType === 'task'
      ? (input.assignees?.length ? input.assignees.slice(0, 2) : ['Jeck'])
      : [];
    const isUpdate = Boolean(input.id && prev.some((item) => item.id === input.id));
    let savedIdea: Idea;
    if (isUpdate) {
      const existing = prev.find((item) => item.id === input.id);
      if (!existing) return;
      savedIdea = {
        ...existing,
        ...input,
        id: existing.id,
        clientId: input.clientId ?? existing.clientId ?? '',
        description: input.description ?? existing.description ?? '',
        assignees: normalizedAssignees,
        attachments: input.attachments ?? existing.attachments ?? [],
        subtasks: input.subtasks ?? existing.subtasks ?? [],
      } as Idea;
    } else {
      savedIdea = {
        id: input.id || createUniqueId('idea'),
        name: input.name,
        category: input.category || 'Content',
        clientId: input.clientId || '',
        status: input.status || 'Da fare',
        description: input.description || '',
        dateAdded: getTodayString(),
        itemType: input.itemType || 'idea',
        dueDate: input.dueDate || '',
        assignees: normalizedAssignees,
        attachments: input.attachments || [],
        subtasks: input.subtasks || [],
      };
    }
    await mutateIdeas(
      (current) => (
        isUpdate
          ? current.map((item) => (item.id === savedIdea.id ? savedIdea : item))
          : [...current, savedIdea]
      ),
      { upsert: savedIdea },
    );
    const isTask = input.itemType === 'task';
    showToast(
      isUpdate
        ? (isTask ? 'Task aggiornata.' : 'Elemento aggiornato.')
        : (isTask ? 'Task creata.' : 'Elemento creato.'),
      'success',
    );
  }, [mutateIdeas, showToast]);

  const deleteIdea = useCallback(async (ideaId: string) => {
    const removed = ideasRef.current.find((item) => item.id === ideaId);
    await mutateIdeas(
      (prev) => prev.filter((item) => item.id !== ideaId),
      { deleteId: ideaId },
    );
    showToast(removed?.itemType === 'task' ? 'Task eliminata.' : 'Idea eliminata.', 'info');
  }, [mutateIdeas, showToast]);

  const moveIdeaStatus = useCallback(async (ideaId: string, newStatus: Idea['status']) => {
    const existing = ideasRef.current.find((item) => item.id === ideaId);
    if (!existing) return;
    const savedIdea: Idea = { ...existing, status: newStatus };
    await mutateIdeas(
      (prev) => prev.map((item) => (item.id === ideaId ? savedIdea : item)),
      { upsert: savedIdea },
    );
  }, [mutateIdeas]);

  const uploadTaskAttachment = useCallback(async (ideaId: string, file: File): Promise<void> => {
    if (!db) {
      showToast('Supabase non configurato.', 'danger');
      return;
    }
    const idea = ideasRef.current.find((item) => item.id === ideaId);
    if (!idea) return;
    const attachmentId = createUniqueId('attachment');
    const fileName = sanitizeStorageSegment(file.name);
    const path = `${ideaId}/${attachmentId}-${fileName}`;
    const { error } = await db.storage
      .from(TASK_ATTACHMENTS_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) {
      showToast(`Upload fallito: ${error.message}`, 'danger');
      return;
    }
    const attachment: TaskAttachment = {
      id: attachmentId,
      name: file.name,
      path,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
    };
    const savedIdea: Idea = {
      ...idea,
      attachments: [...(idea.attachments || []), attachment],
    };
    await mutateIdeas(
      (prev) => prev.map((item) => (item.id === ideaId ? savedIdea : item)),
      { upsert: savedIdea },
    );
    showToast('Documento allegato alla task.', 'success');
  }, [db, mutateIdeas, showToast]);

  const downloadTaskAttachment = useCallback(async (attachment: TaskAttachment): Promise<void> => {
    if (!db) {
      showToast('Supabase non configurato.', 'danger');
      return;
    }
    const { data, error } = await db.storage
      .from(TASK_ATTACHMENTS_BUCKET)
      .download(attachment.path);
    if (error || !data) {
      showToast(`Download fallito: ${error?.message || 'file non trovato'}`, 'danger');
      return;
    }
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.name;
    link.click();
    URL.revokeObjectURL(url);
  }, [db, showToast]);

  const removeTaskAttachment = useCallback(async (
    ideaId: string,
    attachment: TaskAttachment,
  ): Promise<void> => {
    if (!db) {
      showToast('Supabase non configurato.', 'danger');
      return;
    }
    const { error } = await db.storage
      .from(TASK_ATTACHMENTS_BUCKET)
      .remove([attachment.path]);
    if (error) {
      showToast(`Rimozione fallita: ${error.message}`, 'danger');
      return;
    }
    const current = ideasRef.current.find((item) => item.id === ideaId);
    if (!current) return;
    const savedIdea: Idea = {
      ...current,
      attachments: (current.attachments || []).filter((value) => value.id !== attachment.id),
    };
    await mutateIdeas(
      (prev) => prev.map((item) => (item.id === ideaId ? savedIdea : item)),
      { upsert: savedIdea },
    );
    showToast('Documento rimosso.', 'info');
  }, [db, mutateIdeas, showToast]);

  const saveTask = useCallback(async (
    input: Partial<ClientTask> & { title: string; clientId: string },
  ) => {
    let nextTasks: ClientTask[];
    if (input.id) {
      nextTasks = clientTasks.map((t) => (t.id === input.id ? { ...t, ...input, id: t.id } as ClientTask : t));
    } else {
      nextTasks = [...clientTasks, {
        id: createUniqueId('task'),
        clientId: input.clientId,
        title: input.title,
        taskType: input.taskType || 'follow-up',
        dueDate: input.dueDate || '',
        assignee: input.assignee || 'Jeck',
        completed: false,
        notes: input.notes || '',
        createdAt: new Date().toISOString(),
        completedAt: '',
      }];
    }
    setClientTasks(nextTasks);
    await persistTasksNow(nextTasks);
    showToast(input.id ? 'Task aggiornata.' : 'Task creata.', 'success');
  }, [clientTasks, persistTasksNow, showToast]);

  const deleteTask = useCallback(async (taskId: string) => {
    const nextTasks = clientTasks.filter((t) => t.id !== taskId);
    setClientTasks(nextTasks);
    await persistTasksNow(nextTasks);
    showToast('Task eliminata.', 'info');
  }, [clientTasks, persistTasksNow, showToast]);

  const toggleTaskCompleted = useCallback(async (taskId: string, completed: boolean) => {
    const nextTasks = clientTasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        completed,
        completedAt: completed ? new Date().toISOString() : '',
      };
    });
    setClientTasks(nextTasks);
    await persistTasksNow(nextTasks);
  }, [clientTasks, persistTasksNow]);

  const setAnalysisForecast = useCallback(async (
    scope: string,
    field: 'totalForecast' | 'productPct',
    value: number,
    product?: string,
  ) => {
    if (!db) {
      showToast('Supabase non configurato.', 'warning');
      return;
    }
    let nextForecasts: AnalysisForecasts | null = null;
    setForecastsByYear((prev) => {
      const current = prev[analysisYear] ?? createDefaultForecasts();
      const next = { ...current };
      if (!next[scope]) next[scope] = { totalForecast: 0, productPct: {} };
      if (field === 'totalForecast') {
        next[scope] = { ...next[scope], totalForecast: value };
      } else if (product) {
        next[scope] = {
          ...next[scope],
          productPct: { ...next[scope].productPct, [product]: value },
        };
      }
      nextForecasts = next;
      return { ...prev, [analysisYear]: next };
    });
    if (!nextForecasts) return;
    try {
      await persistAnalysisNow(undefined, nextForecasts, analysisYear);
    } catch (error) {
      showToast(
        `Errore salvataggio previsioni: ${error instanceof Error ? error.message : 'errore'}`,
        'danger',
      );
    }
  }, [analysisYear, db, persistAnalysisNow, showToast]);

  const handleSetAnalysisYear = useCallback((year: number) => {
    if (!isAnalysisYear(year)) return;
    setAnalysisYear(year);
  }, []);

  const toggleAnalysisScope = useCallback((scope: string) => {
    setAnalysisExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }, []);

  const refreshRecall = useCallback(async () => {
    const doneCount = dailyRecallItems.filter((item) => item.status === 'Done').length;
    const generated = refreshRecallSelectionPreservingDone(clients, dailyRecallItems);
    setDailyRecallItems(generated);
    const today = getTodayString();
    if (db && isSupabaseConnected) {
      await saveDailyRecall(db, today, generated);
    } else {
      localStorage.setItem('crm_sales_daily_recall', JSON.stringify({
        date: today,
        version: RECALL_SELECTION_VERSION,
        items: generated,
      }));
    }
    const refreshedCount = generated.length - doneCount;
    showToast(
      refreshedCount > 0
        ? `Aggiornati ${refreshedCount} clienti To do. I Done restano fissi.`
        : 'Nessun cliente To do da aggiornare.',
      'success',
    );
  }, [clients, dailyRecallItems, db, isSupabaseConnected, showToast]);

  const persistDailyRecallItems = useCallback(async (items: RecallItem[]) => {
    const today = getTodayString();
    if (db && isSupabaseConnected) {
      await saveDailyRecall(db, today, items);
    } else {
      localStorage.setItem('crm_sales_daily_recall', JSON.stringify({
        date: today,
        version: RECALL_SELECTION_VERSION,
        items,
      }));
    }
  }, [db, isSupabaseConnected]);

  const updateRecallStatus = useCallback(async (clientId: string, status: RecallItem['status']) => {
    const next = dailyRecallItems.map((item) =>
      item.clientId === clientId ? { ...item, status } : item,
    );
    setDailyRecallItems(next);
    await persistDailyRecallItems(next);
  }, [dailyRecallItems, persistDailyRecallItems]);

  const completeRecallWithAction = useCallback(async (clientId: string, action: string) => {
    const trimmedAction = action.trim();
    if (!trimmedAction) return;
    await mutateClients((prev) => prev.map((c) => {
      if (c.id !== clientId) return c;
      return {
        ...c,
        action: trimmedAction,
        actionDate: resolveActionDateOnTextChange(c.action || '', trimmedAction, c.actionDate),
      };
    }), { recalculate: false });
    const nextRecall = dailyRecallItems.map((item) =>
      item.clientId === clientId ? { ...item, status: 'Done' as const } : item,
    );
    setDailyRecallItems(nextRecall);
    await persistDailyRecallItems(nextRecall);
  }, [dailyRecallItems, mutateClients, persistDailyRecallItems]);

  const processExcelImport = useCallback(async (
    parsedClients: ParsedExcelClient[],
    newOkrRecords: OkrRecord[],
    importYear: number,
    format: ExcelImportFormat = 'okr',
    replaceYearOkr = false,
  ) => {
    try {
      if (!db) {
        throw new Error('Supabase non configurato. Imposta le variabili NEXT_PUBLIC_SUPABASE_* su Vercel o in .env.local.');
      }
      await assertClientsHistoricalRevenueSchema(db);
      const clientMerge = mergeClientsWithExcelImport(clientsRef.current, parsedClients, importYear);
      let nextClients = recalculateRelationships(clientMerge.merged);
      nextClients = reconcileImportedClientsToMainList(nextClients);
      nextClients = syncClientsProfileCompletion(nextClients);
      const shouldReplaceYearOkr = replaceYearOkr || isRowPerOkrImportFormat(format);
      await persistClientsNow(nextClients);
      clientsRef.current = nextClients;
      if (shouldReplaceYearOkr) {
        const linkedOkrRecords = linkOkrRecordsToClients(newOkrRecords, nextClients);
        await deleteOkrRecordsForYear(db, importYear);
        if (linkedOkrRecords.length > 0) {
          await upsertOkrRecords(db, linkedOkrRecords);
        }
      } else {
        const okrMerge = mergeOkrRecordsWithImport(okrRecords, newOkrRecords, nextClients);
        if (okrMerge.upserted.length > 0) {
          await upsertOkrRecords(db, okrMerge.upserted);
        }
      }
    const [loadedClients, loadedOkr] = await Promise.all([
      fetchClients(db),
      fetchAllOkrRecords(db),
    ]);
    let normalized = normalizeClients(loadedClients);
    normalized = reconcileImportedClientsToMainList(normalized);
    normalized = applyColdClientPromotionToAll(normalized);
    normalized = recalculateRelationships(normalized);
    normalized = syncClientsProfileCompletion(normalized);
    const linkedOkr = linkOkrRecordsToClients(loadedOkr, normalized);
    setClients(normalized);
    clientsRef.current = normalized;
    setOkrRecords(linkedOkr);
    setIsSupabaseConnected(true);
    showToast(
      shouldReplaceYearOkr
        ? `Import ${importYear}: ${clientMerge.addedCount} clienti aggiunti, ${clientMerge.updatedCount} aggiornati, ${clientMerge.skippedCount} invariati. ${newOkrRecords.length} OKR salvati.`
        : `Import ${importYear}: ${clientMerge.addedCount} clienti aggiunti, ${clientMerge.updatedCount} aggiornati, ${clientMerge.skippedCount} invariati. OKR elaborati.`,
      'success',
    );
    } catch (error) {
      console.error('Excel import failed:', error);
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      showToast(`Import fallito: ${message}`, 'danger');
      throw error;
    }
  }, [db, okrRecords, persistClientsNow, showToast]);

  const parseExcelBuffer = useCallback((buffer: ArrayBuffer, filename?: string) => {
    return parseExcelImportBuffer(buffer, filename);
  }, []);

  const resetAllData = useCallback(async () => {
    if (db) {
      await clearAllData(db);
      await clearMailCampaignData(db);
      await clearCommercialFunnelData(db);
    }
    setClients([]);
    clientsRef.current = [];
    setCommercialFunnelEntries([]);
    setIdeas([]);
    setClientTasks([]);
    setOkrRecords([]);
    setMailCampaigns([]);
    setMailCampaignSteps([]);
    setMailCampaignContacts([]);
    setMailCampaignSendTracking([]);
    setForecastsByYear(createEmptyForecastsByYear());
    setAnalysisYear(ANALYSIS_YEAR);
    setDailyRecallItems([]);
    showToast('Gestionale azzerato.', 'warning');
  }, [db, showToast]);

  const cleanHistoricalYears = useCallback(async () => {
    if (!db) {
      showToast('Supabase non configurato.', 'danger');
      return;
    }
    try {
      const result = await cleanHistoricalYearsData(db);
      setOkrRecords((prev) => prev.filter((record) => record.year !== 2023 && record.year !== 2024));
      const nextClients = clientsRef.current.map((client) => ({ ...client, rev2023: 0, rev2024: 0 }));
      clientsRef.current = nextClients;
      setClients(nextClients);
      setForecastsByYear((prev) => {
        const defaults = createEmptyForecastsByYear();
        return { ...prev, 2023: defaults[2023], 2024: defaults[2024] };
      });
      const okrDeleted = HISTORICAL_IMPORT_YEARS
        .map((year) => `${year}: ${result.deletedOkrByYear[year] ?? 0}`)
        .join(', ');
      showToast(
        `Dati 2023/2024 rimossi (OKR ${okrDeleted}, clienti aggiornati: ${result.updatedClients}). Reimporta gli Excel storici.`,
        'success',
      );
    } catch (error) {
      console.error('Historical years cleanup failed:', error);
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      showToast(`Pulizia 2023/2024 fallita: ${message}`, 'danger');
      throw error;
    }
  }, [db, showToast]);

  const exportJsonBackup = useCallback(() => {
    const payload = {
      clients,
      ideas,
      clientTasks,
      okrRecords,
      analysisForecastsByYear: forecastsByYear,
      analysisYear,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-backup-${getTodayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [analysisYear, clientTasks, clients, forecastsByYear, ideas, okrRecords]);

  const importJsonBackup = useCallback(async (json: string) => {
    const data = JSON.parse(json) as {
      clients?: Client[];
      ideas?: Idea[];
      clientTasks?: ClientTask[];
      okrRecords?: OkrRecord[];
      analysisForecasts?: AnalysisForecasts;
      analysisForecastsByYear?: AnalysisForecastsByYear;
      analysisYear?: number;
    };
    const nextClients = recalculateRelationships(
      reconcileImportedClientsToMainList(normalizeClients(data.clients || [])),
    );
    setClients(nextClients);
    clientsRef.current = nextClients;
    const normalizedIdeas = (data.ideas || []).map((idea) => ({
      ...idea,
      attachments: idea.attachments || [],
      subtasks: idea.subtasks || [],
    }));
    setIdeas(normalizedIdeas);
    ideasRef.current = normalizedIdeas;
    setClientTasks(data.clientTasks || []);
    setOkrRecords(data.okrRecords || []);
    if (data.analysisForecastsByYear) {
      setForecastsByYear(data.analysisForecastsByYear);
    } else if (data.analysisForecasts) {
      setForecastsByYear({
        ...createEmptyForecastsByYear(),
        [ANALYSIS_YEAR]: data.analysisForecasts,
      });
    }
    if (data.analysisYear) setAnalysisYear(data.analysisYear);
    await persistClientsNow(nextClients);
    await persistIdeasNow(normalizedIdeas, true);
    await persistTasksNow(data.clientTasks || []);
    await persistAnalysisNow(
      data.okrRecords || [],
      data.analysisForecastsByYear?.[data.analysisYear ?? ANALYSIS_YEAR] ?? data.analysisForecasts,
      data.analysisYear ?? ANALYSIS_YEAR,
    );
    showToast('Backup importato.', 'success');
  }, [persistAnalysisNow, persistClientsNow, persistIdeasNow, persistTasksNow, showToast]);

  const enrichClientApollo = useCallback(async (clientId: string) => {
    if (!db) {
      showToast('Supabase non configurato.', 'danger');
      return;
    }
    const client = clientsRef.current.find((c) => c.id === clientId);
    if (!client) return;
    showToast('Arricchimento Apollo in corso...', 'info');
    const result = await enrichClientWithApollo(db, {
      companyName: client.name,
      email: client.contacts[0]?.email || client.email,
    });
    if (!result.ok) {
      showToast(result.error || 'Errore Apollo', 'danger');
      return;
    }
    await mutateClients((prev) => prev.map((c) => {
      if (c.id !== clientId) return c;
      const contacts: ClientContact[] = [...c.contacts];
      if (result.email && typeof result.email === 'string') {
        if (contacts.length === 0) {
          contacts.push({ id: createUniqueId('contact'), email: result.email, name: '', role: '', phone: '' });
        } else if (!contacts[0]?.email?.trim()) {
          contacts[0] = { ...contacts[0], email: result.email };
        }
      }
      if (result.phone && typeof result.phone === 'string' && contacts.length > 0 && !contacts[0]?.phone?.trim()) {
        contacts[0] = { ...contacts[0], phone: result.phone };
      }
      const description = result.description
        ? appendApolloDescription(c.description, result.description)
        : c.description;
      const action = resolveActionWithWebsite(
        c.action,
        typeof result.website === 'string' ? result.website : undefined,
      );
      const updated = { ...c, contacts, description, action, email: contacts[0]?.email || c.email };
      syncClientLegacyFields(updated);
      return updated;
    }), { recalculate: false });
    showToast('Cliente arricchito con Apollo.', 'success');
  }, [db, mutateClients, showToast]);

  const value: CrmContextValue = {
    isLoading,
    isSupabaseConnected,
    isSupabaseConfigured: supabaseConfigured,
    apolloStatus,
    clients,
    ideas,
    clientTasks,
    okrRecords,
    analysisYear,
    analysisForecasts,
    analysisExpanded,
    dailyRecallItems: filterValidRecallItems(dailyRecallItems, clients),
    recallFilterStatus,
    totalRevenue2026,
    currentOwner,
    showToast,
    toasts,
    dismissToast,
    refreshApolloStatus,
    saveClient,
    saveClients,
    deleteClient,
    updateClientField,
    updateClientContacts,
    updateClientAction,
    updateClientProductOffers,
    saveIdea,
    deleteIdea,
    moveIdeaStatus,
    uploadTaskAttachment,
    downloadTaskAttachment,
    removeTaskAttachment,
    saveTask,
    deleteTask,
    toggleTaskCompleted,
    setAnalysisForecast,
    setAnalysisYear: handleSetAnalysisYear,
    toggleAnalysisScope,
    refreshRecall,
    updateRecallStatus,
    completeRecallWithAction,
    processExcelImport,
    parseExcelBuffer,
    resetAllData,
    cleanHistoricalYears,
    exportJsonBackup,
    importJsonBackup,
    enrichClientApollo,
    setClients,
    setIdeas,
    setClientTasks,
    setDailyRecallItems,
    setRecallFilterStatus,
    persistClientsNow,
    persistIdeasNow,
    persistTasksNow,
    persistAnalysisNow,
    loadDailyRecall,
    mailCampaigns,
    mailCampaignSteps,
    mailCampaignContacts,
    mailCampaignSendTracking,
    saveMailCampaign: mailCampaignActions.saveMailCampaign,
    updateMailCampaignOwner: mailCampaignActions.updateMailCampaignOwner,
    deleteMailCampaignById,
    addContactsToCampaign: mailCampaignActions.addContactsToCampaign,
    removeContactFromCampaign: mailCampaignActions.removeContactFromCampaign,
    updateCampaignContactStatus: mailCampaignActions.updateCampaignContactStatus,
    updateCampaignContactNotes: mailCampaignActions.updateCampaignContactNotes,
    updateMailSendStatus: mailCampaignActions.updateMailSendStatus,
    markMailSentToday: mailCampaignActions.markMailSentToday,
    saveCampaignSteps: mailCampaignActions.saveCampaignSteps,
    commercialFunnelEntries,
    addClientsToFunnel: commercialFunnelActions.addClientsToFunnel,
    updateFunnelAction: commercialFunnelActions.updateFunnelAction,
    updateFunnelLostReason: commercialFunnelActions.updateFunnelLostReason,
    updateFunnelActionNote: commercialFunnelActions.updateFunnelActionNote,
    addTaskToFunnelAction: commercialFunnelActions.addTaskToFunnelAction,
    removeFunnelEntry: commercialFunnelActions.removeFunnelEntry,
    moveFunnelEntryToCampaign: commercialFunnelActions.moveFunnelEntryToCampaign,
  };

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}
