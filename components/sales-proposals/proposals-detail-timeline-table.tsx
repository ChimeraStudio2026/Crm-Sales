'use client';

import {
  formatProposalCurrency,
  formatProposalDateLabel,
  resolveProposalValue,
} from '@/lib/sales-proposals/stats';
import type { ProposalDetailFilter, SalesProposal } from '@/lib/types/sales-proposals';

interface ProposalsDetailTimelineTableProps {
  filter: ProposalDetailFilter;
  proposals: SalesProposal[];
}

function formatProposalValue(proposalValue: number | null): string {
  if (proposalValue === null) return '—';
  return formatProposalCurrency(proposalValue);
}

function resolveTimelineGroupLabel(proposal: SalesProposal, filter: ProposalDetailFilter): string {
  if (filter === 'rejected') {
    return proposal.motivoRifiuto.trim() || 'Senza motivazione';
  }
  return proposal.categoria.trim() || 'Senza categoria';
}

export function ProposalsDetailTimelineTable({
  filter,
  proposals,
}: ProposalsDetailTimelineTableProps) {
  const groupColumnLabel = filter === 'rejected' ? 'Motivazione' : 'Categoria';
  if (proposals.length === 0) {
    return <p className="proposals-empty">Nessuna proposta per la selezione corrente.</p>;
  }
  return (
    <div className="glass-card proposals-panel proposals-detail-timeline">
      <div className="analysis-table-wrap">
        <table className="analysis-table">
          <thead>
            <tr>
              <th>Creato il</th>
              <th>Proposta</th>
              <th>Cliente</th>
              <th>{groupColumnLabel}</th>
              <th className="analysis-num">Valore</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map((proposal) => {
              const value = resolveProposalValue(proposal);
              return (
                <tr key={proposal.id}>
                  <td>{formatProposalDateLabel(proposal.creatoIl)}</td>
                  <td><strong>{proposal.nome}</strong></td>
                  <td>{proposal.cliente.trim() || '—'}</td>
                  <td>{resolveTimelineGroupLabel(proposal, filter)}</td>
                  <td className="analysis-num">{formatProposalValue(value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
