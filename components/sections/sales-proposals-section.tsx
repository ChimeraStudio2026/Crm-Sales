'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { TopHeader } from '@/components/layout/top-header';
import { CategoryTicketChart } from '@/components/sales-proposals/category-ticket-chart';
import { ProposalsDetailView } from '@/components/sales-proposals/proposals-detail-view';
import { ProposalsKpiCard } from '@/components/sales-proposals/proposals-kpi-card';
import { ProposalsImportCard } from '@/components/sales-proposals/proposals-import-card';
import { ProposalsList } from '@/components/sales-proposals/proposals-list';
import { ProposalsWeeklyReview } from '@/components/sales-proposals/proposals-weekly-review';
import { createBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchSalesProposals, updateSalesProposalReferenceYear } from '@/lib/supabase/sales-proposals-database';
import {
  buildCategoryTicketStats,
  buildProposalCategoryGroups,
  buildProposalKpis,
  buildProposalRejectionReasonGroups,
  buildRejectedClientStats,
  buildRejectionReasonStats,
  collectProposalYears,
  filterProposalsByYear,
  filterProposalsForDetail,
  formatProposalConversionDuration,
  formatProposalCurrency,
  formatProposalDateLabel,
  formatProposalPercent,
  resolveLatestImportBatch,
  resolveProposalDetailTitle,
  sumProposalValues,
} from '@/lib/sales-proposals/stats';
import { ANALYSIS_YEAR } from '@/lib/constants/crm';
import { normalizeOwner } from '@/lib/crm/owners';
import { normalizeClientKey } from '@/lib/reminders/shared';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import type { ProposalDetailFilter, SalesProposal } from '@/lib/types/sales-proposals';

type ProposalsViewMode = 'overview' | 'weekly';

function resolveDefaultYear(years: number[], currentYear: number): number {
  if (years.includes(currentYear)) return currentYear;
  return years[years.length - 1] || ANALYSIS_YEAR;
}

export function SalesProposalsSection() {
  const { clients, showToast } = useCrm();
  const { workspaceId, access } = useWorkspace();
  const currentYear = new Date().getFullYear();
  const [allProposals, setProposals] = useState<SalesProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [detailFilter, setDetailFilter] = useState<ProposalDetailFilter | null>(null);
  const [viewMode, setViewMode] = useState<ProposalsViewMode>('overview');

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

  // Accesso personale: solo le proposte contattate da sé o dei propri clienti.
  const proposals = useMemo(() => {
    const scopeOwner = access.scopeOwner;
    if (!scopeOwner) return allProposals;
    const firstName = scopeOwner.split(' ')[0].toLowerCase();
    const ownClientKeys = new Set(clients
      .filter((client) => normalizeOwner(client.owner) === scopeOwner)
      .map((client) => normalizeClientKey(client.name)));
    return allProposals.filter((proposal) => proposal.contattatoDa.trim().toLowerCase() === firstName
      || (proposal.cliente && ownClientKeys.has(normalizeClientKey(proposal.cliente))));
  }, [access.scopeOwner, allProposals, clients]);

  const handleMoveYear = useCallback(async (proposal: SalesProposal, year: number | null): Promise<void> => {
    const db = createBrowserSupabaseClient();
    if (!db) return;
    try {
      await updateSalesProposalReferenceYear(db, proposal.id, year);
      setProposals((prev) => prev.map((item) => (item.id === proposal.id ? { ...item, annoRiferimento: year } : item)));
      showToast(year ? `${proposal.nome} ora conta nel ${year}.` : `${proposal.nome} torna nel suo anno di creazione.`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Spostamento non riuscito.', 'danger');
    }
  }, [showToast]);

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
  const rejectedClientStats = useMemo(() => {
    if (detailFilter !== 'rejected') return [];
    return buildRejectedClientStats(detailProposals);
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
              <p>Analisi delle richieste cliente sincronizzate da Cerbero.</p>
            </div>
            <div className="proposals-toolbar-actions">
              <div className="task-view-toggle" role="group" aria-label="Vista proposte">
                <button
                  type="button"
                  className={`task-view-toggle-btn${viewMode === 'overview' ? ' is-active' : ''}`}
                  onClick={() => {
                    setViewMode('overview');
                    setDetailFilter(null);
                  }}
                >
                  Panoramica
                </button>
                <button
                  type="button"
                  className={`task-view-toggle-btn${viewMode === 'weekly' ? ' is-active' : ''}`}
                  onClick={() => {
                    setViewMode('weekly');
                    setDetailFilter(null);
                  }}
                >
                  Weekly review
                </button>
              </div>
              {viewMode === 'overview' ? (
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
              ) : null}
            </div>
          </div>
          {isCurrentYear ? (
            <p className="proposals-year-hint">
              Anno in corso
              {latestBatch ? ` · proposte aggiornate al ${formatProposalDateLabel(latestBatch)}` : ''}.
            </p>
          ) : null}
          {access.navMode !== 'personal' && (
          <ProposalsImportCard
            workspaceId={workspaceId}
            existingProposals={allProposals}
            isDisabled={isLoading}
            onImported={loadProposals}
            onToast={showToast}
          />
          )}
          {isLoading ? (
            <p className="proposals-empty">Caricamento proposte...</p>
          ) : viewMode === 'weekly' ? (
            <ProposalsWeeklyReview proposals={proposals} />
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
                  label="Conversione su decise"
                  value={formatProposalPercent(kpis.conversionOnDecided)}
                  hint={`${kpis.acceptedCount} su ${kpis.acceptedCount + kpis.rejectedCount}${
                    kpis.openCount > 0 ? ` · ${kpis.openCount} pending escluse` : ''
                  }`}
                />
                <ProposalsKpiCard
                  label="Ticket medio totale"
                  value={formatProposalCurrency(kpis.acceptedAverageTicket)}
                  hint={
                    kpis.acceptedValuedCount > 0
                      ? `${kpis.acceptedValuedCount} accettate con valore · tutte le categorie`
                      : 'Nessuna proposta accettata con valore'
                  }
                />
                <ProposalsKpiCard
                  label="Tempo di conversione"
                  value={formatProposalConversionDuration(kpis.averageConversionDays)}
                  hint={
                    kpis.conversionSampleCount > 0
                      ? `Media su ${kpis.conversionSampleCount} proposte chiuse (Si/No) · da creazione a chiusura`
                      : 'Nessuna proposta chiusa con date complete'
                  }
                />
              </div>
              {detailFilter ? (
                <ProposalsDetailView
                  title={resolveProposalDetailTitle(detailFilter)}
                  filter={detailFilter}
                  proposals={detailProposals}
                  groups={detailGroups}
                  rejectionReasonStats={rejectionReasonStats}
                  rejectedClientStats={rejectedClientStats}
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
                  <ProposalsList
                    key={selectedYear}
                    proposals={proposals}
                    yearOptions={yearOptions}
                    defaultYear={selectedYear}
                    currentYear={currentYear}
                    onMoveYear={handleMoveYear}
                  />
                </>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
