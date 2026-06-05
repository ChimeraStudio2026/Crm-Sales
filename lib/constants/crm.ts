import type { ClientOrigin, ClientType, IdeaCategory, Owner, Relationship } from '@/lib/types/crm';

export const ANALYSIS_YEAR = 2026;
export const PREVIOUS_ANALYSIS_YEAR = ANALYSIS_YEAR - 1;
export const SUPPORTED_IMPORT_YEARS = [PREVIOUS_ANALYSIS_YEAR, ANALYSIS_YEAR] as const;
export const COLD_CLIENT_REV_THRESHOLD = 1;
export const RECURRENT_REV_2025_THRESHOLD = 15000;
export const EXCEL_REV_EPSILON = 0.005;

export const OWNERS: Owner[] = ['Jeck', 'Virgi', 'Martina'];

export const OWNER_ZOD_ENUM = ['Jeck', 'Virgi', 'Martina'] as const satisfies readonly Owner[];

export function isOwner(value: unknown): value is Owner {
  return typeof value === 'string' && OWNERS.includes(value as Owner);
}

export const CLIENT_TYPES: ClientType[] = [
  'Cliente Diretto',
  'Agenzia',
  'Agenzia PR',
  'CDP',
  'Agenzia Eventi',
];

export const CLIENT_ORIGINS: ClientOrigin[] = [
  'Jeck',
  'Inbound',
  'Instagram',
  'Community',
  'Outbound',
];

export const CLIENT_ORIGIN_CHIP_CLASSES: Record<ClientOrigin, string> = {
  Jeck: 'cell-origin-jeck',
  Inbound: 'cell-origin-inbound',
  Instagram: 'cell-origin-instagram',
  Community: 'cell-origin-community',
  Outbound: 'cell-origin-outbound',
};

export const RELATIONSHIPS: Relationship[] = [
  'Nuovo Cliente',
  'Ricorrente',
  'Top 20%',
  'Perso',
  'Eliminato',
];

export const IDEA_CATEGORIES: IdeaCategory[] = [
  'Content',
  'Mini prod',
  'Evento',
  'Prod',
];

export const RECALL_QUOTAS = [
  {
    relationship: 'Top 20%' as Relationship,
    count: 1,
    slotLabel: '⭐⭐⭐ Top 20%',
    slotClass: 'recall-slot-top20',
  },
  {
    relationship: 'Ricorrente' as Relationship,
    count: 2,
    slotLabel: '⭐⭐ Ricorrente',
    slotClass: 'recall-slot-ricorrente',
  },
  {
    relationship: 'Nuovo Cliente' as Relationship,
    count: 2,
    slotLabel: '⭐ Nuovo Cliente',
    slotClass: 'recall-slot-nuovo',
  },
];

export const RECALL_TOTAL_COUNT = RECALL_QUOTAS.reduce(
  (sum, quota) => sum + quota.count,
  0,
);

export const RECALL_STATUS_TODO = 'To do';
export const RECALL_STATUS_DONE = 'Done';

export const COLD_CLIENT_CATEGORIES = [
  { id: 'agenzia', label: 'Agenzie', type: 'Agenzia' as ClientType },
  { id: 'agenzia-eventi', label: 'Agenzie Eventi', type: 'Agenzia Eventi' as ClientType },
  { id: 'cdp', label: 'CDP', type: 'CDP' as ClientType },
  { id: 'agenzia-pr', label: 'Agenzie Pr', type: 'Agenzia PR' as ClientType },
  { id: 'cliente-diretto', label: 'Cliente diretto', type: 'Cliente Diretto' as ClientType },
];

