'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AnalysisForecasts,
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
  COLD_CLIENT_REV_THRESHOLD,
  EXCEL_IMPORT_ACTION_PREFIX,
  EXCEL_IMPORT_DESC_PREFIX,
} from '@/lib/constants/crm';
import { createDefaultForecasts } from '@/lib/analysis/index';
import {
  aggregateExcelClients,
  buildOkrRecordsFromExcel,
  detectExcelColumns,
  parseExcelFile,
} from '@/lib/crm/excel';
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
  updateClientProfileCompletion,
} from '@/lib/crm/utils';
import {
  filterValidRecallItems,
  generateRandomRecallSelection,
  isRecallSelectionValid,
  normalizeStoredRecallItems,
  RECALL_SELECTION_VERSION,
} from '@/lib/crm/recall';
import { createBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  clearAllData,
  enrichClientWithApollo,
  fetchAnalysisForecasts,
  fetchClientTasks,
  fetchClients,
  fetchDailyRecall,
  fetchIdeas,
  fetchOkrRecords,
  getApolloStatus,
  persistAnalysisForecasts,
  persistClientTasks,
  persistClients,
  persistIdeas,
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
  saveIdea: (idea: Partial<Idea> & { name: string; description: string; clientId: string }) => Promise<void>;
  deleteIdea: (ideaId: string) => Promise<void>;
  moveIdeaStatus: (ideaId: string, newStatus: Idea['status']) => Promise<void>;
  saveTask: (task: Partial<ClientTask> & { title: string; clientId: string }) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskCompleted: (taskId: string, completed: boolean) => Promise<void>;
  setAnalysisForecast: (scope: string, field: 'totalForecast' | 'productPct', value: number, product?: string) => Promise<void>;
  toggleAnalysisScope: (scope: string) => void;
  refreshRecall: () => Promise<void>;
  updateRecallStatus: (clientId: string, status: RecallItem['status']) => Promise<void>;
  processExcelImport: (parsedClients: ParsedExcelClient[], okrRecords: OkrRecord[]) => Promise<void>;
  parseExcelBuffer: (buffer: ArrayBuffer) => {
    headers: unknown[];
    parsedClients: ParsedExcelClient[];
    okrRecords: OkrRecord[];
    detected: ReturnType<typeof detectExcelColumns>;
  };
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
  persistAnalysisNow: (nextOkr?: OkrRecord[], nextForecasts?: AnalysisForecasts) => Promise<void>;
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
  const [analysisForecasts, setAnalysisForecasts] = useState<AnalysisForecasts>(createDefaultForecasts());
  const [analysisExpanded, setAnalysisExpanded] = useState<Set<string>>(new Set());
  const [dailyRecallItems, setDailyRecallItems] = useState<RecallItem[]>([]);
  const [recallFilterStatus, setRecallFilterStatus] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const supabaseConfigured = isSupabaseConfigured();
  const db = useMemo(() => createBrowserSupabaseClient(), []);

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
    if (db) {
      await persistClients(db, data);
      setIsSupabaseConnected(true);
    }
  }, [clients, db]);

  const persistIdeasNow = useCallback(async (nextIdeas?: Idea[]) => {
    const data = nextIdeas ?? ideas;
    if (db) {
      await persistIdeas(db, data);
      setIsSupabaseConnected(true);
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
  ) => {
    if (!db) return;
    await persistOkrRecords(db, nextOkr ?? okrRecords);
    await persistAnalysisForecasts(db, nextForecasts ?? analysisForecasts);
    setIsSupabaseConnected(true);
  }, [analysisForecasts, db, okrRecords]);

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
    async function loadState(): Promise<void> {
      try {
        if (db) {
          const status = await testSupabaseConnection(db);
          if (!status.ok) throw new Error(status.message);
          const [loadedClients, loadedIdeas, loadedTasks, loadedOkr, loadedForecasts] = await Promise.all([
            fetchClients(db),
            fetchIdeas(db),
            fetchClientTasks(db),
            fetchOkrRecords(db),
            fetchAnalysisForecasts(db),
          ]);
          let normalized = normalizeClients(loadedClients);
          normalized = applyColdClientPromotionToAll(normalized);
          normalized = recalculateRelationships(normalized);
          setClients(normalized);
          setIdeas(loadedIdeas);
          setClientTasks(loadedTasks);
          setOkrRecords(loadedOkr);
          if (Object.keys(loadedForecasts).length > 0) {
            setAnalysisForecasts({ ...createDefaultForecasts(), ...loadedForecasts });
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
        const updated: Client = {
          ...c,
          ...input,
          id: c.id,
          contacts: input.contacts ?? c.contacts,
          manualRelationship: input.manualRelationship ?? c.manualRelationship,
        };
        updateClientProfileCompletion(updated);
        if (isCold || isClientInColdSection(updated)) {
          updated.isColdClient = (updated.rev2026 || 0) <= COLD_CLIENT_REV_THRESHOLD;
        }
        return applyColdClientPromotion(updated).client;
      });
    } else {
      const newClient: Client = {
        id: createUniqueId('client'),
        name: input.name,
        type: input.type || 'Cliente Diretto',
        owner: input.owner || 'Jeck',
        relationship: input.relationship || 'Nuovo Cliente',
        manualRelationship: false,
        rev2025: input.rev2025 || 0,
        rev2026: input.rev2026 || 0,
        action: input.action || '',
        actionDate: input.actionDate || getTodayString(),
        email: input.email || '',
        description: input.description || '',
        contacts: input.contacts || [],
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
      updateClientProfileCompletion(updated);
      return applyColdClientPromotion(updated).client;
    });
    nextClients = recalculateRelationships(nextClients);
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
      }];
    }
    setIdeas(nextIdeas);
    await persistIdeasNow(nextIdeas);
    showToast(input.id ? 'Idea aggiornata.' : 'Idea creata.', 'success');
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
    const next = { ...analysisForecasts };
    if (!next[scope]) next[scope] = { totalForecast: 0, productPct: {} };
    if (field === 'totalForecast') {
      next[scope] = { ...next[scope], totalForecast: value };
    } else if (product) {
      next[scope] = {
        ...next[scope],
        productPct: { ...next[scope].productPct, [product]: value },
      };
    }
    setAnalysisForecasts(next);
    await persistAnalysisNow(okrRecords, next);
  }, [analysisForecasts, okrRecords, persistAnalysisNow]);

  const toggleAnalysisScope = useCallback((scope: string) => {
    setAnalysisExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }, []);

  const refreshRecall = useCallback(async () => {
    const generated = generateRandomRecallSelection(clients);
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
    showToast(`Nuova selezione: ${generated.length} clienti.`, 'success');
  }, [clients, db, isSupabaseConnected, showToast]);

  const updateRecallStatus = useCallback(async (clientId: string, status: RecallItem['status']) => {
    const next = dailyRecallItems.map((item) =>
      item.clientId === clientId ? { ...item, status } : item,
    );
    setDailyRecallItems(next);
    const today = getTodayString();
    if (db && isSupabaseConnected) {
      await saveDailyRecall(db, today, next);
    } else {
      localStorage.setItem('crm_sales_daily_recall', JSON.stringify({
        date: today,
        version: RECALL_SELECTION_VERSION,
        items: next,
      }));
    }
  }, [dailyRecallItems, db, isSupabaseConnected]);

  const processExcelImport = useCallback(async (
    parsedClients: ParsedExcelClient[],
    newOkrRecords: OkrRecord[],
  ) => {
    let nextClients = [...clients];
    parsedClients.forEach((imported) => {
      const existingIdx = nextClients.findIndex(
        (c) => c.name.toLowerCase() === imported.name.toLowerCase(),
      );
      if (existingIdx > -1) {
        const existing = nextClients[existingIdx];
        if (!hasExcelRevenueDifference(existing.rev2026, imported.revenue)) return;
        existing.rev2026 = imported.revenue;
        if (existing.relationship !== 'Perso' && existing.relationship !== 'Eliminato') {
          existing.manualRelationship = false;
        }
        nextClients[existingIdx] = applyColdClientPromotion(existing).client;
      } else {
        nextClients.push({
          id: createUniqueId('client'),
          name: imported.name,
          type: 'Cliente Diretto',
          owner: 'Jeck',
          relationship: 'Nuovo Cliente',
          manualRelationship: false,
          rev2025: 0,
          rev2026: imported.revenue,
          action: `${EXCEL_IMPORT_ACTION_PREFIX} (${imported.recordCount} record uniti)`,
          actionDate: getTodayString(),
          email: '',
          description: `${EXCEL_IMPORT_DESC_PREFIX}. Completa contatti, azione e note.`,
          contacts: [],
          needsProfileCompletion: true,
          isColdClient: imported.revenue <= COLD_CLIENT_REV_THRESHOLD,
        });
      }
    });
    nextClients = recalculateRelationships(nextClients);
    setClients(nextClients);
    setOkrRecords(newOkrRecords);
    await persistClientsNow(nextClients);
    await persistAnalysisNow(newOkrRecords, analysisForecasts);
    showToast('Import Excel completato.', 'success');
  }, [analysisForecasts, clients, persistAnalysisNow, persistClientsNow, showToast]);

  const parseExcelBuffer = useCallback((buffer: ArrayBuffer) => {
    const { headers, rows, worksheet } = parseExcelFile(buffer);
    const detected = detectExcelColumns(headers);
    const parsedClients = aggregateExcelClients(
      rows,
      worksheet,
      detected.clientCol,
      detected.importoCol,
    );
    const okr = buildOkrRecordsFromExcel(
      rows,
      worksheet,
      headers,
      detected.clientCol,
      detected.importoCol,
      detected.productCol,
      detected.monthCol,
      detected.projectCol,
      detected.ownerCol,
    );
    return { headers, parsedClients, okrRecords: okr, detected };
  }, []);

  const resetAllData = useCallback(async () => {
    if (db) await clearAllData(db);
    setClients([]);
    setIdeas([]);
    setClientTasks([]);
    setOkrRecords([]);
    setAnalysisForecasts(createDefaultForecasts());
    setDailyRecallItems([]);
    showToast('Gestionale azzerato.', 'warning');
  }, [db, showToast]);

  const exportJsonBackup = useCallback(() => {
    const payload = { clients, ideas, clientTasks, okrRecords, analysisForecasts };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-backup-${getTodayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [analysisForecasts, clientTasks, clients, ideas, okrRecords]);

  const importJsonBackup = useCallback(async (json: string) => {
    const data = JSON.parse(json) as {
      clients?: Client[];
      ideas?: Idea[];
      clientTasks?: ClientTask[];
      okrRecords?: OkrRecord[];
      analysisForecasts?: AnalysisForecasts;
    };
    const nextClients = recalculateRelationships(normalizeClients(data.clients || []));
    setClients(nextClients);
    setIdeas(data.ideas || []);
    setClientTasks(data.clientTasks || []);
    setOkrRecords(data.okrRecords || []);
    if (data.analysisForecasts) setAnalysisForecasts(data.analysisForecasts);
    await persistClientsNow(nextClients);
    await persistIdeasNow(data.ideas || []);
    await persistTasksNow(data.clientTasks || []);
    await persistAnalysisNow(data.okrRecords || [], data.analysisForecasts);
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
      email: client.email,
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
          contacts.push({ id: createUniqueId('contact'), email: result.email, role: '' });
        } else {
          contacts[0] = { ...contacts[0], email: result.email };
        }
      }
      const description = result.description
        ? `${c.description}\n${result.description}`.trim()
        : c.description;
      return { ...c, contacts, description };
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
    saveIdea,
    deleteIdea,
    moveIdeaStatus,
    saveTask,
    deleteTask,
    toggleTaskCompleted,
    setAnalysisForecast,
    toggleAnalysisScope,
    refreshRecall,
    updateRecallStatus,
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
