'use client';

import { useMemo } from 'react';
import {
  formatAverageConversionDays,
  getFunnelCompositionPercentages,
  type FunnelStatsSummary,
} from '@/lib/commercial-funnel/stats';

interface FunnelStatsChartsProps {
  title?: string;
  stats: FunnelStatsSummary;
}

function ConversionRateRing({ rate }: { rate: number }) {
  const clampedRate = Math.min(Math.max(rate, 0), 100);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clampedRate / 100) * circumference;
  return (
    <div className="funnel-stat-ring-wrap" aria-hidden="true">
      <svg className="funnel-stat-ring" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} className="funnel-stat-ring-bg" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          className="funnel-stat-ring-fill"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="funnel-stat-ring-value">{clampedRate.toFixed(0)}%</span>
    </div>
  );
}

export function FunnelStatsCharts({ title = 'Totali', stats }: FunnelStatsChartsProps) {
  const composition = useMemo(() => getFunnelCompositionPercentages(stats), [stats]);
  const averageConversionLabel = formatAverageConversionDays(stats.averageConversionDays);
  return (
    <div className="funnel-stats-charts glass-card">
      <div className="funnel-stats-header">
        <h3 className="funnel-stats-title">{title}</h3>
        <span className="funnel-stats-subtitle">Lead nel funnel · metriche aggregate</span>
      </div>
      <div className="funnel-stats-grid">
        <article className="funnel-stat-card funnel-stat-card-rate">
          <span className="funnel-stat-label">Tasso di conversione</span>
          <div className="funnel-stat-rate-body">
            <ConversionRateRing rate={stats.conversionRate} />
            <div className="funnel-stat-rate-copy">
              <strong className="funnel-stat-value">{stats.conversionRate.toFixed(1)}%</strong>
              <small>{stats.converted} convertiti su {stats.total} lead</small>
            </div>
          </div>
        </article>
        <article className="funnel-stat-card">
          <span className="funnel-stat-label">Totale campagna</span>
          <strong className="funnel-stat-value">{stats.total}</strong>
          <small>{stats.active} attivi in pipeline</small>
        </article>
        <article className="funnel-stat-card funnel-stat-card-converted">
          <span className="funnel-stat-label">Totale convertiti</span>
          <strong className="funnel-stat-value">{stats.converted}</strong>
          <small>{composition.convertedPct.toFixed(1)}% del totale</small>
        </article>
        <article className="funnel-stat-card funnel-stat-card-lost">
          <span className="funnel-stat-label">Totale persi</span>
          <strong className="funnel-stat-value">{stats.lost}</strong>
          <small>{composition.lostPct.toFixed(1)}% del totale</small>
        </article>
        <article className="funnel-stat-card funnel-stat-card-time">
          <span className="funnel-stat-label">Tempo medio di conversione</span>
          <strong className="funnel-stat-value">{averageConversionLabel}</strong>
          <small>
            {stats.averageConversionSampleSize > 0
              ? `Su ${stats.averageConversionSampleSize} lead convertiti`
              : 'Nessuna conversione con date disponibili'}
          </small>
        </article>
      </div>
      <div className="funnel-stats-composition">
        <div className="funnel-stats-composition-head">
          <span>Composizione pipeline</span>
          <span>{stats.total} lead</span>
        </div>
        <div
          className="funnel-stats-composition-bar"
          role="img"
          aria-label={`Attivi ${stats.active}, convertiti ${stats.converted}, persi ${stats.lost}`}
        >
          {stats.total > 0 ? (
            <>
              {composition.activePct > 0 && (
                <div
                  className="funnel-stats-composition-segment is-active"
                  style={{ width: `${composition.activePct}%` }}
                  title={`Attivi: ${stats.active}`}
                />
              )}
              {composition.convertedPct > 0 && (
                <div
                  className="funnel-stats-composition-segment is-converted"
                  style={{ width: `${composition.convertedPct}%` }}
                  title={`Convertiti: ${stats.converted}`}
                />
              )}
              {composition.lostPct > 0 && (
                <div
                  className="funnel-stats-composition-segment is-lost"
                  style={{ width: `${composition.lostPct}%` }}
                  title={`Persi: ${stats.lost}`}
                />
              )}
            </>
          ) : (
            <div className="funnel-stats-composition-empty">Nessun lead in campagna</div>
          )}
        </div>
        <div className="funnel-stats-composition-legend">
          <span><i className="is-active" /> Attivi ({stats.active})</span>
          <span><i className="is-converted" /> Convertiti ({stats.converted})</span>
          <span><i className="is-lost" /> Persi ({stats.lost})</span>
        </div>
      </div>
    </div>
  );
}
