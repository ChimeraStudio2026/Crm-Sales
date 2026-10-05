'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Plus, Search, X } from 'lucide-react';
import { ClientSearchSelect } from '@/components/clients/client-search-select';
import {
  buildAccountingRows,
  formatDaysToDue,
  isAccountingClient,
} from '@/lib/commercial-funnel/accounting';
import type { AccountingRow } from '@/lib/commercial-funnel/accounting';
import { isClientInWorkspace } from '@/lib/crm/workspace-access';
import { createUniqueId, formatActionDateDisplay, getTodayString } from '@/lib/crm/utils';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fetchAllClientActions, insertClientAction } from '@/lib/supabase/client-actions-database';
import {
  ACCOUNTING_ACTION_TYPE,
  DEFAULT_RED_AFTER_DAYS,
  RED_AFTER_DAYS_OPTIONS,
} from '@/lib/types/client-actions';
import type { ClientAction } from '@/lib/types/client-actions';
import type { Client } from '@/lib/types/crm';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type AccountingFilter = 'all' | 'red';

function resolveContactLabel(client: Client, contactId: string): string {
  const contact = client.contacts.find((item) => item.id === contactId);
  if (!contact) return '—';
  return contact.name.trim() || contact.email.trim() || '—';
}

const SEMAFORO_TITLES: Record<AccountingRow['semaforo'], string> = {
  green: 'Nei tempi',
  red: 'In ritardo: serve una nuova azione',
};

interface NewActionDrawerProps {
  clients: Client[];
  initialClientId: string;
  onClose: () => void;
  onSave: (input: { clientId: string; contactId: string; note: string; actionDate: string; redAfterDays: number }) => Promise<void>;
}

