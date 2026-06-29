import {
  DEFAULT_WORKSPACE_ID,
  ICIB_WORKSPACE_ID,
} from '@/lib/constants/workspaces';
import type { Owner } from '@/lib/types/crm';

export const CHIMERA_OWNERS: Owner[] = ['Jeck', 'Virgi', 'Martina'];

export const ICIB_OWNERS: Owner[] = ['Jeck', 'Vitto'];

export const ALL_OWNERS: Owner[] = ['Jeck', 'Virgi', 'Martina', 'Vitto'];

export function getOwnersForWorkspace(workspaceId: string): Owner[] {
  if (workspaceId === ICIB_WORKSPACE_ID) return ICIB_OWNERS;
  return CHIMERA_OWNERS;
}

export function getDefaultOwnerForWorkspace(workspaceId: string): Owner {
  if (workspaceId === ICIB_WORKSPACE_ID) return 'Vitto';
  return 'Jeck';
}

export function resolveOwnerForWorkspace(
  owner: string | undefined,
  workspaceId: string = DEFAULT_WORKSPACE_ID,
): Owner {
  const allowedOwners = getOwnersForWorkspace(workspaceId);
  if (owner && allowedOwners.includes(owner as Owner)) {
    return owner as Owner;
  }
  return getDefaultOwnerForWorkspace(workspaceId);
}

export function isOwnerInWorkspace(value: unknown, workspaceId: string): value is Owner {
  return typeof value === 'string' && getOwnersForWorkspace(workspaceId).includes(value as Owner);
}
