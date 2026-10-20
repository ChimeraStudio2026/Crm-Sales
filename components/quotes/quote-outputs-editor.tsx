'use client';

import { Plus, X } from 'lucide-react';
import { createQuoteOutput } from '@/lib/quotes/draft';
import type { QuoteDraft, QuoteOutput } from '@/lib/quotes/types';

interface QuoteOutputsEditorProps {
  readonly quote: QuoteDraft;
  readonly onQuoteChange: (updater: (current: QuoteDraft) => QuoteDraft) => void;
}

export function QuoteOutputsEditor({ quote, onQuoteChange }: QuoteOutputsEditorProps) {
  const updateOutput = (outputId: string, patch: Partial<QuoteOutput>): void => {
    onQuoteChange((current) => ({
      ...current,
      outputs: current.outputs.map((output) => (output.id === outputId ? { ...output, ...patch } : output)),
    }));
  };

  return (
    <div className="glass-card quote-card">
      <div className="quote-card-header">
        <h4>Output</h4>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onQuoteChange((current) => ({ ...current, outputs: [...current.outputs, createQuoteOutput()] }))}
        >
          <Plus size={14} /> Output
        </button>
      </div>
      {quote.outputs.length === 0 ? (
        <p className="quote-section-empty">Nessuna consegna indicata.</p>
      ) : (
        <div className="quote-table-scroll">
          <table className="quote-table">
            <thead>
              <tr>
                <th>Delivery</th>
                <th>Descrizione</th>
                <th className="is-numeric col-small">Qt</th>
                <th className="col-small">Duration</th>
                <th className="col-small">Format</th>
                <th aria-label="Rimuovi" />
              </tr>
            </thead>
            <tbody>
              {quote.outputs.map((output) => (
                <tr key={output.id}>
                  <td>
                    <input
                      className="form-input quote-cell-input"
                      value={output.name}
                      placeholder="Reel master"
                      onChange={(event) => updateOutput(output.id, { name: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input quote-cell-input"
                      value={output.description}
                      onChange={(event) => updateOutput(output.id, { description: event.target.value })}
                    />
                  </td>
                  <td className="is-numeric">
                    <input
                      className="form-input quote-cell-input quote-number-input"
                      type="number"
                      min={0}
                      value={output.qty}
                      onChange={(event) => updateOutput(output.id, { qty: Number(event.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input quote-cell-input"
                      value={output.duration}
                      onChange={(event) => updateOutput(output.id, { duration: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input quote-cell-input"
                      value={output.format}
                      onChange={(event) => updateOutput(output.id, { format: event.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="quote-remove-btn"
                      aria-label="Rimuovi output"
                      onClick={() =>
                        onQuoteChange((current) => ({
                          ...current,
                          outputs: current.outputs.filter((entry) => entry.id !== output.id),
                        }))
                      }
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
