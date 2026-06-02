'use client';

import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CrmLogo } from '@/components/ui/crm-logo';
import { isIosDevice, isStandaloneApp } from '@/lib/pwa/install';
import { usePwaInstall } from '@/providers/pwa-install-provider';

const DISMISS_KEY = 'crm_sales_pwa_install_dismissed';

export function InstallPrompt() {
  const { canInstall, installApp } = usePwaInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    if (isIosDevice() && !isStandaloneApp()) {
      setShowIosHint(true);
      return;
    }
    if (canInstall) setIsVisible(true);
  }, [canInstall]);

  const handleInstall = async (): Promise<void> => {
    const outcome = await installApp();
    if (outcome !== 'unavailable') setIsVisible(false);
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

  if (!isVisible || !canInstall) return null;

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
