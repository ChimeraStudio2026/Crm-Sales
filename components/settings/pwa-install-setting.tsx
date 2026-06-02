'use client';

import { CheckCircle2, Download, MonitorSmartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CrmLogo } from '@/components/ui/crm-logo';
import { isDesktopBrowser } from '@/lib/pwa/install';
import { usePwaInstall } from '@/providers/pwa-install-provider';

export function PwaInstallSetting() {
  const { canInstall, isInstalled, isIos, installApp } = usePwaInstall();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isDesktopBrowser());
  }, []);

  const handleInstall = async (): Promise<void> => {
    await installApp();
  };

  return (
    <div className="glass-card">
      <div className="chart-header">
        <h3><MonitorSmartphone size={20} /> App sul PC</h3>
        {isInstalled && (
          <span className="quick-stats-badge" style={{ color: 'var(--success)' }}>
            Installata
          </span>
        )}
      </div>
      <div className="settings-pwa-row">
        <CrmLogo size={48} className="settings-pwa-logo" />
        <div>
          <p className="settings-copy settings-copy-tight">
            Scarica il gestionale e aprilo come app sul computer, dalla barra applicazioni o dal desktop.
          </p>
          {isInstalled ? (
            <p className="settings-pwa-status settings-pwa-status-success">
              <CheckCircle2 size={16} />
              <span>CRM Sales è già installato su questo dispositivo.</span>
            </p>
          ) : canInstall ? (
            <button type="button" className="btn btn-primary" onClick={() => void handleInstall()}>
              <Download size={16} />
              <span>Installa sul PC</span>
            </button>
          ) : isIos ? (
            <ol className="settings-steps-list settings-steps-list-compact">
              <li>Apri CRM Sales in Safari.</li>
              <li>Tocca Condividi → Aggiungi a Home.</li>
            </ol>
          ) : isDesktop ? (
            <ol className="settings-steps-list settings-steps-list-compact">
              <li>Usa Chrome o Edge su questo PC.</li>
              <li>Clicca l&apos;icona installa nella barra degli indirizzi oppure Menu → Installa app.</li>
              <li>Se compare il banner in basso, puoi installare da lì.</li>
            </ol>
          ) : (
            <ol className="settings-steps-list settings-steps-list-compact">
              <li>Apri il sito da Chrome su Android.</li>
              <li>Tocca Menu → Installa app oppure usa il banner Installa.</li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
