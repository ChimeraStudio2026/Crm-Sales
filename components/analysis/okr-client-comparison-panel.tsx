'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Search, Users } from 'lucide-react';
import {
  OKR_COMPARISON_YEARS,
  OKR_TIMELINE_MAX_DAY,
  OKR_TIMELINE_MONTH_LABELS,
  buildOkrMonthlySeries,
  computeOkrTimelineSnapshot,
  filterOkrByClientName,
  formatTimelineDateLabel,
  getDefaultTimelineDayOfYear,
  getMonthlyAmountAtMonth,
  getMonthlyCountAtMonth,
  getOkrClientNames,
  getOkrComparisonDeltaSnapshots,
  getOkrComparisonYearRangeLabel,
  getTimelineMonthLabel,
} from '@/lib/analysis/okr-timeline';
import { useOkrConfirmations } from '@/lib/analysis/use-okr-confirmations';
import { ANALYSIS_YEAR, PREVIOUS_ANALYSIS_YEAR } from '@/lib/constants/crm';
import { filterOkrByClientYearMonth } from '@/lib/crm/client-sold-products';
import { OkrDetailDrawer } from '@/components/analysis/okr-detail-drawer';
import { formatCurrency } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';

interface OkrDetailSelection {
  year: number;
  monthNumber: number;
}

