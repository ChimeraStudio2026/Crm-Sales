export const LOGO_DESKTOP_SIZE_STORAGE_KEY = 'crm_sales_logo_desktop_size';

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
