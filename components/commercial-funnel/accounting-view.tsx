'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, Plus, Search, X } from 'lucide-react';
import { ClientSearchSelect } from '@/components/clients/client-search-select';
import {
  buildAccountingRows,
  formatDaysToDue,
  isAccountingClient,
} from '@/lib/commercial-funnel/accounting';
import type { AccountingRow, AccountingStatus } from '@/lib/commercial-funnel/accounting';
import { isClientInWorkspace } from '@/lib/crm/workspace-access';
import { createUniqueId, formatActionDateDisplay, getTodayString } from '@/lib/crm/utils';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fetchAllClientActions, insertClientAction } from '@/lib/supabase/client-actions-database';
import {
  ACCOUNTING_ACTION_TYPE,
  ACCOUNTING_CLOSE_ACTION_TYPE,
  DEFAULT_RED_AFTER_DAYS,
  RED_AFTER_DAYS_OPTIONS,
} from '@/lib/types/client-actions';
import type { AccountingOutcome, ClientAction } from '@/lib/types/client-actions';
import type { Client } from '@/lib/types/crm';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type AccountingFilter = 'open' | 'red' | 'won' | 'lost';

const OUTCOME_LABELS: Record<AccountingOutcome, string> = { won: 'Won', lost: 'Lost' };

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

interface CloseCycleDrawerProps {
  row: AccountingRow;
  onClose: () => void;
  onSave: (input: { outcome: AccountingOutcome; note: string; actionDate: string }) => Promise<void>;
}

