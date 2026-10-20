'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FilePlus2, Sparkles } from 'lucide-react';
import { TopHeader } from '@/components/layout/top-header';
import { formatQuoteCurrency } from '@/lib/quotes/calc';
import { createEmptyQuoteDraft } from '@/lib/quotes/draft';
import { QUOTE_STATUS_LABELS } from '@/lib/quotes/status';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fetchQuoteDraftSummaries, saveQuoteDraft, type QuoteDraftSummary } from '@/lib/supabase/quote-drafts-database';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function QuotesSection() {
  const router = useRouter();
  const { showToast } = useCrm();
  const { workspaceId } = useWorkspace();
  const [quotes, setQuotes] = useState<QuoteDraftSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const loadQuotes = useCallback(async (): Promise<void> => {
    const db = createBrowserSupabaseClient();
    if (!db) {
      setIsLoading(false);
      showToast('Supabase non configurato.', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      setQuotes(await fetchQuoteDraftSummaries(db, workspaceId));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Errore lettura preventivi.', 'danger');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, workspaceId]);

  useEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);

  const handleCreate = async (): Promise<void> => {
    const db = createBrowserSupabaseClient();
    if (!db) return;
    setIsCreating(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      const saved = await saveQuoteDraft(db, workspaceId, createEmptyQuoteDraft(user?.email || ''));
      router.push(`/preventivi/${saved.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Errore creazione preventivo.', 'danger');
      setIsCreating(false);
    }
  };

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="quotes-toolbar">
            <div>
              <h3>I tuoi preventivi</h3>
              <p>
                Crea un preventivo nella struttura Cerbero. Descrivi il lavoro nella chat e l&apos;assistente
                prepara la bozza dal listino.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={isCreating}>
              <FilePlus2 size={16} />
              {isCreating ? 'Creazione...' : 'Crea preventivo'}
            </button>
          </div>
          {isLoading ? (
            <p className="quotes-empty">Caricamento preventivi...</p>
          ) : quotes.length === 0 ? (
            <div className="glass-card quotes-empty-card">
              <Sparkles size={20} />
              <p>Nessun preventivo ancora. Clicca «Crea preventivo» e scrivi cosa ti serve.</p>
            </div>
          ) : (
            <div className="glass-card quotes-list-card">
              <table className="quotes-table">
                <thead>
                  <tr>
                    <th>Codice</th>
                    <th>Progetto</th>
                    <th>Cliente</th>
                    <th>Versione</th>
                    <th>Stato</th>
                    <th className="is-numeric">Totale</th>
                    <th>Aggiornato</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.id}>
                      <td>{quote.code || '—'}</td>
                      <td>
                        <Link href={`/preventivi/${quote.id}`} className="quotes-link">
                          {quote.title || 'Senza titolo'}
                        </Link>
                      </td>
                      <td>{quote.clientName || '—'}</td>
                      <td>{quote.version}</td>
                      <td>
                        <span className={`quote-status quote-status-${quote.status}`}>
                          {QUOTE_STATUS_LABELS[quote.status]}
                        </span>
                      </td>
                      <td className="is-numeric">{formatQuoteCurrency(quote.total)}</td>
                      <td>{formatUpdatedAt(quote.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
