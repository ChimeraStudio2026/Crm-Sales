import {
  CHIMERA_OWNERS,
  isOwnerValue,
  normalizeOwner,
  OWNER_JECK_SCARDY,
  OWNER_MARTINA_GAVAZZI,
  OWNER_MARTINO,
  OWNER_VIRGINIA_VELCICH,
} from '@/lib/crm/owners';
import type { ClientOrigin, ClientType, IdeaCategory, Owner, Relationship } from '@/lib/types/crm';

export const ANALYSIS_YEAR = 2026;
export const PREVIOUS_ANALYSIS_YEAR = ANALYSIS_YEAR - 1;
export const ANALYSIS_YEARS = [2023, 2024, 2025, 2026] as const;
export const SUPPORTED_IMPORT_YEARS = [...ANALYSIS_YEARS] as const;

export function isAnalysisYear(year: number): boolean {
  return ANALYSIS_YEARS.includes(year as (typeof ANALYSIS_YEARS)[number]);
}
export const COLD_CLIENT_REV_THRESHOLD = 1;
export const TOP_20_REV_THRESHOLD = 30000;
export const RECURRENT_REV_THRESHOLD = 10000;
export const EXCEL_REV_EPSILON = 0.005;

export const OWNERS: Owner[] = [...CHIMERA_OWNERS];

export const OWNER_ZOD_ENUM = [
  OWNER_VIRGINIA_VELCICH,
  OWNER_JECK_SCARDY,
  OWNER_MARTINA_GAVAZZI,
  OWNER_MARTINO,
] as const satisfies readonly Owner[];

export function isOwner(value: unknown): value is Owner {
  return isOwnerValue(value);
}

export function resolveOwnerFromEmail(email: string | null | undefined): Owner | null {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  if (normalizedEmail.includes('martino.ilacqua')) return OWNER_MARTINO;
  if (normalizedEmail.includes('velcich')) return OWNER_VIRGINIA_VELCICH;
  if (normalizedEmail.includes('martina.gavazzi')) return OWNER_MARTINA_GAVAZZI;
  if (normalizedEmail.includes('jeck')) return OWNER_JECK_SCARDY;
  return null;
}

export { normalizeOwner };

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
  Martino: 'cell-origin-martino',
};

export const RELATIONSHIPS: Relationship[] = [
  'Freddo',
  'Nuovo Cliente',
  'Ricorrente',
  'Top 20%',
  'Da recuperare',
  'Eliminato',
];

export const IDEA_CATEGORIES: IdeaCategory[] = [
  'Content',
  'Mini prod',
  'Evento',
  'Prod',
];

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
  rev2023: { label: 'Fatturato 2023', sortKey: 'rev2023', align: 'right' as const, defaultWidth: 130, minWidth: 110, expandedWidth: 150 },
  rev2024: { label: 'Fatturato 2024', sortKey: 'rev2024', align: 'right' as const, defaultWidth: 130, minWidth: 110, expandedWidth: 150 },
  rev2025: { label: 'Fatturato 2025', sortKey: 'rev2025', align: 'right' as const, defaultWidth: 130, minWidth: 110, expandedWidth: 150 },
  rev2026: { label: 'Fatturato 2026', sortKey: 'rev2026', align: 'right' as const, defaultWidth: 130, minWidth: 110, expandedWidth: 150 },
  action: { label: 'Azione', sortKey: 'action', align: 'left' as const, defaultWidth: 160, minWidth: 120, expandedWidth: 340 },
  actionDate: { label: 'Data Azione', sortKey: 'actionDate', align: 'left' as const, defaultWidth: 120, minWidth: 100, expandedWidth: 140 },
  contacts: { label: 'Contatti', sortKey: null, align: 'left' as const, defaultWidth: 150, minWidth: 120, expandedWidth: 220, noSort: true },
  actions: { label: 'Azioni', sortKey: null, align: 'center' as const, defaultWidth: 100, minWidth: 90, noExpand: true, noSort: true },
};

export const MAIN_TABLE_HIDDEN_COLUMNS = new Set(['contacts', 'action', 'actionDate', 'rev2023', 'rev2024']);

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
  { href: '/proposte', label: 'Proposte', icon: 'FileText' },
  { href: '/clients', label: 'Lista Clienti', icon: 'Users' },
  { href: '/funnel', label: 'Funnel Commerciale', icon: 'GitBranch' },
  { href: '/propositivita', label: 'Propositività', icon: 'Sparkles' },
  { href: '/import', label: 'Importa Excel', icon: 'FileSpreadsheet' },
  { href: '/settings', label: 'Impostazioni', icon: 'Settings' },
] as const;

export const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/analysis': { title: 'Analisi', subtitle: 'OKR, previsioni e breakdown per quarter.' },
  '/proposte': { title: 'Proposte', subtitle: 'Preventivi commerciali: KPI, ticket medio e clienti per categoria.' },
  '/clients': {
    title: 'Gestione Clienti',
    subtitle: 'Clienti attivi e prospect freddi nella stessa lista. Usa Rapporto «Freddo» per i contatti cold.',
  },
  '/funnel': { title: 'Funnel Commerciale', subtitle: 'Campagne commerciali con pipeline clienti, azioni, status e semaforo tempi.' },
  '/propositivita': { title: 'Propositività', subtitle: 'Creatività proposte ai clienti e sconti/extra concessi.' },
  '/import': { title: 'Importazione Dati', subtitle: 'Carica fatturati 2023–2026 da foglio di calcolo.' },
  '/settings': { title: 'Impostazioni', subtitle: 'Manutenzione database e regole.' },
  '/account': { title: 'Il mio account', subtitle: 'Profilo e password di accesso al CRM.' },
  '/campaigns': { title: 'Campagne mail', subtitle: 'Sequenze mail, contatti e stato degli invii.' },
};

/** Meta for a path, falling back to its section (e.g. /funnel/abc → /funnel). */
export function resolvePageMeta(pathname: string): { title: string; subtitle: string } {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  const section = `/${pathname.split('/')[1] || ''}`;
  return PAGE_META[section] || PAGE_META['/analysis'];
}
