'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { TopHeader } from '@/components/layout/top-header';
import { CategoryTicketChart } from '@/components/sales-proposals/category-ticket-chart';
import { ClientCategoryTable } from '@/components/sales-proposals/client-category-table';
import { ProposalsDetailView } from '@/components/sales-proposals/proposals-detail-view';
import { ProposalsKpiCard } from '@/components/sales-proposals/proposals-kpi-card';
import { ProposalsImportCard } from '@/components/sales-proposals/proposals-import-card';
import { createBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchSalesProposals } from '@/lib/supabase/sales-proposals-database';
import {
  buildCategoryTicketStats,
  buildClientProposalStats,
  buildProposalCategoryGroups,
  buildProposalKpis,
  buildProposalRejectionReasonGroups,
  buildRejectionReasonStats,
  collectProposalYears,
  filterProposalsByYear,
  filterProposalsForDetail,
  formatProposalCurrency,
  formatProposalDateLabel,
  formatProposalPercent,
  resolveLatestImportBatch,
  resolveProposalDetailTitle,
  sumProposalValues,
} from '@/lib/sales-proposals/stats';
import { ANALYSIS_YEAR } from '@/lib/constants/crm';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import type { ProposalDetailFilter, SalesProposal } from '@/lib/types/sales-proposals';

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
  const [detailFilter, setDetailFilter] = useState<ProposalDetailFilter | null>(null);

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
  const detailProposals = useMemo(() => {
    if (!detailFilter) return [];
    return filterProposalsForDetail(yearProposals, detailFilter);
  }, [detailFilter, yearProposals]);
  const detailGroups = useMemo(() => {
    if (!detailFilter) return [];
    if (detailFilter === 'rejected') return buildProposalRejectionReasonGroups(detailProposals);
    return buildProposalCategoryGroups(detailProposals);
  }, [detailFilter, detailProposals]);
  const rejectionReasonStats = useMemo(() => {
    if (detailFilter !== 'rejected') return [];
    return buildRejectionReasonStats(detailProposals);
  }, [detailFilter, detailProposals]);
  const detailTotalValue = useMemo(
    () => sumProposalValues(detailProposals),
    [detailProposals],
  );

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
                <ProposalsKpiCard
                  label="Proposte totali"
                  value={kpis.totalCount}
                  hint={String(selectedYear)}
                />
                <ProposalsKpiCard
                  label="Accettate"
                  value={kpis.acceptedCount}
                  amountLabel={formatProposalCurrency(kpis.acceptedTotal)}
                  hint="Stato Si"
                  valueClassName="analysis-kpi-positive"
                  isClickable
                  onClick={() => setDetailFilter('accepted')}
                />
                <ProposalsKpiCard
                  label="Rifiutate"
                  value={kpis.rejectedCount}
                  amountLabel={formatProposalCurrency(kpis.rejectedTotal)}
                  hint="Stato No"
                  valueClassName="analysis-kpi-negative"
                  isClickable
                  onClick={() => setDetailFilter('rejected')}
                />
                <ProposalsKpiCard
                  label="Pending"
                  value={kpis.openCount}
                  amountLabel={formatProposalCurrency(kpis.pendingTotal)}
                  hint="Senza esito"
                  valueClassName="proposals-kpi-pending"
                  isClickable
                  onClick={() => setDetailFilter('pending')}
                />
                <ProposalsKpiCard
                  label="Conversione sul totale"
                  value={formatProposalPercent(kpis.conversionOnTotal)}
                  hint={`${kpis.acceptedCount} su ${kpis.totalCount}`}
                />
                <ProposalsKpiCard
                  label="Conversione su decise"
                  value={formatProposalPercent(kpis.conversionOnDecided)}
                  hint={`${kpis.acceptedCount} su ${kpis.acceptedCount + kpis.rejectedCount}${
                    kpis.openCount > 0 ? ` · ${kpis.openCount} pending escluse` : ''
                  }`}
                />
              </div>
              {detailFilter ? (
                <ProposalsDetailView
                  title={resolveProposalDetailTitle(detailFilter)}
                  filter={detailFilter}
                  groups={detailGroups}
                  rejectionReasonStats={rejectionReasonStats}
                  totalCount={detailProposals.length}
                  totalValue={detailTotalValue}
                  onBack={() => setDetailFilter(null)}
                />
              ) : (
                <>
                  <div className="glass-card proposals-panel">
                    <div className="proposals-panel-head">
                      <h3><BarChart3 size={18} /> Ticket medio per categoria</h3>
                      <p>Solo proposte accettate. Valore = Budget Finale, con fallback su Ultimo prezzo.</p>
                    </div>
                    <CategoryTicketChart stats={categoryStats} />
                  </div>
                  <div className="glass-card proposals-panel">
                    <div className="proposals-panel-head">
                      <h3>Cliente × categoria</h3>
                      <p>
                        Ogni riga è un cliente con proposte accettate.
                        Le colonne categoria mostrano il conteggio per tipologia.
                      </p>
                    </div>
                    <ClientCategoryTable stats={clientStats} />
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
