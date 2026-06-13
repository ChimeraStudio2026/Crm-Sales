export const LOGO_DESKTOP_SIZE_STORAGE_KEY = 'crm_sales_logo_desktop_size';
export const THEME_MODE_STORAGE_KEY = 'crm_sales_theme_mode';

export type ThemeMode = 'light' | 'dark';

export const DEFAULT_LOGO_DESKTOP_SIZE = 28;
export const MIN_LOGO_DESKTOP_SIZE = 20;
export const MAX_LOGO_DESKTOP_SIZE = 56;

export function readLogoDesktopSize(): number {
  if (typeof window === 'undefined') return DEFAULT_LOGO_DESKTOP_SIZE;
  const storedValue = window.localStorage.getItem(LOGO_DESKTOP_SIZE_STORAGE_KEY);
  if (!storedValue) return DEFAULT_LOGO_DESKTOP_SIZE;
  const parsedValue = Number.parseInt(storedValue, 10);
  if (Number.isNaN(parsedValue)) return DEFAULT_LOGO_DESKTOP_SIZE;
  return Math.min(MAX_LOGO_DESKTOP_SIZE, Math.max(MIN_LOGO_DESKTOP_SIZE, parsedValue));
}

export function writeLogoDesktopSize(size: number): number {
  const normalizedSize = Math.min(MAX_LOGO_DESKTOP_SIZE, Math.max(MIN_LOGO_DESKTOP_SIZE, size));
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOGO_DESKTOP_SIZE_STORAGE_KEY, String(normalizedSize));
    document.documentElement.style.setProperty('--logo-desktop-size', `${normalizedSize}px`);
  }
  return normalizedSize;
}

export function applyLogoDesktopSizeToDocument(size: number): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--logo-desktop-size', `${size}px`);
}

export function readThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const storedValue = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
  return storedValue === 'dark' ? 'dark' : 'light';
}

export function applyThemeModeToDocument(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.style.colorScheme = mode;
}

export function writeThemeMode(mode: ThemeMode): ThemeMode {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    applyThemeModeToDocument(mode);
  }
  return mode;
}

export function toggleThemeMode(currentMode: ThemeMode): ThemeMode {
  return writeThemeMode(currentMode === 'dark' ? 'light' : 'dark');
}
