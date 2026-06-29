'use client';

import { PlusCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { PAGE_META } from '@/lib/constants/crm';
import { useCrm } from '@/providers/crm-provider';
import { ThemeToggleButton } from '@/components/ui/theme-toggle-button';
import { formatCurrency } from '@/lib/crm/utils';

interface TopHeaderProps {
  onQuickAdd?: () => void;
}

export function TopHeader({ onQuickAdd }: TopHeaderProps) {
  const pathname = usePathname();
  const { totalRevenue2026 } = useCrm();
  const meta = PAGE_META[pathname] || PAGE_META['/analysis'];

  return (
    <header className="top-header">
      <div className="page-title">
        <h1 id="header-title">{meta.title}</h1>
        <p id="header-subtitle">{meta.subtitle}</p>
      </div>
      <div className="header-actions">
        <ThemeToggleButton />
        <div className="quick-stats-badge">
          <span>Fatturato 2026: </span>
          <strong id="header-total-revenue">{formatCurrency(totalRevenue2026)}</strong>
        </div>
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