function CloseCycleDrawer({ row, onClose, onSave }: CloseCycleDrawerProps) {
  const [outcome, setOutcome] = useState<AccountingOutcome>('won');
  const [note, setNote] = useState('');
  const [actionDate, setActionDate] = useState(getTodayString());
  const [isSaving, setIsSaving] = useState(false);
  // Come da flussi commerciali: un Lost va sempre motivato, per ripartire da lì al richiamo.
  const isNoteRequired = outcome === 'lost';
  const canSave = !isSaving && (!isNoteRequired || Boolean(note.trim()));

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    try {
      await onSave({ outcome, note: note.trim(), actionDate });
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
          <h3>Chiudi azioni · {row.client.name}</h3>
          <div className="drawer-close" onClick={onClose} role="button" tabIndex={0}>
            <X size={20} />
          </div>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="drawer-body">
            <p className="funnel-track-note">
              Chiudi le {row.actions.length} {row.actions.length === 1 ? 'azione' : 'azioni'} di questo ciclo con il loro esito.
              Il cliente esce dalla lista attiva; con una nuova azione si apre un nuovo ciclo.
            </p>
            <div className="form-group">
              <label>Esito *</label>
              <div className="accounting-outcome-choice" role="radiogroup" aria-label="Esito">
                {(['won', 'lost'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={outcome === value}
                    className={`accounting-outcome-option is-${value}${outcome === value ? ' is-active' : ''}`}
                    onClick={() => setOutcome(value)}
                  >
                    {value === 'won' ? 'Won · ha portato a un progetto' : 'Lost · non è andata'}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="accounting-close-note">{isNoteRequired ? 'Motivo *' : 'Nota'}</label>
              <textarea
                id="accounting-close-note"
                className="form-textarea"
                rows={3}
                placeholder={isNoteRequired
                  ? 'Perché non è andata? Servirà per il richiamo.'
                  : 'Cosa è stato chiuso (progetto, preventivo, importo...)'}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                required={isNoteRequired}
              />
            </div>
            <div className="form-group">
              <label htmlFor="accounting-close-date">Data chiusura</label>
              <input
                id="accounting-close-date"
                type="date"
                className="form-input"
                value={actionDate}
                onChange={(event) => setActionDate(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              {isSaving ? 'Salvataggio…' : `Chiudi come ${OUTCOME_LABELS[outcome]}`}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: AccountingStatus }) {
  if (status === 'open') return null;
  return <span className={`accounting-outcome-badge is-${status}`}>{OUTCOME_LABELS[status]}</span>;
}

export function AccountingView() {
  const { clients, currentOwner, showToast } = useCrm();
  const { workspaceId } = useWorkspace();
  const db = useMemo(() => createBrowserSupabaseClient(), []);
  const [actions, setActions] = useState<ClientAction[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(db));
  const [filter, setFilter] = useState<AccountingFilter>('open');
  const [closingRow, setClosingRow] = useState<AccountingRow | null>(null);
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
  const counts = useMemo(() => ({
    open: rows.filter((row) => row.status === 'open').length,
    red: rows.filter((row) => row.status === 'open' && row.semaforo === 'red').length,
    won: rows.filter((row) => row.status === 'won').length,
    lost: rows.filter((row) => row.status === 'lost').length,
  }), [rows]);
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (filter === 'red') return row.status === 'open' && row.semaforo === 'red';
        return row.status === filter;
      })
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
        outcome: null,
      });
      setActions((prev) => [saved, ...prev]);
      showToast('Azione registrata anche sulla scheda cliente.', 'success');
    } catch (error) {
      showToast(`Errore salvataggio azione: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
      throw error;
    }
  };

  const handleCloseCycle = async (
    row: AccountingRow,
    input: { outcome: AccountingOutcome; note: string; actionDate: string },
  ): Promise<void> => {
    if (!db) return;
    try {
      const saved = await insertClientAction(db, {
        id: createUniqueId('client-action'),
        clientId: row.client.id,
        actionType: ACCOUNTING_CLOSE_ACTION_TYPE,
        actionDate: input.actionDate,
        note: input.note,
        author: currentOwner || '',
        createdAt: '',
        contactId: row.lastAction.contactId,
        redAfterDays: null,
        outcome: input.outcome,
      });
      setActions((prev) => [saved, ...prev]);
      showToast(`${row.client.name} chiuso come ${OUTCOME_LABELS[input.outcome]}.`, 'success');
    } catch (error) {
      showToast(`Errore chiusura: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
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
          <div className="proposals-list-chips" role="group" aria-label="Filtra Accounting">
            {([
              ['open', 'Aperti'],
              ['red', 'In ritardo'],
              ['won', 'Won'],
              ['lost', 'Lost'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`clients-filter-chip${filter === value ? ' is-active' : ''}`}
                onClick={() => setFilter(value)}
              >
                {label}
                <span className="clients-filter-chip-count">{counts[value]}</span>
              </button>
            ))}
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
              <th>{filter === 'won' || filter === 'lost' ? 'Chiuso' : 'Scadenza'}</th>
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
                    : filter === 'open'
                      ? 'Nessun ciclo aperto: tutti i clienti sono chiusi come Won o Lost.'
                      : 'Nessun cliente con questi filtri.'}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const isExpanded = expandedClientId === row.client.id;
                return (
                  <Fragment key={row.client.id}>
                    <tr className={`accounting-row is-${row.status === 'open' ? row.semaforo : row.status}`}>
                      <td className="funnel-col-semaforo">
                        {row.status === 'open' ? (
                          <span
                            className={`funnel-semaforo funnel-semaforo-${row.semaforo}`}
                            title={SEMAFORO_TITLES[row.semaforo]}
                            aria-label={SEMAFORO_TITLES[row.semaforo]}
                          />
                        ) : (
                          <StatusBadge status={row.status} />
                        )}
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
                        {row.closure?.note
                          ? row.closure.note
                          : row.lastAction.note || row.lastAction.actionType}
                      </td>
                      <td>{formatActionDateDisplay(row.lastAction.actionDate)}</td>
                      <td>
                        {row.closure ? (
                          <span className={`accounting-due is-${row.status}`}>
                            {formatActionDateDisplay(row.closure.actionDate)}
                          </span>
                        ) : (
                          <span className={`accounting-due is-${row.semaforo}`}>
                            {formatDaysToDue(row.daysToDue)}
                          </span>
                        )}
                      </td>
                      <td className="accounting-row-actions">
                        {row.status === 'open' && (
                          <button
                            type="button"
                            className="btn-table-action"
                            title="Chiudi con esito Won o Lost"
                            onClick={() => setClosingRow(row)}
                            disabled={!db}
                          >
                            <CheckCircle2 size={14} />
                            <span>Chiudi</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-table-action"
                          title={row.status === 'open' ? 'Nuova azione su questo cliente' : 'Riapri con una nuova azione'}
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
                            {row.closure && (
                              <li className={`accounting-history-closure is-${row.status}`}>
                                <StatusBadge status={row.status} />
                                <span>{formatActionDateDisplay(row.closure.actionDate)}</span>
                                {row.closure.author && <span className="client-last-action-detail">{row.closure.author}</span>}
                                <p>{row.closure.note || 'Ciclo chiuso.'}</p>
                              </li>
                            )}
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
                          {row.previousCycles > 0 && (
                            <p className="accounting-previous-cycles">
                              {row.previousCycles} {row.previousCycles === 1 ? 'ciclo precedente chiuso' : 'cicli precedenti chiusi'} su questo cliente
                              (li trovi nella scheda cliente).
                            </p>
                          )}
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
      {closingRow && (
        <CloseCycleDrawer
          row={closingRow}
          onClose={() => setClosingRow(null)}
          onSave={(input) => handleCloseCycle(closingRow, input)}
        />
      )}
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
