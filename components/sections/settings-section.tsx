'use client';

import { useRef } from 'react';
import { Cloud, Database, ExternalLink, FileJson, Info, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react';
import { useCrm } from '@/providers/crm-provider';
import { DesktopLogoSetting } from '@/components/settings/desktop-logo-setting';
import { ThemeModeSetting } from '@/components/settings/theme-mode-setting';
import { PwaInstallSetting } from '@/components/settings/pwa-install-setting';
import { TopHeader } from '@/components/layout/top-header';

const APOLLO_SECRETS_URL = 'https://supabase.com/dashboard/project/ftkqrtzovyezlhlabmpn/functions/secrets';
const APOLLO_DOCS_URL = 'https://docs.apollo.io/';

export function SettingsSection() {
  const {
    isSupabaseConnected,
    isSupabaseConfigured,
    apolloStatus,
    refreshApolloStatus,
    exportJsonBackup,
    importJsonBackup,
    resetAllData,
    cleanHistoricalYears,
    showToast,
  } = useCrm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isApolloReady = apolloStatus.ok && apolloStatus.configured;

  const supabaseBadge = isSupabaseConnected
    ? 'Supabase: connesso'
    : isSupabaseConfigured
      ? 'Supabase: errore connessione'
      : 'Supabase: non configurato';

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div style={{ maxWidth: 650, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <DesktopLogoSetting />
            <ThemeModeSetting />
            <PwaInstallSetting />
            <div className="glass-card">
              <div className="chart-header">
                <h3><Cloud size={20} /> Supabase (Database Cloud)</h3>
                <span className="quick-stats-badge">{supabaseBadge}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                Configura le variabili Supabase in <code>.env.local</code> o su Vercel.
                Il database richiede <strong>login</strong> — RLS consente solo utenti autenticati.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Guida: <strong>SUPABASE_SETUP.md</strong> · Migrazioni in <strong>supabase/migrations/</strong>
              </p>
            </div>
            <div className="glass-card">
              <div className="chart-header">
                <h3><Sparkles size={20} /> Apollo.io</h3>
                <span
                  className="quick-stats-badge"
                  style={isApolloReady ? { color: 'var(--success)' } : undefined}
                >
                  {apolloStatus.message}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.55 }}>
                Apollo arricchisce i clienti con email, sito web, settore e note aziendali.
                La chiave API va inserita <strong>solo su Supabase</strong>, non in Vercel o nel codice.
              </p>
              <ol className="settings-steps-list">
                <li>
                  Ottieni la API key da{' '}
                  <a href="https://app.apollo.io/" target="_blank" rel="noreferrer">Apollo.io</a>
                  {' '}(Settings → Integrations → API).
                </li>
                <li>
                  Aggiungi il secret <code>APOLLO_API_KEY</code> in Supabase Edge Functions.
                </li>
                <li>
                  Usa il pulsante ✨ nella lista clienti o nel drawer di modifica.
                </li>
              </ol>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
                <a
                  href={APOLLO_SECRETS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                >
                  <ExternalLink size={16} />
                  <span>Apri Secrets Supabase</span>
                </a>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void refreshApolloStatus()}
                >
                  <RefreshCw size={16} />
                  <span>Verifica connessione</span>
                </button>
                <a
                  href={APOLLO_DOCS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                >
                  <ExternalLink size={16} />
                  <span>Docs Apollo</span>
                </a>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 12 }}>
                Guida completa: <strong>APOLLO_SETUP.md</strong>
                <br />
                Serve un piano Apollo con API <strong>Organization Enrich</strong> attiva (le chiavi base spesso non includono l&apos;arricchimento).
              </p>
            </div>
            <div className="glass-card">
              <div className="chart-header">
                <h3><Database size={20} /> Backup &amp; Reset</h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={exportJsonBackup}>
                  <FileJson size={16} />
                  <span>Esporta JSON</span>
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={16} />
                  <span>Importa JSON</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    try {
                      await importJsonBackup(text);
                    } catch {
                      showToast('Backup JSON non valido.', 'danger');
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Eliminare tutti i dati 2023 e 2024 da Supabase?\n\n'
                        + '• OKR 2023/2024\n'
                        + '• rev_2023 / rev_2024 sui clienti\n'
                        + '• Forecast analisi 2023/2024\n\n'
                        + 'Dovrai reimportare gli Excel storici.',
                      )
                    ) {
                      void cleanHistoricalYears();
                    }
                  }}
                >
                  <Trash2 size={16} />
                  <span>Pulisci 2023/2024</span>
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => {
                    if (window.confirm('Svuotare tutti i dati?')) void resetAllData();
                  }}
                >
                  <Trash2 size={16} />
                  <span>Svuota Tutto</span>
                </button>
              </div>
            </div>
            <div className="glass-card">
              <div className="chart-header">
                <h3><Info size={20} /> Regole Automatiche del CRM</h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                • <strong>Indice 1 — Nuovo Cliente:</strong> fatturato 2026 da €0 a €10.000<br />
                • <strong>Indice 2 — Ricorrente:</strong> fatturato 2026 da €10.000 a €30.000<br />
                • <strong>Indice 3 — Top 20%:</strong> fatturato 2026 oltre €30.000<br />
                • <strong>Perso</strong> e <strong>Eliminato:</strong> solo impostazione manuale<br />
                • Puoi cambiare il rapporto a mano dalla lista clienti; resta bloccato finché non lo modifichi di nuovo
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
