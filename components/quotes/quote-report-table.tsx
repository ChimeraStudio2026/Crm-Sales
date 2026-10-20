'use client';

import { formatQuoteCurrency, getSectionTotals } from '@/lib/quotes/calc';
import { resolveSectionReportNote } from '@/lib/quotes/draft';
import { QUOTE_SECTIONS } from '@/lib/quotes/sections';
import type { QuoteDraft, QuoteTotals } from '@/lib/quotes/types';

interface QuoteReportTableProps {
  readonly quote: QuoteDraft;
  readonly totals: QuoteTotals;
}

/** Pagina REPORT di Cerbero: una riga per sezione con nota, prezzo ed extras. */
export function QuoteReportTable({ quote, totals }: QuoteReportTableProps) {
  return (
    <div className="glass-card quote-card">
      <div className="quote-card-header">
        <h4>Report</h4>
      </div>
      <table className="quote-table">
        <thead>
          <tr>
            <th className="col-id">ID</th>
            <th>Item</th>
            <th>Note</th>
            <th className="is-numeric">Price</th>
            <th className="is-numeric">Extras</th>
          </tr>
        </thead>
        <tbody>
          {QUOTE_SECTIONS.map((section) => {
            const sectionTotals = getSectionTotals(totals, section.code);
            return (
              <tr key={section.code}>
                <td className="col-id">{section.letter}</td>
                <td>
                  <a href={`#quote-section-${section.code}`} className="quotes-link">{section.label}</a>
                </td>
                <td className="quote-report-note">{resolveSectionReportNote(quote, section.code)}</td>
                <td className="is-numeric">{formatQuoteCurrency(sectionTotals.subtotal)}</td>
                <td className="is-numeric quote-extras">{formatQuoteCurrency(sectionTotals.extras)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
