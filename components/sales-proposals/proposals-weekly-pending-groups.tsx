'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  buildProposalCategoryGroups,
  formatProposalCurrency,
  formatProposalDateLabel,
  resolveProposalValue,
} from '@/lib/sales-proposals/stats';
import type { SalesProposal } from '@/lib/types/sales-proposals';

interface ProposalsWeeklyPendingGroupsProps {
  proposals: SalesProposal[];
}

function formatProposalValue(proposalValue: number | null): string {
  if (proposalValue === null) return '—';
  return formatProposalCurrency(proposalValue);
}

export function ProposalsWeeklyPendingGroups({ proposals }: ProposalsWeeklyPendingGroupsProps) {
  const groups = buildProposalCategoryGroups(proposals);
  if (proposals.length === 0) {
    return (
      <div className="glass-card proposals-panel proposals-weekly-list">
        <div className="proposals-panel-head">
          <h3>Proposte ancora pending</h3>
          <p>Nessuna nuova proposta rimasta aperta a fine settimana.</p>
        </div>
        <p className="proposals-empty">
          Create nella settimana selezionata e non chiuse Si/No entro domenica.
        </p>
      </div>
    );
  }
  return (
    <div className="glass-card proposals-panel proposals-weekly-pending-panel">
      <div className="proposals-panel-head">
        <h3>Proposte ancora pending</h3>
        <p>
          {proposals.length} proposte create nella settimana e non chiuse Si/No entro fine settimana
          · scorporo per categoria
        </p>
      </div>
      <div className="proposals-weekly-pending-groups">
        {groups.map((group, index) => (
          <WeeklyPendingCategoryAccordion key={group.label} group={group} defaultOpen={index === 0} />
        ))}
      </div>
    </div>
  );
}

interface WeeklyPendingCategoryAccordionProps {
  group: ReturnType<typeof buildProposalCategoryGroups>[number];
  defaultOpen: boolean;
}

function WeeklyPendingCategoryAccordion({
  group,
  defaultOpen,
}: WeeklyPendingCategoryAccordionProps) {
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
                  <th className="analysis-num">Valore</th>
                  <th>Stato</th>
                  <th>Creata il</th>
                </tr>
              </thead>
              <tbody>
                {group.proposals.map((proposal) => (
                  <tr key={proposal.id}>
                    <td><strong>{proposal.nome}</strong></td>
                    <td>{proposal.cliente.trim() || '—'}</td>
                    <td className="analysis-num">{formatProposalValue(resolveProposalValue(proposal))}</td>
                    <td>{proposal.stato.trim() || 'Pending'}</td>
                    <td>{formatProposalDateLabel(proposal.creatoIl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
