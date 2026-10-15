'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, GitCompareArrows } from 'lucide-react';
import {
  OKR_COMPARISON_YEARS,
  OKR_TIMELINE_MAX_DAY,
  OKR_TIMELINE_MONTH_LABELS,
  buildOkrMonthlySeries,
  computeOkrDailyChangeSummary,
  computeOkrTimelineSnapshot,
  formatOkrCountDelta,
  formatTimelineDateLabel,
  getDefaultTimelineDayOfYear,
  getOkrComparisonDeltaSnapshots,
  getOkrComparisonYearRangeLabel,
} from '@/lib/analysis/okr-timeline';
import { useOkrConfirmations } from '@/lib/analysis/use-okr-confirmations';
import { ANALYSIS_YEAR } from '@/lib/constants/crm';
import { formatCurrency } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';

export function OkrYearComparisonPanel() {
  const { okrRecords } = useCrm();
  const confirmations = useOkrConfirmations();
  const [isOpen, setIsOpen] = useState(false);
  const [dayOfYear, setDayOfYear] = useState<number>(getDefaultTimelineDayOfYear);

  const monthlySeries = useMemo(
    () => OKR_COMPARISON_YEARS.map((year) => buildOkrMonthlySeries(okrRecords, year, dayOfYear, confirmations)),
    [dayOfYear, okrRecords, confirmations],
  );

  const snapshots = useMemo(
    () => OKR_COMPARISON_YEARS.map((year) => computeOkrTimelineSnapshot(okrRecords, year, dayOfYear, confirmations)),
    [dayOfYear, okrRecords, confirmations],
  );

  const dailyChange = useMemo(
    () => computeOkrDailyChangeSummary(okrRecords, ANALYSIS_YEAR, dayOfYear, confirmations),
    [confirmations, dayOfYear, okrRecords],
  );

  const activeMonthlyChanges = dailyChange?.monthlyChanges.filter((change) => change.countDelta !== 0) ?? [];

  const deltaSnapshots = useMemo(
    () => getOkrComparisonDeltaSnapshots(snapshots),
    [snapshots],
  );

  const sliderPercent = ((dayOfYear - 1) / (OKR_TIMELINE_MAX_DAY - 1)) * 100;
  const dateLabel = formatTimelineDateLabel(dayOfYear, ANALYSIS_YEAR);
  const yearRangeLabel = getOkrComparisonYearRangeLabel();

  return (
    <div className={`analysis-accordion okr-comparison-accordion${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="analysis-accordion-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <ChevronRight size={18} className="analysis-accordion-icon" />
        <span>Confronto OKR {yearRangeLabel}</span>
        <span className="analysis-accordion-meta">
          <GitCompareArrows size={14} />
          Timeline cumulativa
        </span>
      </button>
      {isOpen && (
        <div className="analysis-accordion-body okr-comparison-body">
          <p className="okr-comparison-intro">
            Scorri la barra: per ogni anno vedi tutti gli OKR da gennaio a dicembre già confermati alla
            stessa data (es. al 15 marzo contano anche i lavori di maggio se la proposta era già passata a «Si»).
            La data di conferma è quella di accettazione su Cerbero; per gli anni prima di Cerbero vale il mese del lavoro.
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
                  {snapshot.count} OKR
                  {` · confermati al ${snapshot.throughDay}/${snapshot.throughMonth.toString().padStart(2, '0')}`}
                </span>
              </div>
            ))}
            {deltaSnapshots && (
            <div className="okr-comparison-stat-card okr-comparison-stat-delta">
              <span className="okr-comparison-stat-year">Delta {deltaSnapshots.target.year} vs {deltaSnapshots.base.year}</span>
              <strong className={`okr-comparison-stat-value ${deltaSnapshots.target.amount - deltaSnapshots.base.amount >= 0 ? 'analysis-kpi-positive' : 'analysis-kpi-negative'}`}>
                {formatCurrency(deltaSnapshots.target.amount - deltaSnapshots.base.amount)}
              </strong>
              <span className="okr-comparison-stat-meta">
                {deltaSnapshots.target.count - deltaSnapshots.base.count >= 0 ? '+' : ''}
                {deltaSnapshots.target.count - deltaSnapshots.base.count} OKR
              </span>
            </div>
            )}
          </div>
          {dailyChange && (
            <div className="okr-daily-change-panel">
              <div className="okr-daily-change-head">
                <span className="okr-comparison-scrubber-label">Variazione vs giorno precedente · {ANALYSIS_YEAR}</span>
                <strong className={`okr-daily-change-total ${dailyChange.countDelta >= 0 ? 'analysis-kpi-positive' : 'analysis-kpi-negative'}`}>
                  {formatOkrCountDelta(dailyChange.countDelta)}
                  {' · '}
                  {formatCurrency(dailyChange.amountDelta)}
                </strong>
              </div>
              <p className="okr-daily-change-meta">
                {dailyChange.addedCount > 0 && `+${dailyChange.addedCount} aggiunti`}
                {dailyChange.addedCount > 0 && dailyChange.removedCount > 0 && ' · '}
                {dailyChange.removedCount > 0 && `-${dailyChange.removedCount} rimossi`}
                {dailyChange.addedCount === 0 && dailyChange.removedCount === 0 && 'Nessuna modifica rispetto al giorno precedente'}
              </p>
              {activeMonthlyChanges.length > 0 && (
                <div className="okr-daily-change-months">
                  {dailyChange.monthlyChanges.map((change) => (
                    <div
                      key={change.monthNumber}
                      className={`okr-daily-change-month${change.countDelta !== 0 ? ' has-change' : ''}`}
                    >
                      <span className="okr-daily-change-month-label">{change.monthLabel}</span>
                      <strong className="okr-daily-change-month-count">
                        {change.currentCount} OKR
                      </strong>
                      {change.countDelta !== 0 && (
                        <span className={`okr-daily-change-month-delta ${change.countDelta >= 0 ? 'analysis-kpi-positive' : 'analysis-kpi-negative'}`}>
                          {formatOkrCountDelta(change.countDelta)}
                        </span>
                      )}
                      <span className="okr-daily-change-month-amount">
                        {formatCurrency(change.currentAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
              {monthlySeries.map((series) => {
                return (
                  <div key={series.year} className="okr-comparison-row">
                    <div className="okr-comparison-row-track">
                      {series.monthlyAmounts.map((amount, monthIndex) => {
                        const monthNumber = monthIndex + 1;
                        const count = series.monthlyCounts[monthIndex];
                        const isIncluded = count > 0;
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
