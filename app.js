/* ==========================================================================
   CUSTOM CRM SALES - APPLICATION LOGIC
   Core state, Excel engine, auto-calculations, Kanban Board and Chart.js
   ========================================================================== */

// --- SAFE ICON HELPER ---
// Avoids ReferenceError crashes if Lucide CDN is blocked or offline
function safeCreateIcons() {
    try {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    } catch (e) {
        console.warn("Lucide icons failed to render:", e);
    }
}

// --- APP DATA VERSION (increment to force one-time local reset) ---
const CRM_DATA_VERSION = '2-empty';
const RECALL_STORAGE_KEY = 'crm_sales_daily_recall';
const CRM_COLUMN_ORDER_KEY = 'crm_sales_column_order';
const CRM_COLUMN_WIDTHS_KEY = 'crm_sales_column_widths';
const CRM_COLUMN_EXPANDED_KEY = 'crm_sales_column_expanded';
const CLIENT_CONTACTS_EXPANDED_KEY = 'crm_sales_contacts_expanded';
const EXCEL_REV_EPSILON = 0.005;
const RECALL_QUOTAS = [
    { relationship: 'Top 20%', count: 1, slotLabel: '⭐⭐⭐ Top 20%', slotClass: 'recall-slot-top20' },
    { relationship: 'Ricorrente', count: 2, slotLabel: '⭐⭐ Ricorrente', slotClass: 'recall-slot-ricorrente' },
    { relationship: 'Nuovo Cliente', count: 2, slotLabel: '⭐ Nuovo Cliente', slotClass: 'recall-slot-nuovo' }
];
const RECALL_TOTAL_COUNT = RECALL_QUOTAS.reduce((sum, quota) => sum + quota.count, 0);
const RECALL_SELECTION_VERSION = 2;
const RECALL_STATUS_TODO = 'To do';
const RECALL_STATUS_DONE = 'Done';

const CLIENT_PRODUCT_OFFERS = [
    {
        id: 'prod',
        title: 'Prod',
        types: ['Agenzia'],
        dotColor: '#8b5cf6',
        badgeBg: 'rgba(139, 92, 246, 0.15)',
        badgeColor: '#7c3aed'
    },
    {
        id: 'content',
        title: 'Content Creation',
        types: ['Agenzia PR', 'Agenzia'],
        dotColor: '#06b6d4',
        badgeBg: 'rgba(6, 182, 212, 0.15)',
        badgeColor: '#0891b2'
    },
    {
        id: 'eventi',
        title: 'Copertura Eventi',
        types: ['Cliente Diretto', 'Agenzia PR'],
        dotColor: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
        badgeColor: '#d97706'
    },
    {
        id: 'mini',
        title: 'Mini prod',
        types: ['CDP'],
        dotColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        badgeColor: '#059669'
    }
];

const COLD_CLIENT_REV_THRESHOLD = 1;
const COLD_CATEGORY_EXPANDED_KEY = 'crm_sales_cold_category_expanded';
const COLD_CLIENT_CATEGORIES = [
    { id: 'agenzia', label: 'Agenzie', type: 'Agenzia' },
    { id: 'agenzia-eventi', label: 'Agenzie Eventi', type: 'Agenzia Eventi' },
    { id: 'cdp', label: 'CDP', type: 'CDP' },
    { id: 'agenzia-pr', label: 'Agenzie Pr', type: 'Agenzia PR' },
    { id: 'cliente-diretto', label: 'Cliente diretto', type: 'Cliente Diretto' }
];
const COLD_TABLE_COLUMNS = ['name', 'owner', 'rev2026', 'action', 'actionDate', 'contacts', 'actions'];

const CRM_TABLE_COLUMN_DEFS = {
    name: { label: 'Nome Cliente', sortKey: 'name', align: 'left', defaultWidth: 170, minWidth: 120, expandedWidth: 280 },
    type: { label: 'Tipologia', sortKey: 'type', align: 'left', defaultWidth: 155, minWidth: 130, expandedWidth: 200 },
    owner: { label: 'Owner', sortKey: 'owner', align: 'left', defaultWidth: 120, minWidth: 100, expandedWidth: 160 },
    relationship: { label: 'Rapporto', sortKey: 'relationship', align: 'left', defaultWidth: 160, minWidth: 130, expandedWidth: 220 },
    rev2026: { label: 'Fatturato 2026', sortKey: 'rev2026', align: 'right', defaultWidth: 130, minWidth: 110, expandedWidth: 150 },
    rev2025: { label: 'Fatturato 2025', sortKey: 'rev2025', align: 'right', defaultWidth: 130, minWidth: 110, expandedWidth: 150 },
    action: { label: 'Azione', sortKey: 'action', align: 'left', defaultWidth: 160, minWidth: 120, expandedWidth: 340 },
    actionDate: { label: 'Data Azione', sortKey: 'actionDate', align: 'left', defaultWidth: 120, minWidth: 100, expandedWidth: 140 },
    contacts: { label: 'Contatti', sortKey: null, align: 'left', defaultWidth: 150, minWidth: 120, expandedWidth: 220, noSort: true },
    actions: { label: 'Azioni', sortKey: null, align: 'center', defaultWidth: 100, minWidth: 90, noExpand: true, noSort: true }
};

/** Colonne nascoste nella Lista Clienti (contatti e azioni solo nel pannello riga espansa). */
const MAIN_TABLE_HIDDEN_COLUMNS = new Set(['contacts', 'action', 'actionDate']);

const DEFAULT_TABLE_COLUMN_ORDER = Object.keys(CRM_TABLE_COLUMN_DEFS).filter(
    (columnId) => !MAIN_TABLE_HIDDEN_COLUMNS.has(columnId)
);

function sanitizeMainTableColumnOrder(columnOrder) {
    return columnOrder.filter(
        (columnId) => CRM_TABLE_COLUMN_DEFS[columnId] && !MAIN_TABLE_HIDDEN_COLUMNS.has(columnId)
    );
}

let dailyRecallItems = [];
let recallFilterStatus = '';
let isSupabaseConnected = false;
let isAppReady = false;

// --- APP STATE ---
let clients = [];
let ideas = [];
let currentSort = { column: 'name', direction: 'asc' };
let tableColumnOrder = [...DEFAULT_TABLE_COLUMN_ORDER];
let tableColumnWidths = {};
let expandedTableColumns = new Set();
let draggedTableColumnId = null;
let resizingColumnState = null;
let rawExcelData = null;
let rawExcelWorksheet = null;
let parsedExcelClients = [];
let pendingOkrRecords = [];
let coldCategoryExpanded = new Set();
let coldClientAddOptions = null;
let expandedClientContacts = new Set();
let okrRecords = [];
let analysisForecasts = typeof CrmAnalysis !== 'undefined' ? CrmAnalysis.createDefaultForecasts() : {};
let analysisExpanded = new Set();
const ANALYSIS_FORECASTS_KEY = 'crm_sales_analysis_forecasts';
const ANALYSIS_OKR_KEY = 'crm_sales_okr_records';
const ANALYSIS_EXPANDED_KEY = 'crm_sales_analysis_expanded';
const CLIENT_TASKS_KEY = 'crm_sales_client_tasks';
let clientTasks = [];
let selectedTaskClientId = '';
let taskFilter = 'all';
let tasksClientSearch = '';

// --- DOM ELEMENTS ---
const sections = document.querySelectorAll('.app-section');
const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
const searchInput = document.getElementById('search-clients');
const filterType = document.getElementById('filter-type');
const filterOwner = document.getElementById('filter-owner');
const filterRelationship = document.getElementById('filter-relationship');
const clearFiltersBtn = document.getElementById('btn-clear-filters');
const crmTableBody = document.getElementById('crm-table-body');
const totalCountLabel = document.getElementById('lbl-total-count');
const shownCountLabel = document.getElementById('lbl-shown-count');
const paginationContainer = document.getElementById('table-pagination');
const contentBody = document.querySelector('.content-body');

// Header / KPI stats
const headerTitle = document.getElementById('header-title');
const headerSubtitle = document.getElementById('header-subtitle');
const headerTotalRevenue = document.getElementById('header-total-revenue');
const kpiRev2026 = document.getElementById('kpi-rev-2026');
const kpiRev2025 = document.getElementById('kpi-rev-2025');
const kpiRevGrowth = document.getElementById('kpi-rev-growth');
const kpiClientCount = document.getElementById('kpi-client-count');
const kpiClientActive = document.getElementById('kpi-client-active');
const kpiPremiumCount = document.getElementById('kpi-premium-count');

// Drawer Client elements
const clientDrawer = document.getElementById('client-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerClose = document.getElementById('drawer-close');
const drawerTitle = document.getElementById('drawer-title');
const clientForm = document.getElementById('client-form');
const btnQuickAdd = document.getElementById('btn-quick-add');
const btnFormCancel = document.getElementById('btn-form-cancel');

// Drawer Idea elements
const ideaDrawer = document.getElementById('idea-drawer');
const ideaDrawerClose = document.getElementById('idea-drawer-close');
const ideaDrawerTitle = document.getElementById('idea-drawer-title');
const ideaForm = document.getElementById('idea-form');
const btnQuickAddIdea = document.getElementById('btn-quick-add-idea');
const btnIdeaCancel = document.getElementById('btn-idea-cancel');

// Quick Client sub-form inside Idea
const subFormQuickClient = document.getElementById('sub-form-quick-client');
const formIdeaClient = document.getElementById('form-idea-client');
const btnCancelQuickClient = document.getElementById('btn-cancel-quick-client');
const btnSaveQuickClient = document.getElementById('btn-save-quick-client');

// Idea search and filter
const searchIdeasInput = document.getElementById('search-ideas');
const filterIdeaCategory = document.getElementById('filter-idea-category');

const searchColdClientsInput = document.getElementById('search-cold-clients');
const coldClientsAccordion = document.getElementById('cold-clients-accordion');
const btnQuickAddCold = document.getElementById('btn-quick-add-cold');

// Excel Import Elements
const dropzone = document.getElementById('dropzone');
const excelFileInput = document.getElementById('excel-file-input');
const excelMappingCard = document.getElementById('excel-mapping-card');
const excelPreviewCard = document.getElementById('excel-preview-card');
const mapClientSelect = document.getElementById('map-client');
const mapRevenueSelect = document.getElementById('map-revenue');
const btnProcessMapping = document.getElementById('btn-process-mapping');
const btnCancelImport = document.getElementById('btn-cancel-import');
const btnResetImport = document.getElementById('btn-reset-import');
const btnCommitImport = document.getElementById('btn-commit-import');
const importPreviewBody = document.getElementById('import-preview-body');
const previewSummaryBadge = document.getElementById('preview-summary-badge');
const lblPreviewTotalSum = document.getElementById('lbl-preview-total-sum');

// Settings Elements
const btnExportJson = document.getElementById('settings-btn-export-json');
const btnImportJson = document.getElementById('settings-btn-import-json');
const jsonFileInput = document.getElementById('json-file-input');
const btnResetDemo = document.getElementById('settings-btn-reset-demo');
const btnExportClients = document.getElementById('btn-export-clients');
const analysisDashboard = document.getElementById('analysis-dashboard');
const tasksLayout = document.getElementById('tasks-layout');
const taskDrawer = document.getElementById('task-drawer');
const taskDrawerClose = document.getElementById('task-drawer-close');
const taskDrawerTitle = document.getElementById('task-drawer-title');
const taskForm = document.getElementById('task-form');
const btnTaskCancel = document.getElementById('btn-task-cancel');

// Charts variables
let chartRevenues = null;
let chartOwners = null;
let chartTypes = null;

// ==========================================================================
// INITIALIZATION & STATE MANAGEMENT
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    safeCreateIcons();
    initializeApplication();
});

async function initializeApplication() {
    try {
        document.body.classList.remove('drawer-open');
        await loadApplicationState();
        applyColdClientPromotionToAll(false);
        recalculateRelationships();
        updateDashboardUI();
        bindAnalysisEventListeners();
        bindTasksEventListeners();
        populateTaskFormSelects();
        renderClientTable();
        renderColdClientsSection();
        renderRandomRecall();
        updateSupabaseStatusUI();
        bindEventListeners();
        isAppReady = true;
    } catch (error) {
        console.error('Inizializzazione CRM fallita:', error);
        showToast('Errore avvio CRM. Controlla la console.', 'danger');
    }
}

function isSupabaseConfigPresent() {
    const config = typeof window !== 'undefined' ? window.CRM_SUPABASE_CONFIG : null;
    return !!(config && config.url && config.anonKey);
}

async function loadApplicationState() {
    loadTableColumnPreferences();
    loadColdCategoryPreferences();
    loadClientContactsExpandedPreference();
    if (typeof CrmSupabase !== 'undefined' && CrmSupabase.isEnabled()) {
        try {
            const status = await CrmSupabase.testConnection();
            if (!status.ok) {
                throw new Error(status.message);
            }
            clients = await CrmSupabase.fetchClients();
            ideas = await CrmSupabase.fetchIdeas();
            clients.forEach((client) => {
                normalizeClientContacts(client);
                normalizeClientActionLog(client);
            });
            const migrated = await CrmSupabase.migrateFromLocalStorageIfEmpty(clients, ideas);
            if (migrated) {
                clients = await CrmSupabase.fetchClients();
                ideas = await CrmSupabase.fetchIdeas();
                clients.forEach((client) => {
                normalizeClientContacts(client);
                normalizeClientActionLog(client);
            });
                showToast('Dati migrati da localStorage a Supabase.', 'success');
            }
            isSupabaseConnected = true;
            await loadAnalysisState();
            await loadTasksState();
            return;
        } catch (error) {
            console.error('Supabase non disponibile, uso localStorage:', error);
            isSupabaseConnected = false;
            showToast(`Supabase offline: ${error.message}. Uso dati locali.`, 'warning');
        }
    } else if (isSupabaseConfigPresent()) {
        isSupabaseConnected = false;
        showToast('Supabase configurato ma libreria non caricata. Ricarica la pagina.', 'danger');
    } else {
        isSupabaseConnected = false;
        showToast('Supabase non configurato: dati solo nel browser (vuoto in incognito).', 'warning');
    }
    if (localStorage.getItem('crm_sales_version') !== CRM_DATA_VERSION) {
        await resetApplicationData(false);
        localStorage.setItem('crm_sales_version', CRM_DATA_VERSION);
        return;
    }
    const localData = localStorage.getItem('crm_sales_data');
    if (localData) {
        try {
            clients = JSON.parse(localData).map(client => {
                const normalized = {
                    ...client,
                    isColdClient: client.isColdClient === true
                };
                normalizeClientContacts(normalized);
                normalizeClientActionLog(normalized);
                return normalized;
            });
        } catch (e) {
            console.error('Localstorage clienti corrotto, database vuoto.', e);
            clients = [];
        }
    } else {
        clients = [];
    }
    const localIdeas = localStorage.getItem('crm_sales_ideas');
    if (localIdeas) {
        try {
            ideas = JSON.parse(localIdeas);
        } catch (e) {
            console.error('Localstorage idee corrotto, database vuoto.', e);
            ideas = [];
        }
    } else {
        ideas = [];
    }
    await loadAnalysisState();
    await loadTasksState();
}

async function resetApplicationData(refreshUi = true) {
    clients = [];
    ideas = [];
    okrRecords = [];
    analysisForecasts = typeof CrmAnalysis !== 'undefined' ? CrmAnalysis.createDefaultForecasts() : {};
    analysisExpanded = new Set();
    resetImportState();
    dailyRecallItems = [];
    clientTasks = [];
    selectedTaskClientId = '';
    taskFilter = 'all';
    tasksClientSearch = '';
    localStorage.removeItem('crm_sales_data');
    localStorage.removeItem('crm_sales_ideas');
    localStorage.removeItem(CRM_COLUMN_ORDER_KEY);
    localStorage.removeItem(CRM_COLUMN_WIDTHS_KEY);
    localStorage.removeItem(CRM_COLUMN_EXPANDED_KEY);
    localStorage.removeItem(ANALYSIS_FORECASTS_KEY);
    localStorage.removeItem(ANALYSIS_OKR_KEY);
    localStorage.removeItem(ANALYSIS_EXPANDED_KEY);
    localStorage.removeItem(CLIENT_TASKS_KEY);
    localStorage.removeItem(RECALL_STORAGE_KEY);
    if (isSupabaseConnected) {
        try {
            await CrmSupabase.clearAll();
        } catch (error) {
            console.error('Reset Supabase fallito:', error);
            showToast('Errore reset su Supabase.', 'danger');
        }
    }
    if (!refreshUi) return;
    recalculateRelationships();
    updateDashboardUI();
    renderClientTable();
    renderColdClientsSection();
    renderRandomRecall();
    renderTasksSection();
    updateSupabaseStatusUI();
    showToast('Gestionale azzerato. Database vuoto.', 'warning');
}

async function persistClientsState() {
    localStorage.setItem('crm_sales_data', JSON.stringify(clients));
    if (typeof CrmSupabase === 'undefined' || !CrmSupabase.isEnabled()) {
        isSupabaseConnected = false;
        updateSupabaseStatusUI();
        return { target: 'localStorage' };
    }
    await CrmSupabase.persistClients(clients);
    isSupabaseConnected = true;
    updateSupabaseStatusUI();
    return { target: 'supabase' };
}

async function persistIdeasState() {
    localStorage.setItem('crm_sales_ideas', JSON.stringify(ideas));
    if (typeof CrmSupabase === 'undefined' || !CrmSupabase.isEnabled()) {
        isSupabaseConnected = false;
        updateSupabaseStatusUI();
        return { target: 'localStorage' };
    }
    await CrmSupabase.persistIdeas(ideas);
    isSupabaseConnected = true;
    updateSupabaseStatusUI();
    return { target: 'supabase' };
}

async function saveStateAsync() {
    updateDashboardUI();
    return persistClientsState();
}

function saveState() {
    saveStateAsync().catch((error) => {
        console.error('Salvataggio clienti fallito:', error);
        showToast(`Errore salvataggio clienti: ${error.message}`, 'danger');
    });
}

function saveIdeasState() {
    persistIdeasState().catch((error) => {
        console.error('Salvataggio idee fallito:', error);
        showToast(`Errore salvataggio idee: ${error.message}`, 'danger');
    });
}

function createUniqueClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function hasExcelRevenueDifference(currentValue, importedValue) {
    const current = Number(currentValue) || 0;
    const imported = Number(importedValue) || 0;
    return Math.abs(current - imported) > EXCEL_REV_EPSILON;
}

async function commitExcelImportToDatabase() {
    if (parsedExcelClients.length === 0) {
        return { newCount: 0, updateCount: 0, skippedCount: 0, target: 'none' };
    }
    let newCount = 0;
    let updateCount = 0;
    let skippedCount = 0;
    parsedExcelClients.forEach(imported => {
        const existingIdx = clients.findIndex(c => c.name.toLowerCase() === imported.name.toLowerCase());
        if (existingIdx > -1) {
            const existingClient = clients[existingIdx];
            if (!hasExcelRevenueDifference(existingClient.rev2026, imported.revenue)) {
                skippedCount += 1;
                return;
            }
            existingClient.rev2026 = imported.revenue;
            if (existingClient.relationship !== 'Perso' && existingClient.relationship !== 'Eliminato') {
                existingClient.manualRelationship = false;
            }
            applyColdClientPromotion(existingClient);
            updateCount += 1;
            return;
        }
        clients.push({
            id: createUniqueClientId(),
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
            isColdClient: imported.revenue <= COLD_CLIENT_REV_THRESHOLD
        });
        newCount += 1;
    });
    recalculateRelationships();
    if (pendingOkrRecords.length > 0) {
        okrRecords = pendingOkrRecords;
        await persistAnalysisState();
    }
    const persistResult = await saveStateAsync();
    if (persistResult.target === 'supabase') {
        clients = await CrmSupabase.fetchClients();
        recalculateRelationships();
    }
    renderClientTable();
    renderColdClientsSection();
    renderAnalysisSection();
    return { newCount, updateCount, skippedCount, target: persistResult.target };
}

