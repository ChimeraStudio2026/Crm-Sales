'use client';

import { formatProposalCurrency } from '@/lib/sales-proposals/stats';
import type { ClientProposalStat } from '@/lib/types/sales-proposals';

const DEFAULT_TOP_COUNT = 20;

interface ClientRankingListProps {
  stats: ClientProposalStat[];
  topCount?: number;
}

export function ClientRankingList({ stats, topCount = DEFAULT_TOP_COUNT }: ClientRankingListProps) {
  const visibleStats = stats.slice(0, topCount);
  if (visibleStats.length === 0) {
    return <p className="proposals-empty">Nessun cliente con proposte accettate nell'anno selezionato.</p>;
  }
  return (
    <ol className="proposals-client-ranking">
      {visibleStats.map((stat, index) => (
        <li key={stat.cliente} className="proposals-client-ranking-item">
          <div className="proposals-client-ranking-main">
            <span className="proposals-client-ranking-position">{index + 1}</span>
            <div className="proposals-client-ranking-copy">
              <strong>{stat.cliente}</strong>
              <span>{stat.acceptedCount} proposte accettate</span>
            </div>
          </div>
          <strong className="proposals-client-ranking-value">
            {formatProposalCurrency(stat.acceptedTotal)}
          </strong>
        </li>
      ))}
    </ol>
  );
}
