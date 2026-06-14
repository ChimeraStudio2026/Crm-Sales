'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, TrendingUp } from 'lucide-react';
import {
  buildRollingTwelveMonthRevenueWithStats,
  formatRollingMonthLabel,
  formatRollingMonthShortLabel,
} from '@/lib/analysis/rolling-revenue';
import { formatCurrency } from '@/lib/crm/utils';
import { createBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchAllOkrRecords } from '@/lib/supabase/database';
import { useCrm } from '@/providers/crm-provider';
import type { OkrRecord } from '@/lib/types/crm';

const CHART_HEIGHT_PX = 240;
const CHART_LABEL_HEIGHT_PX = 28;
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
  const { okrRecords, isLoading: isCrmLoading } = useCrm();
  const [isOpen, setIsOpen] = useState(false);
  const [supabaseOkrRecords, setSupabaseOkrRecords] = useState<OkrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadSource, setLoadSource] = useState<'supabase' | 'local'>('local');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadOkrFromSupabase = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    const db = createBrowserSupabaseClient();
    if (!isSupabaseConfigured() || !db) {
      setSupabaseOkrRecords(okrRecords);
      setLoadSource('local');
      setLoadError('Supabase non configurato in .env.local');
      setIsLoading(false);
      return;
    }
    const { data: { session }, error: sessionError } = await db.auth.getSession();
    if (sessionError || !session) {
      setSupabaseOkrRecords(okrRecords);
      setLoadSource('local');
      setLoadError('Sessione Supabase non attiva nel gestionale. Rieffettua il login.');
      setIsLoading(false);
      return;
    }
    try {
      const records = await fetchAllOkrRecords(db);
      setSupabaseOkrRecords(records);
      setLoadSource('supabase');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore lettura okr_records';
      setLoadError(message);
      setSupabaseOkrRecords(okrRecords);
      setLoadSource('local');
    } finally {
      setIsLoading(false);
    }
  }, [okrRecords]);

  useEffect(() => {
    if (isCrmLoading) return;
    void loadOkrFromSupabase();
  }, [isCrmLoading, loadOkrFromSupabase, okrRecords.length]);

  useEffect(() => {
    if (!isOpen || isCrmLoading) return;
    void loadOkrFromSupabase();
  }, [isOpen, isCrmLoading, loadOkrFromSupabase]);

  const rollingResult = useMemo(
    () => buildRollingTwelveMonthRevenueWithStats(supabaseOkrRecords),
    [supabaseOkrRecords],
  );

  const { points: rollingPoints, totalOkrCount, usedOkrCount, skippedOkrCount, skippedOkrAmount } = rollingResult;

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
          {isLoading
            ? 'Caricamento OKR...'
            : latestPoint
              ? `${formatCurrency(latestPoint.rollingAmount)} · ${formatRollingMonthLabel(latestPoint.year, latestPoint.month)}`
              : 'Servono almeno 12 mesi di OKR'}
        </span>
      </button>
      {isOpen && (
        <div className="analysis-accordion-body rolling-revenue-body">
          <p className="rolling-revenue-source">
            Fonte:{' '}
            {loadSource === 'supabase' ? (
              <strong>Supabase · okr_records</strong>
            ) : (
              <strong>cache locale gestionale</strong>
            )}
            {' '}· <strong>{totalOkrCount} OKR</strong> letti
            {' '}· usati nel grafico: <strong>{usedOkrCount}</strong> con mese valido
            {skippedOkrCount > 0 && (
              <>
                {' '}· esclusi <strong>{skippedOkrCount}</strong> senza mese ({formatCurrency(skippedOkrAmount)})
              </>
            )}
            .
          </p>
          {loadError && (
            <p className="analysis-empty-hint rolling-revenue-error">
              {loadError}
            </p>
          )}
          {isLoading ? (
            <p className="analysis-empty-hint">Caricamento OKR da Supabase...</p>
          ) : rollingPoints.length === 0 ? (
            <p className="analysis-empty-hint">
              Servono almeno 12 mesi di calendario con OKR datati (2023–2026).
              {totalOkrCount === 0
                ? ' Nessun OKR in Supabase: importa gli Excel storici.'
                : ' Verifica che l\'import Excel abbia colonna data o mese compilata.'}
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
                  role="img"
                  aria-label="Grafico a barre del fatturato anno mobile per mese"
                >
                  {rollingPoints.map((point) => {
                    const trackHeight = CHART_HEIGHT_PX - CHART_LABEL_HEIGHT_PX;
                    const barHeightPx = Math.max(
                      2,
                      Math.round((point.rollingAmount / maxRollingAmount) * trackHeight),
                    );
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
                            style={{ height: `${barHeightPx}px` }}
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