function updateSupabaseStatusUI() {
    const badge = document.getElementById('supabase-status-badge');
    if (!badge) return;
    if (isSupabaseConnected) {
        badge.textContent = 'Supabase: connesso';
        badge.style.color = 'var(--success)';
        badge.style.borderColor = 'rgba(5, 150, 105, 0.35)';
        badge.style.background = 'rgba(5, 150, 105, 0.08)';
    } else if (typeof CrmSupabase !== 'undefined' && CrmSupabase.isEnabled()) {
        badge.textContent = 'Supabase: errore connessione';
        badge.style.color = 'var(--danger)';
        badge.style.borderColor = 'rgba(220, 38, 38, 0.35)';
        badge.style.background = 'rgba(220, 38, 38, 0.08)';
    } else {
        badge.textContent = 'Supabase: non configurato (localStorage)';
        badge.style.color = 'var(--text-secondary)';
        badge.style.borderColor = 'var(--border-color)';
        badge.style.background = '#f8fafc';
    }
    updateApolloStatusUI();
}

async function updateApolloStatusUI() {
    const badge = document.getElementById('apollo-status-badge');
    if (!badge || typeof CrmSupabase === 'undefined' || !CrmSupabase.isEnabled() || !isSupabaseConnected) {
        if (badge) {
            badge.textContent = 'Apollo: —';
            badge.style.color = 'var(--text-secondary)';
            badge.style.borderColor = 'var(--border-color)';
            badge.style.background = '#f8fafc';
        }
        return;
    }
    const status = await CrmSupabase.getApolloStatus();
    if (status.configured) {
        badge.textContent = 'Apollo: connesso';
        badge.style.color = 'var(--success)';
        badge.style.borderColor = 'rgba(5, 150, 105, 0.35)';
        badge.style.background = 'rgba(5, 150, 105, 0.08)';
        return;
    }
    badge.textContent = 'Apollo: configura API key';
    badge.style.color = 'var(--warning, #d97706)';
    badge.style.borderColor = 'rgba(245, 158, 11, 0.35)';
    badge.style.background = 'rgba(245, 158, 11, 0.08)';
}

function extractDomainFromClientEmail(email) {
    if (!email || !email.includes('@')) return '';
    const domain = email.split('@')[1].trim().toLowerCase();
    if (!domain || domain.includes('gmail.') || domain.includes('yahoo.') || domain.includes('hotmail.')) {
        return '';
    }
    return domain;
}

