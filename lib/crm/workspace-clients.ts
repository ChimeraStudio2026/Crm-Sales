import { CLIENT_ORIGINS, OWNERS } from '@/lib/constants/crm';
import { OWNER_JECK_SCARDY, OWNER_MARTINO } from '@/lib/crm/owners';
import { DEFAULT_WORKSPACE_ID, TINYTOAST_WORKSPACE_ID } from '@/lib/constants/workspaces';
import type { ClientOrigin, Owner } from '@/lib/types/crm';

export const TINYTOAST_OWNERS: readonly Owner[] = [OWNER_MARTINO, OWNER_JECK_SCARDY];

export const TINYTOAST_CLIENT_ORIGINS: readonly ClientOrigin[] = [
  ...CLIENT_ORIGINS,
  'Martino',
];

export function getOwnersForWorkspace(workspaceId: string = DEFAULT_WORKSPACE_ID): Owner[] {
  if (workspaceId === TINYTOAST_WORKSPACE_ID) {
    return [...TINYTOAST_OWNERS];
  }
  return [...OWNERS];
}

export function getClientOriginsForWorkspace(workspaceId: string = DEFAULT_WORKSPACE_ID): ClientOrigin[] {
  if (workspaceId === TINYTOAST_WORKSPACE_ID) {
    return [...TINYTOAST_CLIENT_ORIGINS];
  }
  return [...CLIENT_ORIGINS];
}

export function getDefaultOwnerForWorkspace(workspaceId: string = DEFAULT_WORKSPACE_ID): Owner {
  if (workspaceId === TINYTOAST_WORKSPACE_ID) {
    return OWNER_MARTINO;
  }
  return OWNER_JECK_SCARDY;
}
