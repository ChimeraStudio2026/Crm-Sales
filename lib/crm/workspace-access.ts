import { NAV_ITEMS, resolveOwnerFromEmail } from '@/lib/constants/crm';
import {
  DEFAULT_WORKSPACE_ID,
  TINYTOAST_WORKSPACE_ID,
  type WorkspaceId,
} from '@/lib/constants/workspaces';
import { normalizeOwner } from '@/lib/crm/owners';
import type { Owner } from '@/lib/types/crm';

/** personal = vede tutti i clienti, ma nelle altre sezioni solo le cose di cui è owner. */
export type WorkspaceNavMode = 'full' | 'tinytoast' | 'personal';

export interface WorkspaceAccess {
  navMode: WorkspaceNavMode;
  canSwitchWorkspace: boolean;
  workspaceId: WorkspaceId;
  homePath: string;
  /** In modalità personal: l'owner a cui sono limitati funnel, reminder, proposte e propositività. */
  scopeOwner: Owner | null;
}

const TINYTOAST_EMAIL_PATTERNS = [
  'tinytoast',
] as const;

const CHIMERA_ONLY_EMAIL_PATTERNS = [
  'velcich',
] as const;

const PERSONAL_EMAIL_PATTERNS = [
  'federica.santocchia',
] as const;

const TINYTOAST_ALLOWED_PATH_PREFIXES = [
  '/funnel',
  '/clients',
  '/account',
] as const;

const TINYTOAST_NAV_HREFS = new Set<string>([
  '/funnel',
  '/clients',
]);

// Niente Analisi, Import, Impostazioni né vecchie campagne mail: sono dati di tutto il team.
const PERSONAL_ALLOWED_PATH_PREFIXES = [
  '/clients',
  '/cold',
  '/funnel',
  '/reminder',
  '/proposte',
  '/propositivita',
  '/account',
] as const;

const PERSONAL_NAV_HREFS = new Set<string>(PERSONAL_ALLOWED_PATH_PREFIXES);

function matchesPathPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isTinytoastUserEmail(email: string | null | undefined): boolean {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;
  return TINYTOAST_EMAIL_PATTERNS.some((pattern) => normalizedEmail.includes(pattern));
}

export function isChimeraOnlyUserEmail(email: string | null | undefined): boolean {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;
  return CHIMERA_ONLY_EMAIL_PATTERNS.some((pattern) => normalizedEmail.includes(pattern));
}

export function isPersonalUserEmail(email: string | null | undefined): boolean {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;
  return PERSONAL_EMAIL_PATTERNS.some((pattern) => normalizedEmail.includes(pattern));
}

export function resolveWorkspaceAccess(email: string | null | undefined): WorkspaceAccess {
  if (isTinytoastUserEmail(email)) {
    return {
      navMode: 'tinytoast',
      canSwitchWorkspace: false,
      workspaceId: TINYTOAST_WORKSPACE_ID,
      homePath: '/funnel',
      scopeOwner: null,
    };
  }
  const personalOwner = isPersonalUserEmail(email) ? resolveOwnerFromEmail(email) : null;
  if (personalOwner) {
    return {
      navMode: 'personal',
      canSwitchWorkspace: false,
      workspaceId: DEFAULT_WORKSPACE_ID,
      homePath: '/clients',
      scopeOwner: personalOwner,
    };
  }
  if (isChimeraOnlyUserEmail(email)) {
    return {
      navMode: 'full',
      canSwitchWorkspace: false,
      workspaceId: DEFAULT_WORKSPACE_ID,
      homePath: '/analysis',
      scopeOwner: null,
    };
  }
  return {
    navMode: 'full',
    canSwitchWorkspace: true,
    workspaceId: DEFAULT_WORKSPACE_ID,
    homePath: '/analysis',
    scopeOwner: null,
  };
}

export function isPathAllowedForTinytoast(pathname: string): boolean {
  return matchesPathPrefix(pathname, TINYTOAST_ALLOWED_PATH_PREFIXES);
}

/** Le pagine che un accesso può aprire (gli altri vengono rimandati alla home). */
export function isPathAllowedForAccess(access: Pick<WorkspaceAccess, 'navMode'>, pathname: string): boolean {
  if (access.navMode === 'tinytoast') return isPathAllowedForTinytoast(pathname);
  if (access.navMode === 'personal') return matchesPathPrefix(pathname, PERSONAL_ALLOWED_PATH_PREFIXES);
  return true;
}

export function getNavItemsForAccess(access: WorkspaceAccess): (typeof NAV_ITEMS)[number][] {
  if (access.navMode === 'tinytoast') {
    return NAV_ITEMS.filter((item) => TINYTOAST_NAV_HREFS.has(item.href));
  }
  if (access.navMode === 'personal') {
    return NAV_ITEMS.filter((item) => PERSONAL_NAV_HREFS.has(item.href));
  }
  return [...NAV_ITEMS];
}

/** In modalità personal: true se la cosa (campagna, obiettivo, proposta…) è di chi è collegato. */
export function isOwnedByScope(access: Pick<WorkspaceAccess, 'scopeOwner'>, owner: string | null | undefined): boolean {
  if (!access.scopeOwner) return true;
  return normalizeOwner(owner) === access.scopeOwner;
}

export function isClientInWorkspace(client: { workspaceId?: string }, workspaceId: string): boolean {
  return (client.workspaceId || DEFAULT_WORKSPACE_ID) === workspaceId;
}
