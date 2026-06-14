'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, TrendingUp } from 'lucide-react';
import {
  buildRollingTwelveMonthRevenue,
  formatRollingMonthLabel,
  formatRollingMonthShortLabel,
} from '@/lib/analysis/rolling-revenue';
import { formatCurrency } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';

const CHART_HEIGHT_PX = 240;
const Y_AXIS_TICKS = 5;

function formatAxisValue(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${Math.round(value / 1_000)}k`;
  return formatCurrency(value);
}

function buildAxisTicks(maxValue: number, tickCount: number): number[] {
  if (maxValue <= 0) return [0];
  const step = maxValue / (tickCount - 1);
  return Array.from({ length: tickCount }, (_, index) => Math.round(maxValue - step * index));
}

export function RollingRevenuePanel() {
  const { okrRecords } = useCrm();
  const [isOpen, setIsOpen] = useState(false);

  const rollingPoints = useMemo(
    () => buildRollingTwelveMonthRevenue(okrRecords),
    [okrRecords],
  );

  const maxRollingAmount = useMemo(
    () => Math.max(...rollingPoints.map((point) => point.rollingAmount), 1),
    [rollingPoints],
  );

  const yAxisTicks = useMemo(
    () => buildAxisTicks(maxRollingAmount, Y_AXIS_TICKS),
    [maxRollingAmount],
  );

  const latestPoint = rollingPoints.length > 0
    ? rollingPoints[rollingPoints.length - 1]
    : null;

  return (
    <div className={`analysis-accordion rolling-revenue-accordion${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="analysis-accordion-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <ChevronRight size={18} className="analysis-accordion-icon" />
        <span>Fatturato Anno Mobile</span>
        <span className="analysis-accordion-meta">
          <TrendingUp size={14} />
          {latestPoint
            ? `${formatCurrency(latestPoint.rollingAmount)} · ${formatRollingMonthLabel(latestPoint.year, latestPoint.month)}`
            : 'Servono almeno 12 mesi di OKR'}
        </span>
      </button>
      {isOpen && (
        <div className="analysis-accordion-body rolling-revenue-body">
          {rollingPoints.length === 0 ? (
            <p className="analysis-empty-hint">
              Non ci sono abbastanza mesi con OKR datati per calcolare l&apos;anno mobile.
            </p>
          ) : (
            <div className="rolling-revenue-chart">
              <div className="rolling-revenue-y-axis" aria-hidden="true">
                {yAxisTicks.map((tick) => (
                  <span key={tick}>{formatAxisValue(tick)}</span>
                ))}
              </div>
              <div className="rolling-revenue-chart-scroll">
                <div
                  className="rolling-revenue-bars"
                  style={{ height: `${CHART_HEIGHT_PX}px` }}
                  role="img"
                  aria-label="Grafico a barre del fatturato anno mobile per mese"
                >
                  {rollingPoints.map((point) => {
                    const barHeight = Math.max(4, Math.round((point.rollingAmount / maxRollingAmount) * 100));
                    const label = formatRollingMonthShortLabel(point.year, point.month);
                    return (
                      <div
                        key={`${point.year}-${point.month}`}
                        className="rolling-revenue-bar-cell"
                        title={`${formatRollingMonthLabel(point.year, point.month)}: ${formatCurrency(point.rollingAmount)}`}
                      >
                        <div className="rolling-revenue-bar-track">
                          <div
                            className="rolling-revenue-bar"
                            style={{ height: `${barHeight}%` }}
                          />
                        </div>
                        <span className="rolling-revenue-bar-label">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
