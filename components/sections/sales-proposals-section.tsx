'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { TopHeader } from '@/components/layout/top-header';
import { CategoryTicketChart } from '@/components/sales-proposals/category-ticket-chart';
import { ClientCategoryTable } from '@/components/sales-proposals/client-category-table';
import { ClientRankingList } from '@/components/sales-proposals/client-ranking-list';
import { ProposalsImportCard } from '@/components/sales-proposals/proposals-import-card';
import { createBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchSalesProposals } from '@/lib/supabase/sales-proposals-database';
import {
  buildCategoryTicketStats,
  buildClientProposalStats,
  buildProposalKpis,
  collectProposalYears,
  filterProposalsByYear,
  formatProposalDateLabel,
  formatProposalPercent,
  resolveLatestImportBatch,
} from '@/lib/sales-proposals/stats';
import { ANALYSIS_YEAR } from '@/lib/constants/crm';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import type { SalesProposal } from '@/lib/types/sales-proposals';

function resolveDefaultYear(years: number[], currentYear: number): number {
  if (years.includes(currentYear)) return currentYear;
  return years[years.length - 1] || ANALYSIS_YEAR;
}

export function SalesProposalsSection() {
  const { showToast } = useCrm();
  const { workspaceId } = useWorkspace();
  const currentYear = new Date().getFullYear();
  const [proposals, setProposals] = useState<SalesProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const loadProposals = useCallback(async (): Promise<void> => {
    const db = createBrowserSupabaseClient();
    if (!isSupabaseConfigured() || !db) {
      setProposals([]);
      setIsLoading(false);
      showToast('Supabase non configurato.', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const rows = await fetchSalesProposals(db, workspaceId);
      setProposals(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore lettura proposte.';
      showToast(message, 'danger');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, workspaceId]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  const yearOptions = useMemo(
    () => collectProposalYears(proposals, currentYear),
    [currentYear, proposals],
  );

  useEffect(() => {
    if (!yearOptions.includes(selectedYear)) {
      setSelectedYear(resolveDefaultYear(yearOptions, currentYear));
    }
  }, [currentYear, selectedYear, yearOptions]);

  const yearProposals = useMemo(
    () => filterProposalsByYear(proposals, selectedYear),
    [proposals, selectedYear],
  );
  const kpis = useMemo(() => buildProposalKpis(yearProposals), [yearProposals]);
  const categoryStats = useMemo(() => buildCategoryTicketStats(yearProposals), [yearProposals]);
  const clientStats = useMemo(
    () => buildClientProposalStats(yearProposals),
    [yearProposals],
  );
  const latestBatch = useMemo(() => resolveLatestImportBatch(yearProposals), [yearProposals]);
  const isCurrentYear = selectedYear === currentYear;

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="proposals-toolbar">
            <div>
              <h3>Preventivi commerciali</h3>
              <p>Analisi delle richieste cliente importate dallo scarico CSV mensile.</p>
            </div>
            <div className="analysis-year-switcher" role="group" aria-label="Seleziona anno proposte">
              {yearOptions.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={`analysis-year-switcher-btn${selectedYear === year ? ' is-active' : ''}`}
                  aria-pressed={selectedYear === year}
                  onClick={() => setSelectedYear(year)}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
          {isCurrentYear ? (
            <p className="proposals-year-hint">
              Anno in corso: i dati possono essere parziali fino all'ultimo scarico
              {latestBatch ? ` del ${formatProposalDateLabel(latestBatch)}` : ''}.
            </p>
          ) : null}
          <ProposalsImportCard
            workspaceId={workspaceId}
            existingProposals={proposals}
            isDisabled={isLoading}
            onImported={loadProposals}
            onToast={showToast}
          />
          {isLoading ? (
            <p className="proposals-empty">Caricamento proposte...</p>
          ) : (
            <>
              <div className="proposals-kpi-grid">
                <div className="analysis-kpi-card">
                  <span className="analysis-kpi-label">Proposte totali</span>
                  <strong className="analysis-kpi-value">{kpis.totalCount}</strong>
                  <span className="analysis-kpi-hint">{selectedYear}</span>
                </div>
                <div className="analysis-kpi-card">
                  <span className="analysis-kpi-label">Accettate</span>
                  <strong className="analysis-kpi-value analysis-kpi-positive">{kpis.acceptedCount}</strong>
                  <span className="analysis-kpi-hint">Stato Si</span>
                </div>
                <div className="analysis-kpi-card">
                  <span className="analysis-kpi-label">Rifiutate</span>
                  <strong className="analysis-kpi-value analysis-kpi-negative">{kpis.rejectedCount}</strong>
                  <span className="analysis-kpi-hint">Stato No</span>
                </div>
                <div className="analysis-kpi-card">
                  <span className="analysis-kpi-label">Conversione sul totale</span>
                  <strong className="analysis-kpi-value">{formatProposalPercent(kpis.conversionOnTotal)}</strong>
                  <span className="analysis-kpi-hint">{kpis.acceptedCount} su {kpis.totalCount}</span>
                </div>
                <div className="analysis-kpi-card">
                  <span className="analysis-kpi-label">Conversione su decise</span>
                  <strong className="analysis-kpi-value">{formatProposalPercent(kpis.conversionOnDecided)}</strong>
                  <span className="analysis-kpi-hint">
                    {kpis.acceptedCount} su {kpis.acceptedCount + kpis.rejectedCount}
                    {kpis.openCount > 0 ? ` · ${kpis.openCount} aperte escluse` : ''}
                  </span>
                </div>
              </div>
              <div className="glass-card proposals-panel">
                <div className="proposals-panel-head">
                  <h3><BarChart3 size={18} /> Ticket medio per categoria</h3>
                  <p>Solo proposte accettate. Valore = Budget Finale, con fallback su Ultimo prezzo.</p>
                </div>
                <CategoryTicketChart stats={categoryStats} />
              </div>
              <div className="glass-card proposals-panel">
                <div className="proposals-panel-head">
                  <h3>Top clienti per valore accettato</h3>
                  <p>Ordinati per valore totale delle proposte accettate nell'anno selezionato.</p>
                </div>
                <ClientRankingList stats={clientStats} />
              </div>
              <div className="glass-card proposals-panel">
                <div className="proposals-panel-head">
                  <h3>Cliente × categoria</h3>
                  <p>
                    Ogni riga è un cliente con proposte accettate. Il totale è la somma dei valori accettati.
                    Le colonne categoria mostrano il conteggio per tipologia.
                  </p>
                </div>
                <ClientCategoryTable stats={clientStats} />
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
