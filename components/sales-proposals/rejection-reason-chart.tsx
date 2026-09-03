'use client';

import { useMemo } from 'react';
import { formatProposalCurrency } from '@/lib/sales-proposals/stats';
import type { ProposalRejectionReasonStat } from '@/lib/types/sales-proposals';

interface RejectionReasonChartProps {
  stats: ProposalRejectionReasonStat[];
}

export function RejectionReasonChart({ stats }: RejectionReasonChartProps) {
  const maxCount = useMemo(
    () => Math.max(...stats.map((stat) => stat.count), 0),
    [stats],
  );
  if (stats.length === 0) {
    return <p className="proposals-empty">Nessuna proposta rifiutata nell'anno selezionato.</p>;
  }
  return (
    <div className="proposals-bar-chart" role="img" aria-label="Proposte rifiutate per motivazione">
      {stats.map((stat) => {
        const widthPct = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
        return (
          <div key={stat.motivo} className="proposals-bar-row">
            <span className="proposals-bar-label">{stat.motivo}</span>
            <div className="proposals-bar-track">
              <div className="proposals-bar-fill proposals-bar-fill--danger" style={{ width: `${widthPct}%` }} />
            </div>
            <div className="proposals-bar-meta">
              <strong>{stat.count}</strong>
              <small>
                {stat.count === 1 ? 'proposta' : 'proposte'}
                {stat.totalValue > 0 ? ` · ${formatProposalCurrency(stat.totalValue)}` : ''}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}
