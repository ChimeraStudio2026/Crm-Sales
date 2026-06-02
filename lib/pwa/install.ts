export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (
    'standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isDesktopBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(min-width: 901px)').matches && !isIosDevice();
}
