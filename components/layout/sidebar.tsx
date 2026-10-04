'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Lightbulb,
  LogOut,
  Mail,
  Menu,
  Settings,
  Snowflake,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ChimeraWordmark } from '@/components/ui/chimera-wordmark';
import { NAV_ITEMS } from '@/lib/constants/crm';
import { getNavItemsForAccess } from '@/lib/crm/workspace-access';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useUiPreferences } from '@/providers/ui-preferences-provider';
import { useWorkspace } from '@/providers/workspace-provider';

const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  FileText,
  Users,
  Mail,
  GitBranch,
  CheckSquare,
  Sparkles,
  Lightbulb,
  Snowflake,
  FileSpreadsheet,
  Settings,
};

// Shown below a divider, like the secondary links in the Caronte sidebar.
const SECONDARY_NAV_HREFS = new Set<string>(['/import', '/settings']);

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logoDesktopSize } = useUiPreferences();
  const { access } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 901px)');
    const updateViewport = (): void => setIsDesktopViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);
  const sidebarLogoSize = isDesktopViewport ? logoDesktopSize : 28;

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || '');
    });
  }, []);

  const navItems = useMemo(() => getNavItemsForAccess(access), [access]);

  const roleLabel = access.navMode === 'tinytoast' ? 'Tinytoast' : 'Sales Team';
  const primaryNavItems = navItems.filter((item) => !SECONDARY_NAV_HREFS.has(item.href));
  const secondaryNavItems = navItems.filter((item) => SECONDARY_NAV_HREFS.has(item.href));

  const renderNavItem = (item: (typeof navItems)[number]) => {
    const Icon = ICON_MAP[item.icon];
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <li key={item.href} className={`menu-item${isActive ? ' active' : ''}`}>
        <Link href={item.href} onClick={() => setMobileOpen(false)}>
          {Icon && <Icon size={19} strokeWidth={1.75} />}
          <span>{item.label}</span>
        </Link>
      </li>
    );
  };

  const handleSignOut = async () => {
    const supabase = createBrowserSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

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
            <ChimeraWordmark height={sidebarLogoSize} className="sidebar-wordmark" />
            <span className="logo-chip">
              <span className="logo-chip-star" aria-hidden />
              CRM · {roleLabel}
            </span>
          </div>
        </div>
        <ul className="sidebar-menu">
          {primaryNavItems.map(renderNavItem)}
          {secondaryNavItems.length > 0 && <li className="sidebar-divider" aria-hidden />}
          {secondaryNavItems.map(renderNavItem)}
        </ul>
        <div className="sidebar-footer">
          <Link
            href="/account"
            className={`sidebar-account-link${pathname === '/account' ? ' is-active' : ''}`}
            title="Il mio account e password"
            onClick={() => setMobileOpen(false)}
          >
            <div className="user-avatar">{userEmail ? userEmail[0].toUpperCase() : 'A'}</div>
            <div className="user-info">
              <span className="user-name">{userEmail || 'Utente'}</span>
              <span className="user-role">Il mio account</span>
            </div>
          </Link>
          <button type="button" className="sidebar-signout" onClick={() => void handleSignOut()} title="Esci">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
    </>
  );
}
