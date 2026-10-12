'use client';

import {
  formatProposalCurrency,
  formatProposalDateLabel,
  resolveProposalValue,
} from '@/lib/sales-proposals/stats';
import type { SalesProposal } from '@/lib/types/sales-proposals';

interface ProposalsWeeklyListProps {
  title: string;
  emptyLabel: string;
  proposals: SalesProposal[];
  closedDateLabel: string;
  resolveClosedDate: (proposal: SalesProposal) => string | null;
  showStatus?: boolean;
}

function formatProposalValue(proposalValue: number | null): string {
  if (proposalValue === null) return '—';
  return formatProposalCurrency(proposalValue);
}

export function ProposalsWeeklyList({
  title,
  emptyLabel,
  proposals,
  closedDateLabel,
  resolveClosedDate,
  showStatus = false,
}: ProposalsWeeklyListProps) {
  return (
    <div className="glass-card proposals-panel proposals-weekly-list">
      <div className="proposals-panel-head">
        <h3>{title}</h3>
        <p>{proposals.length} proposte</p>
      </div>
      {proposals.length === 0 ? (
        <p className="proposals-empty">{emptyLabel}</p>
      ) : (
        <div className="analysis-table-wrap">
          <table className="analysis-table">
            <thead>
              <tr>
                <th>Proposta</th>
                <th>Cliente</th>
                <th>Categoria</th>
                {showStatus && <th>Stato</th>}
                <th className="analysis-num">Valore</th>
                <th>{closedDateLabel}</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((proposal) => {
                const closedDate = resolveClosedDate(proposal);
                return (
                  <tr key={proposal.id}>
                    <td><strong>{proposal.nome}</strong></td>
                    <td>{proposal.cliente.trim() || '—'}</td>
                    <td>{proposal.categoria.trim() || '—'}</td>
                    {showStatus && <td>{proposal.stato.trim() || '—'}</td>}
                    <td className="analysis-num">{formatProposalValue(resolveProposalValue(proposal))}</td>
                    <td>{closedDate ? formatProposalDateLabel(closedDate) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
