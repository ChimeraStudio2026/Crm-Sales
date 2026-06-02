'use client';

import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CrmLogo } from '@/components/ui/crm-logo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'crm_sales_pwa_install_dismissed';

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (
    'standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    if (isIosDevice() && !isStandaloneApp()) {
      setShowIosHint(true);
      return;
    }
    const handleBeforeInstall = (event: Event): void => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstall = async (): Promise<void> => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = (): void => {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setIsVisible(false);
    setShowIosHint(false);
  };

  if (showIosHint) {
    return (
      <div className="pwa-install-banner pwa-install-banner-ios" role="dialog" aria-label="Aggiungi CRM Sales alla Home">
        <CrmLogo size={40} className="pwa-install-logo" />
        <div className="pwa-install-copy">
          <strong>Aggiungi a Home su iPhone</strong>
          <span>Tocca Condividi → Aggiungi a Home per aprire CRM Sales come app.</span>
        </div>
        <button type="button" className="pwa-install-close" onClick={handleDismiss} aria-label="Chiudi">
          <X size={16} />
        </button>
      </div>
    );
  }

  if (!isVisible) return null;

  return (
    <div className="pwa-install-banner" role="dialog" aria-label="Installa CRM Sales">
      <CrmLogo size={40} className="pwa-install-logo" />
      <div className="pwa-install-copy">
        <strong>Installa CRM Sales</strong>
        <span>Aggiungi l&apos;app alla home per un accesso rapido.</span>
      </div>
      <div className="pwa-install-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleInstall()}>
          <Download size={14} />
          <span>Installa</span>
        </button>
        <button type="button" className="pwa-install-close" onClick={handleDismiss} aria-label="Chiudi">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
