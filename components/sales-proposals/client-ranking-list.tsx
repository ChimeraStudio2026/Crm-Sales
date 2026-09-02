'use client';

import { formatProposalCurrency } from '@/lib/sales-proposals/stats';
import type { ClientProposalStat } from '@/lib/types/sales-proposals';

interface ClientRankingListProps {
  stats: ClientProposalStat[];
}

export function ClientRankingList({ stats }: ClientRankingListProps) {
  if (stats.length === 0) {
    return <p className="proposals-empty">Nessun cliente con proposte accettate nell'anno selezionato.</p>;
  }
  return (
    <ol className="proposals-client-list">
      {stats.map((stat, index) => (
        <li key={stat.cliente} className="proposals-client-row">
          <span className="proposals-client-rank">{index + 1}</span>
          <div className="proposals-client-copy">
            <strong>{stat.cliente}</strong>
            <small>{stat.acceptedCount} {stat.acceptedCount === 1 ? 'proposta accettata' : 'proposte accettate'}</small>
          </div>
          <span className="proposals-client-value">{formatProposalCurrency(stat.totalValue)}</span>
        </li>
      ))}
    </ol>
  );
}
