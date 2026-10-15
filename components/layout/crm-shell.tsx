'use client';

import { ToastContainer } from '@/components/ui/toast-container';
import { Sidebar } from '@/components/layout/sidebar';
import { WorkspaceRouteGuard } from '@/components/layout/workspace-route-guard';
import { CrmProvider, useCrm } from '@/providers/crm-provider';
import { RemindersProvider } from '@/providers/reminders-provider';
import { WorkspaceProvider } from '@/providers/workspace-provider';

interface CrmShellProps {
  children: React.ReactNode;
}

export function CrmShell({ children }: CrmShellProps) {
  return (
    <WorkspaceProvider>
      <CrmProvider>
        <CrmShellInner>{children}</CrmShellInner>
      </CrmProvider>
    </WorkspaceProvider>
  );
}

function CrmShellInner({ children }: CrmShellProps) {
  const { isLoading } = useCrm();
  if (isLoading) {
    return (
      <>
        <Sidebar />
        <main className="main-content">
          <div className="content-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Caricamento CRM...</p>
          </div>
        </main>
      </>
    );
  }
  return (
    <RemindersProvider>
      <Sidebar />
      <main className="main-content">
        <WorkspaceRouteGuard>{children}</WorkspaceRouteGuard>
      </main>
      <ToastContainer />
    </RemindersProvider>
  );
}
