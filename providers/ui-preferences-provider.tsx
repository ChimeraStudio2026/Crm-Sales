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
  DEFAULT_LOGO_DESKTOP_SIZE,
  readLogoDesktopSize,
  writeLogoDesktopSize,
} from '@/lib/crm/ui-preferences';

interface UiPreferencesContextValue {
  readonly logoDesktopSize: number;
  readonly setLogoDesktopSize: (size: number) => void;
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

export function UiPreferencesProvider({ children }: { readonly children: ReactNode }) {
  const [logoDesktopSize, setLogoDesktopSizeState] = useState(DEFAULT_LOGO_DESKTOP_SIZE);

  useEffect(() => {
    const storedSize = readLogoDesktopSize();
    setLogoDesktopSizeState(storedSize);
    applyLogoDesktopSizeToDocument(storedSize);
  }, []);

  const setLogoDesktopSize = useCallback((size: number) => {
    const normalizedSize = writeLogoDesktopSize(size);
    setLogoDesktopSizeState(normalizedSize);
  }, []);

  const value = useMemo(
    () => ({ logoDesktopSize, setLogoDesktopSize }),
    [logoDesktopSize, setLogoDesktopSize],
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
