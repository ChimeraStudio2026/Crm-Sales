'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, GitCompareArrows } from 'lucide-react';
import {
  OKR_COMPARISON_YEARS,
  OKR_TIMELINE_MAX_DAY,
  OKR_TIMELINE_MONTH_LABELS,
  buildOkrMonthlySeries,
  computeOkrTimelineSnapshot,
  formatTimelineDateLabel,
  getDefaultTimelineDayOfYear,
} from '@/lib/analysis/okr-timeline';
import { formatCurrency } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';

export function OkrYearComparisonPanel() {
  const { okrRecords } = useCrm();
  const [isOpen, setIsOpen] = useState(false);
  const [dayOfYear, setDayOfYear] = useState<number>(getDefaultTimelineDayOfYear);

  const monthlySeries = useMemo(
    () => OKR_COMPARISON_YEARS.map((year) => buildOkrMonthlySeries(okrRecords, year)),
    [okrRecords],
  );

  const snapshots = useMemo(
    () => OKR_COMPARISON_YEARS.map((year) => computeOkrTimelineSnapshot(okrRecords, year, dayOfYear)),
    [dayOfYear, okrRecords],
  );

  const sliderPercent = ((dayOfYear - 1) / (OKR_TIMELINE_MAX_DAY - 1)) * 100;
  const dateLabel = formatTimelineDateLabel(dayOfYear, 2026);

  return (
    <div className={`analysis-accordion okr-comparison-accordion${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="analysis-accordion-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <ChevronRight size={18} className="analysis-accordion-icon" />
        <span>Confronto OKR 2025 vs 2026</span>
        <span className="analysis-accordion-meta">
          <GitCompareArrows size={14} />
          Timeline cumulativa
        </span>
      </button>
      {isOpen && (
        <div className="analysis-accordion-body okr-comparison-body">
          <p className="okr-comparison-intro">
            Scorri la barra per confrontare quanti OKR avevi accumulato alla stessa data dell&apos;anno
            (es. 15 marzo) tra {OKR_COMPARISON_YEARS[0]} e {OKR_COMPARISON_YEARS[1]}.
          </p>
          <div className="okr-comparison-scrubber-wrap">
            <div className="okr-comparison-scrubber-head">
              <span className="okr-comparison-scrubber-label">Data di riferimento</span>
              <strong className="okr-comparison-scrubber-date">{dateLabel}</strong>
            </div>
            <div className="okr-comparison-scrubber-track">
              <input
                type="range"
                className="okr-comparison-scrubber-input"
                min={1}
                max={OKR_TIMELINE_MAX_DAY}
                value={dayOfYear}
                onChange={(event) => setDayOfYear(Number(event.target.value))}
                aria-label="Seleziona giorno dell'anno"
              />
              <div className="okr-comparison-scrubber-months" aria-hidden="true">
                {OKR_TIMELINE_MONTH_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="okr-comparison-scrubber-marker" style={{ left: `${sliderPercent}%` }} />
            </div>
          </div>
          <div className="okr-comparison-stats">
            {snapshots.map((snapshot) => (
              <div key={snapshot.year} className="okr-comparison-stat-card">
                <span className="okr-comparison-stat-year">{snapshot.year}</span>
                <strong className="okr-comparison-stat-value">{formatCurrency(snapshot.amount)}</strong>
                <span className="okr-comparison-stat-meta">
                  {snapshot.count} OKR · fino a {snapshot.throughDay}/{snapshot.throughMonth.toString().padStart(2, '0')}
                </span>
              </div>
            ))}
            <div className="okr-comparison-stat-card okr-comparison-stat-delta">
              <span className="okr-comparison-stat-year">Delta</span>
              <strong className={`okr-comparison-stat-value ${snapshots[1].amount - snapshots[0].amount >= 0 ? 'analysis-kpi-positive' : 'analysis-kpi-negative'}`}>
                {formatCurrency(snapshots[1].amount - snapshots[0].amount)}
              </strong>
              <span className="okr-comparison-stat-meta">
                {snapshots[1].count - snapshots[0].count >= 0 ? '+' : ''}
                {snapshots[1].count - snapshots[0].count} OKR
              </span>
            </div>
          </div>
          <div className="okr-comparison-chart">
            <div className="okr-comparison-chart-axis-y" aria-hidden="true">
              {OKR_COMPARISON_YEARS.map((year) => (
                <span key={year}>{year}</span>
              ))}
            </div>
            <div className="okr-comparison-chart-main">
              <div className="okr-comparison-chart-grid" aria-hidden="true">
                {OKR_TIMELINE_MONTH_LABELS.map((label) => (
                  <span key={label} className="okr-comparison-grid-month">{label}</span>
                ))}
              </div>
              {monthlySeries.map((series, rowIndex) => {
                const snapshot = snapshots[rowIndex];
                return (
                  <div key={series.year} className="okr-comparison-row">
                    <div className="okr-comparison-row-track">
                      {series.monthlyAmounts.map((amount, monthIndex) => {
                        const monthNumber = monthIndex + 1;
                        const isIncluded = monthNumber <= snapshot.throughMonth;
                        const barHeight = Math.max(8, Math.round((amount / series.maxAmount) * 100));
                        return (
                          <div
                            key={`${series.year}-${monthNumber}`}
                            className={`okr-comparison-month-cell${isIncluded ? ' is-included' : ''}`}
                            title={`${OKR_TIMELINE_MONTH_LABELS[monthIndex]}: ${formatCurrency(amount)} · ${series.monthlyCounts[monthIndex]} OKR`}
                          >
                            <div
                              className="okr-comparison-month-bar"
                              style={{ height: `${barHeight}%` }}
                            />
                          </div>
                        );
                      })}
                      <div
                        className="okr-comparison-cursor"
                        style={{ left: `${sliderPercent}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
