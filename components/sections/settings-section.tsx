'use client';

import { useRef } from 'react';
import { Cloud, Database, FileJson, Info, Sparkles, Trash2, Upload } from 'lucide-react';
import { useCrm } from '@/providers/crm-provider';
import { TopHeader } from '@/components/layout/top-header';

export function SettingsSection() {
  const {
    isSupabaseConnected,
    isSupabaseConfigured,
    apolloStatus,
    exportJsonBackup,
    importJsonBackup,
    resetAllData,
    showToast,
  } = useCrm();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
                <span className="quick-stats-badge">{apolloStatus.message}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Setup: <strong>APOLLO_SETUP.md</strong> — aggiungi <code>APOLLO_API_KEY</code> nei Secrets della Edge Function.
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