function createContactId() {
    return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createActionLogId() {
    return `action-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeClientActionLog(client) {
    if (!client) return [];
    if (!Array.isArray(client.actionLog)) {
        client.actionLog = [];
    }
    if (client.actionLog.length === 0 && client.action && String(client.action).trim()) {
        client.actionLog.push({
            id: createActionLogId(),
            text: String(client.action).trim(),
            date: client.actionDate || getTodayString()
        });
    }
    client.actionLog = client.actionLog.map((entry) => ({
        id: entry.id || createActionLogId(),
        text: String(entry.text || '').trim(),
        date: entry.date || getTodayString()
    })).filter((entry) => entry.text);
    syncClientLegacyActionFields(client);
    return client.actionLog;
}

function syncClientLegacyActionFields(client) {
    if (!client || !Array.isArray(client.actionLog) || client.actionLog.length === 0) {
        return;
    }
    const sortedEntries = [...client.actionLog].sort((entryA, entryB) => {
        const dateCompare = (entryB.date || '').localeCompare(entryA.date || '');
        if (dateCompare !== 0) return dateCompare;
        return (entryB.id || '').localeCompare(entryA.id || '');
    });
    const latestEntry = sortedEntries[0];
    client.action = latestEntry.text;
    client.actionDate = latestEntry.date;
}

function getClientActionLogEntries(client) {
    normalizeClientActionLog(client);
    return [...client.actionLog].sort((entryA, entryB) => {
        const dateCompare = (entryB.date || '').localeCompare(entryA.date || '');
        if (dateCompare !== 0) return dateCompare;
        return (entryB.id || '').localeCompare(entryA.id || '');
    });
}

function addActionToClient(client, text, date = getTodayString()) {
    const trimmedText = String(text || '').trim();
    if (!trimmedText) return false;
    normalizeClientActionLog(client);
    client.actionLog.unshift({
        id: createActionLogId(),
        text: trimmedText,
        date: date || getTodayString()
    });
    syncClientLegacyActionFields(client);
    updateClientProfileCompletion(client);
    return true;
}

function updateClientActionLogEntry(clientId, actionId, fieldName, value) {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return false;
    normalizeClientActionLog(client);
    const entry = client.actionLog.find((item) => item.id === actionId);
    if (!entry) return false;
    if (fieldName === 'text') {
        const trimmedText = String(value || '').trim();
        if (!trimmedText) return false;
        if (entry.text === trimmedText) return false;
        entry.text = trimmedText;
    } else if (fieldName === 'date') {
        const nextDate = String(value || '').trim() || getTodayString();
        if (entry.date === nextDate) return false;
        entry.date = nextDate;
    } else {
        return false;
    }
    syncClientLegacyActionFields(client);
    updateClientProfileCompletion(client);
    return true;
}

function deleteClientActionLogEntry(clientId, actionId) {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return false;
    normalizeClientActionLog(client);
    const previousLength = client.actionLog.length;
    client.actionLog = client.actionLog.filter((item) => item.id !== actionId);
    if (client.actionLog.length === previousLength) return false;
    if (client.actionLog.length === 0) {
        client.action = '';
        client.actionDate = '';
    } else {
        syncClientLegacyActionFields(client);
    }
    updateClientProfileCompletion(client);
    return true;
}

function normalizeClientContacts(client) {
    if (!client) return [];
    if (!Array.isArray(client.contacts)) {
        client.contacts = [];
    }
    if (client.contacts.length === 0 && client.email && client.email.trim()) {
        client.contacts.push({
            id: createContactId(),
            email: client.email || '',
            role: ''
        });
    }
    const legacyContactNotes = client.contacts
        .map((contact) => contact.description || '')
        .filter(Boolean);
    if (!client.description && legacyContactNotes.length > 0) {
        client.description = legacyContactNotes.join('\n');
    }
    client.contacts = client.contacts.map((contact) => ({
        id: contact.id || createContactId(),
        email: contact.email || '',
        role: contact.role || ''
    }));
    return client.contacts;
}

function syncClientLegacyFields(client) {
    normalizeClientContacts(client);
    const primaryContact = client.contacts.find((contact) => (contact.email || '').trim()) || client.contacts[0];
    client.email = primaryContact?.email || '';
}

function getClientEmailDomains(client) {
    normalizeClientContacts(client);
    const domains = new Set();
    client.contacts.forEach((contact) => {
        const domain = extractDomainFromClientEmail(contact.email);
        if (domain) domains.add(domain);
    });
    return domains;
}

function findClientByEmailDomain(domain, excludeClientId = null) {
    if (!domain) return null;
    return clients.find((client) => {
        if (excludeClientId && client.id === excludeClientId) return false;
        return getClientEmailDomains(client).has(domain);
    }) || null;
}

function clientHasContactEmail(client, email) {
    if (!email) return false;
    normalizeClientContacts(client);
    const normalizedEmail = email.trim().toLowerCase();
    return client.contacts.some((contact) => (contact.email || '').trim().toLowerCase() === normalizedEmail);
}

function getClientPrimaryEmail(client) {
    normalizeClientContacts(client);
    const withEmail = client.contacts.find((contact) => (contact.email || '').trim());
    return withEmail?.email || client.email || '';
}

function getClientContactsSearchText(client) {
    normalizeClientContacts(client);
    const contactText = client.contacts.map((contact) => [
        contact.email || '',
        contact.role || ''
    ].join(' ')).join(' ').toLowerCase();
    return `${contactText} ${(client.description || '').toLowerCase()}`.trim();
}

function isInteractiveTableTarget(target) {
    return !!target.closest('button, select, input, textarea, a, .contacts-panel, .client-actions-panel, .table-row-actions, .btn-table-action');
}

function handleClientRowExpandClick(e) {
    if (isInteractiveTableTarget(e.target)) return false;
    const row = e.target.closest('tr.client-row');
    if (!row || !row.dataset.id) return false;
    toggleClientContactsExpanded(row.dataset.id);
    renderClientTable();
    renderColdClientsSection();
    return true;
}

function loadClientContactsExpandedPreference() {
    try {
        const stored = localStorage.getItem(CLIENT_CONTACTS_EXPANDED_KEY);
        if (stored) {
            expandedClientContacts = new Set(JSON.parse(stored));
        }
    } catch (error) {
        expandedClientContacts = new Set();
    }
}

function saveClientContactsExpandedPreference() {
    localStorage.setItem(CLIENT_CONTACTS_EXPANDED_KEY, JSON.stringify([...expandedClientContacts]));
}

function toggleClientContactsExpanded(clientId) {
    if (expandedClientContacts.has(clientId)) {
        expandedClientContacts.delete(clientId);
    } else {
        expandedClientContacts.add(clientId);
    }
    saveClientContactsExpandedPreference();
}

function migrateTableColumnOrderPreferences() {
    const legacyColumns = new Set(['email', 'description']);
    const hasLegacy = tableColumnOrder.some((columnId) => legacyColumns.has(columnId));
    if (!hasLegacy) return;
    const migrated = [];
    tableColumnOrder.forEach((columnId) => {
        if (legacyColumns.has(columnId)) {
            if (!migrated.includes('contacts')) migrated.push('contacts');
            return;
        }
        if (!migrated.includes(columnId)) migrated.push(columnId);
    });
    if (!migrated.includes('contacts')) {
        const actionIdx = migrated.indexOf('actionDate');
        if (actionIdx >= 0) migrated.splice(actionIdx + 1, 0, 'contacts');
        else migrated.push('contacts');
    }
    tableColumnOrder = migrated.filter((columnId) => CRM_TABLE_COLUMN_DEFS[columnId]);
    tableColumnOrder = sanitizeMainTableColumnOrder(tableColumnOrder);
    const missing = DEFAULT_TABLE_COLUMN_ORDER.filter((columnId) => !tableColumnOrder.includes(columnId));
    tableColumnOrder = [...tableColumnOrder, ...missing];
    expandedTableColumns = new Set([...expandedTableColumns].filter((columnId) => CRM_TABLE_COLUMN_DEFS[columnId]));
    saveTableColumnPreferences();
}

function buildContactsSummaryCellHtml(client, expandedClass = '', dataCol = '') {
    normalizeClientContacts(client);
    const count = client.contacts.length;
    const preview = count > 0
        ? client.contacts.slice(0, 2).map((contact) => {
            const label = contact.role ? `${contact.role}: ${contact.email || '—'}` : (contact.email || '—');
            return escapeHtml(label);
        }).join('<br>')
        : '<span class="contacts-empty">Nessun contatto</span>';
    return `<td class="col-contacts${expandedClass}"${dataCol}>
        <span class="contacts-count">${count} contatt${count === 1 ? 'o' : 'i'}</span>
        <div class="contacts-preview">${preview}</div>
    </td>`;
}

function buildClientNameCellHtml(client, expandedClass = '', dataCol = '') {
    const isExpanded = expandedClientContacts.has(client.id);
    return `<td class="col-nome client-row-name${expandedClass}"${dataCol}>
        <div class="client-name-cell">
            <i data-lucide="chevron-right" class="row-expand-icon ${isExpanded ? 'is-expanded' : ''}"></i>
            <strong>${escapeHtml(client.name)}</strong>
        </div>
    </td>`;
}

function buildContactsToggleCellHtml(client, expandedClass = '', dataCol = '') {
    return buildContactsSummaryCellHtml(client, expandedClass, dataCol);
}

function getProductOffersForClient(client) {
    if (!client || !client.type) return [];
    return CLIENT_PRODUCT_OFFERS.filter((offer) => offer.types.includes(client.type));
}

function buildProductOfferTagsHtml(client) {
    const offers = getProductOffersForClient(client);
    if (offers.length === 0) {
        return `
            <div class="product-offers-block">
                <span class="product-offers-label">Prodotti vendibili</span>
                <p class="product-offers-empty">Nessuna linea prodotto mappata per la tipologia «${escapeHtml(client.type || '—')}».</p>
            </div>`;
    }
    const tags = offers.map((offer) => `
        <span class="product-offer-tag product-offer-${offer.id}" style="background:${offer.badgeBg}; color:${offer.badgeColor};">
            <span class="product-offer-dot" style="background:${offer.dotColor};"></span>
            ${escapeHtml(offer.title)}
        </span>
    `).join('');
    return `
        <div class="product-offers-block">
            <span class="product-offers-label">Prodotti vendibili</span>
            <div class="product-offers-tags">${tags}</div>
        </div>`;
}

function buildClientActionsPanelHtml(client) {
    normalizeClientActionLog(client);
    const entries = getClientActionLogEntries(client);
    const entriesHtml = entries.length === 0
        ? '<p class="client-actions-empty">Nessuna azione registrata. Aggiungi la prima sotto.</p>'
        : entries.map((entry) => {
            const isDateStale = isActionDateStale(entry.date);
            return `
            <div class="action-log-entry" data-action-id="${entry.id}">
                <input type="date" class="contact-field-input action-log-date${isDateStale ? ' is-stale' : ''}" data-action-field="date" data-client-id="${client.id}" data-action-id="${entry.id}" value="${escapeHtml(entry.date || '')}" title="Data azione">
                <input type="text" class="contact-field-input action-log-text" data-action-field="text" data-client-id="${client.id}" data-action-id="${entry.id}" value="${escapeHtml(entry.text || '')}" placeholder="Es. Chiamata, email inviata, proposta inviata...">
                <button type="button" class="btn-contact-delete" data-action="delete-client-action" data-client-id="${client.id}" data-action-id="${entry.id}" title="Elimina azione"><i data-lucide="x"></i></button>
            </div>`;
        }).join('');
    return `
        <div class="client-actions-panel">
            <div class="client-actions-header">
                <strong>Storico azioni</strong>
                <span class="client-actions-hint">Ogni interazione con il cliente</span>
            </div>
            <div class="client-actions-list">${entriesHtml}</div>
            <div class="client-actions-add-form">
                <input type="date" class="contact-field-input action-log-date" data-action-input="date" data-client-id="${client.id}" value="${getTodayString()}" aria-label="Data nuova azione">
                <input type="text" class="contact-field-input action-log-text" data-action-input="text" data-client-id="${client.id}" placeholder="Descrivi l'azione svolta..." aria-label="Testo nuova azione">
                <button type="button" class="btn btn-secondary btn-sm" data-action="add-client-action" data-client-id="${client.id}">
                    <i data-lucide="plus"></i>
                    <span>Aggiungi</span>
                </button>
            </div>
        </div>`;
}

function buildContactsDetailRowHtml(client, colSpan) {
    normalizeClientContacts(client);
    normalizeClientActionLog(client);
    const cards = client.contacts.length === 0
        ? '<p class="contacts-panel-empty">Nessun contatto. Aggiungine uno dal drawer o con il pulsante sotto.</p>'
        : client.contacts.map((contact) => `
            <div class="contact-card" data-contact-id="${contact.id}">
                <div class="contact-card-header">
                    <input type="text" class="contact-field-input contact-role-input" data-contact-field="role" data-client-id="${client.id}" data-contact-id="${contact.id}" value="${escapeHtml(contact.role || '')}" placeholder="Ruolo in azienda">
                    <button type="button" class="btn-contact-delete" data-action="delete-contact" data-client-id="${client.id}" data-contact-id="${contact.id}" title="Elimina contatto"><i data-lucide="x"></i></button>
                </div>
                <input type="email" class="contact-field-input contact-email-input" data-contact-field="email" data-client-id="${client.id}" data-contact-id="${contact.id}" value="${escapeHtml(contact.email || '')}" placeholder="Email">
            </div>
        `).join('');
    return `
        <tr class="client-contacts-detail-row ${expandedClientContacts.has(client.id) ? 'is-visible' : ''}" data-client-id="${client.id}">
            <td colspan="${colSpan}">
                <div class="contacts-panel">
                    <div class="contacts-panel-header">
                        <strong>${escapeHtml(client.name)}</strong>
                        <button type="button" class="btn btn-secondary btn-sm" data-action="add-contact" data-client-id="${client.id}">
                            <i data-lucide="user-plus"></i>
                            <span>Aggiungi contatto</span>
                        </button>
                    </div>
                    ${buildProductOfferTagsHtml(client)}
                    ${buildClientActionsPanelHtml(client)}
                    <div class="relationship-note-block">
                        <label class="relationship-note-label">Nota rapporto con l'azienda</label>
                        <textarea class="contact-field-input relationship-note-input" data-client-field="description" data-client-id="${client.id}" rows="3" placeholder="Note generali sul rapporto con l'azienda...">${escapeHtml(client.description || '')}</textarea>
                    </div>
                    <div class="contacts-panel-list">${cards}</div>
                </div>
            </td>
        </tr>`;
}

function renderDrawerContactsEditor(contacts) {
    const container = document.getElementById('form-contacts-list');
    if (!container) return;
    const list = Array.isArray(contacts) && contacts.length > 0
        ? contacts
        : [{ id: createContactId(), email: '', role: '' }];
    container.innerHTML = list.map((contact, index) => `
        <div class="form-contact-row" data-contact-id="${contact.id}">
            <div class="form-contact-row-header">
                <span class="form-contact-row-title">Contatto ${index + 1}</span>
                <button type="button" class="btn-contact-delete" data-action="remove-drawer-contact" data-contact-id="${contact.id}" title="Rimuovi contatto"${list.length === 1 ? ' disabled' : ''}><i data-lucide="x"></i></button>
            </div>
            <input type="email" class="form-input drawer-contact-email" data-contact-id="${contact.id}" value="${escapeHtml(contact.email || '')}" placeholder="Email (es. nome@azienda.it)">
            <input type="text" class="form-input drawer-contact-role" data-contact-id="${contact.id}" value="${escapeHtml(contact.role || '')}" placeholder="Ruolo in azienda (es. Marketing Manager)">
        </div>
    `).join('');
    safeCreateIcons();
}

function collectDrawerContacts() {
    const container = document.getElementById('form-contacts-list');
    if (!container) return [];
    return [...container.querySelectorAll('.form-contact-row')].map((row) => ({
        id: row.getAttribute('data-contact-id') || createContactId(),
        email: row.querySelector('.drawer-contact-email')?.value.trim() || '',
        role: row.querySelector('.drawer-contact-role')?.value.trim() || ''
    })).filter((contact) => contact.email || contact.role);
}

function addContactToClient(client, contactData) {
    normalizeClientContacts(client);
    const email = (contactData.email || '').trim();
    if (email && clientHasContactEmail(client, email)) {
        return false;
    }
    client.contacts.push({
        id: createContactId(),
        email,
        role: (contactData.role || '').trim()
    });
    syncClientLegacyFields(client);
    return true;
}

function updateClientContactField(clientId, contactId, field, value) {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return false;
    normalizeClientContacts(client);
    const contact = client.contacts.find((item) => item.id === contactId);
    if (!contact) return false;
    if (field === 'email') {
        const normalizedEmail = value.trim();
        if (normalizedEmail && client.contacts.some((item) => item.id !== contactId && (item.email || '').trim().toLowerCase() === normalizedEmail.toLowerCase())) {
            showToast('Questa email esiste già tra i contatti del cliente.', 'warning');
            return false;
        }
        contact.email = normalizedEmail;
    } else if (field === 'role') {
        contact.role = value.trim();
    }
    syncClientLegacyFields(client);
    updateClientProfileCompletion(client);
    return true;
}

function updateClientRelationshipNote(clientId, value) {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return false;
    client.description = value.trim();
    updateClientProfileCompletion(client);
    return true;
}

function deleteContactFromClient(clientId, contactId) {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return;
    normalizeClientContacts(client);
    client.contacts = client.contacts.filter((contact) => contact.id !== contactId);
    syncClientLegacyFields(client);
    updateClientProfileCompletion(client);
}

function mergeNewClientContactsIntoExisting(existingClient, incomingContacts) {
    let addedCount = 0;
    incomingContacts.forEach((contactData) => {
        if (addContactToClient(existingClient, contactData)) {
            addedCount += 1;
        }
    });
    updateClientProfileCompletion(existingClient);
    return addedCount;
}

function findExistingClientForIncomingContacts(incomingContacts) {
    for (const contactData of incomingContacts) {
        const domain = extractDomainFromClientEmail(contactData.email || '');
        if (!domain) continue;
        const existingClient = findClientByEmailDomain(domain);
        if (existingClient) {
            return { existingClient, domain };
        }
    }
    return null;
}

function appendApolloDescription(existingDescription, apolloDescription) {
    if (!apolloDescription) return existingDescription || '';
    const marker = '--- Apollo ---';
    if ((existingDescription || '').includes(marker)) {
        return `${(existingDescription || '').split(marker)[0].trim()}\n\n${marker}\n${apolloDescription}`.trim();
    }
    if (!existingDescription) return apolloDescription;
    return `${existingDescription}\n\n${marker}\n${apolloDescription}`;
}

async function enrichClientWithApolloAction(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    if (typeof CrmSupabase === 'undefined' || !CrmSupabase.isEnabled() || !isSupabaseConnected) {
        showToast('Apollo richiede Supabase connesso.', 'warning');
        return;
    }
    normalizeClientContacts(client);
    const primaryEmail = getClientPrimaryEmail(client);
    showToast(`Ricerca Apollo per "${client.name}"...`, 'info');
    try {
        const result = await CrmSupabase.enrichClientWithApollo({
            companyName: client.name,
            email: primaryEmail,
            domain: extractDomainFromClientEmail(primaryEmail)
        });
        if (!result || !result.ok) {
            throw new Error(result?.error || 'Nessun dato trovato');
        }
        let targetContact = client.contacts.find((contact) => (contact.email || '').trim()) || client.contacts[0];
        if (!targetContact) {
            targetContact = { id: createContactId(), email: '', role: '' };
            client.contacts.push(targetContact);
        }
        if (result.email && !targetContact.email) {
            targetContact.email = result.email;
        }
        client.description = appendApolloDescription(client.description, result.description);
        syncClientLegacyFields(client);
        if (result.website && (!client.action || client.action === '-')) {
            addActionToClient(client, `Sito: ${result.website}`, getTodayString());
        }
        updateClientProfileCompletion(client);
        recalculateRelationships();
        await saveStateAsync();
        renderClientTable();
        renderColdClientsSection();
        showToast(`Cliente "${client.name}" arricchito con Apollo.`, 'success');
    } catch (error) {
        console.error('Apollo enrich failed:', error);
        showToast(`Apollo: ${error.message}`, 'danger');
    }
}

function isClientInColdSection(client) {
    if (!client || client.isColdClient !== true) return false;
    return (Number(client.rev2026) || 0) <= COLD_CLIENT_REV_THRESHOLD;
}

function isClientInActiveSection(client) {
    return !isClientInColdSection(client);
}

function applyColdClientPromotion(client, showNotice = true) {
    const rev2026 = Number(client.rev2026) || 0;
    if (client.isColdClient !== true || rev2026 <= COLD_CLIENT_REV_THRESHOLD) {
        return false;
    }
    client.isColdClient = false;
    if (showNotice) {
        showToast(`"${client.name}" promosso alla Lista Clienti (fatturato 2026 > €1).`, 'success');
    }
    return true;
}

function applyColdClientPromotionToAll(showNotice = false) {
    let promotedCount = 0;
    clients.forEach(client => {
        if (applyColdClientPromotion(client, false)) promotedCount += 1;
    });
    if (showNotice && promotedCount > 0) {
        showToast(`${promotedCount} clienti promossi alla Lista Clienti.`, 'success');
    }
    return promotedCount;
}

function loadColdCategoryPreferences() {
    coldCategoryExpanded = new Set();
    try {
        const raw = localStorage.getItem(COLD_CATEGORY_EXPANDED_KEY);
        if (raw) {
            JSON.parse(raw).forEach(id => coldCategoryExpanded.add(id));
        }
    } catch (error) {
        console.warn('Preferenze categorie freddi non caricate:', error);
    }
}

function saveColdCategoryPreferences() {
    localStorage.setItem(COLD_CATEGORY_EXPANDED_KEY, JSON.stringify([...coldCategoryExpanded]));
}

function toggleColdCategoryExpanded(categoryId) {
    if (coldCategoryExpanded.has(categoryId)) {
        coldCategoryExpanded.delete(categoryId);
    } else {
        coldCategoryExpanded.add(categoryId);
    }
    saveColdCategoryPreferences();
}

function formatCurrency(val) {
    if (val === undefined || val === null || isNaN(val)) return '€0,00';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
}

// Get standard YYYY-MM-DD string for today
function getTodayString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ==========================================================================
// RELATIONSHIP BUSINESS RULES ENGINE (SEZIONE 1)
// ==========================================================================
function recalculateRelationships() {
    const activeClientsWithRevenue2026 = clients.filter(c => c.relationship !== 'Eliminato' && c.rev2026 > 0);
    
    // Sort descending by 2026 revenue
    activeClientsWithRevenue2026.sort((a, b) => b.rev2026 - a.rev2026);
    
    const activeCount = activeClientsWithRevenue2026.length;
    const top20Count = Math.ceil(activeCount * 0.2);
    
    // Extract the IDs of clients qualifying for top 20%
    const top20Ids = new Set();
    for (let i = 0; i < top20Count; i++) {
        if (activeClientsWithRevenue2026[i]) {
            top20Ids.add(activeClientsWithRevenue2026[i].id);
        }
    }
    
    // Apply rules to all clients
    clients.forEach(c => {
        if (c.manualRelationship && (c.relationship === 'Perso' || c.relationship === 'Eliminato')) {
            return;
        }
        
        // Priority 1: Top 20% rule
        if (top20Ids.has(c.id)) {
            c.relationship = 'Top 20%';
            return;
        }
        
        // Priority 2: Recurrent rule
        if (c.rev2025 > 15000) {
            c.relationship = 'Ricorrente';
            return;
        }
        
        // Priority 3: Fallback
        if (!c.manualRelationship) {
            c.relationship = 'Nuovo Cliente';
        }
    });
}

// ==========================================================================
// NAVIGATION & INTERFACE ACTIONS
// ==========================================================================
function setDrawerOpenState(isOpen) {
    document.body.classList.toggle('drawer-open', isOpen);
}

function resetDrawerBodyScroll(drawerEl) {
    const body = drawerEl?.querySelector('.drawer-body');
    if (body) body.scrollTop = 0;
}

function updateAnyDrawerOpenState() {
    const hasOpenDrawer = document.querySelector('.drawer.open') !== null;
    setDrawerOpenState(hasOpenDrawer);
}

function setClientDrawerColdMode(isColdMode) {
    const relationshipGroup = document.getElementById('form-group-relationship');
    const rev2025Group = document.getElementById('form-group-rev-2025');
    if (relationshipGroup) relationshipGroup.style.display = isColdMode ? 'none' : '';
    if (rev2025Group) rev2025Group.style.display = isColdMode ? 'none' : '';
}

function openClientDrawer(isEdit = false, clientObj = null, options = null) {
    if (!clientDrawer || !clientForm) return;
    coldClientAddOptions = options;
    clientForm.reset();
    document.getElementById('form-client-id').value = '';
    const isColdMode = !!(options && options.isCold) || !!(isEdit && clientObj && isClientInColdSection(clientObj));
    setClientDrawerColdMode(isColdMode);
    if (isEdit && clientObj) {
        drawerTitle.innerHTML = `<i data-lucide="user-cog" style="color: var(--primary)"></i> Modifica Cliente`;
        document.getElementById('form-client-id').value = clientObj.id;
        document.getElementById('form-name').value = clientObj.name;
        document.getElementById('form-type').value = clientObj.type;
        document.getElementById('form-owner').value = clientObj.owner;
        document.getElementById('form-relationship').value = clientObj.relationship;
        document.getElementById('form-rev-2025').value = clientObj.rev2025 || '';
        document.getElementById('form-rev-2026').value = clientObj.rev2026 || '';
        document.getElementById('form-action').value = clientObj.action || '';
        document.getElementById('form-relationship-note').value = clientObj.description || '';
        normalizeClientContacts(clientObj);
        renderDrawerContactsEditor(clientObj.contacts);
    } else if (options && options.isCold) {
        drawerTitle.innerHTML = `<i data-lucide="snowflake" style="color: var(--secondary)"></i> Nuovo Cliente Freddo`;
        document.getElementById('form-type').value = options.defaultType || 'Cliente Diretto';
        document.getElementById('form-relationship').value = 'Nuovo Cliente';
        document.getElementById('form-rev-2025').value = '0';
        document.getElementById('form-rev-2026').value = '0';
        document.getElementById('form-relationship-note').value = '';
        renderDrawerContactsEditor([]);
    } else {
        drawerTitle.innerHTML = `<i data-lucide="user-plus" style="color: var(--primary)"></i> Aggiungi Cliente`;
        document.getElementById('form-relationship').value = 'Nuovo Cliente';
        document.getElementById('form-relationship-note').value = '';
        renderDrawerContactsEditor([]);
    }
    const btnApolloEnrich = document.getElementById('btn-apollo-enrich');
    if (btnApolloEnrich) {
        btnApolloEnrich.style.display = isEdit && clientObj ? 'inline-flex' : 'none';
        btnApolloEnrich.dataset.clientId = isEdit && clientObj ? clientObj.id : '';
    }
    safeCreateIcons();
    resetDrawerBodyScroll(clientDrawer);
    clientDrawer.classList.add('open');
    drawerOverlay.classList.add('open');
    setDrawerOpenState(true);
}

function bindEventListeners() {
    // Sidebar switching tab clicks
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetSectionId = item.getAttribute('data-target');
            
            // Toggle active menu item
            menuItems.forEach(m => m.classList.remove('active'));
            item.classList.add('active');
            
            // Toggle section visibility
            sections.forEach(sec => {
                sec.classList.remove('active');
                if (sec.id === targetSectionId) {
                    sec.classList.add('active');
                }
            });
            
            // Update page titles
            const titleMap = {
                'section-dashboard': { title: 'Analisi', sub: 'OKR, previsioni e breakdown per quarter.' },
                'section-clients': { title: 'Gestione Clienti', sub: 'Lista generica e schede clienti.' },
                'section-tasks': { title: 'Task', sub: 'Task collegate ai clienti: progress, scadenze e assegnazioni.' },
                'section-recall': { title: 'Random Recall', sub: `${RECALL_TOTAL_COUNT} clienti al giorno da ricontattare, scelti a caso per rapporto.` },
                'section-ideas': { title: 'Idee Random', sub: 'Spazio creativo e proposte commerciali ai clienti.' },
                'section-cold': { title: 'Clienti Freddi', sub: 'Prospect non ancora attivati. Promozione automatica a Lista Clienti con fatturato 2026 > €1.' },
                'section-import': { title: 'Importazione Dati', sub: 'Carica fatturati 2026 da foglio di calcolo.' },
                'section-settings': { title: 'Impostazioni', sub: 'Manutenzione database e regole.' }
            };
            
            if (titleMap[targetSectionId]) {
                headerTitle.textContent = titleMap[targetSectionId].title;
                headerSubtitle.textContent = titleMap[targetSectionId].sub;
            }
            
            // View updates on switch
            if (targetSectionId === 'section-dashboard') {
                updateDashboardUI();
            } else if (targetSectionId === 'section-ideas') {
                renderKanbanBoard();
            } else if (targetSectionId === 'section-cold') {
                renderColdClientsSection();
            } else if (targetSectionId === 'section-clients') {
                renderClientTable();
            } else if (targetSectionId === 'section-tasks') {
                renderTasksSection();
            } else if (targetSectionId === 'section-recall') {
                renderRandomRecall();
            }
            updateClientsSectionLayout();
            
            // Close mobile sidebar if open
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('mobile-open');
        });
    });
    
    // Mobile menu toggle
    const mobileToggle = document.getElementById('mobile-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.add('mobile-open');
        });
    }
    
    // Close sidebar clicking outside on mobile
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('mobile-toggle');
        if (sidebar && toggle && window.innerWidth <= 768 && sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
            sidebar.classList.remove('mobile-open');
        }
    });
    
    // --- CLIENTS FILTER BAR ACTIONS ---
    if (searchInput) searchInput.addEventListener('input', renderClientTable);
    if (filterType) filterType.addEventListener('change', renderClientTable);
    if (filterOwner) filterOwner.addEventListener('change', renderClientTable);
    if (filterRelationship) filterRelationship.addEventListener('change', renderClientTable);
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (filterType) filterType.value = '';
            if (filterOwner) filterOwner.value = '';
            if (filterRelationship) filterRelationship.value = '';
            renderClientTable();
            showToast('Filtri azzerati con successo.', 'info');
        });
    }
    
    // --- IDEAS FILTER BAR ACTIONS ---
    if (searchIdeasInput) searchIdeasInput.addEventListener('input', renderKanbanBoard);
    if (filterIdeaCategory) filterIdeaCategory.addEventListener('change', renderKanbanBoard);
    if (searchColdClientsInput) searchColdClientsInput.addEventListener('input', renderColdClientsSection);
    
    // Sorting handled via initTableColumnControls (delegated on thead)

    // --- CLIENT DRAWER ACTIONS ---
    const openDrawer = (isEdit = false, clientObj = null, options = null) => openClientDrawer(isEdit, clientObj, options);
    
    const closeDrawer = () => {
        coldClientAddOptions = null;
        setClientDrawerColdMode(false);
        clientDrawer.classList.remove('open');
        const hasOtherDrawerOpen = (ideaDrawer && ideaDrawer.classList.contains('open'))
            || (taskDrawer && taskDrawer.classList.contains('open'));
        if (!hasOtherDrawerOpen && drawerOverlay) {
            drawerOverlay.classList.remove('open');
        }
        updateAnyDrawerOpenState();
    };
    
    if (btnQuickAdd) {
        btnQuickAdd.addEventListener('click', () => {
            const activeSection = document.querySelector('.app-section.active');
            if (activeSection && activeSection.id === 'section-cold') {
                openClientDrawer(false, null, { isCold: true });
                return;
            }
            openClientDrawer(false, null, { isCold: false });
        });
    }
    if (btnQuickAddCold) {
        btnQuickAddCold.addEventListener('click', () => openClientDrawer(false, null, { isCold: true }));
    }
    const btnApolloEnrich = document.getElementById('btn-apollo-enrich');
    if (btnApolloEnrich) {
        btnApolloEnrich.addEventListener('click', () => {
            const clientId = btnApolloEnrich.dataset.clientId;
            if (clientId) enrichClientWithApolloAction(clientId);
        });
    }
    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
    if (btnFormCancel) btnFormCancel.addEventListener('click', closeDrawer);
    const btnAddDrawerContact = document.getElementById('btn-add-drawer-contact');
    if (btnAddDrawerContact) {
        btnAddDrawerContact.addEventListener('click', () => {
            const container = document.getElementById('form-contacts-list');
            if (!container) return;
            const currentContacts = collectDrawerContacts();
            currentContacts.push({ id: createContactId(), email: '', role: '' });
            renderDrawerContactsEditor(currentContacts);
        });
    }
    const formContactsList = document.getElementById('form-contacts-list');
    if (formContactsList) {
        formContactsList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-action="remove-drawer-contact"]');
            if (!removeBtn || removeBtn.disabled) return;
            const contactId = removeBtn.getAttribute('data-contact-id');
            const remaining = collectDrawerContacts().filter((contact) => contact.id !== contactId);
            renderDrawerContactsEditor(remaining.length > 0 ? remaining : [{ id: createContactId(), email: '', role: '' }]);
        });
    }
    if (drawerOverlay) drawerOverlay.addEventListener('click', () => { closeDrawer(); closeIdeaDrawer(); closeTaskDrawer(); });
    
    // Submit Client Drawer Form
    if (clientForm) {
        clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('form-client-id').value;
            const name = document.getElementById('form-name').value.trim();
            const type = document.getElementById('form-type').value;
            const owner = document.getElementById('form-owner').value;
            const relationshipNote = document.getElementById('form-relationship-note').value.trim();
            const existingClient = id ? clients.find(c => c.id === id) : null;
            const isColdForm = !!(coldClientAddOptions && coldClientAddOptions.isCold && !id) ||
                !!(existingClient && isClientInColdSection(existingClient));
            let relationship;
            let rev2025;
            if (isColdForm) {
                relationship = existingClient ? existingClient.relationship : 'Nuovo Cliente';
                rev2025 = existingClient ? (Number(existingClient.rev2025) || 0) : 0;
            } else {
                relationship = document.getElementById('form-relationship').value;
                rev2025 = parseFloat(document.getElementById('form-rev-2025').value) || 0;
            }
            const rev2026 = parseFloat(document.getElementById('form-rev-2026').value) || 0;
            const actionText = document.getElementById('form-action').value.trim();
            const drawerContacts = collectDrawerContacts();
            
            const duplicate = clients.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== id);
            if (duplicate) {
                showToast(`Esiste già un cliente con il nome "${name}".`, 'danger');
                return;
            }
            
            if (id) {
                // EDITING
                const clientIdx = clients.findIndex(c => c.id === id);
                if (clientIdx > -1) {
                    const oldAction = clients[clientIdx].action || '';
                    const oldRev2025 = clients[clientIdx].rev2025 || 0;
                    const relationshipChanged = clients[clientIdx].relationship !== relationship;
                    
                    clients[clientIdx].name = name;
                    clients[clientIdx].type = type;
                    clients[clientIdx].owner = owner;
                    clients[clientIdx].rev2025 = rev2025;
                    clients[clientIdx].rev2026 = rev2026;
                    clients[clientIdx].contacts = drawerContacts.map((contact) => ({
                            id: contact.id || createContactId(),
                            email: contact.email || '',
                            role: contact.role || ''
                        }));
                    clients[clientIdx].description = relationshipNote;
                    syncClientLegacyFields(clients[clientIdx]);
                    
                    if (relationshipChanged) {
                        clients[clientIdx].relationship = relationship;
                        clients[clientIdx].manualRelationship = true;
                    }
                    
                    if (actionText !== oldAction && actionText) {
                        addActionToClient(clients[clientIdx], actionText, getTodayString());
                    }
                    
                    if (rev2025 !== oldRev2025 && !relationshipChanged) {
                        clients[clientIdx].manualRelationship = false;
                    }
                    updateClientProfileCompletion(clients[clientIdx]);
                    if (isColdForm || isClientInColdSection(clients[clientIdx])) {
                        clients[clientIdx].isColdClient = rev2026 <= COLD_CLIENT_REV_THRESHOLD;
                    }
                    applyColdClientPromotion(clients[clientIdx]);
                    showToast(`Cliente "${name}" aggiornato.`, 'success');
                }
            } else {
                if (!isColdForm) {
                    const domainMatch = findExistingClientForIncomingContacts(drawerContacts);
                    if (domainMatch) {
                        const addedCount = mergeNewClientContactsIntoExisting(domainMatch.existingClient, drawerContacts);
                        if (relationshipNote) {
                            domainMatch.existingClient.description = domainMatch.existingClient.description
                                ? `${domainMatch.existingClient.description}\n${relationshipNote}`
                                : relationshipNote;
                        }
                        coldClientAddOptions = null;
                        recalculateRelationships();
                        try {
                            await saveStateAsync();
                        } catch (error) {
                            showToast(`Errore salvataggio: ${error.message}`, 'danger');
                            return;
                        }
                        closeDrawer();
                        renderClientTable();
                        renderColdClientsSection();
                        if (addedCount > 0) {
                            showToast(`Contatto aggiunto a "${domainMatch.existingClient.name}" (dominio @${domainMatch.domain} già presente).`, 'info');
                        } else {
                            showToast(`Il contatto esiste già su "${domainMatch.existingClient.name}".`, 'warning');
                        }
                        return;
                    }
                }
                const isCold = !!(coldClientAddOptions && coldClientAddOptions.isCold);
                const newClient = {
                    id: 'client-' + Date.now(),
                    name,
                    type,
                    owner,
                    relationship,
                    manualRelationship: relationship !== 'Nuovo Cliente',
                    rev2025,
                    rev2026,
                    action: '',
                    actionDate: '',
                    actionLog: [],
                    description: relationshipNote,
                    contacts: drawerContacts.map((contact) => ({
                        id: contact.id || createContactId(),
                        email: contact.email || '',
                        role: contact.role || ''
                    })),
                    isColdClient: !!isCold
                };
                if (actionText) {
                    addActionToClient(newClient, actionText, getTodayString());
                }
                syncClientLegacyFields(newClient);
                applyColdClientPromotion(newClient, false);
                clients.push(newClient);
                showToast(
                    isCold ? `Nuovo cliente freddo "${name}" inserito.` : `Nuovo cliente "${name}" inserito.`,
                    'success'
                );
            }
            
            coldClientAddOptions = null;
            recalculateRelationships();
            try {
                await saveStateAsync();
            } catch (error) {
                showToast(`Errore salvataggio: ${error.message}`, 'danger');
                return;
            }
            closeDrawer();
            renderClientTable();
            renderColdClientsSection();
        });
    }
    
    if (coldClientsAccordion) {
        coldClientsAccordion.addEventListener('click', (e) => {
            if (handleContactsPanelInteraction(e)) return;
            const toggleBtn = e.target.closest('[data-action="toggle-cold-category"]');
            if (toggleBtn) {
                toggleColdCategoryExpanded(toggleBtn.getAttribute('data-category-id'));
                renderColdClientsSection();
                return;
            }
            const addBtn = e.target.closest('[data-action="add-cold-client"]');
            if (addBtn) {
                openClientDrawer(false, null, {
                    isCold: true,
                    defaultType: addBtn.getAttribute('data-client-type')
                });
                return;
            }
            const btnApollo = e.target.closest('.btn-table-action.apollo');
            const btnEdit = e.target.closest('.btn-table-action.edit');
            const btnDelete = e.target.closest('.btn-table-action.delete');
            if (btnApollo) {
                enrichClientWithApolloAction(btnApollo.getAttribute('data-id'));
                return;
            }
            if (btnEdit) {
                const id = btnEdit.getAttribute('data-id');
                const client = clients.find(c => c.id === id);
                if (client) openClientDrawer(true, client);
            }
            if (btnDelete) {
                const id = btnDelete.getAttribute('data-id');
                const client = clients.find(c => c.id === id);
                if (client && confirm(`Eliminare il cliente freddo "${client.name}"?`)) {
                    clients = clients.filter(c => c.id !== id);
                    recalculateRelationships();
                    saveState();
                    renderClientTable();
                    renderColdClientsSection();
                    showToast('Cliente freddo rimosso.', 'warning');
                }
            }
        });
        coldClientsAccordion.addEventListener('dblclick', (e) => {
            const cell = e.target.closest('.cell-editable');
            if (!cell || !cell.closest('.cold-clients-table')) return;
            if (cell.querySelector('input, textarea')) return;
            const clientId = cell.getAttribute('data-id');
            const field = cell.getAttribute('data-field');
            const client = clients.find(c => c.id === clientId);
            if (!client || !isClientInColdSection(client)) return;
            const input = document.createElement('input');
            input.type = field === 'rev2026' ? 'number' : 'text';
            if (field === 'rev2026') {
                input.step = '0.01';
                input.min = '0';
                input.value = client.rev2026 || '';
            } else {
                input.value = client[field] || '';
            }
            input.className = 'inline-edit-input';
            cell.innerHTML = '';
            cell.appendChild(input);
            input.focus();
            const saveColdInlineChange = () => {
                if (field === 'rev2026') {
                    const num = parseFloat(input.value) || 0;
                    if (client.rev2026 !== num) {
                        client.rev2026 = num;
                        client.manualRelationship = false;
                        recalculateRelationships();
                        applyColdClientPromotion(client);
                        saveState();
                    }
                } else if (field === 'action') {
                    const newVal = input.value.trim();
                    if (newVal && client.action !== newVal) {
                        addActionToClient(client, newVal, getTodayString());
                        updateClientProfileCompletion(client);
                        saveState();
                    }
                }
                renderClientTable();
                renderColdClientsSection();
            };
            input.addEventListener('blur', saveColdInlineChange);
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') saveColdInlineChange();
                if (ev.key === 'Escape') renderColdClientsSection();
            });
        });
        coldClientsAccordion.addEventListener('change', (e) => {
            const select = e.target.closest('[data-action="change-owner"]');
            if (!select) return;
            const id = select.getAttribute('data-id');
            const client = clients.find(c => c.id === id);
            if (!client) return;
            client.owner = select.value;
            updateClientProfileCompletion(client);
            saveState();
            renderColdClientsSection();
        });
        coldClientsAccordion.addEventListener('focusout', (e) => {
            const clientField = e.target.closest('[data-client-field]');
            if (clientField) {
                const clientId = clientField.getAttribute('data-client-id');
                const fieldName = clientField.getAttribute('data-client-field');
                if (fieldName === 'description' && updateClientRelationshipNote(clientId, clientField.value)) {
                    saveState();
                }
                return;
            }
            const field = e.target.closest('[data-contact-field]');
            if (!field) return;
            const clientId = field.getAttribute('data-client-id');
            const contactId = field.getAttribute('data-contact-id');
            const contactField = field.getAttribute('data-contact-field');
            if (updateClientContactField(clientId, contactId, contactField, field.value)) {
                saveState();
            }
        });
    }
    
    // Delegated actions for table edit / delete buttons
    if (crmTableBody) {
        crmTableBody.addEventListener('click', (e) => {
            if (handleContactsPanelInteraction(e)) return;
            const btnApollo = e.target.closest('.btn-table-action.apollo');
            const btnEdit = e.target.closest('.btn-table-action.edit');
            const btnDelete = e.target.closest('.btn-table-action.delete');
            
            if (btnApollo) {
                enrichClientWithApolloAction(btnApollo.getAttribute('data-id'));
                return;
            }
            
            if (btnEdit) {
                const id = btnEdit.getAttribute('data-id');
                const client = clients.find(c => c.id === id);
                if (client) openDrawer(true, client);
            }
            
            if (btnDelete) {
                const id = btnDelete.getAttribute('data-id');
                const client = clients.find(c => c.id === id);
                if (client) {
                    if (confirm(`Sei sicuro di voler eliminare definitivamente il cliente "${client.name}"?`)) {
                        clients = clients.filter(c => c.id !== id);
                        recalculateRelationships();
                        saveState();
                        renderClientTable();
                        showToast(`Cliente rimosso dal database.`, 'warning');
                    }
                }
            }
        });
        crmTableBody.addEventListener('focusout', (e) => {
            const actionField = e.target.closest('[data-action-field]');
            if (actionField) {
                const clientId = actionField.getAttribute('data-client-id');
                const actionId = actionField.getAttribute('data-action-id');
                const actionFieldName = actionField.getAttribute('data-action-field');
                if (updateClientActionLogEntry(clientId, actionId, actionFieldName, actionField.value)) {
                    saveState();
                    renderClientTable();
                }
                return;
            }
            const clientField = e.target.closest('[data-client-field]');
            if (clientField) {
                const clientId = clientField.getAttribute('data-client-id');
                const fieldName = clientField.getAttribute('data-client-field');
                if (fieldName === 'description' && updateClientRelationshipNote(clientId, clientField.value)) {
                    saveState();
                }
                return;
            }
            const field = e.target.closest('[data-contact-field]');
            if (!field) return;
            const clientId = field.getAttribute('data-client-id');
            const contactId = field.getAttribute('data-contact-id');
            const contactField = field.getAttribute('data-contact-field');
            if (updateClientContactField(clientId, contactId, contactField, field.value)) {
                saveState();
            }
        });
        crmTableBody.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const textInput = e.target.closest('[data-action-input="text"]');
            if (!textInput) return;
            e.preventDefault();
            const form = textInput.closest('.client-actions-add-form');
            const clientId = textInput.getAttribute('data-client-id');
            if (form && clientId) {
                submitClientActionFromForm(form, clientId);
            }
        });
    }

    // --- RANDOM RECALL ACTIONS ---
    const btnRefreshRecall = document.getElementById('btn-refresh-recall');
    const recallCardsGrid = document.getElementById('recall-cards-grid');
    const filterRecallStatus = document.getElementById('filter-recall-status');
    if (btnRefreshRecall) {
        btnRefreshRecall.addEventListener('click', refreshRandomRecall);
    }
    if (filterRecallStatus) {
        filterRecallStatus.addEventListener('change', (e) => {
            recallFilterStatus = e.target.value;
            renderRandomRecall();
        });
    }
    if (recallCardsGrid) {
        recallCardsGrid.addEventListener('click', (e) => {
            const btnOpen = e.target.closest('.btn-recall-open');
            if (!btnOpen) return;
            const id = btnOpen.getAttribute('data-id');
            const client = clients.find(c => c.id === id);
            if (client) openDrawer(true, client);
        });
        recallCardsGrid.addEventListener('change', (e) => {
            const statusSelect = e.target.closest('.recall-status-select');
            if (!statusSelect) return;
            const clientId = statusSelect.getAttribute('data-id');
            const item = dailyRecallItems.find(i => i.clientId === clientId);
            if (!item) return;
            item.status = statusSelect.value === RECALL_STATUS_DONE ? RECALL_STATUS_DONE : RECALL_STATUS_TODO;
            persistDailyRecall()
                .then(() => renderRandomRecall())
                .catch((error) => {
                    console.error('Salvataggio stato recall fallito:', error);
                    showToast('Errore salvataggio stato recall.', 'danger');
                });
        });
        recallCardsGrid.addEventListener('blur', (e) => {
            if (!e.target.classList.contains('recall-action-input')) return;
            const didSave = saveRecallActionFromInput(e.target);
            if (didSave) renderRandomRecall();
        }, true);
        recallCardsGrid.addEventListener('keydown', (e) => {
            if (!e.target.classList.contains('recall-action-input')) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });
    }

    // --- INLINE EDITING INSIDE CRM TABLE ---
    if (crmTableBody) {
        crmTableBody.addEventListener('dblclick', (e) => {
            const cell = e.target.closest('.cell-editable');
            if (!cell) return;
            if (cell.querySelector('input')) return;
            
            const clientId = cell.getAttribute('data-id');
            const field = cell.getAttribute('data-field');
            const client = clients.find(c => c.id === clientId);
            if (!client) return;
            
            const input = document.createElement('input');
            input.type = field === 'rev2025' ? 'number' : 'text';
            if (field === 'rev2025') {
                input.step = '0.01';
                input.min = '0';
                input.value = client.rev2025 || '';
            } else {
                input.value = client[field] || '';
            }
            
            input.className = 'inline-edit-input';
            cell.innerHTML = '';
            cell.appendChild(input);
            input.focus();
            
            const saveInlineChange = () => {
                let newVal = input.value.trim();
                
                if (field === 'rev2025') {
                    const num = parseFloat(newVal) || 0;
                    if (client.rev2025 !== num) {
                        client.rev2025 = num;
                        client.manualRelationship = false;
                        recalculateRelationships();
                        saveState();
                        showToast(`Fatturato 2025 di "${client.name}" modificato.`, 'success');
                    }
                } else if (field === 'action') {
                    if (newVal && client.action !== newVal) {
                        addActionToClient(client, newVal, getTodayString());
                        updateClientProfileCompletion(client);
                        saveState();
                        showToast(`Nota azione di "${client.name}" aggiornata.`, 'success');
                    }
                }
                
                renderClientTable();
            };
            
            input.addEventListener('blur', saveInlineChange);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') saveInlineChange();
                if (e.key === 'Escape') renderClientTable();
            });
        });
    }

    // --- EXCEL FILE IMPORT EVENTS ---
    if (dropzone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
        });
        
        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) handleExcelFile(files[0]);
        });
        
        dropzone.addEventListener('click', () => {
            if (excelFileInput) excelFileInput.click();
        });
    }
    
    if (excelFileInput) {
        excelFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleExcelFile(e.target.files[0]);
        });
    }
    
    if (btnCancelImport) btnCancelImport.addEventListener('click', resetImportState);
    if (btnResetImport) btnResetImport.addEventListener('click', resetImportState);
    
    if (btnProcessMapping) {
        btnProcessMapping.addEventListener('click', () => {
            const clientCol = mapClientSelect.value;
            const revCol = mapRevenueSelect.value;
            
            if (!clientCol || !revCol) {
                showToast('Mappa entrambe le colonne per procedere.', 'danger');
                return;
            }
            
            processExcelMapping(clientCol, revCol);
        });
    }
    
    if (btnCommitImport) {
        btnCommitImport.addEventListener('click', async () => {
            if (parsedExcelClients.length === 0) return;
            const commitLabel = btnCommitImport.querySelector('span');
            const defaultLabel = commitLabel ? commitLabel.textContent : 'Conferma ed importa nel database';
            btnCommitImport.disabled = true;
            if (commitLabel) commitLabel.textContent = 'Salvataggio su database...';
            try {
                const result = await commitExcelImportToDatabase();
                const storageLabel = result.target === 'supabase' ? 'Supabase' : 'localStorage';
                showToast(
                    `Import completato su ${storageLabel}: ${result.updateCount} aggiornati, ${result.newCount} nuovi, ${result.skippedCount || 0} invariati, ${okrRecords.length} OKR in Analisi.`,
                    'success'
                );
                resetImportState();
                const clientListItem = document.querySelector('[data-target="section-clients"]');
                if (clientListItem) clientListItem.click();
            } catch (error) {
                console.error('Import Excel fallito:', error);
                showToast(`Import non salvato: ${error.message}`, 'danger');
            } finally {
                btnCommitImport.disabled = false;
                if (commitLabel) commitLabel.textContent = defaultLabel;
                safeCreateIcons();
            }
        });
    }

    // --- SEZIONE 2: KANBAN IDEA RANDOM EVENT LISTENERS ---
    
    const openIdeaDrawer = (isEdit = false, ideaObj = null) => {
        ideaForm.reset();
        document.getElementById('form-idea-id').value = '';
        if (subFormQuickClient) subFormQuickClient.style.display = 'none';
        
        populateIdeaClientSelect();
        
        if (isEdit && ideaObj) {
            ideaDrawerTitle.innerHTML = `<i data-lucide="lightbulb" style="color: var(--primary)"></i> Modifica Idea`;
            document.getElementById('form-idea-id').value = ideaObj.id;
            document.getElementById('form-idea-name').value = ideaObj.name;
            document.getElementById('form-idea-category').value = ideaObj.category;
            document.getElementById('form-idea-client').value = ideaObj.clientId;
            document.getElementById('form-idea-status').value = ideaObj.status;
            document.getElementById('form-idea-description').value = ideaObj.description;
        } else {
            ideaDrawerTitle.innerHTML = `<i data-lucide="lightbulb" style="color: var(--primary)"></i> Nuova Idea`;
            document.getElementById('form-idea-status').value = 'Da fare';
        }
        
        safeCreateIcons();
        resetDrawerBodyScroll(ideaDrawer);
        ideaDrawer.classList.add('open');
        drawerOverlay.classList.add('open');
        setDrawerOpenState(true);
    };
    
    const closeIdeaDrawer = () => {
        ideaDrawer.classList.remove('open');
        const hasOtherDrawerOpen = (clientDrawer && clientDrawer.classList.contains('open'))
            || (taskDrawer && taskDrawer.classList.contains('open'));
        if (!hasOtherDrawerOpen && drawerOverlay) {
            drawerOverlay.classList.remove('open');
        }
        if (subFormQuickClient) subFormQuickClient.style.display = 'none';
        updateAnyDrawerOpenState();
    };
    
    if (btnQuickAddIdea) btnQuickAddIdea.addEventListener('click', () => openIdeaDrawer(false));
    if (ideaDrawerClose) ideaDrawerClose.addEventListener('click', closeIdeaDrawer);
    if (btnIdeaCancel) btnIdeaCancel.addEventListener('click', closeIdeaDrawer);

    if (taskDrawerClose) taskDrawerClose.addEventListener('click', closeTaskDrawer);
    if (btnTaskCancel) btnTaskCancel.addEventListener('click', closeTaskDrawer);
    if (taskForm) taskForm.addEventListener('submit', saveTaskFromForm);
    
    // Watch client select dropdown for Quick Client trigger
    if (formIdeaClient) {
        formIdeaClient.addEventListener('change', () => {
            if (formIdeaClient.value === '__NEW_CLIENT__') {
                if (subFormQuickClient) subFormQuickClient.style.display = 'block';
                const qName = document.getElementById('quick-client-name');
                if (qName) qName.focus();
            } else {
                if (subFormQuickClient) subFormQuickClient.style.display = 'none';
            }
        });
    }
    
    if (btnCancelQuickClient) {
        btnCancelQuickClient.addEventListener('click', () => {
            if (subFormQuickClient) subFormQuickClient.style.display = 'none';
            if (formIdeaClient) formIdeaClient.value = '';
        });
    }
    
    // Save Quick Client inside Idea form drawer
    if (btnSaveQuickClient) {
        btnSaveQuickClient.addEventListener('click', () => {
            const name = document.getElementById('quick-client-name').value.trim();
            const type = document.getElementById('quick-client-type').value;
            const owner = document.getElementById('quick-client-owner').value;
            
            if (!name) {
                showToast('Inserisci il nome del cliente.', 'danger');
                return;
            }
            
            const exists = clients.some(c => c.name.toLowerCase() === name.toLowerCase());
            if (exists) {
                showToast('Questo cliente esiste già nel database.', 'danger');
                return;
            }
            
            const newClient = {
                id: 'client-' + Date.now(),
                name,
                type,
                owner,
                relationship: 'Nuovo Cliente',
                manualRelationship: false,
                rev2025: 0.00,
                rev2026: 0.00,
                action: 'Cliente registrato dal modulo Idea Random.',
                actionDate: getTodayString(),
                email: '',
                description: '',
                contacts: [{
                    id: createContactId(),
                    email: '',
                    role: ''
                }]
            };
            newClient.description = 'Cliente creato in automatico durante l\'aggiunta di una nuova proposta commerciale.';
            
            clients.push(newClient);
            recalculateRelationships();
            saveState();
            renderClientTable();
            
            showToast(`Cliente "${name}" registrato con successo!`, 'success');
            
            populateIdeaClientSelect();
            formIdeaClient.value = newClient.id;
            if (subFormQuickClient) subFormQuickClient.style.display = 'none';
            
            document.getElementById('quick-client-name').value = '';
        });
    }
    
    // Submit Idea Form Drawer
    if (ideaForm) {
        ideaForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const id = document.getElementById('form-idea-id').value;
            const name = document.getElementById('form-idea-name').value.trim();
            const category = document.getElementById('form-idea-category').value;
            const clientId = document.getElementById('form-idea-client').value;
            const status = document.getElementById('form-idea-status').value;
            const description = document.getElementById('form-idea-description').value.trim();
            
            if (clientId === '__NEW_CLIENT__' || !clientId) {
                showToast('Associa un cliente valido all\'idea.', 'danger');
                return;
            }
            
            if (id) {
                const ideaIdx = ideas.findIndex(i => i.id === id);
                if (ideaIdx > -1) {
                    ideas[ideaIdx].name = name;
                    ideas[ideaIdx].category = category;
                    ideas[ideaIdx].clientId = clientId;
                    ideas[ideaIdx].status = status;
                    ideas[ideaIdx].description = description;
                    
                    showToast(`Idea "${name}" aggiornata.`, 'success');
                }
            } else {
                const newIdea = {
                    id: 'idea-' + Date.now(),
                    name,
                    category,
                    clientId,
                    status,
                    description,
                    dateAdded: getTodayString()
                };
                ideas.push(newIdea);
                showToast(`Idea "${name}" inserita in Kanban!`, 'success');
            }
            
            saveIdeasState();
            closeIdeaDrawer();
            renderKanbanBoard();
        });
    }
    
    // Event delegation on Kanban Columns for Move and Delete clicks
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('click', (e) => {
            const btnLeft = e.target.closest('.btn-card-move.left');
            const btnRight = e.target.closest('.btn-card-move.right');
            const btnDelete = e.target.closest('.btn-card-move.delete');
            const btnEdit = e.target.closest('.btn-card-move.edit');
            
            if (btnLeft || btnRight) {
                const button = btnLeft || btnRight;
                const id = button.getAttribute('data-id');
                const direction = btnLeft ? 'left' : 'right';
                moveIdea(id, direction);
            }
            
            if (btnDelete) {
                const id = btnDelete.getAttribute('data-id');
                const idea = ideas.find(i => i.id === id);
                if (idea && confirm(`Sei sicuro di voler rimuovere l'idea "${idea.name}"?`)) {
                    ideas = ideas.filter(i => i.id !== id);
                    saveIdeasState();
                    renderKanbanBoard();
                    showToast('Idea commerciale rimossa.', 'warning');
                }
            }
            
            if (btnEdit) {
                const id = btnEdit.getAttribute('data-id');
                const idea = ideas.find(i => i.id === id);
                if (idea) openIdeaDrawer(true, idea);
            }
        });
    });

    // --- SETTINGS / LOCALSTORAGE SYSTEM ---
    
    if (btnResetDemo) {
        btnResetDemo.addEventListener('click', () => {
            if (confirm('Sei sicuro di voler svuotare completamente il gestionale? Verranno eliminati tutti i clienti e tutte le idee.')) {
                resetApplicationData(true).catch((error) => {
                    console.error('Reset fallito:', error);
                    showToast('Errore durante lo svuotamento.', 'danger');
                });
            }
        });
    }
    
    // Unified Export (capturing both clients & ideas!)
    if (btnExportJson) {
        btnExportJson.addEventListener('click', () => {
            const backupObject = {
                clients: clients,
                ideas: ideas
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObject, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `crm_full_backup_${getTodayString()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            showToast('Backup completo scaricato.', 'success');
        });
    }
    
    if (btnImportJson) btnImportJson.addEventListener('click', () => {
        if (jsonFileInput) jsonFileInput.click();
    });
    
    if (jsonFileInput) {
        jsonFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    
                    if (parsed.clients && parsed.ideas && Array.isArray(parsed.clients) && Array.isArray(parsed.ideas)) {
                        clients = parsed.clients;
                        ideas = parsed.ideas;
                        recalculateRelationships();
                        saveState();
                        saveIdeasState();
                        
                        renderClientTable();
                        renderKanbanBoard();
                        updateDashboardUI();
                        
                        showToast('Backup completo importato correttamente!', 'success');
                    } else if (Array.isArray(parsed)) {
                        clients = parsed;
                        recalculateRelationships();
                        saveState();
                        renderClientTable();
                        showToast('Lista clienti caricata dal vecchio formato backup.', 'success');
                    } else {
                        showToast('Formato JSON backup non compatibile.', 'danger');
                    }
                } catch(err) {
                    showToast('Lettura del backup JSON fallita.', 'danger');
                    console.error(err);
                }
            };
            reader.readAsText(file);
            jsonFileInput.value = '';
        });
    }
    
    if (btnExportClients) {
        btnExportClients.addEventListener('click', () => {
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Nome Cliente,Tipologia,Owner,Rapporto,Fatturato 2026,Fatturato 2025,Azione,Data Azione,Contatti\n";
            
            clients.forEach(c => {
                normalizeClientContacts(c);
                const contactsText = c.contacts.map((contact) => {
                    const parts = [contact.email || '', contact.role || ''].filter(Boolean);
                    return parts.join(' | ');
                }).join(' ; ');
                const row = [
                    `"${c.name}"`,
                    `"${c.type}"`,
                    `"${c.owner}"`,
                    `"${c.relationship}"`,
                    c.rev2026 || 0,
                    c.rev2025 || 0,
                    `"${(c.action || '').replace(/"/g, '""')}"`,
                    `"${c.actionDate || ''}"`,
                    `"${contactsText.replace(/"/g, '""')}"`
                ].join(",");
                csvContent += row + "\n";
            });
            
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `lista_clienti_crm_${getTodayString()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            showToast('Lista clienti esportata in CSV.', 'success');
        });
    }

    initTableHorizontalScroll();
    initTableColumnControls();
    updateClientsSectionLayout();
}

// ==========================================================================
// EXCEL PARSING & AGGREGATION ENGINE (SHEETJS)
// Struttura attesa: Cliente, Codice progetto, Prodotto, Importo, Mese, PO Cliente, Status, Documento Owner
// PO Cliente e Status vengono esclusi dall'import.
// ==========================================================================
const EXCEL_EXCLUDED_COLUMNS = ['po cliente', 'status'];
const EXCEL_IMPORT_ACTION_PREFIX = 'Fatturato 2026 caricato da file Excel';
const EXCEL_IMPORT_DESC_PREFIX = 'Cliente creato in automatico tramite caricamento Excel';

function normalizeExcelHeader(header) {
    return header.toString().toLowerCase().trim();
}

function isExcludedExcelColumn(header) {
    if (!header) return true;
    const normalized = normalizeExcelHeader(header);
    return EXCEL_EXCLUDED_COLUMNS.some(excluded => normalized === excluded || normalized.includes(excluded));
}

function findExcelColumnIndex(headers, targetName) {
    const target = targetName.toLowerCase();
    const exactIdx = headers.findIndex(h => h && normalizeExcelHeader(h) === target);
    if (exactIdx !== -1) return exactIdx;
    return headers.findIndex(h => h && normalizeExcelHeader(h).includes(target));
}

function detectExcelColumns(headers) {
    return {
        clientCol: findExcelColumnIndex(headers, 'cliente'),
        importoCol: findExcelColumnIndex(headers, 'importo'),
        productCol: findExcelColumnIndex(headers, 'prodotto'),
        monthCol: findExcelColumnIndex(headers, 'mese'),
        projectCol: findExcelColumnIndex(headers, 'codice progetto'),
        ownerCol: findExcelColumnIndex(headers, 'documento owner')
    };
}

function populateExcelMappingSelects(headers) {
    mapClientSelect.innerHTML = '<option value="">-- Seleziona Colonna --</option>';
    mapRevenueSelect.innerHTML = '<option value="">-- Seleziona Colonna --</option>';
    headers.forEach((header, index) => {
        if (!header || isExcludedExcelColumn(header)) return;
        const label = header.toString();
        const optionHtml = `<option value="${index}">${label}</option>`;
        mapClientSelect.insertAdjacentHTML('beforeend', optionHtml);
        mapRevenueSelect.insertAdjacentHTML('beforeend', optionHtml);
    });
}

function isClientProfileComplete(client) {
    normalizeClientContacts(client);
    const hasEmail = client.contacts.some((contact) => !!(contact.email && contact.email.trim()));
    const hasCustomAction = !!(client.action && client.action.trim() && !client.action.startsWith(EXCEL_IMPORT_ACTION_PREFIX));
    const hasRelationshipNote = !!(client.description && client.description.trim() && !client.description.startsWith(EXCEL_IMPORT_DESC_PREFIX));
    return hasEmail && hasCustomAction && hasRelationshipNote;
}

function updateClientProfileCompletion(client) {
    if (client.needsProfileCompletion && isClientProfileComplete(client)) {
        client.needsProfileCompletion = false;
    }
}

function shouldHighlightIncompleteClient(client) {
    return !!(client.needsProfileCompletion && !isClientProfileComplete(client));
}

/**
 * Parses Importo in formato europeo (IT): punto = migliaia, virgola = decimali.
 * La parte decimale (,00) viene ignorata — si importa solo l'euro intero.
 */
function parseExcelImporto(value) {
    if (value === undefined || value === null || value === '') return 0;
    let str = String(value).trim().replace(/[\u00A0\s]/g, '').replace(/[€$£]/g, '');
    if (!str) return 0;
    if (/^-?\d+$/.test(str)) return parseInt(str, 10);
    const hasComma = str.includes(',');
    const hasDot = str.includes('.');
    if (hasComma && hasDot) {
        const commaPos = str.lastIndexOf(',');
        str = str.substring(0, commaPos).replace(/\./g, '');
        const parsed = parseInt(str, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (hasComma) {
        const commaPos = str.indexOf(',');
        const afterComma = str.substring(commaPos + 1);
        const beforeComma = str.substring(0, commaPos);
        if (/^\d{1,2}$/.test(afterComma)) {
            const parsed = parseInt(beforeComma, 10);
            return Number.isNaN(parsed) ? 0 : parsed;
        }
        const parsed = parseInt(str.replace(/,/g, ''), 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (hasDot) {
        const parts = str.split('.');
        if (parts.length === 2 && parts[1].length <= 2 && parts[0].length <= 3) {
            const parsed = parseInt(parts[0], 10);
            return Number.isNaN(parsed) ? 0 : parsed;
        }
        const parsed = parseInt(str.replace(/\./g, ''), 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    const parsed = parseInt(str, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function getExcelCellValue(rowIndex, colIndex) {
    if (rawExcelWorksheet) {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: Number(colIndex) });
        const cell = rawExcelWorksheet[address];
        if (cell) {
            if (cell.w) return cell.w;
            if (cell.v !== undefined && cell.v !== null) return cell.v;
        }
    }
    const row = rawExcelData ? rawExcelData[rowIndex] : null;
    if (row && row[colIndex] !== undefined && row[colIndex] !== null && row[colIndex] !== '') {
        return row[colIndex];
    }
    return null;
}
function handleExcelFile(file) {
    showToast(`Analisi del file: ${file.name}...`, 'info');
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target.result;
        try {
            if (typeof XLSX === 'undefined') {
                showToast('Libreria Excel (SheetJS) non caricata. Verifica la connessione internet.', 'danger');
                return;
            }
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            rawExcelWorksheet = worksheet;
            rawExcelData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
            
            if (rawExcelData.length < 2) {
                showToast('Il foglio caricato non contiene righe o record sufficienti.', 'danger');
                return;
            }
            
            const headers = rawExcelData[0];
            populateExcelMappingSelects(headers);
            autoMatchExcelHeaders(headers);
            const detected = detectExcelColumns(headers);
            if (detected.clientCol !== -1 && detected.importoCol !== -1) {
                processExcelMapping(detected.clientCol, detected.importoCol);
                showToast('Colonne Cliente e Importo rilevate. Anteprima pronta.', 'success');
                return;
            }
            excelMappingCard.style.display = 'block';
            dropzone.style.display = 'none';
            excelPreviewCard.style.display = 'none';
            showToast('Configura la mappatura delle colonne Cliente e Importo.', 'info');
            
        } catch(error) {
            showToast('Lettura Excel fallita.', 'danger');
            console.error("SheetJS Error:", error);
        }
    };
    reader.readAsBinaryString(file);
}

function autoMatchExcelHeaders(headers) {
    const detected = detectExcelColumns(headers);
    if (detected.clientCol !== -1) mapClientSelect.value = detected.clientCol;
    if (detected.importoCol !== -1) mapRevenueSelect.value = detected.importoCol;
}

function processExcelMapping(clientColIndex, revColIndex) {
    const clientMap = new Map();
    
    for (let i = 1; i < rawExcelData.length; i++) {
        const row = rawExcelData[i];
        if (!row || row.length === 0) continue;
        
        let clientName = row[clientColIndex];
        if (!clientName) continue;
        clientName = clientName.toString().trim().replace(/\s+/g, ' ');
        if (!clientName) continue;
        let revenueRaw = getExcelCellValue(i, revColIndex);
        if (revenueRaw === null || revenueRaw === undefined || revenueRaw === '') continue;
        const revenue = parseExcelImporto(revenueRaw);
        
        if (clientMap.has(clientName.toLowerCase())) {
            const exist = clientMap.get(clientName.toLowerCase());
            exist.revenue += revenue;
            exist.recordCount += 1;
        } else {
            clientMap.set(clientName.toLowerCase(), {
                name: clientName,
                revenue: revenue,
                recordCount: 1
            });
        }
    }
    
    parsedExcelClients = Array.from(clientMap.values());
    parsedExcelClients.sort((a, b) => b.revenue - a.revenue);
    if (typeof CrmAnalysis !== 'undefined' && rawExcelData && rawExcelData[0]) {
        const headers = rawExcelData[0];
        const detected = detectExcelColumns(headers);
        pendingOkrRecords = buildOkrRecordsFromExcel(
            headers,
            clientColIndex,
            revColIndex,
            detected.productCol,
            detected.monthCol,
            detected.projectCol,
            detected.ownerCol
        );
    } else {
        pendingOkrRecords = [];
    }
    renderImportPreviewUI();
}

function renderImportPreviewUI() {
    importPreviewBody.innerHTML = '';
    let totalSum = 0;
    
    parsedExcelClients.forEach(imported => {
        totalSum += imported.revenue;
        const existingClient = clients.find(c => c.name.toLowerCase() === imported.name.toLowerCase());
        let statusBadge;
        if (!existingClient) {
            statusBadge = '<span class="badge" style="background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25);">Nuovo — da completare</span>';
        } else if (hasExcelRevenueDifference(existingClient.rev2026, imported.revenue)) {
            statusBadge = '<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.25);">Aggiorna Fatturato</span>';
        } else {
            statusBadge = '<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #64748b; border: 1px solid rgba(148, 163, 184, 0.35);">Invariato</span>';
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${imported.name}</strong></td>
            <td style="text-align: center;"><span class="quick-stats-badge" style="display:inline-flex;">${imported.recordCount}</span></td>
            <td style="text-align: right; font-weight:700; color:var(--text-primary);">${formatCurrency(imported.revenue)}</td>
            <td style="text-align: center;">${statusBadge}</td>
        `;
        importPreviewBody.appendChild(tr);
    });
    
    previewSummaryBadge.textContent = `Clienti Totali Rilevati: ${parsedExcelClients.length}`;
    lblPreviewTotalSum.textContent = formatCurrency(totalSum);
    
    excelMappingCard.style.display = 'none';
    excelPreviewCard.style.display = 'block';
    if (dropzone) dropzone.style.display = 'none';
    
    showToast('Elaborazione completata. Rivedi l\'anteprima.', 'success');
}

