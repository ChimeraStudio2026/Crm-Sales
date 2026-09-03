'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { collectClientTableCategories } from '@/lib/sales-proposals/stats';
import type { ClientProposalStat } from '@/lib/types/sales-proposals';

const CLIENT_COLUMN = 'cliente' as const;

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

export function ClientCategoryTable({ stats }: ClientCategoryTableProps) {
  const categories = useMemo(() => collectClientTableCategories(stats), [stats]);
  const [sort, setSort] = useState<SortState>({ columnId: CLIENT_COLUMN, direction: 'asc' });
  const [clientQuery, setClientQuery] = useState('');
  useEffect(() => {
    if (sort.columnId === CLIENT_COLUMN) return;
    if (categories.includes(sort.columnId)) return;
    setSort({ columnId: CLIENT_COLUMN, direction: 'asc' });
  }, [categories, sort.columnId]);
  const visibleStats = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    const filtered = query
      ? stats.filter((stat) => stat.cliente.toLowerCase().includes(query))
      : stats;
    return [...filtered].sort((left, right) => compareStats(left, right, sort));
  }, [clientQuery, sort, stats]);
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
    <div className="proposals-client-table">
      <label className="proposals-client-filter">
        <span>Filtra cliente</span>
        <input
          type="search"
          className="form-input"
          value={clientQuery}
          placeholder="Cerca per nome..."
          onChange={(event) => setClientQuery(event.target.value)}
        />
      </label>
      <div className="analysis-table-wrap">
        <table className="analysis-table">
          <thead>
            <tr>
              <SortableHeader
                label="Cliente"
                columnId={CLIENT_COLUMN}
                sort={sort}
                onSort={handleSort}
              />
              {categories.map((categoria) => (
                <SortableHeader
                  key={categoria}
                  label={categoria}
                  columnId={categoria}
                  sort={sort}
                  align="right"
                  onSort={handleSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleStats.map((stat) => (
              <tr key={stat.cliente}>
                <td><strong>{stat.cliente}</strong></td>
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
    </div>
  );
}

function SortableHeader({
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
    <th
      className={`${align === 'right' ? 'analysis-num' : ''}${isActive ? ' is-sorted' : ''}`}
      aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className={`proposals-sort-btn${isActive ? ' is-active' : ''}${align === 'right' ? ' is-numeric' : ''}`}
        onClick={() => onSort(columnId)}
      >
        <span>{label}</span>
        {isActive ? (
          sort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
        ) : (
          <ChevronDown size={14} className="proposals-sort-idle" />
        )}
      </button>
    </th>
  );
}
