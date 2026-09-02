'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { formatCurrency } from '@/lib/crm/utils';
import { collectClientTableCategories } from '@/lib/sales-proposals/stats';
import type { ClientProposalStat } from '@/lib/types/sales-proposals';

const CLIENT_COLUMN = 'cliente' as const;
const OKR_COLUMN = 'okrTotal' as const;

type SortDirection = 'asc' | 'desc';

interface ClientCategoryTableProps {
  stats: ClientProposalStat[];
}

interface SortState {
  columnId: string;
  direction: SortDirection;
}

function isNumericColumn(columnId: string): boolean {
  return columnId !== CLIENT_COLUMN;
}

function readSortValue(stat: ClientProposalStat, columnId: string): string | number {
  if (columnId === CLIENT_COLUMN) return stat.cliente;
  if (columnId === OKR_COLUMN) return stat.okrTotal;
  return stat.countsByCategory[columnId] || 0;
}

function compareStats(
  left: ClientProposalStat,
  right: ClientProposalStat,
  sort: SortState,
): number {
  const leftValue = readSortValue(left, sort.columnId);
  const rightValue = readSortValue(right, sort.columnId);
  if (typeof leftValue === 'string' && typeof rightValue === 'string') {
    const byName = leftValue.localeCompare(rightValue, 'it', { sensitivity: 'base' });
    return sort.direction === 'asc' ? byName : -byName;
  }
  const leftNumber = Number(leftValue) || 0;
  const rightNumber = Number(rightValue) || 0;
  if (leftNumber !== rightNumber) {
    return sort.direction === 'asc' ? leftNumber - rightNumber : rightNumber - leftNumber;
  }
  return left.cliente.localeCompare(right.cliente, 'it', { sensitivity: 'base' });
}

function SortHeaderButton({
  label,
  columnId,
  sort,
  align,
  onSort,
}: {
  label: string;
  columnId: string;
  sort: SortState;
  align?: 'left' | 'right';
  onSort: (columnId: string) => void;
}) {
  const isActive = sort.columnId === columnId;
  return (
    <button
      type="button"
      className={`proposals-sort-btn${isActive ? ' is-active' : ''}${align === 'right' ? ' is-numeric' : ''}`}
      aria-pressed={isActive}
      onClick={() => onSort(columnId)}
    >
      <span>{label}</span>
      {isActive ? (
        sort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
      ) : (
        <ChevronsUpDown size={14} />
      )}
    </button>
  );
}

export function ClientCategoryTable({ stats }: ClientCategoryTableProps) {
  const categories = useMemo(() => collectClientTableCategories(stats), [stats]);
  const [sort, setSort] = useState<SortState>({ columnId: OKR_COLUMN, direction: 'desc' });
  useEffect(() => {
    if (sort.columnId === CLIENT_COLUMN || sort.columnId === OKR_COLUMN) return;
    if (categories.includes(sort.columnId)) return;
    setSort({ columnId: OKR_COLUMN, direction: 'desc' });
  }, [categories, sort.columnId]);
  const sortedStats = useMemo(
    () => [...stats].sort((left, right) => compareStats(left, right, sort)),
    [sort, stats],
  );
  const handleSort = (columnId: string): void => {
    setSort((current) => {
      if (current.columnId === columnId) {
        return { columnId, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { columnId, direction: isNumericColumn(columnId) ? 'desc' : 'asc' };
    });
  };
  if (stats.length === 0) {
    return <p className="proposals-empty">Nessun dato cliente × categoria per l'anno selezionato.</p>;
  }
  return (
    <div className="analysis-table-wrap">
      <table className="analysis-table">
        <thead>
          <tr>
            <th>
              <SortHeaderButton label="Cliente" columnId={CLIENT_COLUMN} sort={sort} onSort={handleSort} />
            </th>
            <th className="analysis-num">
              <SortHeaderButton label="Totale OKR" columnId={OKR_COLUMN} sort={sort} align="right" onSort={handleSort} />
            </th>
            {categories.map((categoria) => (
              <th key={categoria} className="analysis-num">
                <SortHeaderButton
                  label={categoria}
                  columnId={categoria}
                  sort={sort}
                  align="right"
                  onSort={handleSort}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedStats.map((stat) => (
            <tr key={stat.cliente}>
              <td><strong>{stat.cliente}</strong></td>
              <td className="analysis-num">{formatCurrency(stat.okrTotal)}</td>
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