function NewActionDrawer({ clients, initialClientId, onClose, onSave }: NewActionDrawerProps) {
  const [clientId, setClientId] = useState(initialClientId);
  const [contactId, setContactId] = useState('');
  const [note, setNote] = useState('');
  const [actionDate, setActionDate] = useState(getTodayString());
  const [redAfterDays, setRedAfterDays] = useState<number>(DEFAULT_RED_AFTER_DAYS);
  const [isSaving, setIsSaving] = useState(false);
  const selectedClient = clients.find((client) => client.id === clientId);
  const contacts = selectedClient?.contacts.filter((contact) => contact.name.trim() || contact.email.trim()) || [];

  useEffect(() => {
    setContactId(contacts[0]?.id || '');
    // Solo al cambio cliente: il contatto di default è il primo del cliente scelto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!clientId || !note.trim()) return;
    setIsSaving(true);
    try {
      await onSave({ clientId, contactId, note: note.trim(), actionDate, redAfterDays });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} aria-hidden />
      <div className="drawer open">
        <div className="drawer-header">
          <h3>Nuova azione · Accounting</h3>
          <div className="drawer-close" onClick={onClose} role="button" tabIndex={0}>
            <X size={20} />
          </div>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="drawer-body">
            <div className="form-group">
              <label>Cliente *</label>
              <ClientSearchSelect
                activeClients={clients}
                coldClients={[]}
                value={clientId}
                onChange={setClientId}
                required
                placeholder="Cerca un cliente caldo..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="accounting-contact">Contatto</label>
              <select
                id="accounting-contact"
                className="form-select"
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                disabled={!selectedClient || contacts.length === 0}
              >
                {contacts.length === 0 ? (
                  <option value="">{selectedClient ? 'Nessun contatto su questo cliente' : 'Scegli prima il cliente'}</option>
                ) : (
                  contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name.trim() || contact.email}
                      {contact.role ? ` · ${contact.role}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="accounting-note">Azione *</label>
              <textarea
                id="accounting-note"
                className="form-textarea"
                rows={4}
                placeholder="Cosa è stato fatto e qual è il prossimo passo"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="accounting-date">Data azione</label>
              <input
                id="accounting-date"
                type="date"
                className="form-input"
                value={actionDate}
                onChange={(event) => setActionDate(event.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Semaforo rosso dopo</label>
              <div className="accounting-red-after" role="radiogroup" aria-label="Semaforo rosso dopo">
                {RED_AFTER_DAYS_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    role="radio"
                    aria-checked={redAfterDays === days}
                    className={`clients-filter-chip${redAfterDays === days ? ' is-active' : ''}`}
                    onClick={() => setRedAfterDays(days)}
                  >
                    {days} giorni
                  </button>
                ))}
              </div>
              <small className="accounting-red-after-hint">
                Se entro {redAfterDays} giorni non registri una nuova azione su questo cliente, il semaforo diventa rosso.
              </small>
            </div>
          </div>
          <div className="drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving || !clientId || !note.trim()}>
              {isSaving ? 'Salvataggio…' : 'Salva azione'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export function AccountingView() {
  const { clients, currentOwner, showToast } = useCrm();
  const { workspaceId } = useWorkspace();
  const db = useMemo(() => createBrowserSupabaseClient(), []);
  const [actions, setActions] = useState<ClientAction[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(db));
  const [filter, setFilter] = useState<AccountingFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedClientId, setExpandedClientId] = useState('');
  const [drawerClientId, setDrawerClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    fetchAllClientActions(db)
      .then((loaded) => {
        if (!cancelled) setActions(loaded);
      })
      .catch((error) => {
        showToast(`Errore lettura azioni: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [db, showToast]);

  const accountingClients = useMemo(
    () => clients
      .filter((client) => isClientInWorkspace(client, workspaceId))
      .filter(isAccountingClient)
      .sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [clients, workspaceId],
  );
  const rows = useMemo(
    () => buildAccountingRows(accountingClients, actions, getTodayString()),
    [accountingClients, actions],
  );
  const redCount = rows.filter((row) => row.semaforo === 'red').length;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => filter === 'all' || row.semaforo === filter)
      .filter((row) => !query || row.client.name.toLowerCase().includes(query));
  }, [filter, rows, search]);

  const handleSave = async (input: {
    clientId: string;
    contactId: string;
    note: string;
    actionDate: string;
    redAfterDays: number;
  }): Promise<void> => {
    if (!db) return;
    try {
      const saved = await insertClientAction(db, {
        id: createUniqueId('client-action'),
        clientId: input.clientId,
        actionType: ACCOUNTING_ACTION_TYPE,
        actionDate: input.actionDate,
        note: input.note,
        author: currentOwner || '',
        createdAt: '',
        contactId: input.contactId,
        redAfterDays: input.redAfterDays,
      });
      setActions((prev) => [saved, ...prev]);
      showToast('Azione registrata anche sulla scheda cliente.', 'success');
    } catch (error) {
      showToast(`Errore salvataggio azione: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
      throw error;
    }
  };

  return (
    <>
      <div className="table-filter-bar accounting-toolbar">
        <div className="filter-left">
          <div className="search-box">
            <Search size={18} />
            <input
              className="search-input"
              placeholder="Cerca cliente..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="proposals-list-chips" role="group" aria-label="Filtra per semaforo">
            <button
              type="button"
              className={`clients-filter-chip${filter === 'all' ? ' is-active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Tutti
              <span className="clients-filter-chip-count">{rows.length}</span>
            </button>
            <button
              type="button"
              className={`clients-filter-chip${filter === 'red' ? ' is-active' : ''}`}
              onClick={() => setFilter('red')}
            >
              In ritardo
              <span className="clients-filter-chip-count">{redCount}</span>
            </button>
          </div>
        </div>
        <div className="filter-right">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setDrawerClientId('')}
            disabled={!db}
          >
            <Plus size={16} />
            <span>Nuova azione</span>
          </button>
        </div>
      </div>
      <div className="commercial-funnel-table-wrap glass-card">
        <table className="analysis-table accounting-table">
          <thead>
            <tr>
              <th className="funnel-col-semaforo">Semaforo</th>
              <th>Cliente</th>
              <th>Contatto</th>
              <th>Ultima azione</th>
              <th>Data</th>
              <th>Scadenza</th>
              <th> </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="mail-campaigns-empty">Caricamento azioni…</td></tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="mail-campaigns-empty">
                  {rows.length === 0
                    ? 'Nessun cliente in Accounting. Usa «Nuova azione» per aggiungere il primo cliente su cui lavorare.'
                    : 'Nessun cliente con questi filtri.'}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const isExpanded = expandedClientId === row.client.id;
                return (
                  <Fragment key={row.client.id}>
                    <tr className={`accounting-row is-${row.semaforo}`}>
                      <td className="funnel-col-semaforo">
                        <span
                          className={`funnel-semaforo funnel-semaforo-${row.semaforo}`}
                          title={SEMAFORO_TITLES[row.semaforo]}
                          aria-label={SEMAFORO_TITLES[row.semaforo]}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="funnel-client-toggle"
                          onClick={() => setExpandedClientId(isExpanded ? '' : row.client.id)}
                        >
                          <ChevronRight size={14} className={`row-expand-icon${isExpanded ? ' is-expanded' : ''}`} />
                          <strong>{row.client.name}</strong>
                        </button>
                      </td>
                      <td>{resolveContactLabel(row.client, row.lastAction.contactId)}</td>
                      <td className="accounting-note-cell">
                        {row.lastAction.note || row.lastAction.actionType}
                      </td>
                      <td>{formatActionDateDisplay(row.lastAction.actionDate)}</td>
                      <td>
                        <span className={`accounting-due is-${row.semaforo}`}>
                          {formatDaysToDue(row.daysToDue)}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-table-action"
                          title="Nuova azione su questo cliente"
                          onClick={() => setDrawerClientId(row.client.id)}
                          disabled={!db}
                        >
                          <Plus size={14} />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="accounting-history-row">
                        <td colSpan={7}>
                          <ul className="accounting-history">
                            {row.actions.map((action) => (
                              <li key={action.id}>
                                <span className="client-last-action-type">{action.actionType}</span>
                                <span>{formatActionDateDisplay(action.actionDate)}</span>
                                {action.contactId && <span>con {resolveContactLabel(row.client, action.contactId)}</span>}
                                {action.author && <span className="client-last-action-detail">{action.author}</span>}
                                {action.redAfterDays && (
                                  <span className="client-last-action-detail">semaforo {action.redAfterDays} gg</span>
                                )}
                                <p>{action.note || '—'}</p>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {drawerClientId !== null && (
        <NewActionDrawer
          clients={accountingClients}
          initialClientId={drawerClientId}
          onClose={() => setDrawerClientId(null)}
          onSave={handleSave}
        />
      )}
    </>
  );
}
