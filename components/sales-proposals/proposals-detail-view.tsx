'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { ProposalsDetailTimelineTable } from '@/components/sales-proposals/proposals-detail-timeline-table';
import { RejectedClientRankingList } from '@/components/sales-proposals/rejected-client-ranking-list';
import { RejectionReasonChart } from '@/components/sales-proposals/rejection-reason-chart';
import {
  formatProposalCurrency,
  formatProposalDateLabel,
  resolveProposalDetailGroupLabel,
  resolveProposalValue,
  sortProposalsByCreatedDate,
} from '@/lib/sales-proposals/stats';
import type {
  ProposalDetailFilter,
  ProposalDetailGroup,
  ProposalRejectionReasonStat,
  RejectedClientStat,
  SalesProposal,
} from '@/lib/types/sales-proposals';

type ProposalsDetailLayout = 'grouped' | 'timeline';

interface ProposalsDetailViewProps {
  title: string;
  filter: ProposalDetailFilter;
  proposals: SalesProposal[];
  groups: ProposalDetailGroup[];
  rejectionReasonStats?: ProposalRejectionReasonStat[];
  rejectedClientStats?: RejectedClientStat[];
  totalCount: number;
  totalValue: number;
  onBack: () => void;
}

function formatProposalValue(proposalValue: number | null): string {
  if (proposalValue === null) return '—';
  return formatProposalCurrency(proposalValue);
}

interface ProposalDetailGroupAccordionProps {
  group: ProposalDetailGroup;
  showCategoryColumn: boolean;
  defaultOpen: boolean;
}

function ProposalDetailGroupAccordion({
  group,
  showCategoryColumn,
  defaultOpen,
}: ProposalDetailGroupAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`analysis-accordion proposals-detail-accordion${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="analysis-accordion-toggle"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <ChevronRight size={18} className="analysis-accordion-icon" />
        <span>{group.label}</span>
        <span className="analysis-accordion-meta">
          {group.count} proposte
          {group.totalValue > 0 ? ` · ${formatProposalCurrency(group.totalValue)}` : ''}
        </span>
      </button>
      {isOpen ? (
        <div className="analysis-accordion-body proposals-detail-accordion-body">
          <div className="analysis-table-wrap">
            <table className="analysis-table">
              <thead>
                <tr>
                  <th>Proposta</th>
                  <th>Cliente</th>
                  {showCategoryColumn ? <th>Categoria</th> : null}
                  <th className="analysis-num">Valore</th>
                  <th>Creato il</th>
                </tr>
              </thead>
              <tbody>
                {group.proposals.map((proposal) => {
                  const value = resolveProposalValue(proposal);
                  return (
                    <tr key={proposal.id}>
                      <td><strong>{proposal.nome}</strong></td>
                      <td>{proposal.cliente.trim() || '—'}</td>
                      {showCategoryColumn ? (
                        <td>{proposal.categoria.trim() || '—'}</td>
                      ) : null}
                      <td className="analysis-num">{formatProposalValue(value)}</td>
                      <td>{formatProposalDateLabel(proposal.creatoIl)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface ProposalsCollapsiblePanelProps {
  title: string;
  meta: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

function ProposalsCollapsiblePanel({
  title,
  meta,
  defaultOpen = false,
  children,
}: ProposalsCollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`analysis-accordion proposals-detail-accordion proposals-detail-collapsible${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="analysis-accordion-toggle"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <ChevronRight size={18} className="analysis-accordion-icon" />
        <span>{title}</span>
        <span className="analysis-accordion-meta">{meta}</span>
      </button>
      {isOpen ? (
        <div className="analysis-accordion-body proposals-detail-collapsible-body">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ProposalsDetailView({
  title,
  filter,
  proposals,
  groups,
  rejectionReasonStats = [],
  rejectedClientStats = [],
  totalCount,
  totalValue,
  onBack,
}: ProposalsDetailViewProps) {
  const [layout, setLayout] = useState<ProposalsDetailLayout>('grouped');
  useEffect(() => {
    setLayout('grouped');
  }, [filter, title]);
  const showCategoryColumn = filter === 'rejected';
  const groupLabel = resolveProposalDetailGroupLabel(filter);
  const timelineProposals = useMemo(
    () => sortProposalsByCreatedDate(proposals),
    [proposals],
  );
  const layoutHint = layout === 'grouped'
    ? `raggruppate per ${groupLabel}.`
    : 'lista temporale · più recenti in alto.';
  return (
    <div className="proposals-detail">
      <div className="proposals-detail-toolbar">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Panoramica</span>
        </button>
      </div>
      <div className="glass-card proposals-panel proposals-detail-head">
        <div className="proposals-panel-head">
          <h3>{title}</h3>
          <p>
            {totalCount} proposte
            {totalValue > 0 ? ` · ${formatProposalCurrency(totalValue)}` : ''}
            {' · '}{layoutHint}
          </p>
        </div>
      </div>
      {proposals.length > 0 ? (
        <div className="proposals-detail-view-toolbar">
          <div className="task-view-toggle" role="group" aria-label="Layout elenco proposte">
            <button
              type="button"
              className={`task-view-toggle-btn${layout === 'grouped' ? ' is-active' : ''}`}
              onClick={() => setLayout('grouped')}
            >
              {filter === 'rejected' ? 'Per motivazione' : 'Per categoria'}
            </button>
            <button
              type="button"
              className={`task-view-toggle-btn${layout === 'timeline' ? ' is-active' : ''}`}
              onClick={() => setLayout('timeline')}
            >
              Lista temporale
            </button>
          </div>
        </div>
      ) : null}
      {filter === 'rejected' && rejectionReasonStats.length > 0 ? (
        <div className="glass-card proposals-panel">
          <div className="proposals-panel-head">
            <h3>Rifiuti per motivazione</h3>
            <p>Panoramica del numero di proposte rifiutate per ogni motivo.</p>
          </div>
          <RejectionReasonChart stats={rejectionReasonStats} />
        </div>
      ) : null}
      {filter === 'rejected' && rejectedClientStats.length > 0 ? (
        <ProposalsCollapsiblePanel
          title="Clienti per proposte rifiutate"
          meta={`${rejectedClientStats.length} clienti · ranking per numero di rifiuti`}
          defaultOpen
        >
          <RejectedClientRankingList stats={rejectedClientStats} />
        </ProposalsCollapsiblePanel>
      ) : null}
      {proposals.length === 0 ? (
        <p className="proposals-empty">Nessuna proposta per la selezione corrente.</p>
      ) : layout === 'timeline' ? (
        <ProposalsDetailTimelineTable filter={filter} proposals={timelineProposals} />
      ) : (
        <div className="proposals-detail-groups">
          {groups.map((group, index) => (
            <ProposalDetailGroupAccordion
              key={group.label}
              group={group}
              showCategoryColumn={showCategoryColumn}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
