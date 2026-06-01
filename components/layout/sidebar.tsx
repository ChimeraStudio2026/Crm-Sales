'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  CheckSquare,
  FileSpreadsheet,
  Lightbulb,
  LogOut,
  Menu,
  PhoneCall,
  Settings,
  Snowflake,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NAV_ITEMS } from '@/lib/constants/crm';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

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
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || '');
    });
  }, []);

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
          <div className="user-avatar">{userEmail ? userEmail[0].toUpperCase() : 'A'}</div>
          <div className="user-info">
            <span className="user-name">{userEmail || 'Utente'}</span>
            <span className="user-role">Sales Team</span>
          </div>
          <button type="button" className="sidebar-signout" onClick={() => void handleSignOut()} title="Esci">
            <LogOut size={18} />
          </button>
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
