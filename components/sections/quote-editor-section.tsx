'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Trash2 } from 'lucide-react';
import { TopHeader } from '@/components/layout/top-header';
import { QuoteChatPanel } from '@/components/quotes/quote-chat-panel';
import { QuoteHeaderForm } from '@/components/quotes/quote-header-form';
import { QuoteOutputsEditor } from '@/components/quotes/quote-outputs-editor';
import { QuotePrintView } from '@/components/quotes/quote-print-view';
import { QuoteReportTable } from '@/components/quotes/quote-report-table';
import { QuoteSectionEditor } from '@/components/quotes/quote-section-editor';
import { QuoteTotalsCard } from '@/components/quotes/quote-totals-card';
import { computeQuoteTotals } from '@/lib/quotes/calc';
import { buildQuoteDisplayTitle } from '@/lib/quotes/draft';
import { QUOTE_SECTIONS } from '@/lib/quotes/sections';
import type { QuoteDraft } from '@/lib/quotes/types';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { deleteQuoteDraft, fetchQuoteDraft, saveQuoteDraft } from '@/lib/supabase/quote-drafts-database';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';

const AUTOSAVE_DELAY_MS = 1200;

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

const SAVE_STATE_LABELS: Record<SaveState, string> = {
  saved: 'Salvato',
  dirty: 'Modifiche non salvate',
  saving: 'Salvataggio...',
  error: 'Errore di salvataggio',
};

interface QuoteEditorSectionProps {
  readonly quoteId: string;
}

export function QuoteEditorSection({ quoteId }: QuoteEditorSectionProps) {
  const router = useRouter();
  const { showToast } = useCrm();
  const { workspaceId } = useWorkspace();
  const [quote, setQuote] = useState<QuoteDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQuote = useRef<QuoteDraft | null>(null);

  useEffect(() => {
    const db = createBrowserSupabaseClient();
    if (!db) return;
    let isCancelled = false;
    fetchQuoteDraft(db, quoteId)
      .then((loaded) => {
        if (isCancelled) return;
        setQuote(loaded);
        latestQuote.current = loaded;
      })
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : 'Errore lettura preventivo.', 'danger');
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [quoteId, showToast]);

  const persist = useCallback(async (): Promise<void> => {
    const db = createBrowserSupabaseClient();
    const current = latestQuote.current;
    if (!db || !current) return;
    setSaveState('saving');
    try {
      await saveQuoteDraft(db, workspaceId, current);
      setSaveState(latestQuote.current === current ? 'saved' : 'dirty');
    } catch (error) {
      setSaveState('error');
      showToast(error instanceof Error ? error.message : 'Errore salvataggio preventivo.', 'danger');
    }
  }, [showToast, workspaceId]);

  const updateQuote = useCallback((updater: (current: QuoteDraft) => QuoteDraft): void => {
    setQuote((current) => {
      if (!current) return current;
      const next = updater(current);
      latestQuote.current = next;
      return next;
    });
    setSaveState('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist();
    }, AUTOSAVE_DELAY_MS);
  }, [persist]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const totals = useMemo(() => (quote ? computeQuoteTotals(quote) : null), [quote]);

  const handleDelete = async (): Promise<void> => {
    if (!quote || !window.confirm('Eliminare questo preventivo? L\'operazione non si può annullare.')) return;
    const db = createBrowserSupabaseClient();
    if (!db) return;
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await deleteQuoteDraft(db, quote.id);
      router.push('/preventivi');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Errore eliminazione preventivo.', 'danger');
    }
  };

  if (isLoading) {
    return (
      <>
        <TopHeader />
        <div className="content-body"><p className="quotes-empty">Caricamento preventivo...</p></div>
      </>
    );
  }

  if (!quote || !totals) {
    return (
      <>
        <TopHeader />
        <div className="content-body">
          <p className="quotes-empty">
            Preventivo non trovato. <Link href="/preventivi">Torna ai preventivi</Link>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="quote-screen">
        <TopHeader />
        <div className="content-body quote-editor-body">
          <div className="quote-editor-toolbar">
            <Link href="/preventivi" className="btn btn-secondary btn-sm">
              <ArrowLeft size={14} /> Preventivi
            </Link>
            <h3 className="quote-editor-title">{buildQuoteDisplayTitle(quote)}</h3>
            <span className={`quote-save-state is-${saveState}`}>{SAVE_STATE_LABELS[saveState]}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
              <Printer size={14} /> Stampa / PDF
            </button>
            <button type="button" className="btn btn-secondary btn-sm quote-delete-btn" onClick={handleDelete}>
              <Trash2 size={14} /> Elimina
            </button>
          </div>
          <div className="quote-editor-layout">
            <QuoteChatPanel quote={quote} onQuoteChange={updateQuote} onToast={showToast} />
            <div className="quote-editor-main">
              <QuoteHeaderForm quote={quote} onQuoteChange={updateQuote} />
              <QuoteReportTable quote={quote} totals={totals} />
              {QUOTE_SECTIONS.map((section) => (
                <QuoteSectionEditor
                  key={section.code}
                  section={section}
                  quote={quote}
                  totals={totals}
                  onQuoteChange={updateQuote}
                />
              ))}
              <QuoteOutputsEditor quote={quote} onQuoteChange={updateQuote} />
              <QuoteTotalsCard quote={quote} totals={totals} onQuoteChange={updateQuote} />
            </div>
          </div>
        </div>
      </div>
      <QuotePrintView quote={quote} totals={totals} />
    </>
  );
}