function resetImportState() {
    rawExcelData = null;
    rawExcelWorksheet = null;
    parsedExcelClients = [];
    pendingOkrRecords = [];
    excelFileInput.value = '';
    excelMappingCard.style.display = 'none';
    excelPreviewCard.style.display = 'none';
    dropzone.style.display = 'flex';
}

// ==========================================================================
// SEZIONE 3 — RANDOM RECALL ENGINE
// ==========================================================================
function shuffleArray(items) {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getRecallSlotMetaForRelationship(relationship) {
    const match = RECALL_QUOTAS.find(q => q.relationship === relationship);
    if (match) {
        return { slotLabel: match.slotLabel, slotClass: match.slotClass };
    }
    return { slotLabel: relationship, slotClass: 'recall-slot-default' };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

function normalizeRecallItem(item) {
    const relationship = item.relationship || getRecallRelationshipFromItem(item);
    const meta = getRecallSlotMetaForRelationship(relationship);
    return {
        clientId: item.clientId,
        relationship,
        slotLabel: item.slotLabel || meta.slotLabel,
        slotClass: item.slotClass || meta.slotClass,
        status: item.status === RECALL_STATUS_DONE ? RECALL_STATUS_DONE : RECALL_STATUS_TODO
    };
}

function getRecallRelationshipFromItem(item) {
    if (item.relationship) return item.relationship;
    const quotaMatch = RECALL_QUOTAS.find(q => q.slotClass === item.slotClass || q.slotLabel === item.slotLabel);
    if (quotaMatch) return quotaMatch.relationship;
    const client = clients.find(c => c.id === item.clientId);
    return client ? client.relationship : 'Nuovo Cliente';
}

function createRecallItem(client) {
    const meta = getRecallSlotMetaForRelationship(client.relationship);
    return {
        clientId: client.id,
        relationship: client.relationship,
        slotLabel: meta.slotLabel,
        slotClass: meta.slotClass,
        status: RECALL_STATUS_TODO
    };
}

function getEligibleRecallClientsByRelationship(relationship, excludeIds) {
    return clients.filter(c =>
        isClientInActiveSection(c) &&
        c.relationship === relationship &&
        c.relationship !== 'Perso' &&
        c.relationship !== 'Eliminato' &&
        !excludeIds.has(c.id)
    );
}

function pickRandomRecallClientsForQuota(quota, excludeIds) {
    const pool = getEligibleRecallClientsByRelationship(quota.relationship, excludeIds);
    return shuffleArray(pool).slice(0, quota.count);
}

function buildRecallSelectionForQuotas(excludeIds = new Set()) {
    const usedIds = new Set(excludeIds);
    const result = [];
    RECALL_QUOTAS.forEach(quota => {
        pickRandomRecallClientsForQuota(quota, usedIds).forEach(client => {
            usedIds.add(client.id);
            result.push(createRecallItem(client));
        });
    });
    return shuffleArray(result);
}

function pickRandomRecallClientForRelationship(relationship, excludeIds) {
    const pool = getEligibleRecallClientsByRelationship(relationship, excludeIds);
    if (pool.length === 0) return null;
    return shuffleArray(pool)[0];
}

async function persistDailyRecall() {
    const today = getTodayString();
    if (isSupabaseConnected) {
        await CrmSupabase.saveDailyRecall(today, dailyRecallItems);
        return;
    }
    localStorage.setItem(RECALL_STORAGE_KEY, JSON.stringify({
        date: today,
        version: RECALL_SELECTION_VERSION,
        items: dailyRecallItems
    }));
}

function generateRandomRecallSelection(excludeIds = new Set()) {
    return buildRecallSelectionForQuotas(excludeIds);
}

function isRecallSelectionValid(items) {
    if (!Array.isArray(items) || items.length !== RECALL_TOTAL_COUNT) {
        return false;
    }
    const counts = {};
    RECALL_QUOTAS.forEach((quota) => {
        counts[quota.relationship] = 0;
    });
    items.forEach((item) => {
        const relationship = normalizeRecallItem(item).relationship;
        if (Object.prototype.hasOwnProperty.call(counts, relationship)) {
            counts[relationship] += 1;
        }
    });
    return RECALL_QUOTAS.every((quota) => counts[quota.relationship] === quota.count);
}

function normalizeStoredRecallItems(items) {
    return items.map(normalizeRecallItem);
}

function formatItalianDate(dateStr) {
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function loadDailyRecall(forceRefresh = false) {
    const today = getTodayString();
    if (!forceRefresh && dailyRecallItems.length > 0) {
        return dailyRecallItems;
    }
    if (isSupabaseConnected) {
        return CrmSupabase.fetchDailyRecall(today).then(storedItems => {
            if (!forceRefresh && Array.isArray(storedItems) && isRecallSelectionValid(storedItems)) {
                dailyRecallItems = normalizeStoredRecallItems(storedItems);
                return dailyRecallItems;
            }
            dailyRecallItems = generateRandomRecallSelection();
            return CrmSupabase.saveDailyRecall(today, dailyRecallItems).then(() => dailyRecallItems);
        });
    }
    if (!forceRefresh) {
        const stored = localStorage.getItem(RECALL_STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                const hasValidVersion = parsed.version === RECALL_SELECTION_VERSION;
                if (parsed.date === today && Array.isArray(parsed.items) && parsed.items.length > 0) {
                    const normalizedItems = normalizeStoredRecallItems(parsed.items);
                    if (hasValidVersion && isRecallSelectionValid(normalizedItems)) {
                        dailyRecallItems = normalizedItems;
                        return dailyRecallItems;
                    }
                }
            } catch (error) {
                console.warn('Recall storage corrotto, rigenero.', error);
            }
        }
    }
    dailyRecallItems = generateRandomRecallSelection();
    localStorage.setItem(RECALL_STORAGE_KEY, JSON.stringify({
        date: today,
        version: RECALL_SELECTION_VERSION,
        items: dailyRecallItems
    }));
    return dailyRecallItems;
}

async function renderRandomRecall() {
    const grid = document.getElementById('recall-cards-grid');
    const dateLabel = document.getElementById('recall-date-label');
    const sectionTitle = document.getElementById('recall-section-title');
    const filterSelect = document.getElementById('filter-recall-status');
    if (!grid) return;
    let items = [];
    try {
        const loaded = loadDailyRecall(false);
        items = loaded instanceof Promise ? await loaded : loaded;
        if (!isRecallSelectionValid(items)) {
            dailyRecallItems = generateRandomRecallSelection();
            items = dailyRecallItems;
            await persistDailyRecall().catch((error) => {
                console.warn('Rigenerazione recall non salvata:', error);
            });
        }
    } catch (error) {
        console.error('Caricamento recall fallito:', error);
        items = generateRandomRecallSelection();
        dailyRecallItems = items;
    }
    if (filterSelect && filterSelect.value !== recallFilterStatus) {
        filterSelect.value = recallFilterStatus;
    }
    const todoCount = items.filter(i => i.status !== RECALL_STATUS_DONE).length;
    const doneCount = items.filter(i => i.status === RECALL_STATUS_DONE).length;
    if (sectionTitle) {
        sectionTitle.textContent = `I tuoi ${RECALL_TOTAL_COUNT} clienti da ricontattare oggi`;
    }
    if (dateLabel) {
        dateLabel.textContent = `Selezione del ${formatItalianDate(getTodayString())} — ${todoCount} da fare, ${doneCount} completati`;
    }
    const filteredItems = recallFilterStatus
        ? items.filter(i => i.status === recallFilterStatus)
        : items;
    const validItems = items.filter(i => clients.some(c => c.id === i.clientId));
    if (validItems.length !== items.length) {
        dailyRecallItems = validItems;
        await persistDailyRecall().catch((error) => {
            console.warn('Pulizia recall orfani non salvata:', error);
        });
        items = validItems;
    }
    const validFilteredItems = recallFilterStatus
        ? validItems.filter(i => i.status === recallFilterStatus)
        : validItems;
    grid.innerHTML = '';
    if (validItems.length === 0) {
        grid.innerHTML = `
            <div class="recall-empty glass-card">
                <i data-lucide="users-round"></i>
                <h3>Nessun cliente disponibile</h3>
                <p>Aggiungi clienti nella Lista Clienti per ricevere suggerimenti di recall giornalieri.</p>
            </div>
        `;
        safeCreateIcons();
        return;
    }
    if (validFilteredItems.length === 0) {
        grid.innerHTML = `
            <div class="recall-empty glass-card">
                <i data-lucide="filter"></i>
                <h3>Nessun contatto in questa vista</h3>
                <p>Prova a cambiare il filtro su <strong>Tutti</strong> o <strong>Done</strong>, oppure premi Refresh per nuovi clienti.</p>
            </div>
        `;
        safeCreateIcons();
        return;
    }
    validFilteredItems.forEach((item) => {
        const client = clients.find(c => c.id === item.clientId);
        if (!client) return;
        const isDone = item.status === RECALL_STATUS_DONE;
        const isDateStale = isActionDateStale(client.actionDate);
        const card = document.createElement('div');
        card.className = `recall-card glass-card ${item.slotClass}${isDone ? ' recall-card-done' : ''}`;
        card.innerHTML = `
            <div class="recall-card-top">
                <span class="recall-slot-badge">${escapeHtml(item.slotLabel)}</span>
                <select class="recall-status-select form-select" data-id="${client.id}" title="Stato recall">
                    <option value="${RECALL_STATUS_TODO}"${isDone ? '' : ' selected'}>${RECALL_STATUS_TODO}</option>
                    <option value="${RECALL_STATUS_DONE}"${isDone ? ' selected' : ''}>${RECALL_STATUS_DONE}</option>
                </select>
            </div>
            <h3 class="recall-card-name">${escapeHtml(client.name)}</h3>
            <div class="recall-card-meta">
                <span class="recall-meta-chip">${escapeHtml(client.type)}</span>
                <span class="recall-meta-chip">${escapeHtml(client.owner)}</span>
            </div>
            <div class="recall-card-stats">
                <div class="recall-stat">
                    <span class="recall-stat-label">Fatturato 2026</span>
                    <span class="recall-stat-value">${formatCurrency(client.rev2026)}</span>
                </div>
                <div class="recall-stat">
                    <span class="recall-stat-label">Data ultima azione</span>
                    <span class="recall-stat-value recall-action-date-inline ${isDateStale ? 'stale' : ''}">${escapeHtml(client.actionDate || 'Nessuna data')}</span>
                </div>
            </div>
            <div class="recall-action-field">
                <label class="recall-stat-label" for="recall-action-${client.id}">Azione</label>
                <input type="text" id="recall-action-${client.id}" class="recall-action-input form-input" data-id="${client.id}" value="${escapeHtml(client.action || '')}" placeholder="Es. Chiamata effettuata, email inviata...">
            </div>
            <div class="recall-card-footer">
                <button type="button" class="btn btn-primary btn-recall-open" data-id="${client.id}">
                    <i data-lucide="user-cog"></i>
                    <span>Apri scheda</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
    safeCreateIcons();
}

function saveRecallActionFromInput(inputEl) {
    const clientId = inputEl.getAttribute('data-id');
    const client = clients.find(c => c.id === clientId);
    if (!client) return false;
    const trimmed = inputEl.value.trim();
    if ((client.action || '') === trimmed) return false;
    if (!trimmed) return false;
    addActionToClient(client, trimmed, getTodayString());
    saveState();
    return true;
}

async function refreshRandomRecall() {
    dailyRecallItems = generateRandomRecallSelection();
    if (dailyRecallItems.length === 0) {
        await renderRandomRecall();
        showToast('Nessun cliente disponibile per il recall.', 'warning');
        return;
    }
    try {
        await persistDailyRecall();
        await renderRandomRecall();
        showToast(`Nuova selezione: ${dailyRecallItems.length} clienti (1 Top 20%, 2 Ricorrenti, 2 Nuovi).`, 'success');
    } catch (error) {
        console.error('Refresh recall fallito:', error);
        showToast('Errore refresh Random Recall.', 'danger');
    }
}

// ==========================================================================
// SEZIONE 1 — TABLE DESIGN HELPERS
// ==========================================================================
const CLIENT_TYPE_CELL_CLASSES = {
    'Cliente Diretto': 'cell-type-diretto',
    'Agenzia': 'cell-type-agenzia',
    'Agenzia PR': 'cell-type-pr',
    'CDP': 'cell-type-cdp',
    'Agenzia Eventi': 'cell-type-eventi'
};

const RELATIONSHIP_OPTIONS = [
    { value: 'Nuovo Cliente', label: '⭐ Nuovo Cliente', cellClass: 'cell-rapporto-nuovo' },
    { value: 'Ricorrente', label: '⭐⭐ Ricorrente', cellClass: 'cell-rapporto-ricorrente' },
    { value: 'Top 20%', label: '⭐⭐⭐ Top 20%', cellClass: 'cell-rapporto-top20' },
    { value: 'Perso', label: '🟠 Perso', cellClass: 'cell-rapporto-perso' },
    { value: 'Eliminato', label: '🔴 Eliminato', cellClass: 'cell-rapporto-eliminato' }
];

const ACTION_DATE_STALE_DAYS = 10;

function getClientTypeCellClass(type) {
    return CLIENT_TYPE_CELL_CLASSES[type] || 'cell-type-diretto';
}

function getOwnerCellClass(owner) {
    return owner === 'Virgi' ? 'cell-owner-virgi' : 'cell-owner-jeck';
}

function getRelationshipCellClass(relationship) {
    const match = RELATIONSHIP_OPTIONS.find(r => r.value === relationship);
    return match ? match.cellClass : 'cell-rapporto-nuovo';
}

function buildRelationshipOptionsHtml(selectedValue) {
    return RELATIONSHIP_OPTIONS.map(opt =>
        `<option value="${opt.value}" ${selectedValue === opt.value ? 'selected' : ''}>${opt.label}</option>`
    ).join('');
}

function isActionDateStale(actionDateStr) {
    if (!actionDateStr) return false;
    const actionDate = new Date(`${actionDateStr}T00:00:00`);
    if (Number.isNaN(actionDate.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - actionDate) / (1000 * 60 * 60 * 24));
    return diffDays >= ACTION_DATE_STALE_DAYS;
}

// ==========================================================================
// RENDER CRM CLIENT LIST TABLE (SEZIONE 1)
// ==========================================================================
function loadTableColumnPreferences() {
    try {
        const savedOrder = localStorage.getItem(CRM_COLUMN_ORDER_KEY);
        if (savedOrder) {
            const parsed = JSON.parse(savedOrder);
            if (Array.isArray(parsed)) {
                const valid = sanitizeMainTableColumnOrder(parsed);
                const missing = DEFAULT_TABLE_COLUMN_ORDER.filter(id => !valid.includes(id));
                tableColumnOrder = [...valid, ...missing];
            }
        }
        const savedWidths = localStorage.getItem(CRM_COLUMN_WIDTHS_KEY);
        if (savedWidths) {
            tableColumnWidths = JSON.parse(savedWidths) || {};
        }
        const savedExpanded = localStorage.getItem(CRM_COLUMN_EXPANDED_KEY);
        if (savedExpanded) {
            expandedTableColumns = new Set(JSON.parse(savedExpanded).filter(id => CRM_TABLE_COLUMN_DEFS[id]));
        }
        migrateTableColumnOrderPreferences();
    } catch (error) {
        console.warn('Preferenze colonne non valide, uso default.', error);
        tableColumnOrder = [...DEFAULT_TABLE_COLUMN_ORDER];
        tableColumnWidths = {};
        expandedTableColumns = new Set();
    }
}

function saveTableColumnPreferences() {
    localStorage.setItem(CRM_COLUMN_ORDER_KEY, JSON.stringify(tableColumnOrder));
    localStorage.setItem(CRM_COLUMN_WIDTHS_KEY, JSON.stringify(tableColumnWidths));
    localStorage.setItem(CRM_COLUMN_EXPANDED_KEY, JSON.stringify([...expandedTableColumns]));
}

function getTableColumnWidth(columnId) {
    const def = CRM_TABLE_COLUMN_DEFS[columnId];
    if (!def) return 120;
    if (expandedTableColumns.has(columnId) && def.expandedWidth) {
        return Math.max(def.expandedWidth, tableColumnWidths[columnId] || def.defaultWidth);
    }
    const width = tableColumnWidths[columnId] || def.defaultWidth;
    return Math.max(width, def.minWidth);
}

function renderTableColgroup() {
    const table = document.getElementById('crm-table');
    if (!table) return;
    let colgroup = table.querySelector('colgroup');
    if (!colgroup) {
        colgroup = document.createElement('colgroup');
        table.insertBefore(colgroup, table.firstChild);
    }
    colgroup.innerHTML = tableColumnOrder.map(columnId =>
        `<col data-col="${columnId}" style="width:${getTableColumnWidth(columnId)}px">`
    ).join('');
}

function renderClientTableHeader() {
    const headRow = document.getElementById('crm-table-head-row');
    if (!headRow) return;
    headRow.innerHTML = tableColumnOrder.map(columnId => {
        const def = CRM_TABLE_COLUMN_DEFS[columnId];
        const isExpanded = expandedTableColumns.has(columnId);
        const sortIcon = def.sortKey && currentSort.column === def.sortKey
            ? (currentSort.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down')
            : 'fa-sort';
        const sortControl = def.sortKey
            ? `<button type="button" class="th-sort-btn" data-sort="${def.sortKey}">${def.label} <i class="fas ${sortIcon}"></i></button>`
            : `<span class="th-label">${def.label}</span>`;
        const expandBtn = def.noExpand ? '' : `
            <button type="button" class="col-expand-btn ${isExpanded ? 'is-expanded' : ''}" data-col-expand="${columnId}" title="${isExpanded ? 'Comprimi colonna' : 'Espandi colonna'}">
                <i data-lucide="${isExpanded ? 'minimize-2' : 'maximize-2'}"></i>
            </button>`;
        return `
            <th class="crm-th" data-col-id="${columnId}" style="text-align:${def.align}">
                <div class="th-inner">
                    <span class="col-drag-handle" draggable="true" data-col-drag="${columnId}" title="Trascina per riordinare la colonna">
                        <i data-lucide="grip-vertical"></i>
                    </span>
                    ${sortControl}
                    ${expandBtn}
                    <span class="col-resize-handle" data-col-resize="${columnId}" title="Trascina per ridimensionare"></span>
                </div>
            </th>`;
    }).join('');
}

function buildClientTableCellHtml(client, columnId) {
    const expandedClass = expandedTableColumns.has(columnId) ? ' col-cell-expanded' : '';
    const dataCol = ` data-col="${columnId}"`;
    switch (columnId) {
        case 'name':
            return buildClientNameCellHtml(client, expandedClass, dataCol);
        case 'type': {
            const typeCellClass = getClientTypeCellClass(client.type);
            return `<td class="cell-type${expandedClass}"${dataCol}>
                <div class="table-cell-chip ${typeCellClass}">
                    <select class="table-cell-select" data-id="${client.id}" data-action="change-type">
                        <option value="Cliente Diretto" ${client.type === 'Cliente Diretto' ? 'selected' : ''}>Cliente Diretto</option>
                        <option value="Agenzia" ${client.type === 'Agenzia' ? 'selected' : ''}>Agenzia</option>
                        <option value="Agenzia PR" ${client.type === 'Agenzia PR' ? 'selected' : ''}>Agenzia PR</option>
                        <option value="CDP" ${client.type === 'CDP' ? 'selected' : ''}>CDP</option>
                        <option value="Agenzia Eventi" ${client.type === 'Agenzia Eventi' ? 'selected' : ''}>Agenzia Eventi</option>
                    </select>
                </div>
            </td>`;
        }
        case 'owner': {
            const ownerCellClass = getOwnerCellClass(client.owner);
            return `<td class="cell-owner${expandedClass}"${dataCol}>
                <div class="table-cell-chip ${ownerCellClass}">
                    <select class="table-cell-select" data-id="${client.id}" data-action="change-owner">
                        <option value="Jeck" ${client.owner === 'Jeck' ? 'selected' : ''}>Jeck</option>
                        <option value="Virgi" ${client.owner === 'Virgi' ? 'selected' : ''}>Virgi</option>
                    </select>
                </div>
            </td>`;
        }
        case 'relationship': {
            const rapportoCellClass = getRelationshipCellClass(client.relationship);
            return `<td class="cell-rapporto${expandedClass}"${dataCol}>
                <div class="table-cell-chip ${rapportoCellClass}">
                    <select class="table-cell-select table-cell-select-rapporto" data-id="${client.id}" data-action="change-relationship">
                        ${buildRelationshipOptionsHtml(client.relationship)}
                    </select>
                </div>
            </td>`;
        }
        case 'rev2026':
            return `<td style="text-align:right" class="col-fatturato ${client.rev2026 > 0 ? '' : 'empty'}${expandedClass}"${dataCol}>${formatCurrency(client.rev2026)}</td>`;
        case 'rev2025':
            return `<td style="text-align:right" class="col-fatturato cell-editable ${client.rev2025 > 0 ? '' : 'empty'}${expandedClass}" data-id="${client.id}" data-field="rev2025"${dataCol}>${formatCurrency(client.rev2025)}</td>`;
        case 'action':
            return `<td class="col-azione cell-editable${expandedClass}" data-id="${client.id}" data-field="action" title="Doppio clic per modificare"${dataCol}>${escapeHtml(client.action || '-')}</td>`;
        case 'actionDate': {
            const isDateStale = isActionDateStale(client.actionDate);
            const dateContent = isDateStale && client.actionDate
                ? `<span class="table-cell-chip cell-date-stale">${client.actionDate}</span>`
                : (client.actionDate ? client.actionDate : '-');
            return `<td class="col-data-azione${expandedClass}" title="${isDateStale ? 'Azione non aggiornata da oltre 10 giorni' : ''}"${dataCol}>${dateContent}</td>`;
        }
        case 'email':
        case 'description':
            return buildContactsToggleCellHtml(client, expandedClass, dataCol);
        case 'contacts':
            return buildContactsToggleCellHtml(client, expandedClass, dataCol);
        case 'actions':
            return `<td class="col-actions${expandedClass}"${dataCol}>
                <div class="table-row-actions">
                    <button class="btn-table-action apollo" data-id="${client.id}" title="Arricchisci con Apollo"><i data-lucide="sparkles"></i></button>
                    <button class="btn-table-action edit" data-id="${client.id}" title="Modifica Completa"><i data-lucide="edit"></i></button>
                    <button class="btn-table-action delete" data-id="${client.id}" title="Elimina"><i data-lucide="trash-2"></i></button>
                </div>
            </td>`;
        default:
            return `<td${dataCol}></td>`;
    }
}

function reorderTableColumn(draggedId, targetId) {
    if (!draggedId || !targetId || draggedId === targetId) return;
    const fromIdx = tableColumnOrder.indexOf(draggedId);
    const toIdx = tableColumnOrder.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [item] = tableColumnOrder.splice(fromIdx, 1);
    tableColumnOrder.splice(toIdx, 0, item);
    saveTableColumnPreferences();
    renderClientTable();
    showToast('Ordine colonne aggiornato.', 'info');
}

function toggleTableColumnExpand(columnId) {
    if (!CRM_TABLE_COLUMN_DEFS[columnId] || CRM_TABLE_COLUMN_DEFS[columnId].noExpand) return;
    if (expandedTableColumns.has(columnId)) {
        expandedTableColumns.delete(columnId);
    } else {
        expandedTableColumns.add(columnId);
    }
    saveTableColumnPreferences();
    renderClientTable();
}

function initTableColumnControls() {
    const head = document.getElementById('crm-table-head');
    if (!head || head.dataset.bound === '1') return;
    head.dataset.bound = '1';

    head.addEventListener('click', (event) => {
        const sortBtn = event.target.closest('.th-sort-btn');
        if (sortBtn) {
            event.preventDefault();
            const col = sortBtn.getAttribute('data-sort');
            if (!col) return;
            if (currentSort.column === col) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = col;
                currentSort.direction = 'asc';
            }
            renderClientTable();
            return;
        }
        const expandBtn = event.target.closest('.col-expand-btn');
        if (expandBtn) {
            event.preventDefault();
            toggleTableColumnExpand(expandBtn.getAttribute('data-col-expand'));
        }
    });

    head.addEventListener('dragstart', (event) => {
        const handle = event.target.closest('.col-drag-handle');
        if (!handle) return;
        draggedTableColumnId = handle.getAttribute('data-col-drag');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedTableColumnId);
        handle.closest('.crm-th')?.classList.add('is-dragging');
    });

    head.addEventListener('dragend', () => {
        draggedTableColumnId = null;
        head.querySelectorAll('.crm-th.is-dragging, .crm-th.drag-over').forEach(el => {
            el.classList.remove('is-dragging', 'drag-over');
        });
    });

    head.addEventListener('dragover', (event) => {
        const th = event.target.closest('.crm-th');
        if (!th || !draggedTableColumnId) return;
        event.preventDefault();
        head.querySelectorAll('.crm-th.drag-over').forEach(el => el.classList.remove('drag-over'));
        th.classList.add('drag-over');
    });

    head.addEventListener('dragleave', (event) => {
        const th = event.target.closest('.crm-th');
        if (th) th.classList.remove('drag-over');
    });

    head.addEventListener('drop', (event) => {
        const th = event.target.closest('.crm-th');
        if (!th) return;
        event.preventDefault();
        th.classList.remove('drag-over');
        const targetId = th.getAttribute('data-col-id');
        if (draggedTableColumnId && targetId) {
            reorderTableColumn(draggedTableColumnId, targetId);
        }
    });

    head.addEventListener('mousedown', (event) => {
        const resizeHandle = event.target.closest('.col-resize-handle');
        if (!resizeHandle) return;
        event.preventDefault();
        const columnId = resizeHandle.getAttribute('data-col-resize');
        const def = CRM_TABLE_COLUMN_DEFS[columnId];
        if (!def) return;
        resizingColumnState = {
            columnId,
            startX: event.clientX,
            startWidth: getTableColumnWidth(columnId)
        };
        document.body.classList.add('crm-col-resizing');
    });

    if (!document.body.dataset.crmColResizeBound) {
        document.body.dataset.crmColResizeBound = '1';
        document.addEventListener('mousemove', (event) => {
            if (!resizingColumnState) return;
            const def = CRM_TABLE_COLUMN_DEFS[resizingColumnState.columnId];
            const delta = event.clientX - resizingColumnState.startX;
            const nextWidth = Math.max(def.minWidth, resizingColumnState.startWidth + delta);
            tableColumnWidths[resizingColumnState.columnId] = nextWidth;
            expandedTableColumns.delete(resizingColumnState.columnId);
            const colEl = document.querySelector(`#crm-table col[data-col="${resizingColumnState.columnId}"]`);
            if (colEl) colEl.style.width = `${nextWidth}px`;
            syncTableHorizontalScroll();
        });
        document.addEventListener('mouseup', () => {
            if (!resizingColumnState) return;
            saveTableColumnPreferences();
            resizingColumnState = null;
            document.body.classList.remove('crm-col-resizing');
            syncTableHorizontalScroll();
        });
    }
}

function updateClientsSectionLayout() {
    const isClientsActive = document.getElementById('section-clients')?.classList.contains('active');
    if (contentBody) {
        contentBody.classList.toggle('is-clients-section', Boolean(isClientsActive));
    }
    const bar = document.getElementById('crm-table-h-scroll');
    if (bar) {
        bar.classList.toggle('is-active', Boolean(isClientsActive));
    }
    if (isClientsActive) {
        requestAnimationFrame(() => syncTableHorizontalScroll());
    }
}

function syncTableHorizontalScroll() {
    const viewport = document.getElementById('crm-table-scroll-viewport');
    const bar = document.getElementById('crm-table-h-scroll');
    const table = document.getElementById('crm-table');
    if (!viewport || !bar) return;
    let inner = bar.querySelector('.table-h-scroll-inner');
    if (!inner) {
        inner = document.createElement('div');
        inner.className = 'table-h-scroll-inner';
        bar.appendChild(inner);
    }
    const contentWidth = table ? Math.max(table.offsetWidth, table.scrollWidth) : viewport.scrollWidth;
    inner.style.width = `${contentWidth}px`;
    bar.classList.add('is-visible');
    if (bar.dataset.syncing !== '1') {
        bar.scrollLeft = viewport.scrollLeft;
    }
}

let tableHorizontalDragState = null;

function setTableHorizontalScrollLeft(nextScrollLeft) {
    const viewport = document.getElementById('crm-table-scroll-viewport');
    const bar = document.getElementById('crm-table-h-scroll');
    const table = document.getElementById('crm-table');
    if (!viewport || !bar) return;
    const contentWidth = table ? Math.max(table.offsetWidth, table.scrollWidth) : viewport.scrollWidth;
    const maxScroll = Math.max(0, contentWidth - viewport.clientWidth);
    const clamped = Math.max(0, Math.min(maxScroll, nextScrollLeft));
    bar.dataset.syncing = '1';
    viewport.scrollLeft = clamped;
    bar.scrollLeft = clamped;
    bar.dataset.syncing = '0';
}

function initTableHorizontalScroll() {
    const viewport = document.getElementById('crm-table-scroll-viewport');
    const bar = document.getElementById('crm-table-h-scroll');
    if (!viewport || !bar || bar.dataset.bound === '1') return;
    bar.dataset.bound = '1';
    bar.addEventListener('scroll', () => {
        if (bar.dataset.syncing === '1') return;
        bar.dataset.syncing = '1';
        viewport.scrollLeft = bar.scrollLeft;
        bar.dataset.syncing = '0';
    });
    viewport.addEventListener('scroll', () => {
        if (bar.dataset.syncing === '1') return;
        bar.dataset.syncing = '1';
        bar.scrollLeft = viewport.scrollLeft;
        bar.dataset.syncing = '0';
    });
    bar.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        tableHorizontalDragState = {
            startX: event.clientX,
            startScrollLeft: bar.scrollLeft
        };
        bar.classList.add('is-dragging');
        event.preventDefault();
    });
    if (!document.body.dataset.crmTableHDragBound) {
        document.body.dataset.crmTableHDragBound = '1';
        document.addEventListener('mousemove', (event) => {
            if (!tableHorizontalDragState) return;
            const deltaX = event.clientX - tableHorizontalDragState.startX;
            setTableHorizontalScrollLeft(tableHorizontalDragState.startScrollLeft + deltaX);
        });
        document.addEventListener('mouseup', () => {
            if (!tableHorizontalDragState) return;
            tableHorizontalDragState = null;
            const activeBar = document.getElementById('crm-table-h-scroll');
            if (activeBar) activeBar.classList.remove('is-dragging');
        });
    }
    viewport.addEventListener('wheel', (event) => {
        if (!document.getElementById('section-clients')?.classList.contains('active')) return;
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) && !event.shiftKey) return;
        const delta = event.shiftKey ? event.deltaY : event.deltaX;
        if (delta === 0) return;
        setTableHorizontalScrollLeft(viewport.scrollLeft + delta);
        event.preventDefault();
    }, { passive: false });
    if (typeof ResizeObserver !== 'undefined') {
        const table = document.getElementById('crm-table');
        new ResizeObserver(() => syncTableHorizontalScroll()).observe(viewport);
        if (table) new ResizeObserver(() => syncTableHorizontalScroll()).observe(table);
    }
    window.addEventListener('resize', syncTableHorizontalScroll);
    syncTableHorizontalScroll();
}

