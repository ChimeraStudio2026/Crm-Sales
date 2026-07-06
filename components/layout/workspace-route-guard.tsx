'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isPathAllowedForTinytoast } from '@/lib/crm/workspace-access';
import { useWorkspace } from '@/providers/workspace-provider';

interface WorkspaceRouteGuardProps {
  children: React.ReactNode;
}

export function WorkspaceRouteGuard({ children }: WorkspaceRouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { access, isReady } = useWorkspace();

  useEffect(() => {
    if (!isReady) return;
    if (access.navMode !== 'tinytoast') return;
    if (isPathAllowedForTinytoast(pathname)) return;
    router.replace(access.homePath);
  }, [access.homePath, access.navMode, isReady, pathname, router]);

  if (!isReady) {
    return (
      <div className="content-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Caricamento workspace...</p>
      </div>
    );
  }

  if (access.navMode === 'tinytoast' && !isPathAllowedForTinytoast(pathname)) {
    return null;
  }

  return <>{children}</>;
}
