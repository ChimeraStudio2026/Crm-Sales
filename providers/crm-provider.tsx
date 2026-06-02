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
  ParsedExcelClient,
  RecallItem,
  Relationship,
} from '@/lib/types/crm';
import {
  ANALYSIS_YEAR,
  COLD_CLIENT_REV_THRESHOLD,
  EXCEL_IMPORT_ACTION_PREFIX,
  EXCEL_IMPORT_DESC_PREFIX,
  DEFAULT_ACTION_DATE,
  PREVIOUS_ANALYSIS_YEAR,
} from '@/lib/constants/crm';
import { createDefaultForecasts } from '@/lib/analysis/index';
import {
  getRevenueFieldForImportYear,
  parseExcelImportBuffer,
  type ExcelImportParseResult,
} from '@/lib/crm/excel';
import { mergeOkrRecordsWithImport, linkOkrRecordsToClients } from '@/lib/crm/import-merge';
import {
  applyColdClientPromotion,
  applyColdClientPromotionToAll,
  createUniqueId,
  getTodayString,
  hasExcelRevenueDifference,
  isClientInActiveSection,
  isClientInColdSection,
  normalizeClients,
  recalculateRelationships,
  reconcileImportedClientsToMainList,
  resolveActionDateOnTextChange,
  syncClientLegacyFields,
  updateClientProfileCompletion,
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
  fetchDailyRecall,
  fetchIdeas,
  fetchAllOkrRecords,
  fetchOkrRecords,
  getApolloStatus,
  persistAnalysisForecasts,
  persistClientTasks,
  persistClients,
  persistIdeas,
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
  showToast: (message: string, type?: ToastType) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  refreshApolloStatus: () => Promise<void>;
  saveClient: (client: Partial<Client> & { name: string }, options?: { isCold?: boolean; isEdit?: boolean; id?: string }) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  updateClientField: (clientId: string, field: keyof Client, value: unknown) => Promise<void>;
  updateClientContacts: (clientId: string, contacts: ClientContact[]) => Promise<void>;
  updateClientAction: (clientId: string, action: string) => Promise<void>;
  updateClientProductOffers: (clientId: string, offerIds: ProductOfferId[]) => Promise<void>;
  saveIdea: (idea: Partial<Idea> & { name: string; description: string; clientId: string }) => Promise<void>;
  deleteIdea: (ideaId: string) => Promise<void>;
  moveIdeaStatus: (ideaId: string, newStatus: Idea['status']) => Promise<void>;
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
  ) => Promise<void>;
  parseExcelBuffer: (buffer: ArrayBuffer, filename?: string) => ExcelImportParseResult;
  resetAllData: () => Promise<void>;
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
  const [forecastsByYear, setForecastsByYear] = useState<AnalysisForecastsByYear>(() => ({
    [PREVIOUS_ANALYSIS_YEAR]: createDefaultForecasts(),
    [ANALYSIS_YEAR]: createDefaultForecasts(),
  }));
  const analysisForecasts = useMemo(
    () => forecastsByYear[analysisYear] ?? createDefaultForecasts(),
    [analysisYear, forecastsByYear],
  );
  const [analysisExpanded, setAnalysisExpanded] = useState<Set<string>>(new Set());
  const [dailyRecallItems, setDailyRecallItems] = useState<RecallItem[]>([]);
  const [recallFilterStatus, setRecallFilterStatus] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const supabaseConfigured = isSupabaseConfigured();
  const db = useMemo(() => createBrowserSupabaseClient(), []);
  const ideasMutationRef = useRef(0);
  const jonnyReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const persistClientsNow = useCallback(async (nextClients?: Client[]) => {
    const data = nextClients ?? clients;
    if (!db) {
      throw new Error('Supabase non configurato');
    }
    await persistClients(db, data);
    setIsSupabaseConnected(true);
  }, [clients, db]);

  const persistIdeasNow = useCallback(async (nextIdeas?: Idea[]) => {
    const data = nextIdeas ?? ideas;
    if (db) {
      ideasMutationRef.current += 1;
      try {
        await persistIdeas(db, data);
        setIsSupabaseConnected(true);
      } finally {
        ideasMutationRef.current -= 1;
      }
    }
  }, [db, ideas]);

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
    const forecasts = nextForecasts ?? forecastsByYear[year] ?? createDefaultForecasts();
    await upsertOkrRecords(db, nextOkr ?? okrRecords);
    await persistAnalysisForecasts(db, forecasts, year);
    setForecastsByYear((prev) => ({ ...prev, [year]: forecasts }));
    setIsSupabaseConnected(true);
  }, [analysisYear, db, forecastsByYear, okrRecords]);

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

  useEffect(() => {
    async function reloadFromJonny(): Promise<void> {
      if (!db) return;
      if (ideasMutationRef.current > 0) {
        if (jonnyReloadTimerRef.current) clearTimeout(jonnyReloadTimerRef.current);
        jonnyReloadTimerRef.current = setTimeout(() => {
          jonnyReloadTimerRef.current = null;
          void reloadFromJonny();
        }, 800);
        return;
      }
      try {
        const [loadedClients, loadedIdeas, loadedTasks, loadedOkr, loadedForecasts] = await Promise.all([
          fetchClients(db),
          fetchIdeas(db),
          fetchClientTasks(db),
          fetchAllOkrRecords(db),
          fetchAllAnalysisForecasts(db),
        ]);
        let normalized = normalizeClients(loadedClients);
        normalized = reconcileImportedClientsToMainList(normalized);
        normalized = applyColdClientPromotionToAll(normalized);
        normalized = recalculateRelationships(normalized);
        setClients(normalized);
        setIdeas(loadedIdeas);
        setClientTasks(loadedTasks);
        setOkrRecords(linkOkrRecordsToClients(loadedOkr, normalized));
        if (Object.keys(loadedForecasts).length > 0) {
          setForecastsByYear(loadedForecasts);
        }
      } catch (reloadError) {
        console.error('Jonny reload failed:', reloadError);
      }
    }
    const handleJonnyUpdated = (): void => {
      if (jonnyReloadTimerRef.current) clearTimeout(jonnyReloadTimerRef.current);
      jonnyReloadTimerRef.current = setTimeout(() => {
        jonnyReloadTimerRef.current = null;
        void reloadFromJonny();
      }, 600);
    };
    window.addEventListener('jonny:crm-updated', handleJonnyUpdated);
    return () => {
      window.removeEventListener('jonny:crm-updated', handleJonnyUpdated);
      if (jonnyReloadTimerRef.current) clearTimeout(jonnyReloadTimerRef.current);
    };
  }, [db]);

  useEffect(() => {
    async function loadState(): Promise<void> {
      try {
        if (db) {
          const status = await testSupabaseConnection(db);
          if (!status.ok) throw new Error(status.message);
          const [loadedClients, loadedIdeas, loadedTasks, loadedOkr, loadedForecasts] = await Promise.all([
            fetchClients(db),
            fetchIdeas(db),
            fetchClientTasks(db),
            fetchAllOkrRecords(db),
            fetchAllAnalysisForecasts(db),
          ]);
          let normalized = normalizeClients(loadedClients);
          normalized = reconcileImportedClientsToMainList(normalized);
          normalized = applyColdClientPromotionToAll(normalized);
          normalized = recalculateRelationships(normalized);
          setClients(normalized);
          setIdeas(loadedIdeas);
          setClientTasks(loadedTasks);
          setOkrRecords(linkOkrRecordsToClients(loadedOkr, normalized));
          if (Object.keys(loadedForecasts).length > 0) {
            setForecastsByYear(loadedForecasts);
          }
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
    let nextClients = [...clients];
    if (id) {
      nextClients = nextClients.map((c) => {
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
        if (trimmedAction !== undefined) {
          updated.action = trimmedAction;
          updated.actionDate = resolveActionDateOnTextChange(c.action || '', trimmedAction, c.actionDate);
        }
        updateClientProfileCompletion(updated);
        if (isCold || isClientInColdSection(updated)) {
          updated.isColdClient = (updated.rev2026 || 0) <= COLD_CLIENT_REV_THRESHOLD;
        }
        return applyColdClientPromotion(updated).client;
      });
    } else {
      const trimmedAction = (input.action || '').trim();
      const newClient: Client = {
        id: createUniqueId('client'),
        name: input.name,
        type: input.type || 'Cliente Diretto',
        owner: input.owner || 'Jeck',
        relationship: input.relationship || 'Nuovo Cliente',
        manualRelationship: false,
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
      updateClientProfileCompletion(newClient);
      nextClients.push(applyColdClientPromotion(newClient).client);
    }
    nextClients = recalculateRelationships(nextClients);
    setClients(nextClients);
    await persistClientsNow(nextClients);
    showToast(id ? `Cliente "${input.name}" aggiornato.` : `Cliente "${input.name}" creato.`, 'success');
  }, [clients, persistClientsNow, showToast]);

  const deleteClient = useCallback(async (clientId: string) => {
    const nextClients = clients.filter((c) => c.id !== clientId);
    setClients(nextClients);
    await persistClientsNow(nextClients);
    showToast('Cliente eliminato.', 'info');
  }, [clients, persistClientsNow, showToast]);

  const updateClientField = useCallback(async (
    clientId: string,
    field: keyof Client,
    value: unknown,
  ) => {
    let nextClients = clients.map((c) => {
      if (c.id !== clientId) return c;
      const updated = { ...c, [field]: value } as Client;
      if (field === 'relationship') updated.manualRelationship = true;
      if (field === 'type') {
        updated.productOffers = reconcileProductOffersForTypeChange(
          updated.type,
          updated.productOffers,
        );
      }
      updateClientProfileCompletion(updated);
      return applyColdClientPromotion(updated).client;
    });
    nextClients = recalculateRelationships(nextClients);
    setClients(nextClients);
    await persistClientsNow(nextClients);
  }, [clients, persistClientsNow]);

  const updateClientContacts = useCallback(async (
    clientId: string,
    contacts: ClientContact[],
  ) => {
    const normalizedContacts = contacts.map((contact) => ({
      id: contact.id || createUniqueId('contact'),
      email: contact.email || '',
      name: contact.name || '',
      role: contact.role || '',
    }));
    let nextClients = clients.map((c) => {
      if (c.id !== clientId) return c;
      const updated = { ...c, contacts: normalizedContacts };
      syncClientLegacyFields(updated);
      updateClientProfileCompletion(updated);
      return applyColdClientPromotion(updated).client;
    });
    nextClients = recalculateRelationships(nextClients);
    setClients(nextClients);
    await persistClientsNow(nextClients);
  }, [clients, persistClientsNow]);

  const updateClientAction = useCallback(async (clientId: string, action: string) => {
    const trimmedAction = action.trim();
    let nextClients = clients.map((c) => {
      if (c.id !== clientId) return c;
      const updated: Client = {
        ...c,
        action: trimmedAction,
        actionDate: resolveActionDateOnTextChange(c.action || '', trimmedAction, c.actionDate),
      };
      updateClientProfileCompletion(updated);
      return updated;
    });
    setClients(nextClients);
    await persistClientsNow(nextClients);
  }, [clients, persistClientsNow]);

  const updateClientProductOffers = useCallback(async (
    clientId: string,
    offerIds: ProductOfferId[],
  ) => {
    let nextClients = clients.map((c) => {
      if (c.id !== clientId) return c;
      const updated = { ...c, productOffers: offerIds };
      return updated;
    });
    setClients(nextClients);
    await persistClientsNow(nextClients);
  }, [clients, persistClientsNow]);

  const saveIdea = useCallback(async (
    input: Partial<Idea> & { name: string; description: string; clientId: string },
  ) => {
    let nextIdeas: Idea[];
    if (input.id) {
      nextIdeas = ideas.map((i) => (i.id === input.id ? { ...i, ...input, id: i.id } as Idea : i));
    } else {
      nextIdeas = [...ideas, {
        id: createUniqueId('idea'),
        name: input.name,
        category: input.category || 'Content',
        clientId: input.clientId,
        status: input.status || 'Da fare',
        description: input.description,
        dateAdded: getTodayString(),
        itemType: input.itemType || 'idea',
        dueDate: input.dueDate || '',
        assignees: input.assignees?.length ? input.assignees : ['Jeck'],
      }];
    }
    setIdeas(nextIdeas);
    await persistIdeasNow(nextIdeas);
    showToast(input.id ? 'Elemento aggiornato.' : 'Elemento creato.', 'success');
  }, [ideas, persistIdeasNow, showToast]);

  const deleteIdea = useCallback(async (ideaId: string) => {
    const nextIdeas = ideas.filter((i) => i.id !== ideaId);
    setIdeas(nextIdeas);
    await persistIdeasNow(nextIdeas);
    showToast('Idea eliminata.', 'info');
  }, [ideas, persistIdeasNow, showToast]);

  const moveIdeaStatus = useCallback(async (ideaId: string, newStatus: Idea['status']) => {
    const nextIdeas = ideas.map((i) => (i.id === ideaId ? { ...i, status: newStatus } : i));
    setIdeas(nextIdeas);
    await persistIdeasNow(nextIdeas);
  }, [ideas, persistIdeasNow]);

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
    const current = forecastsByYear[analysisYear] ?? createDefaultForecasts();
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
    setForecastsByYear((prev) => ({ ...prev, [analysisYear]: next }));
    await persistAnalysisNow(okrRecords, next, analysisYear);
  }, [analysisYear, forecastsByYear, okrRecords, persistAnalysisNow]);

  const handleSetAnalysisYear = useCallback((year: number) => {
    if (year !== PREVIOUS_ANALYSIS_YEAR && year !== ANALYSIS_YEAR) return;
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
    let nextClients = clients.map((c) => {
      if (c.id !== clientId) return c;
      const updated: Client = {
        ...c,
        action: trimmedAction,
        actionDate: resolveActionDateOnTextChange(c.action || '', trimmedAction, c.actionDate),
      };
      updateClientProfileCompletion(updated);
      return updated;
    });
    setClients(nextClients);
    await persistClientsNow(nextClients);
    const nextRecall = dailyRecallItems.map((item) =>
      item.clientId === clientId ? { ...item, status: 'Done' as const } : item,
    );
    setDailyRecallItems(nextRecall);
    await persistDailyRecallItems(nextRecall);
  }, [clients, dailyRecallItems, persistClientsNow, persistDailyRecallItems]);

  const processExcelImport = useCallback(async (
    parsedClients: ParsedExcelClient[],
    newOkrRecords: OkrRecord[],
    importYear: number,
  ) => {
    try {
      if (!db) {
        throw new Error('Supabase non configurato. Imposta le variabili NEXT_PUBLIC_SUPABASE_* su Vercel o in .env.local.');
      }
      const revField = getRevenueFieldForImportYear(importYear);
    let nextClients = [...clients];
    let clientUpdated = 0;
    let clientAdded = 0;
    let clientSkipped = 0;
    parsedClients.forEach((imported) => {
      const existingIdx = nextClients.findIndex(
        (c) => c.name.toLowerCase() === imported.name.toLowerCase(),
      );
      if (existingIdx > -1) {
        const existing = nextClients[existingIdx];
        const currentRevenue = existing[revField];
        if (!hasExcelRevenueDifference(currentRevenue, imported.revenue)) {
          clientSkipped += 1;
          return;
        }
        existing[revField] = imported.revenue;
        existing.isColdClient = false;
        if (existing.relationship !== 'Perso' && existing.relationship !== 'Eliminato') {
          existing.manualRelationship = false;
        }
        nextClients[existingIdx] = existing;
        clientUpdated += 1;
        return;
      }
      nextClients.push({
        id: createUniqueId('client'),
        name: imported.name,
        type: 'Cliente Diretto',
        owner: 'Jeck',
        relationship: 'Nuovo Cliente',
        manualRelationship: false,
        rev2025: revField === 'rev2025' ? imported.revenue : 0,
        rev2026: revField === 'rev2026' ? imported.revenue : 0,
        action: `${EXCEL_IMPORT_ACTION_PREFIX} (${imported.recordCount} record uniti)`,
        actionDate: DEFAULT_ACTION_DATE,
        email: '',
        description: `${EXCEL_IMPORT_DESC_PREFIX}. Completa contatti, azione e note.`,
        contacts: [],
        productOffers: resolveClientProductOffers('Cliente Diretto', []),
        needsProfileCompletion: true,
        isColdClient: false,
      });
      clientAdded += 1;
    });
    nextClients = recalculateRelationships(nextClients);
    nextClients = reconcileImportedClientsToMainList(nextClients);
    const okrMerge = mergeOkrRecordsWithImport(okrRecords, newOkrRecords, nextClients);
    await persistClientsNow(nextClients);
    if (okrMerge.upserted.length > 0) {
      await upsertOkrRecords(db, okrMerge.upserted);
    }
    const [loadedClients, loadedOkr] = await Promise.all([
      fetchClients(db),
      fetchAllOkrRecords(db),
    ]);
    let normalized = normalizeClients(loadedClients);
    normalized = reconcileImportedClientsToMainList(normalized);
    normalized = applyColdClientPromotionToAll(normalized);
    normalized = recalculateRelationships(normalized);
    const linkedOkr = linkOkrRecordsToClients(loadedOkr, normalized);
    setClients(normalized);
    setOkrRecords(linkedOkr);
    setIsSupabaseConnected(true);
    showToast(
      `Import ${importYear} salvato su Supabase: ${clientAdded} nuovi, ${clientUpdated} aggiornati, ${clientSkipped} invariati. OKR +${okrMerge.addedCount}, aggiornati ${okrMerge.updatedCount}.`,
      'success',
    );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      showToast(`Import fallito: ${message}`, 'danger');
      throw error;
    }
  }, [clients, db, okrRecords, persistClientsNow, showToast]);

  const parseExcelBuffer = useCallback((buffer: ArrayBuffer, filename?: string) => {
    return parseExcelImportBuffer(buffer, filename);
  }, []);

  const resetAllData = useCallback(async () => {
    if (db) await clearAllData(db);
    setClients([]);
    setIdeas([]);
    setClientTasks([]);
    setOkrRecords([]);
    setForecastsByYear({
      [PREVIOUS_ANALYSIS_YEAR]: createDefaultForecasts(),
      [ANALYSIS_YEAR]: createDefaultForecasts(),
    });
    setAnalysisYear(ANALYSIS_YEAR);
    setDailyRecallItems([]);
    showToast('Gestionale azzerato.', 'warning');
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
    setIdeas(data.ideas || []);
    setClientTasks(data.clientTasks || []);
    setOkrRecords(data.okrRecords || []);
    if (data.analysisForecastsByYear) {
      setForecastsByYear(data.analysisForecastsByYear);
    } else if (data.analysisForecasts) {
      setForecastsByYear({
        [PREVIOUS_ANALYSIS_YEAR]: createDefaultForecasts(),
        [ANALYSIS_YEAR]: data.analysisForecasts,
      });
    }
    if (data.analysisYear) setAnalysisYear(data.analysisYear);
    await persistClientsNow(nextClients);
    await persistIdeasNow(data.ideas || []);
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
    const client = clients.find((c) => c.id === clientId);
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
    const nextClients = clients.map((c) => {
      if (c.id !== clientId) return c;
      const contacts: ClientContact[] = [...c.contacts];
      if (result.email && typeof result.email === 'string') {
        if (contacts.length === 0) {
          contacts.push({ id: createUniqueId('contact'), email: result.email, name: '', role: '' });
        } else if (!contacts[0]?.email?.trim()) {
          contacts[0] = { ...contacts[0], email: result.email };
        }
      }
      const description = result.description
        ? appendApolloDescription(c.description, result.description)
        : c.description;
      const action = resolveActionWithWebsite(
        c.action,
        typeof result.website === 'string' ? result.website : undefined,
      );
      return { ...c, contacts, description, action, email: contacts[0]?.email || c.email };
    });
    setClients(nextClients);
    await persistClientsNow(nextClients);
    showToast('Cliente arricchito con Apollo.', 'success');
  }, [clients, db, persistClientsNow, showToast]);

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
    showToast,
    toasts,
    dismissToast,
    refreshApolloStatus,
    saveClient,
    deleteClient,
    updateClientField,
    updateClientContacts,
    updateClientAction,
    updateClientProductOffers,
    saveIdea,
    deleteIdea,
    moveIdeaStatus,
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
  };

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}
