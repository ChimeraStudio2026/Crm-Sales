'use client';

import { Moon, Sun } from 'lucide-react';
import { useUiPreferences } from '@/providers/ui-preferences-provider';

interface ThemeToggleButtonProps {
  readonly className?: string;
  readonly showLabel?: boolean;
}

export function ThemeToggleButton({ className, showLabel = false }: ThemeToggleButtonProps) {
  const { themeMode, toggleThemeMode } = useUiPreferences();
  const isDark = themeMode === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle-btn${className ? ` ${className}` : ''}`}
      onClick={toggleThemeMode}
      aria-label={isDark ? 'Passa alla modalità giorno' : 'Passa alla modalità notte'}
      title={isDark ? 'Modalità giorno' : 'Modalità notte'}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      {showLabel && <span>{isDark ? 'Giorno' : 'Notte'}</span>}
    </button>
  );
}
