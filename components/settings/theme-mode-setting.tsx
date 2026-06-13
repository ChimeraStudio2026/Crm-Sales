'use client';

import { Moon, Sun } from 'lucide-react';
import { useUiPreferences } from '@/providers/ui-preferences-provider';

interface ThemeModeSettingProps {
  readonly className?: string;
}

export function ThemeModeSetting({ className }: ThemeModeSettingProps) {
  const { themeMode, setThemeMode } = useUiPreferences();
  const isDark = themeMode === 'dark';

  return (
    <div className={`glass-card theme-mode-setting${className ? ` ${className}` : ''}`}>
      <div className="chart-header">
        <h3>{isDark ? <Moon size={20} /> : <Sun size={20} />} Aspetto</h3>
        <span className="quick-stats-badge">{isDark ? 'Modalità notte' : 'Modalità giorno'}</span>
      </div>
      <p className="theme-mode-setting-copy">
        Scegli il tema dell&apos;interfaccia CRM. La preferenza viene salvata su questo dispositivo.
      </p>
      <div className="theme-mode-setting-options" role="group" aria-label="Tema interfaccia">
        <button
          type="button"
          className={`theme-mode-option${!isDark ? ' is-active' : ''}`}
          onClick={() => setThemeMode('light')}
          aria-pressed={!isDark}
        >
          <Sun size={18} />
          <span>Giorno</span>
        </button>
        <button
          type="button"
          className={`theme-mode-option${isDark ? ' is-active' : ''}`}
          onClick={() => setThemeMode('dark')}
          aria-pressed={isDark}
        >
          <Moon size={18} />
          <span>Notte</span>
        </button>
      </div>
    </div>
  );
}
