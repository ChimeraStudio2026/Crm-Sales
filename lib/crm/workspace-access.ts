import { NAV_ITEMS } from '@/lib/constants/crm';
import {
  DEFAULT_WORKSPACE_ID,
  TINYTOAST_WORKSPACE_ID,
  type WorkspaceId,
} from '@/lib/constants/workspaces';

export type WorkspaceNavMode = 'full' | 'tinytoast';

export interface WorkspaceAccess {
  navMode: WorkspaceNavMode;
  canSwitchWorkspace: boolean;
  workspaceId: WorkspaceId;
  homePath: string;
}

const TINYTOAST_EMAIL_PATTERNS = [
  'tinytoast',
] as const;

const TINYTOAST_ALLOWED_PATH_PREFIXES = [
  '/funnel',
  '/cold',
  '/ideas',
  '/tasks',
] as const;

const TINYTOAST_NAV_HREFS = new Set<string>([
  '/funnel',
  '/cold',
  '/ideas',
]);

export function isTinytoastUserEmail(email: string | null | undefined): boolean {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;
  return TINYTOAST_EMAIL_PATTERNS.some((pattern) => normalizedEmail.includes(pattern));
}

export function resolveWorkspaceAccess(email: string | null | undefined): WorkspaceAccess {
  if (isTinytoastUserEmail(email)) {
    return {
      navMode: 'tinytoast',
      canSwitchWorkspace: false,
      workspaceId: TINYTOAST_WORKSPACE_ID,
      homePath: '/funnel',
    };
  }
  return {
    navMode: 'full',
    canSwitchWorkspace: true,
    workspaceId: DEFAULT_WORKSPACE_ID,
    homePath: '/analysis',
  };
}

export function isPathAllowedForTinytoast(pathname: string): boolean {
  return TINYTOAST_ALLOWED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getNavItemsForAccess(access: WorkspaceAccess): (typeof NAV_ITEMS)[number][] {
  if (access.navMode === 'tinytoast') {
    return NAV_ITEMS.filter((item) => TINYTOAST_NAV_HREFS.has(item.href));
  }
  return [...NAV_ITEMS];
}

export function isClientInWorkspace(client: { workspaceId?: string }, workspaceId: string): boolean {
  return (client.workspaceId || DEFAULT_WORKSPACE_ID) === workspaceId;
}
