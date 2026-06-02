'use client';

import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'crm_sales_pwa_install_dismissed';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
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
  };

  if (!isVisible) return null;

  return (
    <div className="pwa-install-banner" role="dialog" aria-label="Installa CRM Sales">
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