function renderClientTable() {
    if (!crmTableBody) return;
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const typeVal = filterType ? filterType.value : '';
    const ownerVal = filterOwner ? filterOwner.value : '';
    const relationVal = filterRelationship ? filterRelationship.value : '';
    let filtered = clients.filter(c => {
        if (!isClientInActiveSection(c)) return false;
        const matchesQuery = !query ||
            c.name.toLowerCase().includes(query) ||
            getClientContactsSearchText(c).includes(query);
        const matchesType = !typeVal || c.type === typeVal;
        const matchesOwner = !ownerVal || c.owner === ownerVal;
        const matchesRelation = !relationVal || c.relationship === relationVal;
        return matchesQuery && matchesType && matchesOwner && matchesRelation;
    });
    const col = currentSort.column;
    const dir = currentSort.direction;
    filtered.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (col === 'rev2025') {
            valA = a.rev2025 || 0;
            valB = b.rev2025 || 0;
        }
        if (col === 'rev2026') {
            valA = a.rev2026 || 0;
            valB = b.rev2026 || 0;
        }
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
        return 0;
    });
    if (totalCountLabel) totalCountLabel.textContent = clients.filter(isClientInActiveSection).length;
    if (shownCountLabel) shownCountLabel.textContent = filtered.length;
    renderTableColgroup();
    renderClientTableHeader();
    crmTableBody.innerHTML = '';
    const colCount = tableColumnOrder.length;
    if (filtered.length === 0) {
        crmTableBody.innerHTML = `
            <tr>
                <td colspan="${colCount}" style="text-align:center;padding:40px;color:var(--text-muted);">
                    <i class="fas fa-folder-open" style="font-size:2rem;margin-bottom:12px;display:block;"></i>
                    Nessun cliente corrisponde ai criteri di ricerca.
                </td>
            </tr>`;
        safeCreateIcons();
        syncTableHorizontalScroll();
        return;
    }
    filtered.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = 'client-row client-row-expandable';
        tr.dataset.id = c.id;
        if (expandedClientContacts.has(c.id)) {
            tr.classList.add('is-row-expanded');
        }
        if (shouldHighlightIncompleteClient(c)) {
            tr.classList.add('client-row-incomplete');
        }
        tr.innerHTML = tableColumnOrder.map(columnId => buildClientTableCellHtml(c, columnId)).join('');
        crmTableBody.appendChild(tr);
        if (expandedClientContacts.has(c.id)) {
            crmTableBody.insertAdjacentHTML('beforeend', buildContactsDetailRowHtml(c, colCount));
        }
    });
    bindInlineDropdownListeners();
    safeCreateIcons();
    syncTableHorizontalScroll();
}

