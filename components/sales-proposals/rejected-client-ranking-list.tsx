'use client';

import { formatProposalCurrency } from '@/lib/sales-proposals/stats';
import type { RejectedClientStat } from '@/lib/types/sales-proposals';

interface RejectedClientRankingListProps {
  stats: RejectedClientStat[];
}

export function RejectedClientRankingList({ stats }: RejectedClientRankingListProps) {
  if (stats.length === 0) {
    return <p className="proposals-empty">Nessun cliente con proposte rifiutate nell'anno selezionato.</p>;
  }
  return (
    <ol className="proposals-rejected-client-ranking">
      {stats.map((stat, index) => (
        <li key={stat.cliente} className="proposals-rejected-client-ranking-item">
          <div className="proposals-rejected-client-ranking-main">
            <span className="proposals-rejected-client-ranking-position">{index + 1}</span>
            <div className="proposals-rejected-client-ranking-copy">
              <strong>{stat.cliente}</strong>
              <span>
                {stat.rejectedCount} {stat.rejectedCount === 1 ? 'proposta rifiutata' : 'proposte rifiutate'}
              </span>
            </div>
          </div>
          <strong className="proposals-rejected-client-ranking-value">
            {formatProposalCurrency(stat.rejectedTotal)}
          </strong>
        </li>
      ))}
    </ol>
  );
}
