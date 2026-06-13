'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyLogoDesktopSizeToDocument,
  applyThemeModeToDocument,
  DEFAULT_LOGO_DESKTOP_SIZE,
  readLogoDesktopSize,
  readThemeMode,
  type ThemeMode,
  writeLogoDesktopSize,
  writeThemeMode,
} from '@/lib/crm/ui-preferences';

interface UiPreferencesContextValue {
  readonly logoDesktopSize: number;
  readonly setLogoDesktopSize: (size: number) => void;
  readonly themeMode: ThemeMode;
  readonly setThemeMode: (mode: ThemeMode) => void;
  readonly toggleThemeMode: () => void;
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

export function UiPreferencesProvider({ children }: { readonly children: ReactNode }) {
  const [logoDesktopSize, setLogoDesktopSizeState] = useState(DEFAULT_LOGO_DESKTOP_SIZE);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    const storedSize = readLogoDesktopSize();
    setLogoDesktopSizeState(storedSize);
    applyLogoDesktopSizeToDocument(storedSize);
    const storedTheme = readThemeMode();
    setThemeModeState(storedTheme);
    applyThemeModeToDocument(storedTheme);
  }, []);

  const setLogoDesktopSize = useCallback((size: number) => {
    const normalizedSize = writeLogoDesktopSize(size);
    setLogoDesktopSizeState(normalizedSize);
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    const normalizedMode = writeThemeMode(mode);
    setThemeModeState(normalizedMode);
  }, []);

  const toggleThemeMode = useCallback(() => {
    setThemeModeState((currentMode) => {
      const nextMode: ThemeMode = currentMode === 'dark' ? 'light' : 'dark';
      writeThemeMode(nextMode);
      return nextMode;
    });
  }, []);

  const value = useMemo(
    () => ({ logoDesktopSize, setLogoDesktopSize, themeMode, setThemeMode, toggleThemeMode }),
    [logoDesktopSize, setLogoDesktopSize, themeMode, setThemeMode, toggleThemeMode],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences(): UiPreferencesContextValue {
  const context = useContext(UiPreferencesContext);
  if (!context) {
    throw new Error('useUiPreferences must be used within UiPreferencesProvider');
  }
  return context;
}