function handleContactsPanelInteraction(e) {
    if (handleClientRowExpandClick(e)) return true;
    const addActionBtn = e.target.closest('[data-action="add-client-action"]');
    if (addActionBtn) {
        const clientId = addActionBtn.getAttribute('data-client-id');
        const form = addActionBtn.closest('.client-actions-add-form');
        if (form && clientId) {
            submitClientActionFromForm(form, clientId);
        }
        return true;
    }
    const deleteActionBtn = e.target.closest('[data-action="delete-client-action"]');
    if (deleteActionBtn) {
        const clientId = deleteActionBtn.getAttribute('data-client-id');
        const actionId = deleteActionBtn.getAttribute('data-action-id');
        if (deleteClientActionLogEntry(clientId, actionId)) {
            saveState();
            renderClientTable();
            renderColdClientsSection();
            showToast('Azione eliminata.', 'info');
        }
        return true;
    }
    const addBtn = e.target.closest('[data-action="add-contact"]');
    if (addBtn) {
        const clientId = addBtn.getAttribute('data-client-id');
        const client = clients.find((item) => item.id === clientId);
        if (client) {
            addContactToClient(client, { email: '', role: '' });
            expandedClientContacts.add(clientId);
            saveClientContactsExpandedPreference();
            saveState();
            renderClientTable();
            renderColdClientsSection();
        }
        return true;
    }
    const deleteBtn = e.target.closest('[data-action="delete-contact"]');
    if (deleteBtn) {
        const clientId = deleteBtn.getAttribute('data-client-id');
        const contactId = deleteBtn.getAttribute('data-contact-id');
        deleteContactFromClient(clientId, contactId);
        saveState();
        renderClientTable();
        renderColdClientsSection();
        return true;
    }
    return false;
}

