'use client';

import { Fragment, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Search } from 'lucide-react';
import {
  formatProposalCurrency,
  formatProposalDateLabel,
  getProposalCreatedYear,
  resolveProposalValue,
} from '@/lib/sales-proposals/stats';
import type { SalesProposal } from '@/lib/types/sales-proposals';

/** Stati come appaiono su Cerbero, nell'ordine dei filtri. */
const PROPOSAL_STATUS_FILTERS = ['Proposal Started', 'Quotation', 'Si', 'No'] as const;

type StatusFilter = 'all' | typeof PROPOSAL_STATUS_FILTERS[number];

interface ProposalsListProps {
  proposals: SalesProposal[];
  yearOptions: number[];
  defaultYear: number;
}

function resolveStatusClassName(stato: string): string {
  if (stato === 'Si') return 'is-accepted';
  if (stato === 'No') return 'is-rejected';
  if (stato === 'Quotation') return 'is-quotation';
  return 'is-started';
}

/** Numero progressivo del codice Cerbero (CS1426 → 1426) per ordinare come su Cerbero. */
function resolveProposalNumber(proposal: SalesProposal): number {
  const match = /(\d+)/.exec(proposal.code || proposal.nome);
  return match ? Number(match[1]) : 0;
}

export function ProposalsList({ proposals, yearOptions, defaultYear }: ProposalsListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedYear, setSelectedYear] = useState<number | null>(defaultYear);
  const [search, setSearch] = useState('');
  const [sortDescending, setSortDescending] = useState(true);
  const [openProposalId, setOpenProposalId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return proposals
      .filter((proposal) => selectedYear === null || getProposalCreatedYear(proposal) === selectedYear)
      .filter((proposal) => statusFilter === 'all' || proposal.stato === statusFilter)
      .filter((proposal) => {
        if (!query) return true;
        return [proposal.nome, proposal.cliente, proposal.descrizione, proposal.categoria, proposal.contattatoDa]
          .some((value) => value.toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const diff = resolveProposalNumber(left) - resolveProposalNumber(right);
        return sortDescending ? -diff : diff;
      });
  }, [proposals, search, selectedYear, sortDescending, statusFilter]);

  return (
    <div className="glass-card proposals-panel proposals-list">
      <div className="proposals-panel-head">
        <h3>Tutte le proposte</h3>
        <p>Come su Cerbero: filtra per stato e anno, cerca per nome, cliente o categoria.</p>
      </div>
      <div className="search-box proposals-list-search">
        <Search size={18} />
        <input
          className="search-input"
          placeholder="Cerca..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="proposals-list-filters">
        <div className="proposals-list-chips" role="group" aria-label="Filtra per stato">
          <button
            type="button"
            className={`clients-filter-chip${statusFilter === 'all' ? ' is-active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All
          </button>
          {PROPOSAL_STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              className={`clients-filter-chip${statusFilter === status ? ' is-active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
        <span className="proposals-list-divider" aria-hidden />
        <div className="proposals-list-chips" role="group" aria-label="Filtra per anno">
          {yearOptions.map((year) => (
            <button
              key={year}
              type="button"
              className={`clients-filter-chip${selectedYear === year ? ' is-active' : ''}`}
              aria-pressed={selectedYear === year}
              onClick={() => setSelectedYear((prev) => (prev === year ? null : year))}
            >
              {year}
            </button>
          ))}
        </div>
        <span className="proposals-list-count">
          {rows.length} {rows.length === 1 ? 'proposta' : 'proposte'}
        </span>
      </div>
      <div className="proposals-list-table-wrap">
        <table className="analysis-table proposals-list-table">
          <thead>
            <tr>
              <th className="proposals-list-col-status">Stato</th>
              <th className="proposals-list-col-actions">Azioni</th>
              <th>
                <button
                  type="button"
                  className="proposals-list-sort"
                  onClick={() => setSortDescending((prev) => !prev)}
                  title={sortDescending ? 'Dal più recente' : 'Dal più vecchio'}
                >
                  Nome
                  {sortDescending ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                </button>
              </th>
              <th>Cliente</th>
              <th>Categoria</th>
              <th className="analysis-num">Valore</th>
              <th>Aggiornata</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="proposals-empty">Nessuna proposta con questi filtri.</td>
              </tr>
            ) : (
              rows.map((proposal) => {
                const value = resolveProposalValue(proposal);
                const isOpen = openProposalId === proposal.id;
                return (
                  <Fragment key={proposal.id}>
                    <tr className={isOpen ? 'is-open' : ''}>
                      <td className="proposals-list-col-status">
                        <span className={`proposal-status-pill ${resolveStatusClassName(proposal.stato)}`}>
                          {proposal.stato || '—'}
                        </span>
                      </td>
                      <td className="proposals-list-col-actions">
                        <button
                          type="button"
                          className="btn-table-action"
                          title={isOpen ? 'Chiudi dettaglio' : 'Apri dettaglio'}
                          aria-expanded={isOpen}
                          onClick={() => setOpenProposalId(isOpen ? null : proposal.id)}
                        >
                          {isOpen ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </td>
                      <td className="proposals-list-name">{proposal.nome}</td>
                      <td>{proposal.cliente || '—'}</td>
                      <td>{proposal.categoria || '—'}</td>
                      <td className="analysis-num">{value === null ? '—' : formatProposalCurrency(value)}</td>
                      <td>{proposal.ultimoAggiornamento ? formatProposalDateLabel(proposal.ultimoAggiornamento) : '—'}</td>
                    </tr>
                    {isOpen && (
                      <tr className="proposals-list-detail-row">
                        <td colSpan={7}>
                          <dl className="proposals-list-detail">
                            <div><dt>Descrizione</dt><dd>{proposal.descrizione || '—'}</dd></div>
                            <div><dt>Contattato da</dt><dd>{proposal.contattatoDa || '—'}</dd></div>
                            <div><dt>Tipo</dt><dd>{proposal.tipo || '—'}</dd></div>
                            <div><dt>Creata il</dt><dd>{proposal.creatoIl ? formatProposalDateLabel(proposal.creatoIl) : '—'}</dd></div>
                            <div><dt>Ultimo prezzo</dt><dd>{proposal.ultimoPrezzo === null ? '—' : formatProposalCurrency(proposal.ultimoPrezzo)}</dd></div>
                            <div><dt>Budget finale</dt><dd>{proposal.budgetFinale === null ? '—' : formatProposalCurrency(proposal.budgetFinale)}</dd></div>
                            {proposal.dataAccettazione && (
                              <div><dt>Accettata il</dt><dd>{formatProposalDateLabel(proposal.dataAccettazione)}</dd></div>
                            )}
                            {proposal.dataRifiuto && (
                              <div><dt>Rifiutata il</dt><dd>{formatProposalDateLabel(proposal.dataRifiuto)}</dd></div>
                            )}
                            {proposal.motivoRifiuto && (
                              <div><dt>Motivo rifiuto</dt><dd>{proposal.motivoRifiuto}</dd></div>
                            )}
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
