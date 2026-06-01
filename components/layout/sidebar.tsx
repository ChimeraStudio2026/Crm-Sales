'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  CheckSquare,
  FileSpreadsheet,
  Lightbulb,
  Menu,
  PhoneCall,
  Settings,
  Snowflake,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { NAV_ITEMS } from '@/lib/constants/crm';
import { useState } from 'react';

const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  Users,
  CheckSquare,
  PhoneCall,
  Lightbulb,
  Snowflake,
  FileSpreadsheet,
  Settings,
};

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div
        className="mobile-nav-toggle"
        id="mobile-toggle"
        onClick={() => setMobileOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setMobileOpen(true)}
      >
        <Menu size={22} />
      </div>
      <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`} id="sidebar">
        <div className="sidebar-logo">
          <div className="logo-container">
            <div className="logo-icon">C</div>
            <span className="logo-text">CRM Sales</span>
          </div>
        </div>
        <ul className="sidebar-menu">
          {NAV_ITEMS.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className={`menu-item${isActive ? ' active' : ''}`}>
                <Link href={item.href} onClick={() => setMobileOpen(false)}>
                  {Icon && <Icon size={20} strokeWidth={2} />}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="sidebar-footer">
          <div className="user-avatar">A</div>
          <div className="user-info">
            <span className="user-name">Amministratore</span>
            <span className="user-role">Sales Manager</span>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
    </>
  );
}
