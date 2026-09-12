'use client';

import { ProposalsKpiCard } from '@/components/sales-proposals/proposals-kpi-card';
import { formatProposalCurrency } from '@/lib/sales-proposals/stats';
import type { ProposalWeeklyReviewSummary } from '@/lib/types/sales-proposals';

interface ProposalsWeeklyReviewProps {
  summary: ProposalWeeklyReviewSummary;
}

export function ProposalsWeeklyReview({ summary }: ProposalsWeeklyReviewProps) {
  return (
    <div className="proposals-weekly-review">
      <div className="glass-card proposals-panel proposals-weekly-review-head">
        <div className="proposals-panel-head">
          <h3>Weekly review</h3>
          <p>
            Settimana passata ({summary.weekLabel}): nuove proposte per data di creazione;
            Si e No per data di accettazione o rifiuto.
          </p>
        </div>
      </div>
      <div className="proposals-weekly-kpi-grid">
        <ProposalsKpiCard
          label="Nuove proposte"
          value={summary.newCount}
          amountLabel={formatProposalCurrency(summary.newTotalValue)}
          hint="Arrivate la settimana scorsa · valore quotato"
        />
        <ProposalsKpiCard
          label="Andate in Si"
          value={summary.acceptedCount}
          amountLabel={formatProposalCurrency(summary.acceptedTotalValue)}
          hint="Chiuse Si la settimana scorsa"
          valueClassName="analysis-kpi-positive"
        />
        <ProposalsKpiCard
          label="Andate in No"
          value={summary.rejectedCount}
          amountLabel={formatProposalCurrency(summary.rejectedTotalValue)}
          hint="Chiuse No la settimana scorsa"
          valueClassName="analysis-kpi-negative"
        />
      </div>
    </div>
  );
}
