'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CRM_WORKSPACES,
  DEFAULT_WORKSPACE_ID,
  isWorkspaceId,
  type CrmWorkspace,
  type WorkspaceId,
} from '@/lib/constants/workspaces';

const STORAGE_KEY = 'crm-active-workspace';

interface WorkspaceContextValue {
  workspaceId: WorkspaceId;
  setWorkspaceId: (id: WorkspaceId) => void;
  activeWorkspace: CrmWorkspace;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [workspaceId, setWorkspaceIdState] = useState<WorkspaceId>(DEFAULT_WORKSPACE_ID);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isWorkspaceId(stored)) {
      setWorkspaceIdState(stored);
    }
    setIsHydrated(true);
  }, []);

  const setWorkspaceId = useCallback((id: WorkspaceId): void => {
    setWorkspaceIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const activeWorkspace = useMemo(
    () => CRM_WORKSPACES.find((workspace) => workspace.id === workspaceId) ?? CRM_WORKSPACES[0],
    [workspaceId],
  );

  const value = useMemo(
    () => ({ workspaceId, setWorkspaceId, activeWorkspace }),
    [activeWorkspace, setWorkspaceId, workspaceId],
  );

  if (!isHydrated) {
    return (
      <WorkspaceContext.Provider value={value}>
        {children}
      </WorkspaceContext.Provider>
    );
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return context;
}
