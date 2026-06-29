export const DEFAULT_WORKSPACE_ID = 'chimera' as const;
export const ICIB_WORKSPACE_ID = 'icib' as const;

export type WorkspaceId = typeof DEFAULT_WORKSPACE_ID | typeof ICIB_WORKSPACE_ID;

export interface CrmWorkspace {
  id: WorkspaceId;
  label: string;
  shortLabel: string;
}

export const CRM_WORKSPACES: readonly CrmWorkspace[] = [
  { id: DEFAULT_WORKSPACE_ID, label: 'Chimera Studios', shortLabel: 'Chimera' },
  { id: ICIB_WORKSPACE_ID, label: 'Icib', shortLabel: 'Icib' },
] as const;

export function isWorkspaceId(value: string): value is WorkspaceId {
  return CRM_WORKSPACES.some((workspace) => workspace.id === value);
}

export function isWorkspaceScopedPath(pathname: string): boolean {
  return pathname === '/cold' || pathname === '/funnel' || pathname.startsWith('/funnel/');
}

export function resolveWorkspaceLabel(workspaceId: string): string {
  return CRM_WORKSPACES.find((workspace) => workspace.id === workspaceId)?.shortLabel ?? workspaceId;
}
