'use client';

import { useMemo } from 'react';
import { formatProposalCurrency } from '@/lib/sales-proposals/stats';
import type { CategoryTicketStat } from '@/lib/types/sales-proposals';

interface CategoryTicketChartProps {
  stats: CategoryTicketStat[];
}

export function CategoryTicketChart({ stats }: CategoryTicketChartProps) {
  const maxAverage = useMemo(
    () => Math.max(...stats.map((stat) => stat.averageTicket), 0),
    [stats],
  );
  if (stats.length === 0) {
    return <p className="proposals-empty">Nessuna proposta accettata nell'anno selezionato.</p>;
  }
  return (
    <div className="proposals-bar-chart" role="img" aria-label="Ticket medio per categoria">
      {stats.map((stat) => {
        const widthPct = maxAverage > 0 ? (stat.averageTicket / maxAverage) * 100 : 0;
        return (
          <div key={stat.categoria} className="proposals-bar-row">
            <span className="proposals-bar-label">{stat.categoria}</span>
            <div className="proposals-bar-track">
              <div className="proposals-bar-fill" style={{ width: `${widthPct}%` }} />
            </div>
            <div className="proposals-bar-meta">
              <strong>{formatProposalCurrency(stat.averageTicket)}</strong>
              <small>{stat.count} prop. · {formatProposalCurrency(stat.totalValue)}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}
