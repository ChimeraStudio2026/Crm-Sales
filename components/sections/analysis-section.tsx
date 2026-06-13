'use client';

import { useEffect, useState } from 'react';
import { BarChart3, ChevronRight, Layers } from 'lucide-react';
import {
  ANALYSIS_SCOPES,
  CLIENT_TYPE_ROWS,
  RELATIONSHIP_ROWS,
  buildGroupedStats,
  buildProductStats,
  buildScopeMetrics,
  filterOkrByScope,
  filterOkrByYear,
  formatPct,
  formatPctPlain,
} from '@/lib/analysis/index';
import { ANALYSIS_YEARS } from '@/lib/constants/crm';
import { formatCurrency } from '@/lib/crm/utils';
import { TopHeader } from '@/components/layout/top-header';
import { OkrYearComparisonPanel } from '@/components/analysis/okr-year-comparison-panel';
import { OkrClientComparisonPanel } from '@/components/analysis/okr-client-comparison-panel';
import { useCrm } from '@/providers/crm-provider';

function AnalysisNumberInput({
  value,
  className,
  min,
  max,
  step,
  placeholder,
  onSave,
}: {
  value: number;
  className: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value ? String(value) : '');

  useEffect(() => {
    setDraft(value ? String(value) : '');
  }, [value]);

  const commitValue = (): void => {
    const parsed = parseFloat(draft);
    const nextValue = Number.isFinite(parsed) ? parsed : 0;
    onSave(nextValue);
  };

  return (
    <input
      type="number"
      className={className}
      value={draft}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commitValue}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function ScopeContent({
  scopeId,
  year,
  quarter,
}: {
  scopeId: string;
  year: number;
  quarter?: number;
}) {
  const { okrRecords, analysisForecasts, clients, setAnalysisForecast } = useCrm();
  const records = filterOkrByScope(okrRecords, scopeId, year, quarter);
  const forecastScope = analysisForecasts[scopeId] || { totalForecast: 0, productPct: {} };
  const metrics = buildScopeMetrics(records, forecastScope);
  const productStats = buildProductStats(records, forecastScope);
  const relationshipStats = buildGroupedStats(
    records,
    clients,
    (client) => client.relationship,
    RELATIONSHIP_ROWS,
  );
  const clientTypeStats = buildGroupedStats(
    records,
    clients,
    (client) => client.type,
    CLIENT_TYPE_ROWS,
  );

  return (
    <>
      <div className="analysis-kpi-grid">
        <div className="analysis-kpi-card">
          <span className="analysis-kpi-label">Totale OKR</span>
          <strong className="analysis-kpi-value">{formatCurrency(metrics.total)}</strong>
          <span className="analysis-kpi-hint">Somma OKR importati da Excel</span>
        </div>
        <div className="analysis-kpi-card">
          <span className="analysis-kpi-label">Previsione</span>
          <AnalysisNumberInput
            className="analysis-forecast-input"
            value={forecastScope.totalForecast || 0}
            min={0}
            step={100}
            placeholder="0"
            onSave={(nextValue) => {
              void setAnalysisForecast(scopeId, 'totalForecast', nextValue);
            }}
          />
          <span className="analysis-kpi-hint">Inserimento manuale</span>
        </div>
        <div className="analysis-kpi-card">
          <span className="analysis-kpi-label">Delta</span>
          <strong className={`analysis-kpi-value ${metrics.delta >= 0 ? 'analysis-kpi-positive' : 'analysis-kpi-negative'}`}>
            {formatCurrency(metrics.delta)}
          </strong>
          <span className="analysis-kpi-hint">Totale − Previsione</span>
        </div>
      </div>
      <div className="analysis-table-block">
        <h4 className="analysis-table-title">Tipi di progetti</h4>
        <div className="analysis-table-wrap">
          <table className="analysis-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Fatturato</th>
                <th>Fatturato %</th>
                <th>Previsione %</th>
                <th>Delta %</th>
                <th>Ticket Medio</th>
                <th>N. Prop</th>
              </tr>
            </thead>
            <tbody>
              {productStats.map((row) => (
                <tr key={row.category}>
                  <td><strong>{row.category}</strong></td>
                  <td className="analysis-num">{formatCurrency(row.revenue)}</td>
                  <td className="analysis-num">{formatPctPlain(row.revenuePct)}</td>
                  <td className="analysis-num">
                    <AnalysisNumberInput
                      className="analysis-pct-input"
                      value={row.forecastPct || 0}
                      min={0}
                      max={100}
                      step={0.01}
                      onSave={(nextValue) => {
                        void setAnalysisForecast(scopeId, 'productPct', nextValue, row.category);
                      }}
                    />
                    %
                  </td>
                  <td className={`analysis-num ${row.deltaPct >= 0 ? 'analysis-kpi-positive' : 'analysis-kpi-negative'}`}>
                    {formatPct(row.deltaPct)}
                  </td>
                  <td className="analysis-num">{formatCurrency(row.ticketMedio)}</td>
                  <td className="analysis-num">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {[
        { title: 'Tipi di clienti — Rapporto', rows: relationshipStats },
        { title: 'Tipi di clienti — Tipologia CRM', rows: clientTypeStats },
      ].map(({ title, rows }) => (
        <div key={title} className="analysis-table-block">
          <h4 className="analysis-table-title">{title}</h4>
          <div className="analysis-table-wrap">
            <table className="analysis-table analysis-table-simple">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Fatturato</th>
                  <th>Fatturato %</th>
                </tr>
              </thead>
              <tbody>
                <tr className="analysis-row-total">
                  <td><strong>TOTALI</strong></td>
                  <td className="analysis-num"><strong>{formatCurrency(metrics.total)}</strong></td>
                  <td className="analysis-num"><strong>100%</strong></td>
                </tr>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="analysis-num">{formatCurrency(row.revenue)}</td>
                    <td className="analysis-num">{formatPctPlain(row.revenuePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

const ANALYSIS_YEAR_OPTIONS = ANALYSIS_YEARS;

export function AnalysisSection() {
  const { okrRecords, analysisYear, setAnalysisYear, analysisExpanded, toggleAnalysisScope } = useCrm();
  const quarterScopes = ANALYSIS_SCOPES.filter((s) => s.isQuarter);
  const yearOkrRecords = filterOkrByYear(okrRecords, analysisYear);

  return (
    <>
      <TopHeader />
      <div className="content-body">
      <section className="app-section active">
        <div className="analysis-dashboard">
          <OkrYearComparisonPanel />
          <OkrClientComparisonPanel />
          <div className="analysis-intro glass-card">
            <h3><BarChart3 size={20} /> Analisi {analysisYear}</h3>
            <p>
              I dati di fatturato e N. Prop derivano dagli OKR importati via Excel.
              Big Prod e Motion sono unificati in <strong>Prod</strong>.
            </p>
            {yearOkrRecords.length === 0 && (
              <p className="analysis-empty-hint">
                Nessun OKR caricato per {analysisYear} — importa un file Excel dalla sezione Importa Excel.
              </p>
            )}
          </div>
          <div className="analysis-block analysis-block-total is-open">
            <div className="analysis-block-header">
              <h3><Layers size={20} /> Totale Anno {analysisYear}</h3>
              <div className="analysis-block-header-actions">
                <div className="analysis-year-switcher" role="group" aria-label="Seleziona anno analisi">
                  {ANALYSIS_YEAR_OPTIONS.map((year) => (
                    <button
                      key={year}
                      type="button"
                      className={`analysis-year-switcher-btn${analysisYear === year ? ' is-active' : ''}`}
                      aria-pressed={analysisYear === year}
                      onClick={() => setAnalysisYear(year)}
                    >
                      {year}
                    </button>
                  ))}
                </div>
                <span className="quick-stats-badge">{yearOkrRecords.length} OKR totali</span>
              </div>
            </div>
            <div className="analysis-block-body">
              <ScopeContent scopeId="total" year={analysisYear} />
            </div>
          </div>
          <div className="analysis-quarters">
            {quarterScopes.map((scope) => {
              const isOpen = analysisExpanded.has(scope.id);
              const scopedRecords = filterOkrByScope(okrRecords, scope.id, analysisYear, scope.quarter);
              const total = scopedRecords.reduce((s, r) => s + r.amount, 0);
              return (
                <div key={scope.id} className={`analysis-accordion${isOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="analysis-accordion-toggle"
                    onClick={() => toggleAnalysisScope(scope.id)}
                  >
                    <ChevronRight size={18} className="analysis-accordion-icon" />
                    <span>{scope.label}</span>
                    <span className="analysis-accordion-meta">
                      {formatCurrency(total)} · {scopedRecords.length} OKR
                    </span>
                  </button>
                  {isOpen && (
                    <div className="analysis-accordion-body">
                      <ScopeContent scopeId={scope.id} year={analysisYear} quarter={scope.quarter} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