export function OkrClientComparisonPanel() {
  const { okrRecords } = useCrm();
  const confirmations = useOkrConfirmations();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [dayOfYear, setDayOfYear] = useState<number>(getDefaultTimelineDayOfYear);
  const [detailSelection, setDetailSelection] = useState<OkrDetailSelection | null>(null);

  const clientNames = useMemo(() => getOkrClientNames(okrRecords), [okrRecords]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? clientNames.filter((name) => name.toLowerCase().includes(query))
      : clientNames;
    return list.slice(0, 24);
  }, [clientNames, search]);

  const clientRecords = useMemo(
    () => (selectedClient ? filterOkrByClientName(okrRecords, selectedClient) : []),
    [okrRecords, selectedClient],
  );

  const monthlySeries = useMemo(
    () => OKR_COMPARISON_YEARS.map((year) => buildOkrMonthlySeries(clientRecords, year, dayOfYear, confirmations)),
    [clientRecords, dayOfYear, confirmations],
  );

  const snapshots = useMemo(
    () => OKR_COMPARISON_YEARS.map((year) => computeOkrTimelineSnapshot(clientRecords, year, dayOfYear, confirmations)),
    [clientRecords, dayOfYear, confirmations],
  );

  const deltaSnapshots = useMemo(
    () => getOkrComparisonDeltaSnapshots(snapshots),
    [snapshots],
  );

  const sliderPercent = ((dayOfYear - 1) / (OKR_TIMELINE_MAX_DAY - 1)) * 100;
  const dateLabel = formatTimelineDateLabel(dayOfYear, ANALYSIS_YEAR);
  const yearRangeLabel = getOkrComparisonYearRangeLabel();
  const baseMonthlySeries = monthlySeries.find((series) => series.year === PREVIOUS_ANALYSIS_YEAR);
  const targetMonthlySeries = monthlySeries.find((series) => series.year === ANALYSIS_YEAR);
  const activeMonth = snapshots[0]?.throughMonth ?? 1;
  const activeMonthLabel = getTimelineMonthLabel(activeMonth);
  const showSuggestions = isSearchFocused && !selectedClient && filteredClients.length > 0;

  const detailRecords = useMemo(() => {
    if (!detailSelection || !selectedClient) return [];
    return filterOkrByClientYearMonth(
      okrRecords,
      selectedClient,
      detailSelection.year,
      detailSelection.monthNumber,
    );
  }, [detailSelection, okrRecords, selectedClient]);

  const handleSelectClient = (clientName: string): void => {
    setSelectedClient(clientName);
    setSearch(clientName);
    setIsSearchFocused(false);
    setDetailSelection(null);
  };

  const openOkrDetail = (year: number, monthNumber: number, amount: number): void => {
    if (amount <= 0) return;
    setDetailSelection({ year, monthNumber });
  };

  const handleSearchChange = (value: string): void => {
    setSearch(value);
    if (selectedClient && value.trim().toLowerCase() !== selectedClient.trim().toLowerCase()) {
      setSelectedClient('');
    }
  };

  return (
    <div className={`analysis-accordion okr-comparison-accordion${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="analysis-accordion-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <ChevronRight size={18} className="analysis-accordion-icon" />
        <span>Confronto OKR Clienti</span>
        <span className="analysis-accordion-meta">
          <Users size={14} />
          Per cliente · {yearRangeLabel}
        </span>
      </button>
      {isOpen && (
        <div className="analysis-accordion-body okr-comparison-body">
          <p className="okr-comparison-intro">
            Cerca un cliente e scorri la barra per confrontare quanto ti ha fatturato mese per mese
            tra {OKR_COMPARISON_YEARS[0]} e {OKR_COMPARISON_YEARS[OKR_COMPARISON_YEARS.length - 1]} alla stessa data dell&apos;anno.
          </p>
          <div className="okr-client-picker">
            <label htmlFor="okr-client-search" className="okr-comparison-scrubber-label">
              Cliente
            </label>
            <div className="okr-client-search-wrap">
              <div className="search-box okr-client-search-box">
                <Search size={18} />
                <input
                  id="okr-client-search"
                  type="text"
                  className="search-input"
                  placeholder="Cerca cliente con OKR..."
                  value={search}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    window.setTimeout(() => setIsSearchFocused(false), 150);
                  }}
                  autoComplete="off"
                />
              </div>
              {showSuggestions && (
                <ul className="okr-client-suggestions" role="listbox">
                  {filteredClients.map((clientName) => (
                    <li key={clientName}>
                      <button
                        type="button"
                        className="okr-client-suggestion-btn"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelectClient(clientName)}
                      >
                        {clientName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {clientNames.length === 0 && (
              <p className="okr-client-empty">Nessun cliente con OKR importati per {yearRangeLabel}.</p>
            )}
          </div>
          {!selectedClient ? (
            <p className="okr-client-empty">Seleziona un cliente dalla ricerca per vedere il confronto.</p>
          ) : (
            <>
              <div className="okr-client-selected">
                <strong>{selectedClient}</strong>
                <button
                  type="button"
                  className="okr-client-clear-btn"
                  onClick={() => {
                    setSelectedClient('');
                    setSearch('');
                    setDetailSelection(null);
                  }}
                >
                  Cambia cliente
                </button>
              </div>
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
              <div className="okr-client-month-highlight">
                <span className="okr-client-month-label">Mese selezionato: {activeMonthLabel}</span>
                <div className="okr-client-month-values">
                  {monthlySeries.map((series) => {
                    const amount = getMonthlyAmountAtMonth(series, activeMonth);
                    return (
                      <button
                        key={series.year}
                        type="button"
                        className={`okr-client-month-value-btn${amount > 0 ? ' is-clickable' : ''}`}
                        disabled={amount <= 0}
                        onClick={() => openOkrDetail(series.year, activeMonth, amount)}
                      >
                        {series.year}: {formatCurrency(amount)}
                        {' · '}
                        {getMonthlyCountAtMonth(series, activeMonth)} OKR
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="okr-comparison-stats">
                {snapshots.map((snapshot) => (
                  <div key={snapshot.year} className="okr-comparison-stat-card">
                    <span className="okr-comparison-stat-year">{snapshot.year} cumulato</span>
                    <strong className="okr-comparison-stat-value">{formatCurrency(snapshot.amount)}</strong>
                    <span className="okr-comparison-stat-meta">
                      {snapshot.count} OKR · confermati al {snapshot.throughDay}/{snapshot.throughMonth.toString().padStart(2, '0')}
                    </span>
                  </div>
                ))}
                {deltaSnapshots && (
                <div className="okr-comparison-stat-card okr-comparison-stat-delta">
                  <span className="okr-comparison-stat-year">Delta cumulato {deltaSnapshots.target.year} vs {deltaSnapshots.base.year}</span>
                  <strong className={`okr-comparison-stat-value ${deltaSnapshots.target.amount - deltaSnapshots.base.amount >= 0 ? 'analysis-kpi-positive' : 'analysis-kpi-negative'}`}>
                    {formatCurrency(deltaSnapshots.target.amount - deltaSnapshots.base.amount)}
                  </strong>
                  <span className="okr-comparison-stat-meta">
                    Mese {activeMonthLabel}:{' '}
                    {baseMonthlySeries && targetMonthlySeries
                      ? formatCurrency(
                          getMonthlyAmountAtMonth(targetMonthlySeries, activeMonth)
                          - getMonthlyAmountAtMonth(baseMonthlySeries, activeMonth),
                        )
                      : formatCurrency(0)}
                  </span>
                </div>
                )}
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
                  {monthlySeries.map((series) => {
                    const chartMax = Math.max(...monthlySeries.flatMap((item) => item.monthlyAmounts), 1);
                    return (
                      <div key={series.year} className="okr-comparison-row">
                        <div className="okr-comparison-row-track">
                          {series.monthlyAmounts.map((amount, monthIndex) => {
                            const monthNumber = monthIndex + 1;
                            const count = series.monthlyCounts[monthIndex];
                            const isIncluded = count > 0;
                            const isActiveMonth = monthNumber === activeMonth;
                            const barHeight = Math.max(8, Math.round((amount / chartMax) * 100));
                            return (
                              <button
                                key={`${series.year}-${monthNumber}`}
                                type="button"
                                className={[
                                  'okr-comparison-month-cell',
                                  isIncluded ? 'is-included' : '',
                                  isActiveMonth ? 'is-active-month' : '',
                                  amount > 0 ? 'is-clickable' : '',
                                ].filter(Boolean).join(' ')}
                                title={`${OKR_TIMELINE_MONTH_LABELS[monthIndex]}: ${formatCurrency(amount)} · ${series.monthlyCounts[monthIndex]} OKR`}
                                disabled={amount <= 0}
                                onClick={() => openOkrDetail(series.year, monthNumber, amount)}
                              >
                                <div
                                  className="okr-comparison-month-bar"
                                  style={{ height: `${barHeight}%` }}
                                />
                                {amount > 0 && (
                                  <span className="okr-comparison-month-value">
                                    {formatCurrency(amount)}
                                  </span>
                                )}
                              </button>
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
            </>
          )}
          {detailSelection && selectedClient && (
            <OkrDetailDrawer
              clientName={selectedClient}
              year={detailSelection.year}
              monthNumber={detailSelection.monthNumber}
              records={detailRecords}
              onClose={() => setDetailSelection(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
