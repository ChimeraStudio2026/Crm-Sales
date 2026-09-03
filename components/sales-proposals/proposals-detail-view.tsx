'use client';

import { ArrowLeft } from 'lucide-react';
import { RejectionReasonChart } from '@/components/sales-proposals/rejection-reason-chart';
import {
  formatProposalCurrency,
  formatProposalDateLabel,
  resolveProposalDetailGroupLabel,
  resolveProposalValue,
} from '@/lib/sales-proposals/stats';
import type {
  ProposalDetailFilter,
  ProposalDetailGroup,
  ProposalRejectionReasonStat,
} from '@/lib/types/sales-proposals';

interface ProposalsDetailViewProps {
  title: string;
  filter: ProposalDetailFilter;
  groups: ProposalDetailGroup[];
  rejectionReasonStats?: ProposalRejectionReasonStat[];
  totalCount: number;
  totalValue: number;
  onBack: () => void;
}

function formatProposalValue(proposalValue: number | null): string {
  if (proposalValue === null) return '—';
  return formatProposalCurrency(proposalValue);
}

export function ProposalsDetailView({
  title,
  filter,
  groups,
  rejectionReasonStats = [],
  totalCount,
  totalValue,
  onBack,
}: ProposalsDetailViewProps) {
  const showCategoryColumn = filter === 'rejected';
  const groupLabel = resolveProposalDetailGroupLabel(filter);
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
            {' · '}raggruppate per {groupLabel}.
          </p>
        </div>
      </div>
      {filter === 'rejected' && rejectionReasonStats.length > 0 ? (
        <div className="glass-card proposals-panel">
          <div className="proposals-panel-head">
            <h3>Rifiuti per motivazione</h3>
            <p>Panoramica del numero di proposte rifiutate per ogni motivo.</p>
          </div>
          <RejectionReasonChart stats={rejectionReasonStats} />
        </div>
      ) : null}
      {groups.length === 0 ? (
        <p className="proposals-empty">Nessuna proposta per la selezione corrente.</p>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="glass-card proposals-panel proposals-detail-group">
            <div className="proposals-detail-group-head">
              <h4>{group.label}</h4>
              <span>
                {group.count} proposte
                {group.totalValue > 0 ? ` · ${formatProposalCurrency(group.totalValue)}` : ''}
              </span>
            </div>
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
        ))
      )}
    </div>
  );
}