export const CRM_TABLE_COLUMN_DEFS = {
  name: { label: 'Nome Cliente', sortKey: 'name', align: 'left' as const, defaultWidth: 170, minWidth: 120, expandedWidth: 280 },
  type: { label: 'Tipologia', sortKey: 'type', align: 'left' as const, defaultWidth: 155, minWidth: 130, expandedWidth: 200 },
  owner: { label: 'Owner', sortKey: 'owner', align: 'left' as const, defaultWidth: 120, minWidth: 100, expandedWidth: 160 },
  clientOrigin: { label: 'Origine Cliente', sortKey: 'clientOrigin', align: 'left' as const, defaultWidth: 150, minWidth: 130, expandedWidth: 190 },
  relationship: { label: 'Rapporto', sortKey: 'relationship', align: 'left' as const, defaultWidth: 160, minWidth: 130, expandedWidth: 220 },
  rev2026: { label: 'Fatturato 2026', sortKey: 'rev2026', align: 'right' as const, defaultWidth: 130, minWidth: 110, expandedWidth: 150 },
  rev2025: { label: 'Fatturato 2025', sortKey: 'rev2025', align: 'right' as const, defaultWidth: 130, minWidth: 110, expandedWidth: 150 },
  action: { label: 'Azione', sortKey: 'action', align: 'left' as const, defaultWidth: 160, minWidth: 120, expandedWidth: 340 },
  actionDate: { label: 'Data Azione', sortKey: 'actionDate', align: 'left' as const, defaultWidth: 120, minWidth: 100, expandedWidth: 140 },
  contacts: { label: 'Contatti', sortKey: null, align: 'left' as const, defaultWidth: 150, minWidth: 120, expandedWidth: 220, noSort: true },
  actions: { label: 'Azioni', sortKey: null, align: 'center' as const, defaultWidth: 100, minWidth: 90, noExpand: true, noSort: true },
};

export const MAIN_TABLE_HIDDEN_COLUMNS = new Set(['contacts', 'action']);

export const DEFAULT_TABLE_COLUMN_ORDER = Object.keys(CRM_TABLE_COLUMN_DEFS).filter(
  (columnId) => !MAIN_TABLE_HIDDEN_COLUMNS.has(columnId),
);

export const COLD_TABLE_COLUMN_ORDER = DEFAULT_TABLE_COLUMN_ORDER.filter(
  (columnId) => columnId !== 'relationship',
);

export const ACTION_DATE_STALE_DAYS = 10;
export const DEFAULT_ACTION_DATE = '2026-01-01';
export const EXCEL_IMPORT_ACTION_PREFIX = 'Import Excel';
export const EXCEL_IMPORT_DESC_PREFIX = 'Cliente creato da import Excel';

export const NAV_ITEMS = [
  { href: '/analysis', label: 'Analisi', icon: 'BarChart3' },
  { href: '/clients', label: 'Lista Clienti', icon: 'Users' },
  { href: '/ideas', label: 'Task & Idee', icon: 'Lightbulb' },
  { href: '/recall', label: 'Random Recall', icon: 'PhoneCall' },
  { href: '/cold', label: 'Clienti Freddi', icon: 'Snowflake' },
  { href: '/import', label: 'Importa Excel', icon: 'FileSpreadsheet' },
  { href: '/settings', label: 'Impostazioni', icon: 'Settings' },
] as const;

export const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/analysis': { title: 'Analisi', subtitle: 'OKR, previsioni e breakdown per quarter.' },
  '/clients': { title: 'Gestione Clienti', subtitle: 'Lista generica e schede clienti.' },
  '/ideas': { title: 'Task & Idee', subtitle: 'Kanban unificato per idee commerciali e task con deadline e owner.' },
  '/tasks': { title: 'Task & Idee', subtitle: 'Kanban unificato per idee commerciali e task con deadline e owner.' },
  '/recall': { title: 'Random Recall', subtitle: '5 clienti al giorno da ricontattare, scelti a caso per rapporto.' },
  '/cold': { title: 'Clienti Freddi', subtitle: 'Prospect con cui non hai mai lavorato. I clienti importati da OKR restano in Lista Clienti.' },
  '/import': { title: 'Importazione Dati', subtitle: 'Carica fatturati 2025 o 2026 da foglio di calcolo.' },
  '/settings': { title: 'Impostazioni', subtitle: 'Manutenzione database e regole.' },
};