function submitClientActionFromForm(formEl, clientId) {
    const textInput = formEl.querySelector('[data-action-input="text"]');
    const dateInput = formEl.querySelector('[data-action-input="date"]');
    const client = clients.find((item) => item.id === clientId);
    if (!client || !textInput) return false;
    const didAdd = addActionToClient(client, textInput.value, dateInput ? dateInput.value : getTodayString());
    if (!didAdd) {
        showToast('Scrivi una descrizione per l\'azione.', 'warning');
        return false;
    }
    textInput.value = '';
    if (dateInput) {
        dateInput.value = getTodayString();
    }
    expandedClientContacts.add(clientId);
    saveClientContactsExpandedPreference();
    saveState();
    renderClientTable();
    renderColdClientsSection();
    showToast('Azione registrata.', 'success');
    return true;
}

function bindInlineDropdownListeners() {
    crmTableBody.querySelectorAll('[data-action="change-type"]').forEach(select => {
        select.addEventListener('change', () => {
            const id = select.getAttribute('data-id');
            const client = clients.find(c => c.id === id);
            if (client) {
                client.type = select.value;
                updateClientProfileCompletion(client);
                saveState();
                renderClientTable();
                showToast(`Tipologia di "${client.name}" aggiornata.`, 'info');
            }
        });
    });
    crmTableBody.querySelectorAll('[data-action="change-owner"]').forEach(select => {
        select.addEventListener('change', () => {
            const id = select.getAttribute('data-id');
            const client = clients.find(c => c.id === id);
            if (client) {
                client.owner = select.value;
                updateClientProfileCompletion(client);
                saveState();
                renderClientTable();
                showToast(`Owner di "${client.name}" assegnato a ${select.value}.`, 'info');
            }
        });
    });
    crmTableBody.querySelectorAll('[data-action="change-relationship"]').forEach(select => {
        select.addEventListener('change', () => {
            const id = select.getAttribute('data-id');
            const client = clients.find(c => c.id === id);
            if (client) {
                client.relationship = select.value;
                client.manualRelationship = true;
                recalculateRelationships();
                saveState();
                renderClientTable();
                showToast(`Stato rapporto di "${client.name}" impostato a "${select.value}".`, 'info');
            }
        });
    });
    renderColdClientsSection();
}


// ==========================================================================
// SEZIONE 2: KANBAN IDEA RANDOM ENGINE
// ==========================================================================

function populateIdeaClientSelect() {
    if (!formIdeaClient) return;
    formIdeaClient.innerHTML = '';
    
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = '-- Seleziona Cliente --';
    formIdeaClient.appendChild(defOpt);
    
    const activeClients = clients
        .filter(c => c.relationship !== 'Eliminato')
        .sort((a, b) => a.name.localeCompare(b.name));
        
    activeClients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.relationship})`;
        formIdeaClient.appendChild(opt);
    });
    
    const addOpt = document.createElement('option');
    addOpt.value = '__NEW_CLIENT__';
    addOpt.textContent = '+ Crea Nuovo Cliente...';
    formIdeaClient.appendChild(addOpt);
}

function moveIdea(id, direction) {
    const ideaIdx = ideas.findIndex(i => i.id === id);
    if (ideaIdx === -1) return;
    
    const currentStatus = ideas[ideaIdx].status;
    let newStatus = currentStatus;
    
    if (direction === 'right') {
        if (currentStatus === 'Da fare') newStatus = 'In progress';
        else if (currentStatus === 'In progress') newStatus = 'Fatto';
    } else if (direction === 'left') {
        if (currentStatus === 'Fatto') newStatus = 'In progress';
        else if (currentStatus === 'In progress') newStatus = 'Da fare';
    }
    
    if (currentStatus !== newStatus) {
        ideas[ideaIdx].status = newStatus;
        saveIdeasState();
        renderKanbanBoard();
        showToast(`Idea spostata in "${newStatus}".`, 'success');
    }
}

function renderKanbanBoard() {
    if (!document.getElementById('cards-todo')) return; // Exit if not in ideas section view DOM
    
    const query = searchIdeasInput ? searchIdeasInput.value.toLowerCase().trim() : '';
    const categoryFilter = filterIdeaCategory ? filterIdeaCategory.value : '';
    
    const filteredIdeas = ideas.filter(idea => {
        const clientObj = clients.find(c => c.id === idea.clientId);
        const clientName = clientObj ? clientObj.name.toLowerCase() : '';
        
        const matchesQuery = !query || 
            idea.name.toLowerCase().includes(query) ||
            idea.description.toLowerCase().includes(query) ||
            clientName.includes(query);
            
        const matchesCategory = !categoryFilter || idea.category === categoryFilter;
        
        return matchesQuery && matchesCategory;
    });
    
    const todoIdeas = filteredIdeas.filter(i => i.status === 'Da fare');
    const progressIdeas = filteredIdeas.filter(i => i.status === 'In progress');
    const doneIdeas = filteredIdeas.filter(i => i.status === 'Fatto');
    
    const bTodo = document.getElementById('badge-todo');
    const bProg = document.getElementById('badge-progress');
    const bDone = document.getElementById('badge-done');
    
    if (bTodo) bTodo.textContent = todoIdeas.length;
    if (bProg) bProg.textContent = progressIdeas.length;
    if (bDone) bDone.textContent = doneIdeas.length;
    
    renderKanbanColumn('cards-todo', todoIdeas, 'Da fare');
    renderKanbanColumn('cards-progress', progressIdeas, 'In progress');
    renderKanbanColumn('cards-done', doneIdeas, 'Fatto');
    
    safeCreateIcons();
}

function renderKanbanColumn(containerId, list, colStatus) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    if (list.length === 0) {
        container.innerHTML = `
            <div style="border: 2px dashed rgba(255,255,255,0.03); border-radius:var(--radius-sm); padding: 30px 20px; text-align:center; color:var(--text-muted); font-size:0.8rem; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;">
                <i class="fas fa-lightbulb" style="font-size:1.4rem; opacity:0.3;"></i>
                Nessuna idea
            </div>
        `;
        return;
    }
    
    list.forEach(idea => {
        const clientObj = clients.find(c => c.id === idea.clientId);
        const clientName = clientObj ? clientObj.name : 'Cliente Sconosciuto';
        
        const card = document.createElement('div');
        card.className = 'idea-card';
        card.setAttribute('data-id', idea.id);
        
        let shiftLeftHtml = '';
        let shiftRightHtml = '';
        
        if (colStatus === 'In progress') {
            shiftLeftHtml = `<button class="btn-card-move left" data-id="${idea.id}" title="Sposta in 'Da fare'"><i class="fas fa-chevron-left"></i></button>`;
            shiftRightHtml = `<button class="btn-card-move right" data-id="${idea.id}" title="Sposta in 'Fatto'"><i class="fas fa-chevron-right"></i></button>`;
        } else if (colStatus === 'Da fare') {
            shiftRightHtml = `<button class="btn-card-move right" data-id="${idea.id}" title="Sposta in 'In progress'"><i class="fas fa-chevron-right"></i></button>`;
        } else if (colStatus === 'Fatto') {
            shiftLeftHtml = `<button class="btn-card-move left" data-id="${idea.id}" title="Sposta in 'In progress'"><i class="fas fa-chevron-left"></i></button>`;
        }
        
        const categoryClass = `badge-${idea.category.toLowerCase().replace(/\s+/g, '')}`;
        
        card.innerHTML = `
            <div class="idea-card-header">
                <span class="badge ${categoryClass}">${idea.category}</span>
                <span class="idea-card-client"><i class="fas fa-user-tie"></i> ${clientName}</span>
            </div>
            
            <h4 class="idea-card-title">${idea.name}</h4>
            
            <p class="idea-card-desc">${idea.description}</p>
            
            <div class="idea-card-footer">
                <span class="idea-card-date"><i class="far fa-calendar-alt"></i> ${idea.dateAdded}</span>
                <div class="idea-card-actions">
                    ${shiftLeftHtml}
                    <button class="btn-card-move edit" data-id="${idea.id}" title="Modifica Idea"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-card-move delete" data-id="${idea.id}" title="Rimuovi"><i class="fas fa-trash-alt"></i></button>
                    ${shiftRightHtml}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function getRelationshipLabel(relationship) {
    const match = RELATIONSHIP_OPTIONS.find(opt => opt.value === relationship);
    return match ? match.label : relationship;
}


// ==========================================================================
// SEZIONE 5: CLIENTI FREDDI
// ==========================================================================
function getColdClientColumnLabel(columnId) {
    const labels = {
        name: 'Nome Cliente',
        owner: 'Owner',
        rev2026: 'Fatturato 2026',
        action: 'Azione',
        actionDate: 'Data Azione',
        contacts: 'Contatti',
        actions: 'Azioni'
    };
    return labels[columnId] || columnId;
}

