'use client';

import { useState } from 'react';
import { Plus, Trash2, UserPlus, X } from 'lucide-react';
import { CLIENT_ORIGINS, CLIENT_TYPES, OWNERS } from '@/lib/constants/crm';
import { getDefaultOwnerForWorkspace } from '@/lib/crm/workspace-clients';
import { createUniqueId } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import type { ClientContact, ClientOrigin, ClientType, Owner } from '@/lib/types/crm';

interface DraftClientRow {
  id: string;
  name: string;
  type: ClientType;
  owner: Owner;
  clientOrigin: ClientOrigin | '';
  contacts: ClientContact[];
}

function createEmptyContact(): ClientContact {
  return { id: createUniqueId('contact'), name: '', email: '', phone: '', role: '' };
}

function isFilledContact(contact: ClientContact): boolean {
  return Boolean(contact.name.trim() || contact.email.trim() || contact.phone.trim() || contact.role.trim());
}

function createEmptyDraftRow(): DraftClientRow {
  return {
    id: createUniqueId('draft-client'),
    name: '',
    type: CLIENT_TYPES[0],
    owner: getDefaultOwnerForWorkspace(),
    clientOrigin: '',
    contacts: [createEmptyContact()],
  };
}

interface BulkClientsDrawerProps {
  onClose: () => void;
}

/** I clienti nuovi partono sempre Freddi: diventano caldi quando fatturano (sync Cerbero). */
export function BulkClientsDrawer({ onClose }: BulkClientsDrawerProps) {
  const { saveClients } = useCrm();
  const [rows, setRows] = useState<DraftClientRow[]>([createEmptyDraftRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateRow = (rowId: string, patch: Partial<DraftClientRow>): void => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const addRow = (): void => {
    setRows((prev) => [...prev, createEmptyDraftRow()]);
  };

  const updateContact = (rowId: string, contactId: string, patch: Partial<ClientContact>): void => {
    setRows((prev) => prev.map((row) => (
      row.id === rowId
        ? { ...row, contacts: row.contacts.map((contact) => (contact.id === contactId ? { ...contact, ...patch } : contact)) }
        : row
    )));
  };

  const addContact = (rowId: string): void => {
    setRows((prev) => prev.map((row) => (
      row.id === rowId ? { ...row, contacts: [...row.contacts, createEmptyContact()] } : row
    )));
  };

  const removeContact = (rowId: string, contactId: string): void => {
    setRows((prev) => prev.map((row) => (
      row.id === rowId && row.contacts.length > 1
        ? { ...row, contacts: row.contacts.filter((contact) => contact.id !== contactId) }
        : row
    )));
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
          relationship: 'Freddo',
          contacts: row.contacts
            .filter(isFilledContact)
            .map((contact) => ({
              ...contact,
              name: contact.name.trim(),
              email: contact.email.trim(),
              phone: contact.phone.trim(),
              role: contact.role.trim(),
            })),
        })),
        { isCold: true },
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
              I clienti nuovi vengono creati come <strong>Freddi</strong>: passano tra i caldi quando fatturano almeno 1€.
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
                  <div className="bulk-clients-contacts">
                    <span className="bulk-clients-contacts-title">Contatti</span>
                    {row.contacts.map((contact, contactIndex) => (
                      <div key={contact.id} className="bulk-clients-contact">
                        <input
                          className="form-input"
                          placeholder="Nome"
                          aria-label={`Nome contatto ${contactIndex + 1}`}
                          value={contact.name}
                          onChange={(e) => updateContact(row.id, contact.id, { name: e.target.value })}
                        />
                        <input
                          className="form-input"
                          type="email"
                          placeholder="Mail"
                          aria-label={`Mail contatto ${contactIndex + 1}`}
                          value={contact.email}
                          onChange={(e) => updateContact(row.id, contact.id, { email: e.target.value })}
                        />
                        <input
                          className="form-input"
                          type="tel"
                          placeholder="Telefono"
                          aria-label={`Telefono contatto ${contactIndex + 1}`}
                          value={contact.phone}
                          onChange={(e) => updateContact(row.id, contact.id, { phone: e.target.value })}
                        />
                        <input
                          className="form-input"
                          placeholder="Posizione"
                          aria-label={`Posizione contatto ${contactIndex + 1}`}
                          value={contact.role}
                          onChange={(e) => updateContact(row.id, contact.id, { role: e.target.value })}
                        />
                        {row.contacts.length > 1 && (
                          <button
                            type="button"
                            className="btn-contact-delete"
                            title="Rimuovi contatto"
                            onClick={() => removeContact(row.id, contact.id)}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addContact(row.id)}>
                      <UserPlus size={14} />
                      <span>Aggiungi contatto</span>
                    </button>
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
