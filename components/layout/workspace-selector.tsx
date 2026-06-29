'use client';

import { Building2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { CRM_WORKSPACES, type WorkspaceId } from '@/lib/constants/workspaces';
import { useWorkspace } from '@/providers/workspace-provider';

export function WorkspaceSelector() {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaceId, setWorkspaceId, activeWorkspace } = useWorkspace();

  const handleChange = (nextWorkspaceId: WorkspaceId): void => {
    setWorkspaceId(nextWorkspaceId);
    if (pathname.startsWith('/funnel/') && pathname !== '/funnel') {
      router.push('/funnel');
    }
  };

  return (
    <div className="workspace-selector">
      <Building2 size={16} aria-hidden="true" />
      <label className="workspace-selector-label" htmlFor="crm-workspace-select">
        Azienda
      </label>
      <select
        id="crm-workspace-select"
        className="workspace-selector-select"
        value={workspaceId}
        onChange={(event) => handleChange(event.target.value as WorkspaceId)}
        aria-label="Seleziona azienda"
      >
        {CRM_WORKSPACES.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.label}
          </option>
        ))}
      </select>
      <span className="workspace-selector-badge">{activeWorkspace.shortLabel}</span>
    </div>
  );
}
