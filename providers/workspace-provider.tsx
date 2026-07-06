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
import {
  CRM_WORKSPACES,
  DEFAULT_WORKSPACE_ID,
  isWorkspaceId,
  type CrmWorkspace,
  type WorkspaceId,
} from '@/lib/constants/workspaces';
import {
  resolveWorkspaceAccess,
  type WorkspaceAccess,
} from '@/lib/crm/workspace-access';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

const STORAGE_KEY = 'crm-active-workspace';

interface WorkspaceContextValue {
  workspaceId: WorkspaceId;
  setWorkspaceId: (id: WorkspaceId) => void;
  activeWorkspace: CrmWorkspace;
  access: WorkspaceAccess;
  isReady: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [workspaceId, setWorkspaceIdState] = useState<WorkspaceId>(DEFAULT_WORKSPACE_ID);
  const [access, setAccess] = useState<WorkspaceAccess>(() => resolveWorkspaceAccess(null));
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const bootstrap = async (): Promise<void> => {
      const supabase = createBrowserSupabaseClient();
      const email = supabase
        ? (await supabase.auth.getUser()).data.user?.email
        : undefined;
      const resolvedAccess = resolveWorkspaceAccess(email);
      if (!isMounted) return;
      setAccess(resolvedAccess);
      if (resolvedAccess.canSwitchWorkspace) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && isWorkspaceId(stored)) {
          setWorkspaceIdState(stored);
        } else {
          setWorkspaceIdState(resolvedAccess.workspaceId);
        }
      } else {
        setWorkspaceIdState(resolvedAccess.workspaceId);
        localStorage.setItem(STORAGE_KEY, resolvedAccess.workspaceId);
      }
      setIsReady(true);
    };
    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  const setWorkspaceId = useCallback((id: WorkspaceId): void => {
    if (!access.canSwitchWorkspace) return;
    setWorkspaceIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, [access.canSwitchWorkspace]);

  const activeWorkspace = useMemo(
    () => CRM_WORKSPACES.find((workspace) => workspace.id === workspaceId) ?? CRM_WORKSPACES[0],
    [workspaceId],
  );

  const value = useMemo(
    () => ({ workspaceId, setWorkspaceId, activeWorkspace, access, isReady }),
    [access, activeWorkspace, isReady, setWorkspaceId, workspaceId],
  );

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
