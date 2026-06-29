'use client';

import { ToastContainer } from '@/components/ui/toast-container';
import { JonnyChat } from '@/components/jonny/jonny-chat';
import { Sidebar } from '@/components/layout/sidebar';
import { CrmProvider, useCrm } from '@/providers/crm-provider';
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
    <>
      <Sidebar />
      <main className="main-content">{children}</main>
      <JonnyChat />
      <ToastContainer />
    </>
  );
}
