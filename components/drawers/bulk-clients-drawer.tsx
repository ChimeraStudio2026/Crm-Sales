'use client';

import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { CLIENT_ORIGINS, CLIENT_TYPES, OWNERS } from '@/lib/constants/crm';
import { createUniqueId } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import type { Client, ClientOrigin, ClientType, Owner } from '@/lib/types/crm';

interface DraftClientRow {
  id: string;
  name: string;
  type: ClientType;
  owner: Owner;
  clientOrigin: ClientOrigin | '';
}

function createEmptyDraftRow(): DraftClientRow {
  return {
    id: createUniqueId('draft-client'),
    name: '',
    type: CLIENT_TYPES[0],
    owner: 'Jeck',
    clientOrigin: '',
  };
}

interface BulkClientsDrawerProps {
  isCold: boolean;
  onClose: () => void;
}

export function BulkClientsDrawer({ isCold, onClose }: BulkClientsDrawerProps) {
  const { saveClients } = useCrm();
  const [rows, setRows] = useState<DraftClientRow[]>([createEmptyDraftRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateRow = (rowId: string, patch: Partial<DraftClientRow>): void => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const addRow = (): void => {
    setRows((prev) => [...prev, createEmptyDraftRow()]);
  };

  const removeRow = (rowId: string): void => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== rowId)));
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const validRows = rows.filter((row) => row.name.trim());
    if (validRows.length === 0) return;
    setIsSubmitting(true);
    try {
      await saveClients(
        validRows.map((row) => ({
          name: row.name.trim(),
          type: row.type,
          owner: row.owner,
          clientOrigin: row.clientOrigin,
        })),
        { isCold },
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = rows.filter((row) => row.name.trim()).length;

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} aria-hidden />
      <div className="drawer open bulk-clients-drawer">
        <div className="drawer-header">
          <h3>Aggiungi clienti</h3>
          <div className="drawer-close" onClick={onClose} role="button" tabIndex={0}>
            <X size={20} />
          </div>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="drawer-body">
            <p className="bulk-clients-hint">
              Compila una o più righe. Usa + per aggiungere altri clienti prima di salvare.
            </p>
            <div className="bulk-clients-rows">
              {rows.map((row, index) => (
                <div key={row.id} className="bulk-clients-row">
                  <div className="bulk-clients-row-header">
                    <strong>Cliente {index + 1}</strong>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="btn-table-action btn-table-action-danger"
                        title="Rimuovi riga"
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="bulk-clients-row-fields">
                    <div className="form-group">
                      <label htmlFor={`bulk-name-${row.id}`}>Nome Cliente *</label>
                      <input
                        id={`bulk-name-${row.id}`}
                        className="form-input"
                        value={row.name}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                        placeholder="Nome azienda"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor={`bulk-type-${row.id}`}>Tipologia</label>
                      <select
                        id={`bulk-type-${row.id}`}
                        className="form-select"
                        value={row.type}
                        onChange={(e) => updateRow(row.id, { type: e.target.value as ClientType })}
                      >
                        {CLIENT_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor={`bulk-owner-${row.id}`}>Owner</label>
                      <select
                        id={`bulk-owner-${row.id}`}
                        className="form-select"
                        value={row.owner}
                        onChange={(e) => updateRow(row.id, { owner: e.target.value as Owner })}
                      >
                        {OWNERS.map((owner) => (
                          <option key={owner} value={owner}>{owner}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor={`bulk-origin-${row.id}`}>Origine Cliente</label>
                      <select
                        id={`bulk-origin-${row.id}`}
                        className="form-select"
                        value={row.clientOrigin}
                        onChange={(e) => updateRow(row.id, { clientOrigin: e.target.value as ClientOrigin | '' })}
                      >
                        <option value="">Seleziona origine</option>
                        {CLIENT_ORIGINS.map((origin) => (
                          <option key={origin} value={origin}>{origin}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm bulk-clients-add-row" onClick={addRow}>
              <Plus size={14} />
              <span>Aggiungi riga cliente</span>
            </button>
          </div>
          <div className="drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || validCount === 0}>
              {isSubmitting ? 'Salvataggio...' : `Salva ${validCount} clienti`}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
