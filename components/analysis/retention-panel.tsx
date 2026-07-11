'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Repeat } from 'lucide-react';
import {
  buildRetentionYearTransitions,
  getRetentionYearPairLabel,
  type RetentionBucket,
  type RetentionYearTransition,
} from '@/lib/analysis/retention';
import { formatCurrency } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';

const BUCKET_LABELS: Record<RetentionBucket, string> = {
  gained: 'Guadagnato',
  lost: 'Perso',
  retained: 'Mantenuto',
  inactive: 'Inattivo',
};

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function RetentionSummaryTable({ transitions }: { transitions: RetentionYearTransition[] }) {
  if (transitions.length === 0) {
    return (
      <p className="analysis-empty-hint">
        Servono almeno due anni di dati OKR/revenue per calcolare la retention.
      </p>
    );
  }
  return (
    <div className="analysis-table-wrap">
      <table className="analysis-table retention-summary-table">
        <thead>
          <tr>
            <th>Periodo</th>
            <th className="analysis-num">Guadagnati</th>
            <th className="analysis-num">Rev. guadagnati</th>
            <th className="analysis-num">Persi</th>
            <th className="analysis-num">Rev. persa</th>
            <th className="analysis-num">Mantenuti</th>
            <th className="analysis-num">Retention</th>
            <th className="analysis-num">Δ clienti</th>
            <th className="analysis-num">Δ fatturato</th>
          </tr>
        </thead>
        <tbody>
          {transitions.map((transition) => (
            <tr key={`${transition.previousYear}-${transition.currentYear}`}>
              <td>{getRetentionYearPairLabel(transition.previousYear, transition.currentYear)}</td>
              <td className="analysis-num retention-positive">{transition.gainedCount}</td>
              <td className="analysis-num retention-positive">{formatCurrency(transition.gainedRevenue)}</td>
              <td className="analysis-num retention-negative">{transition.lostCount}</td>
              <td className="analysis-num retention-negative">{formatCurrency(transition.lostRevenue)}</td>
              <td className="analysis-num">{transition.retainedCount}</td>
              <td className="analysis-num">{formatPct(transition.retentionRate)}</td>
              <td className={`analysis-num${transition.netClientChange >= 0 ? ' retention-positive' : ' retention-negative'}`}>
                {transition.netClientChange >= 0 ? '+' : ''}{transition.netClientChange}
              </td>
              <td className={`analysis-num${transition.netRevenueChange >= 0 ? ' retention-positive' : ' retention-negative'}`}>
                {formatCurrency(transition.netRevenueChange)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RetentionDetailTable({ transition }: { transition: RetentionYearTransition }) {
  const [filter, setFilter] = useState<RetentionBucket | 'all'>('all');
  const filteredRows = useMemo(
    () => (
      filter === 'all'
        ? transition.rows
        : transition.rows.filter((row) => row.bucket === filter)
    ),
    [filter, transition.rows],
  );
  return (
    <div className="retention-detail-block">
      <div className="retention-detail-toolbar">
        <div className="retention-filter-group" role="group" aria-label="Filtra clienti retention">
          <button
            type="button"
            className={`retention-filter-btn${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Tutti ({transition.rows.length})
          </button>
          <button
            type="button"
            className={`retention-filter-btn${filter === 'gained' ? ' is-active' : ''}`}
            onClick={() => setFilter('gained')}
          >
            Guadagnati ({transition.gainedCount})
          </button>
          <button
            type="button"
            className={`retention-filter-btn${filter === 'lost' ? ' is-active' : ''}`}
            onClick={() => setFilter('lost')}
          >
            Persi ({transition.lostCount})
          </button>
          <button
            type="button"
            className={`retention-filter-btn${filter === 'retained' ? ' is-active' : ''}`}
            onClick={() => setFilter('retained')}
          >
            Mantenuti ({transition.retainedCount})
          </button>
        </div>
      </div>
      {filteredRows.length === 0 ? (
        <p className="analysis-empty-hint">Nessun cliente in questa categoria per il periodo selezionato.</p>
      ) : (
        <div className="analysis-table-wrap">
          <table className="analysis-table retention-detail-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Esito</th>
                <th className="analysis-num">{transition.previousYear}</th>
                <th className="analysis-num">{transition.currentYear}</th>
                <th className="analysis-num">Δ</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={`${row.displayName}-${row.bucket}-${index}`}>
                  <td>{row.displayName}</td>
                  <td>
                    <span className={`retention-badge retention-badge-${row.bucket}`}>
                      {BUCKET_LABELS[row.bucket]}
                    </span>
                  </td>
                  <td className="analysis-num">{formatCurrency(row.previousRevenue)}</td>
                  <td className="analysis-num">{formatCurrency(row.currentRevenue)}</td>
                  <td className={`analysis-num${row.delta >= 0 ? ' retention-positive' : ' retention-negative'}`}>
                    {formatCurrency(row.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RetentionPanel() {
  const { okrRecords, clients } = useCrm();
  const [isOpen, setIsOpen] = useState(false);
  const transitions = useMemo(
    () => buildRetentionYearTransitions(okrRecords, clients),
    [okrRecords, clients],
  );
  const [selectedIndex, setSelectedIndex] = useState(Math.max(transitions.length - 1, 0));
  const selectedTransition = transitions[selectedIndex] || null;
  const latestTransition = transitions[transitions.length - 1] || null;

  return (
    <div className={`analysis-accordion retention-accordion${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="analysis-accordion-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <ChevronRight size={18} className="analysis-accordion-icon" />
        <span>Analisi Retention</span>
        <span className="analysis-accordion-meta">
          <Repeat size={14} />
          {latestTransition
            ? `${getRetentionYearPairLabel(latestTransition.previousYear, latestTransition.currentYear)} · +${latestTransition.gainedCount} / -${latestTransition.lostCount}`
            : 'Dati insufficienti'}
        </span>
      </button>
      {isOpen && (
        <div className="analysis-accordion-body retention-body">
          <p className="retention-intro">
            Confronto anno su anno basato sul fatturato per cliente (OKR importati, con fallback sui totali
            annuali del cliente). Un cliente è <strong>guadagnato</strong> se passa da 0 a fatturato positivo,
            <strong> perso</strong> se aveva fatturato e l&apos;anno dopo va a zero.
          </p>
          <RetentionSummaryTable transitions={transitions} />
          {transitions.length > 0 && (
            <>
              <div className="retention-detail-header">
                <h4>Dettaglio clienti</h4>
                <div className="retention-year-switcher" role="group" aria-label="Seleziona periodo retention">
                  {transitions.map((transition, index) => (
                    <button
                      key={`${transition.previousYear}-${transition.currentYear}`}
                      type="button"
                      className={`retention-year-switcher-btn${selectedIndex === index ? ' is-active' : ''}`}
                      onClick={() => setSelectedIndex(index)}
                    >
                      {getRetentionYearPairLabel(transition.previousYear, transition.currentYear)}
                    </button>
                  ))}
                </div>
              </div>
              {selectedTransition && (
                <>
                  <div className="analysis-kpi-grid retention-kpi-grid">
                    <div className="analysis-kpi-card">
                      <span className="analysis-kpi-label">Clienti guadagnati</span>
                      <strong className="analysis-kpi-value retention-positive">{selectedTransition.gainedCount}</strong>
                      <span className="analysis-kpi-hint">{formatCurrency(selectedTransition.gainedRevenue)} nel {selectedTransition.currentYear}</span>
                    </div>
                    <div className="analysis-kpi-card">
                      <span className="analysis-kpi-label">Clienti persi</span>
                      <strong className="analysis-kpi-value retention-negative">{selectedTransition.lostCount}</strong>
                      <span className="analysis-kpi-hint">{formatCurrency(selectedTransition.lostRevenue)} persi dal {selectedTransition.previousYear}</span>
                    </div>
                    <div className="analysis-kpi-card">
                      <span className="analysis-kpi-label">Retention rate</span>
                      <strong className="analysis-kpi-value">{formatPct(selectedTransition.retentionRate)}</strong>
                      <span className="analysis-kpi-hint">{selectedTransition.retainedCount} clienti mantenuti</span>
                    </div>
                    <div className="analysis-kpi-card">
                      <span className="analysis-kpi-label">Δ fatturato netto</span>
                      <strong className={`analysis-kpi-value${selectedTransition.netRevenueChange >= 0 ? ' retention-positive' : ' retention-negative'}`}>
                        {formatCurrency(selectedTransition.netRevenueChange)}
                      </strong>
                      <span className="analysis-kpi-hint">Guadagni + mantenuti − persi</span>
                    </div>
                  </div>
                  <RetentionDetailTable transition={selectedTransition} />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
