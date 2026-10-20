'use client';

import { useState } from 'react';
import { formatQuoteCurrency, premiumForTargetTotal } from '@/lib/quotes/calc';
import type { QuoteDraft, QuoteTotals } from '@/lib/quotes/types';

interface QuoteTotalsCardProps {
  readonly quote: QuoteDraft;
  readonly totals: QuoteTotals;
  readonly onQuoteChange: (updater: (current: QuoteDraft) => QuoteDraft) => void;
}

export function QuoteTotalsCard({ quote, totals, onQuoteChange }: QuoteTotalsCardProps) {
  const [targetTotal, setTargetTotal] = useState('');

  const applyTargetTotal = (): void => {
    const target = Number(targetTotal.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(target) || target <= 0) return;
    onQuoteChange((current) => ({ ...current, premium: premiumForTargetTotal(current, target) }));
    setTargetTotal('');
  };

  return (
    <div className="glass-card quote-card quote-totals-card">
      <div className="quote-card-header">
        <h4>Totali</h4>
      </div>
      <div className="quote-totals-layout">
        <div className="quote-totals-controls">
          <div className="form-group">
            <label htmlFor="quote-fee">Production fee %</label>
            <input
              id="quote-fee"
              type="number"
              min={0}
              step="any"
              className="form-input"
              value={quote.productionFeePct}
              onChange={(event) => {
                const value = Number(event.target.value) || 0;
                onQuoteChange((current) => ({ ...current, productionFeePct: value }));
              }}
            />
          </div>
          <div className="form-group">
            <label htmlFor="quote-premium">Premium / sconto €</label>
            <input
              id="quote-premium"
              type="number"
              step="any"
              className="form-input"
              value={quote.premium}
              onChange={(event) => {
                const value = Number(event.target.value) || 0;
                onQuoteChange((current) => ({ ...current, premium: value }));
              }}
            />
          </div>
          <div className="form-group">
            <label htmlFor="quote-target">Arrotonda il totale a</label>
            <div className="quote-target-row">
              <input
                id="quote-target"
                className="form-input"
                inputMode="decimal"
                placeholder="19000"
                value={targetTotal}
                onChange={(event) => setTargetTotal(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyTargetTotal();
                }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={applyTargetTotal}>
                Applica
              </button>
            </div>
          </div>
        </div>
        <dl className="quote-totals-list">
          <div><dt>Sub total</dt><dd>{formatQuoteCurrency(totals.subtotal)}</dd></div>
          <div><dt>Production fee {quote.productionFeePct}%</dt><dd>{formatQuoteCurrency(totals.fee)}</dd></div>
          {totals.premium !== 0 ? (
            <div className={totals.premium > 0 ? 'is-premium' : 'is-discount'}>
              <dt>{totals.premium > 0 ? 'Premium' : 'Sconto'}</dt>
              <dd>{totals.premium > 0 ? '+' : ''}{formatQuoteCurrency(totals.premium)}</dd>
            </div>
          ) : null}
          <div className="is-total"><dt>Total</dt><dd>{formatQuoteCurrency(totals.total)} +IVA</dd></div>
          <div><dt>Total + IVA {quote.vatPct}%</dt><dd>{formatQuoteCurrency(totals.totalWithVat)}</dd></div>
          <div className="quote-margin">
            <dt>Costo stimato da listino</dt>
            <dd>{formatQuoteCurrency(totals.cost)}</dd>
          </div>
          <div className="quote-margin">
            <dt>Margine</dt>
            <dd>
              {formatQuoteCurrency(totals.margin)} ({(totals.marginPct * 100).toFixed(1).replace('.', ',')}%)
            </dd>
          </div>
        </dl>
      </div>
      <p className="quote-margin-hint">
        Costo e margine sono interni e non vanno in stampa. Le voci libere (budget) non hanno costo di listino.
      </p>
    </div>
  );
}