function buildColdClientTableCellHtml(client, columnId) {
    switch (columnId) {
        case 'name':
            return buildClientNameCellHtml(client);
        case 'owner': {
            const ownerCellClass = getOwnerCellClass(client.owner);
            return `<td class="cell-owner">
                <div class="table-cell-chip ${ownerCellClass}">
                    <select class="table-cell-select" data-id="${client.id}" data-action="change-owner">
                        <option value="Jeck" ${client.owner === 'Jeck' ? 'selected' : ''}>Jeck</option>
                        <option value="Virgi" ${client.owner === 'Virgi' ? 'selected' : ''}>Virgi</option>
                    </select>
                </div>
            </td>`;
        }
        case 'rev2026':
            return `<td style="text-align:right" class="col-fatturato cell-editable ${client.rev2026 > 0 ? '' : 'empty'}" data-id="${client.id}" data-field="rev2026">${formatCurrency(client.rev2026)}</td>`;
        case 'action':
            return `<td class="col-azione cell-editable" data-id="${client.id}" data-field="action" title="Doppio clic per modificare">${escapeHtml(client.action || '-')}</td>`;
        case 'actionDate': {
            const isDateStale = isActionDateStale(client.actionDate);
            const dateContent = isDateStale && client.actionDate
                ? `<span class="table-cell-chip cell-date-stale">${client.actionDate}</span>`
                : (client.actionDate ? client.actionDate : '-');
            return `<td class="col-data-azione">${dateContent}</td>`;
        }
        case 'email':
        case 'description':
        case 'contacts':
            return buildContactsSummaryCellHtml(client);
        case 'actions':
            return `<td class="col-actions">
                <div class="table-row-actions">
                    <button class="btn-table-action apollo" data-id="${client.id}" title="Arricchisci con Apollo"><i data-lucide="sparkles"></i></button>
                    <button class="btn-table-action edit" data-id="${client.id}" title="Modifica Completa"><i data-lucide="edit"></i></button>
                    <button class="btn-table-action delete" data-id="${client.id}" title="Elimina"><i data-lucide="trash-2"></i></button>
                </div>
            </td>`;
        default:
            return '<td></td>';
    }
}

function renderColdClientsSection() {
    if (!coldClientsAccordion) return;
    const query = searchColdClientsInput ? searchColdClientsInput.value.toLowerCase().trim() : '';
    const coldClients = clients.filter(client => {
        if (!isClientInColdSection(client)) return false;
        if (!query) return true;
        return client.name.toLowerCase().includes(query) ||
            getClientContactsSearchText(client).includes(query);
    });
    const totalBadge = document.getElementById('cold-clients-total-badge');
    if (totalBadge) totalBadge.textContent = `${coldClients.length} clienti freddi`;
    coldClientsAccordion.innerHTML = COLD_CLIENT_CATEGORIES.map(category => {
        const categoryClients = coldClients
            .filter(client => client.type === category.type)
            .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
        const isExpanded = coldCategoryExpanded.has(category.id);
        const tableHead = COLD_TABLE_COLUMNS.map(columnId =>
            `<th>${getColdClientColumnLabel(columnId)}</th>`
        ).join('');
        const tableBody = categoryClients.length === 0
            ? `<tr><td colspan="${COLD_TABLE_COLUMNS.length}" class="cold-empty-row">Nessun cliente freddo in questa categoria.</td></tr>`
            : categoryClients.map(client => {
                const rowClass = shouldHighlightIncompleteClient(client) ? 'client-row-incomplete' : '';
                const expandClass = expandedClientContacts.has(client.id) ? ' is-row-expanded' : '';
                const mainRow = `<tr class="client-row client-row-expandable${expandClass} ${rowClass}" data-id="${client.id}">${COLD_TABLE_COLUMNS.map(columnId => buildColdClientTableCellHtml(client, columnId)).join('')}</tr>`;
                const detailRow = expandedClientContacts.has(client.id)
                    ? buildContactsDetailRowHtml(client, COLD_TABLE_COLUMNS.length)
                    : '';
                return mainRow + detailRow;
            }).join('');
        return `
            <div class="cold-category ${isExpanded ? 'is-expanded' : ''}" data-category-id="${category.id}">
                <div class="cold-category-header">
                    <button type="button" class="cold-category-toggle" data-action="toggle-cold-category" data-category-id="${category.id}" aria-expanded="${isExpanded}">
                        <i data-lucide="chevron-right" class="cold-category-chevron"></i>
                        <div class="cold-category-title-wrap">
                            <h3>${category.label}</h3>
                            <span class="cold-category-type-hint">${category.type}</span>
                        </div>
                        <span class="badge cold-category-count">${categoryClients.length}</span>
                    </button>
                    <button type="button" class="btn btn-secondary btn-cold-category-add" data-action="add-cold-client" data-client-type="${category.type}" title="Aggiungi in ${category.label}">
                        <i data-lucide="plus"></i>
                    </button>
                </div>
                <div class="cold-category-body" ${isExpanded ? '' : 'hidden'}>
                    <div class="table-container cold-table-container">
                        <table class="crm-table cold-clients-table">
                            <thead><tr>${tableHead}</tr></thead>
                            <tbody>${tableBody}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    safeCreateIcons();
}

// ==========================================================================
// TASK PER CLIENTE
// ==========================================================================
function createUniqueTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function loadTasksState() {
    try {
        const storedTasks = localStorage.getItem(CLIENT_TASKS_KEY);
        if (storedTasks) clientTasks = JSON.parse(storedTasks);
    } catch (error) {
        console.warn('Task localStorage non valida', error);
        clientTasks = [];
    }
    if (typeof CrmSupabase !== 'undefined' && CrmSupabase.isEnabled()) {
        try {
            clientTasks = await CrmSupabase.fetchClientTasks();
            localStorage.setItem(CLIENT_TASKS_KEY, JSON.stringify(clientTasks));
        } catch (error) {
            console.warn('Caricamento task Supabase fallito', error);
        }
    }
}

async function persistTasksState() {
    localStorage.setItem(CLIENT_TASKS_KEY, JSON.stringify(clientTasks));
    if (typeof CrmSupabase !== 'undefined' && CrmSupabase.isEnabled()) {
        await CrmSupabase.persistClientTasks(clientTasks);
        isSupabaseConnected = true;
        updateSupabaseStatusUI();
    }
}

function ensureTaskClientSelection() {
    const isValid = selectedTaskClientId && clients.some((c) => c.id === selectedTaskClientId && c.relationship !== 'Eliminato');
    if (isValid) return;
    const sortedClients = clients
        .filter((c) => c.relationship !== 'Eliminato')
        .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
    selectedTaskClientId = sortedClients[0]?.id || '';
}

function renderTasksSection() {
    if (!tasksLayout || typeof CrmTasks === 'undefined') return;
    ensureTaskClientSelection();
    CrmTasks.renderSection(tasksLayout, {
        clients,
        tasks: clientTasks,
        selectedClientId: selectedTaskClientId,
        taskFilter,
        clientSearchQuery: tasksClientSearch,
        escapeHtml
    });
}

function populateTaskFormSelects() {
    const typeSelect = document.getElementById('form-task-type');
    const assigneeSelect = document.getElementById('form-task-assignee');
    if (typeSelect && typeof CrmTasks !== 'undefined') {
        typeSelect.innerHTML = CrmTasks.TASK_TYPES.map((type) => `<option value="${type.id}">${type.label}</option>`).join('');
    }
    if (assigneeSelect && typeof CrmTasks !== 'undefined') {
        assigneeSelect.innerHTML = CrmTasks.ASSIGNEES.map((name) => `<option value="${name}">${name}</option>`).join('');
    }
}

function openTaskDrawer(isEdit = false, taskObj = null) {
    if (!taskDrawer || !taskForm) return;
    if (!selectedTaskClientId) {
        showToast('Seleziona prima un cliente.', 'warning');
        return;
    }
    taskForm.reset();
    populateTaskFormSelects();
    document.getElementById('form-task-id').value = '';
    document.getElementById('form-task-client-id').value = selectedTaskClientId;
    if (isEdit && taskObj) {
        taskDrawerTitle.innerHTML = '<i data-lucide="check-square" style="color: var(--primary)"></i> Modifica Task';
        document.getElementById('form-task-id').value = taskObj.id;
        document.getElementById('form-task-client-id').value = taskObj.clientId;
        document.getElementById('form-task-title').value = taskObj.title;
        document.getElementById('form-task-type').value = taskObj.taskType || 'follow-up';
        document.getElementById('form-task-assignee').value = taskObj.assignee || 'Jeck';
        document.getElementById('form-task-due-date').value = taskObj.dueDate || '';
        document.getElementById('form-task-notes').value = taskObj.notes || '';
    } else {
        taskDrawerTitle.innerHTML = '<i data-lucide="check-square" style="color: var(--primary)"></i> Nuova Task';
        document.getElementById('form-task-type').value = 'follow-up';
        document.getElementById('form-task-assignee').value = 'Jeck';
    }
    safeCreateIcons();
    resetDrawerBodyScroll(taskDrawer);
    taskDrawer.classList.add('open');
    drawerOverlay.classList.add('open');
    setDrawerOpenState(true);
}

function closeTaskDrawer() {
    if (!taskDrawer) return;
    taskDrawer.classList.remove('open');
    const hasOtherDrawerOpen = (clientDrawer && clientDrawer.classList.contains('open'))
        || (ideaDrawer && ideaDrawer.classList.contains('open'));
    if (!hasOtherDrawerOpen && drawerOverlay) {
        drawerOverlay.classList.remove('open');
    }
    updateAnyDrawerOpenState();
}

async function saveTaskFromForm(event) {
    event.preventDefault();
    const taskId = document.getElementById('form-task-id').value;
    const clientId = document.getElementById('form-task-client-id').value;
    const title = document.getElementById('form-task-title').value.trim();
    const taskType = document.getElementById('form-task-type').value;
    const assignee = document.getElementById('form-task-assignee').value;
    const dueDate = document.getElementById('form-task-due-date').value;
    const notes = document.getElementById('form-task-notes').value.trim();
    if (!title || !clientId) {
        showToast('Compila il titolo della task.', 'danger');
        return;
    }
    if (taskId) {
        const existing = clientTasks.find((t) => t.id === taskId);
        if (existing) {
            existing.title = title;
            existing.taskType = taskType;
            existing.assignee = assignee;
            existing.dueDate = dueDate;
            existing.notes = notes;
        }
    } else {
        clientTasks.push({
            id: createUniqueTaskId(),
            clientId,
            title,
            taskType,
            assignee,
            dueDate,
            notes,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: ''
        });
    }
    try {
        await persistTasksState();
        renderTasksSection();
        closeTaskDrawer();
        showToast(taskId ? 'Task aggiornata.' : 'Task creata.', 'success');
    } catch (error) {
        console.error('Salvataggio task fallito:', error);
        showToast(`Errore salvataggio task: ${error.message}`, 'danger');
    }
}

async function toggleTaskCompleted(taskId, completed) {
    const task = clientTasks.find((t) => t.id === taskId);
    if (!task) return;
    task.completed = completed;
    task.completedAt = completed ? new Date().toISOString() : '';
    try {
        await persistTasksState();
        renderTasksSection();
    } catch (error) {
        console.error('Aggiornamento task fallito:', error);
        showToast(`Errore aggiornamento task: ${error.message}`, 'danger');
    }
}

async function deleteTaskById(taskId) {
    const task = clientTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (!window.confirm(`Eliminare la task "${task.title}"?`)) return;
    clientTasks = clientTasks.filter((t) => t.id !== taskId);
    try {
        await persistTasksState();
        renderTasksSection();
        showToast('Task eliminata.', 'warning');
    } catch (error) {
        console.error('Eliminazione task fallita:', error);
        showToast(`Errore eliminazione task: ${error.message}`, 'danger');
    }
}

function bindTasksEventListeners() {
    if (!tasksLayout || tasksLayout.dataset.bound === '1') return;
    tasksLayout.dataset.bound = '1';
    tasksLayout.addEventListener('click', (event) => {
        const clientBtn = event.target.closest('[data-action="select-task-client"]');
        if (clientBtn) {
            selectedTaskClientId = clientBtn.getAttribute('data-client-id') || '';
            renderTasksSection();
            return;
        }
        const filterBtn = event.target.closest('[data-action="set-task-filter"]');
        if (filterBtn) {
            taskFilter = filterBtn.getAttribute('data-filter') || 'all';
            renderTasksSection();
            return;
        }
        const addBtn = event.target.closest('#btn-add-task');
        if (addBtn) {
            openTaskDrawer(false);
            return;
        }
        const editBtn = event.target.closest('[data-action="edit-task"]');
        if (editBtn) {
            const task = clientTasks.find((t) => t.id === editBtn.getAttribute('data-task-id'));
            if (task) openTaskDrawer(true, task);
            return;
        }
        const deleteBtn = event.target.closest('[data-action="delete-task"]');
        if (deleteBtn) {
            deleteTaskById(deleteBtn.getAttribute('data-task-id'));
        }
    });
    tasksLayout.addEventListener('change', (event) => {
        const checkbox = event.target.closest('[data-action="toggle-task"]');
        if (!checkbox) return;
        toggleTaskCompleted(checkbox.getAttribute('data-task-id'), checkbox.checked);
    });
    tasksLayout.addEventListener('input', (event) => {
        if (event.target.id !== 'tasks-client-search') return;
        tasksClientSearch = event.target.value;
        const list = document.getElementById('tasks-client-list');
        if (!list || typeof CrmTasks === 'undefined') return;
        list.innerHTML = CrmTasks.buildClientSidebarHtml(
            clients,
            clientTasks,
            selectedTaskClientId,
            tasksClientSearch,
            escapeHtml
        );
        safeCreateIcons();
    });
}

// ==========================================================================
// ANALISI — OKR, PREVISIONI, QUARTER
// ==========================================================================
async function loadAnalysisState() {
    if (typeof CrmAnalysis !== 'undefined') {
        analysisForecasts = CrmAnalysis.createDefaultForecasts();
    }
    try {
        const storedForecasts = localStorage.getItem(ANALYSIS_FORECASTS_KEY);
        if (storedForecasts) {
            const parsed = JSON.parse(storedForecasts);
            Object.keys(parsed).forEach((scope) => {
                analysisForecasts[scope] = { ...analysisForecasts[scope], ...parsed[scope] };
            });
        }
        const storedOkr = localStorage.getItem(ANALYSIS_OKR_KEY);
        if (storedOkr) okrRecords = JSON.parse(storedOkr);
        const storedExpanded = localStorage.getItem(ANALYSIS_EXPANDED_KEY);
        if (storedExpanded) analysisExpanded = new Set(JSON.parse(storedExpanded));
    } catch (error) {
        console.warn('Analisi localStorage non valida', error);
    }
    if (typeof CrmSupabase !== 'undefined' && CrmSupabase.isEnabled()) {
        try {
            okrRecords = await CrmSupabase.fetchOkrRecords(CrmAnalysis.ANALYSIS_YEAR);
            const rows = await CrmSupabase.fetchAnalysisForecasts();
            rows.forEach((row) => {
                analysisForecasts[row.scope] = {
                    totalForecast: Number(row.total_forecast) || 0,
                    productPct: row.product_forecast_pct || {}
                };
            });
            localStorage.setItem(ANALYSIS_OKR_KEY, JSON.stringify(okrRecords));
            localStorage.setItem(ANALYSIS_FORECASTS_KEY, JSON.stringify(analysisForecasts));
        } catch (error) {
            console.warn('Caricamento analisi Supabase fallito', error);
        }
    }
}

async function persistAnalysisState() {
    localStorage.setItem(ANALYSIS_FORECASTS_KEY, JSON.stringify(analysisForecasts));
    localStorage.setItem(ANALYSIS_OKR_KEY, JSON.stringify(okrRecords));
    localStorage.setItem(ANALYSIS_EXPANDED_KEY, JSON.stringify([...analysisExpanded]));
    if (typeof CrmSupabase !== 'undefined' && CrmSupabase.isEnabled()) {
        await CrmSupabase.persistOkrRecords(okrRecords, CrmAnalysis.ANALYSIS_YEAR);
        const rows = Object.keys(analysisForecasts).map((scope) => ({
            scope,
            year: CrmAnalysis.ANALYSIS_YEAR,
            total_forecast: Number(analysisForecasts[scope].totalForecast) || 0,
            product_forecast_pct: analysisForecasts[scope].productPct || {}
        }));
        await CrmSupabase.persistAnalysisForecasts(rows);
    }
}

function renderAnalysisSection() {
    if (!analysisDashboard || typeof CrmAnalysis === 'undefined') return;
    CrmAnalysis.renderDashboard(analysisDashboard, {
        okrRecords,
        analysisForecasts,
        analysisExpanded,
        clients
    });
}

function bindAnalysisEventListeners() {
    if (!analysisDashboard || analysisDashboard.dataset.bound === '1') return;
    analysisDashboard.dataset.bound = '1';
    analysisDashboard.addEventListener('click', (e) => {
        const toggle = e.target.closest('[data-action="toggle-analysis-scope"]');
        if (!toggle) return;
        const scope = toggle.getAttribute('data-scope');
        if (analysisExpanded.has(scope)) analysisExpanded.delete(scope);
        else analysisExpanded.add(scope);
        localStorage.setItem(ANALYSIS_EXPANDED_KEY, JSON.stringify([...analysisExpanded]));
        renderAnalysisSection();
    });
    analysisDashboard.addEventListener('change', (e) => {
        const totalInput = e.target.closest('.analysis-forecast-input');
        const pctInput = e.target.closest('.analysis-pct-input');
        if (totalInput) {
            const scope = totalInput.getAttribute('data-scope');
            if (!analysisForecasts[scope]) return;
            analysisForecasts[scope].totalForecast = parseFloat(totalInput.value) || 0;
            persistAnalysisState().then(() => renderAnalysisSection()).catch(console.error);
            return;
        }
        if (pctInput) {
            const scope = pctInput.getAttribute('data-scope');
            const product = pctInput.getAttribute('data-product');
            if (!analysisForecasts[scope]) return;
            if (!analysisForecasts[scope].productPct) analysisForecasts[scope].productPct = {};
            analysisForecasts[scope].productPct[product] = parseFloat(pctInput.value) || 0;
            persistAnalysisState().then(() => renderAnalysisSection()).catch(console.error);
        }
    });
}

function updateDashboardUI() {
    const okrTotal = okrRecords.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
  const clientTotal = clients.filter((c) => c.relationship !== 'Eliminato').reduce((acc, c) => acc + (Number(c.rev2026) || 0), 0);
    const displayTotal = okrTotal > 0 ? okrTotal : clientTotal;
    if (headerTotalRevenue) headerTotalRevenue.textContent = formatCurrency(displayTotal);
    renderAnalysisSection();
}

function buildOkrRecordsFromExcel(headers, clientColIndex, revColIndex, productColIndex, monthColIndex, projectColIndex, ownerColIndex) {
    const records = [];
    for (let i = 1; i < rawExcelData.length; i++) {
        const row = rawExcelData[i];
        if (!row || row.length === 0) continue;
        let clientName = row[clientColIndex];
        if (!clientName) continue;
        clientName = clientName.toString().trim().replace(/\s+/g, ' ');
        const revenueRaw = getExcelCellValue(i, revColIndex);
        if (revenueRaw === null || revenueRaw === undefined || revenueRaw === '') continue;
        const amount = parseExcelImporto(revenueRaw);
        const productRaw = productColIndex >= 0 ? row[productColIndex] : '';
        const monthRaw = monthColIndex >= 0 ? row[monthColIndex] : '';
        const projectRaw = projectColIndex >= 0 ? row[projectColIndex] : '';
        const ownerRaw = ownerColIndex >= 0 ? row[ownerColIndex] : '';
        const productType = CrmAnalysis.normalizeProductType(productRaw);
        const quarter = CrmAnalysis.parseQuarterFromMonth(monthRaw);
        const matchedClient = clients.find((c) => c.name.trim().toLowerCase() === clientName.toLowerCase());
        records.push({
            id: `okr-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            clientName,
            clientId: matchedClient ? matchedClient.id : '',
            productType,
            amount,
            monthLabel: monthRaw ? String(monthRaw) : '',
            quarter,
            projectCode: projectRaw ? String(projectRaw) : '',
            owner: ownerRaw ? String(ownerRaw) : '',
            year: CrmAnalysis.ANALYSIS_YEAR
        });
    }
    return records;
}

// ==========================================================================
// TOAST ALERT SYSTEM
// ==========================================================================
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-check-circle';
    if (type === 'danger') iconClass = 'fa-exclamation-circle';
    if (type === 'warning') iconClass = 'fa-exclamation-triangle';
    if (type === 'info') iconClass = 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <span>${msg}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 50);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}
