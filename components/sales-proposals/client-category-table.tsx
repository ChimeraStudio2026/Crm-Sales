'use client';

import { collectClientTableCategories, formatProposalCurrency } from '@/lib/sales-proposals/stats';
import type { ClientProposalStat } from '@/lib/types/sales-proposals';

interface ClientCategoryTableProps {
  stats: ClientProposalStat[];
}

export function ClientCategoryTable({ stats }: ClientCategoryTableProps) {
  const categories = collectClientTableCategories(stats);
  if (stats.length === 0) {
    return <p className="proposals-empty">Nessun dato cliente × categoria per l'anno selezionato.</p>;
  }
  return (
    <div className="analysis-table-wrap">
      <table className="analysis-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Totale accettato</th>
            {categories.map((categoria) => (
              <th key={categoria} className="analysis-num">{categoria}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((stat) => (
            <tr key={stat.cliente}>
              <td><strong>{stat.cliente}</strong></td>
              <td className="analysis-num">{formatProposalCurrency(stat.totalValue)}</td>
              {categories.map((categoria) => (
                <td key={categoria} className="analysis-num">
                  {stat.countsByCategory[categoria] || 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
