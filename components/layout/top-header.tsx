'use client';

import { PlusCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { resolvePageMeta } from '@/lib/constants/crm';
import { isWorkspaceScopedPath } from '@/lib/constants/workspaces';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { ThemeToggleButton } from '@/components/ui/theme-toggle-button';
import { WorkspaceSelector } from '@/components/layout/workspace-selector';
import { formatCurrency } from '@/lib/crm/utils';

interface TopHeaderProps {
  onQuickAdd?: () => void;
}

export function TopHeader({ onQuickAdd }: TopHeaderProps) {
  const pathname = usePathname();
  const { totalRevenue2026 } = useCrm();
  const { access } = useWorkspace();
  const meta = resolvePageMeta(pathname);
  const showWorkspaceSelector = access.canSwitchWorkspace && isWorkspaceScopedPath(pathname);
  const showRevenue = access.navMode === 'full';

  return (
    <header className="top-header">
      <div className="page-title">
        <h1 id="header-title">{meta.title}</h1>
        <p id="header-subtitle">{meta.subtitle}</p>
      </div>
      <div className="header-actions">
        {showWorkspaceSelector && <WorkspaceSelector />}
        <ThemeToggleButton />
        {showRevenue && (
          <div className="quick-stats-badge">
            <span>Fatturato 2026: </span>
            <strong id="header-total-revenue">{formatCurrency(totalRevenue2026)}</strong>
          </div>
        )}
        {onQuickAdd && (
          <button className="btn btn-primary" id="btn-quick-add" type="button" onClick={onQuickAdd}>
            <PlusCircle size={18} />
            <span>Nuovi Clienti</span>
          </button>
        )}
      </div>
    </header>
  );
}
