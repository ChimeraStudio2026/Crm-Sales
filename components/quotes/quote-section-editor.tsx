'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { findCatalogEntry, searchCatalog } from '@/lib/quotes/catalog';
import { formatQuoteCurrency, getSectionTotals, itemPrice } from '@/lib/quotes/calc';
import { createQuoteItem, getSectionNote, resolveItemCode, setSectionNote } from '@/lib/quotes/draft';
import type { QuoteSectionDefinition } from '@/lib/quotes/sections';
import type { QuoteDraft, QuoteItem, QuoteTotals } from '@/lib/quotes/types';

interface QuoteSectionEditorProps {
  readonly section: QuoteSectionDefinition;
  readonly quote: QuoteDraft;
  readonly totals: QuoteTotals;
  readonly onQuoteChange: (updater: (current: QuoteDraft) => QuoteDraft) => void;
}

type NumericField = 'qty' | 'prepDays' | 'days' | 'unitPrice' | 'nic' | 'extras';

export function QuoteSectionEditor({ section, quote, totals, onQuoteChange }: QuoteSectionEditorProps) {
  const items = quote.items.filter((item) => item.section === section.code);
  const [isOpen, setIsOpen] = useState(items.length > 0);
  const isExpanded = isOpen || items.length > 0;
  const sectionTotals = getSectionTotals(totals, section.code);
  const catalogOptions = searchCatalog('', section.code);
  const datalistId = `quote-catalog-${section.code}`;

  const updateItem = (itemId: string, patch: Partial<QuoteItem>): void => {
    onQuoteChange((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  };

  // Scegliendo una voce del listino dal menu, prezzo e costo arrivano dal listino.
  const handleJobChange = (item: QuoteItem, value: string): void => {
    const entry = findCatalogEntry(value);
    if (entry) {
      updateItem(item.id, { job: entry.name, catalogName: entry.name, unitPrice: entry.dailyPrice, unitCost: entry.dailyCost });
      return;
    }
    updateItem(item.id, { job: value, catalogName: item.catalogName && value === item.job ? item.catalogName : '' });
  };

  const handleNumberChange = (item: QuoteItem, field: NumericField, raw: string): void => {
    const value = Number(raw.replace(',', '.'));
    updateItem(item.id, { [field]: Number.isFinite(value) ? value : 0 });
  };

  const addItem = (): void => {
    setIsOpen(true);
    onQuoteChange((current) => ({ ...current, items: [...current.items, createQuoteItem(section.code)] }));
  };

  const removeItem = (itemId: string): void => {
    onQuoteChange((current) => ({ ...current, items: current.items.filter((item) => item.id !== itemId) }));
  };

  return (
    <div className="glass-card quote-card quote-section-card" id={`quote-section-${section.code}`}>
      <div className="quote-card-header">
        <button type="button" className="quote-section-toggle" onClick={() => setIsOpen(!isExpanded)}>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <h4>{section.letter}. {section.label}</h4>
        </button>
        <span className="quote-section-total">{formatQuoteCurrency(sectionTotals.total)}</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
          <Plus size={14} /> Voce
        </button>
      </div>
      {isExpanded ? (
        <>
          <div className="form-group quote-section-note">
            <label htmlFor={`quote-note-${section.code}`}>Nota di sezione (va nel Report)</label>
            <input
              id={`quote-note-${section.code}`}
              className="form-input"
              value={getSectionNote(quote, section.code)}
              placeholder={items.length ? 'Es. 1x director; 1x director of photography' : 'Not-Incl'}
              onChange={(event) => {
                const note = event.target.value;
                onQuoteChange((current) => ({ ...current, sectionNotes: setSectionNote(current, section.code, note) }));
              }}
            />
          </div>
          <datalist id={datalistId}>
            {catalogOptions.map((entry) => (
              <option key={entry.name} value={entry.name}>{formatQuoteCurrency(entry.dailyPrice)}</option>
            ))}
          </datalist>
          {items.length > 0 ? (
            <div className="quote-table-scroll">
              <table className="quote-table quote-items-table">
                <thead>
                  <tr>
                    <th className="col-id">ID</th>
                    <th className="col-job">Job</th>
                    <th className="col-note">Note</th>
                    <th className="is-numeric col-small">Qty</th>
                    {section.splitDays ? (
                      <>
                        <th className="is-numeric col-small">Prep</th>
                        <th className="is-numeric col-small">Shoot</th>
                      </>
                    ) : (
                      <th className="is-numeric col-small">Days</th>
                    )}
                    <th className="is-numeric col-money">Unit price</th>
                    <th className="is-numeric col-small">NIC %</th>
                    <th className="is-numeric col-money">Price</th>
                    <th className="is-numeric col-money">Extras</th>
                    <th aria-label="Rimuovi" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="col-id">{resolveItemCode(quote, item)}</td>
                      <td className="col-job">
                        <input
                          className="form-input quote-cell-input"
                          list={datalistId}
                          value={item.job}
                          placeholder="Cerca nel listino o scrivi una voce"
                          onChange={(event) => handleJobChange(item, event.target.value)}
                        />
                        {!item.catalogName ? <span className="quote-free-item">voce libera</span> : null}
                      </td>
                      <td className="col-note">
                        <input
                          className="form-input quote-cell-input"
                          value={item.note}
                          onChange={(event) => updateItem(item.id, { note: event.target.value })}
                        />
                      </td>
                      <NumberCell value={item.qty} onChange={(raw) => handleNumberChange(item, 'qty', raw)} />
                      {section.splitDays ? (
                        <NumberCell value={item.prepDays} onChange={(raw) => handleNumberChange(item, 'prepDays', raw)} />
                      ) : null}
                      <NumberCell value={item.days} onChange={(raw) => handleNumberChange(item, 'days', raw)} />
                      <NumberCell value={item.unitPrice} onChange={(raw) => handleNumberChange(item, 'unitPrice', raw)} />
                      <NumberCell value={item.nic} onChange={(raw) => handleNumberChange(item, 'nic', raw)} />
                      <td className="is-numeric quote-price-cell">{formatQuoteCurrency(itemPrice(item))}</td>
                      <NumberCell value={item.extras} onChange={(raw) => handleNumberChange(item, 'extras', raw)} />
                      <td>
                        <button
                          type="button"
                          className="quote-remove-btn"
                          aria-label="Rimuovi voce"
                          onClick={() => removeItem(item.id)}
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="quote-section-empty">Nessuna voce: nel Report la sezione risulta «Not-Incl».</p>
          )}
          {items.length > 0 ? (
            <dl className="quote-section-summary">
              <div><dt>{section.label} sub total</dt><dd>{formatQuoteCurrency(sectionTotals.subtotal)}</dd></div>
              <div>
                <dt>Production fee {quote.productionFeePct}%</dt>
                <dd>{formatQuoteCurrency(sectionTotals.fee)}</dd>
              </div>
              <div className="is-total"><dt>{section.label} total</dt><dd>{formatQuoteCurrency(sectionTotals.total)}</dd></div>
            </dl>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

interface NumberCellProps {
  readonly value: number;
  readonly onChange: (raw: string) => void;
}

function NumberCell({ value, onChange }: NumberCellProps) {
  return (
    <td className="is-numeric">
      <input
        className="form-input quote-cell-input quote-number-input"
        type="number"
        min={0}
        step="any"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(event.target.value)}
      />
    </td>
  );
}
