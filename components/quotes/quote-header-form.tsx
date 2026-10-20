'use client';

import { QUOTE_STATUS_LABELS, QUOTE_STATUSES } from '@/lib/quotes/status';
import type { QuoteDraft, QuoteStatus } from '@/lib/quotes/types';

interface QuoteHeaderFormProps {
  readonly quote: QuoteDraft;
  readonly onQuoteChange: (updater: (current: QuoteDraft) => QuoteDraft) => void;
}

type TextField =
  | 'code'
  | 'title'
  | 'version'
  | 'clientName'
  | 'clientVat'
  | 'clientAddress'
  | 'directClient'
  | 'country'
  | 'description'
  | 'quoteDate'
  | 'paymentTerms';

const TEXT_FIELDS: ReadonlyArray<{ field: TextField; label: string; placeholder?: string; type?: string }> = [
  { field: 'code', label: 'Codice', placeholder: 'CS1288' },
  { field: 'title', label: 'Progetto', placeholder: 'Campagna settembre' },
  { field: 'version', label: 'Versione', placeholder: 'V1' },
  { field: 'quoteDate', label: 'Data preventivo', type: 'date' },
  { field: 'clientName', label: 'Cliente', placeholder: 'Ragione sociale' },
  { field: 'directClient', label: 'Cliente diretto', placeholder: 'Brand, se il cliente è un\'agenzia' },
  { field: 'clientVat', label: 'P. IVA cliente' },
  { field: 'clientAddress', label: 'Indirizzo cliente' },
  { field: 'country', label: 'Country', placeholder: 'ITA' },
  { field: 'paymentTerms', label: 'Termini di pagamento', placeholder: 'DA DEFINIRE' },
  { field: 'description', label: 'Descrizione' },
];

export function QuoteHeaderForm({ quote, onQuoteChange }: QuoteHeaderFormProps) {
  return (
    <div className="glass-card quote-card">
      <div className="quote-card-header">
        <h4>Dati preventivo</h4>
      </div>
      <div className="quote-header-grid">
        {TEXT_FIELDS.map(({ field, label, placeholder, type }) => (
          <div key={field} className={`form-group${field === 'description' ? ' is-wide' : ''}`}>
            <label htmlFor={`quote-${field}`}>{label}</label>
            <input
              id={`quote-${field}`}
              type={type || 'text'}
              className="form-input"
              value={quote[field]}
              placeholder={placeholder}
              onChange={(event) => {
                const value = event.target.value;
                onQuoteChange((current) => ({ ...current, [field]: value }));
              }}
            />
          </div>
        ))}
        <div className="form-group">
          <label htmlFor="quote-validity">Validità (giorni)</label>
          <input
            id="quote-validity"
            type="number"
            min={0}
            className="form-input"
            value={quote.validityDays}
            onChange={(event) => {
              const value = Number(event.target.value) || 0;
              onQuoteChange((current) => ({ ...current, validityDays: value }));
            }}
          />
        </div>
        <div className="form-group">
          <label htmlFor="quote-status">Stato</label>
          <select
            id="quote-status"
            className="form-select"
            value={quote.status}
            onChange={(event) => {
              const value = event.target.value as QuoteStatus;
              onQuoteChange((current) => ({ ...current, status: value }));
            }}
          >
            {QUOTE_STATUSES.map((status) => (
              <option key={status} value={status}>{QUOTE_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
