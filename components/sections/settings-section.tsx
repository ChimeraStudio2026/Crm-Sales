'use client';

import { useRef } from 'react';
import { Cloud, Database, ExternalLink, FileJson, Info, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react';
import { useCrm } from '@/providers/crm-provider';
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
                • <strong>Top 20%:</strong> clienti nel top 20% per fatturato 2026<br />
                • <strong>Ricorrente:</strong> fatturato 2025 &gt; €15.000<br />
                • <strong>Clienti freddi:</strong> promozione automatica quando fatturato 2026 &gt; €1
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
