'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, ChevronRight, Pencil, Plus, Search, Target, Trash2, X } from 'lucide-react';
import {
  ActionFields,
  ClientChipsField,
  ContactSelect,
  createEmptyActionFields,
  getNamedContacts,
} from '@/components/commercial-funnel/action-fields';
import type { ActionFieldsValue } from '@/components/commercial-funnel/action-fields';
import {
  buildAccountingObjectiveRows,
  formatDaysToDue,
  isObjectiveClient,
} from '@/lib/commercial-funnel/accounting';
import type {
  AccountingClientRow,
  AccountingObjectiveRow,
  AccountingStatus,
} from '@/lib/commercial-funnel/accounting';
import { normalizeOwner } from '@/lib/crm/owners';
import { isClientInWorkspace } from '@/lib/crm/workspace-access';
import { getOwnersForWorkspace } from '@/lib/crm/workspace-clients';
import { createUniqueId, formatActionDateDisplay, getTodayString } from '@/lib/crm/utils';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import {
  deleteAccountObjective,
  fetchAccountObjectives,
  insertAccountObjective,
  updateAccountObjective,
} from '@/lib/supabase/account-objectives-database';
import { fetchAllClientActions, insertClientAction } from '@/lib/supabase/client-actions-database';
import {
  ACCOUNTING_ACTION_TYPE,
  ACCOUNTING_CLOSE_ACTION_TYPE,
} from '@/lib/types/client-actions';
import type { AccountObjective, AccountingOutcome, ClientAction } from '@/lib/types/client-actions';
import type { FunnelTrack } from '@/lib/types/commercial-funnel';
import type { Client } from '@/lib/types/crm';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type AccountingFilter = 'open' | 'red' | 'won' | 'lost';

const ACCOUNTING_OWNER_FILTER_STORAGE_KEY = 'crm-accounting-owner-filter';

function ownerFilterStorageKey(track: FunnelTrack): string {
  return track === 'warm' ? ACCOUNTING_OWNER_FILTER_STORAGE_KEY : 'crm-sales-objectives-owner-filter';
}

function readOwnerFilter(track: FunnelTrack): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(ownerFilterStorageKey(track)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((owner): owner is string => typeof owner === 'string') : [];
  } catch {
    return [];
  }
}

function writeOwnerFilter(track: FunnelTrack, owners: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ownerFilterStorageKey(track), JSON.stringify(owners));
  } catch {
    // Filtro non salvabile: resta valido solo per questa visita.
  }
}

interface TrackCopy {
  name: string;
  outcome: Record<AccountingOutcome, string>;
  outcomeOption: Record<AccountingOutcome, string>;
  clientPlaceholder: string;
}

/** Account e Sales usano lo stesso schema di obiettivi: cambiano solo i nomi degli esiti. */
const TRACK_COPY: Record<FunnelTrack, TrackCopy> = {
  warm: {
    name: 'Account',
    outcome: { won: 'Won', lost: 'Lost' },
    outcomeOption: { won: 'Won · obiettivo raggiunto', lost: 'Lost · non è andata' },
    clientPlaceholder: 'Cerca un cliente caldo...',
  },
  cold: {
    name: 'Sales',
    outcome: { won: 'Convertito', lost: 'Perso' },
    outcomeOption: { won: 'Convertito · è diventato cliente', lost: 'Perso · non è andata' },
    clientPlaceholder: 'Cerca un cliente senza fatturato...',
  },
};

function resolveContactLabel(client: Client, contactId: string): string {
  const contact = client.contacts.find((item) => item.id === contactId);
  if (!contact) return '—';
  return contact.name.trim() || contact.email.trim() || '—';
}

/** Le azioni registrate prima degli obiettivi erano solo testo: si mostrano come «Azione». */
function formatActionType(action: ClientAction): string {
  return action.actionType === ACCOUNTING_ACTION_TYPE ? 'Azione' : action.actionType;
}

function matchesFilter(row: AccountingClientRow, filter: AccountingFilter): boolean {
  if (filter === 'red') return row.status === 'open' && row.semaforo === 'red';
  return row.status === filter;
}

const SEMAFORO_TITLES: Record<AccountingClientRow['semaforo'], string> = {
  green: 'Nei tempi',
  red: 'In ritardo: serve una nuova azione',
};

interface ObjectiveDrawerInput {
  title: string;
  note: string;
  owner: string;
  clientIds: string[];
  firstAction: ActionFieldsValue;
  firstContactId: string;
}

interface ObjectiveDrawerProps {
  copy: TrackCopy;
  clients: Client[];
  owners: readonly string[];
  /** In modifica: obiettivo esistente e clienti che hanno già azioni (non si possono togliere). */
  objective?: AccountObjective;
  lockedClientIds?: ReadonlySet<string>;
  defaultOwner: string;
  onClose: () => void;
  onSave: (input: ObjectiveDrawerInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function ObjectiveDrawer({
  copy,
  clients,
  owners,
  objective,
  lockedClientIds,
  defaultOwner,
  onClose,
  onSave,
  onDelete,
}: ObjectiveDrawerProps) {
  const isEdit = Boolean(objective);
  const [title, setTitle] = useState(objective?.title || '');
  const [note, setNote] = useState(objective?.note || '');
  const [owner, setOwner] = useState(objective?.owner || defaultOwner);
  const [clientIds, setClientIds] = useState<string[]>(objective?.clientIds || []);
  const [firstAction, setFirstAction] = useState<ActionFieldsValue>(createEmptyActionFields);
  const [firstContactId, setFirstContactId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const onlyClientId = clientIds.length === 1 ? clientIds[0] : '';
  const firstContacts = getNamedContacts(clientById.get(onlyClientId));

  useEffect(() => {
    setFirstContactId(firstContacts[0]?.id || '');
    // Solo al cambio cliente: il contatto di default è il primo del cliente scelto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyClientId]);
  const canSave = !isSaving && Boolean(title.trim()) && clientIds.length > 0;

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    try {
      await onSave({ title: title.trim(), note: note.trim(), owner, clientIds, firstAction, firstContactId });
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
          <h3>{isEdit ? 'Modifica obiettivo' : `Nuovo obiettivo · ${copy.name}`}</h3>
          <div className="drawer-close" onClick={onClose} role="button" tabIndex={0}>
            <X size={20} />
          </div>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="drawer-body">
            <div className="form-group">
              <label htmlFor="objective-title">Obiettivo *</label>
              <input
                id="objective-title"
                className="form-input"
                placeholder="Es. Vendere il pacchetto NOVA, presentare il team…"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>
            <ClientChipsField
              clients={clients}
              clientIds={clientIds}
              onChange={setClientIds}
              lockedClientIds={lockedClientIds}
              lockedTitle="Ha già azioni in questo obiettivo"
              removeLabel="Togli dall'obiettivo"
              placeholder={copy.clientPlaceholder}
              hint="Con più clienti l'obiettivo funziona come una campagna: per ogni cliente registri azioni preimpostate con una nota."
            />
            <div className="form-group">
              <label htmlFor="objective-owner">Owner</label>
              <select
                id="objective-owner"
                className="form-select"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
              >
                <option value="">—</option>
                {owners.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="objective-note">Nota (opzionale)</label>
              <textarea
                id="objective-note"
                className="form-textarea"
                rows={2}
                placeholder="Contesto, prossimi passi, budget…"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            {!isEdit && clientIds.length === 1 && (
              <div className="objective-first-action">
                <strong>Prima azione</strong>
                <ContactSelect
                  id="objective-first-contact"
                  contacts={firstContacts}
                  value={firstContactId}
                  onChange={setFirstContactId}
                />
                <ActionFields idPrefix="objective-first" value={firstAction} onChange={setFirstAction} isTypeRequired={false} />
              </div>
            )}
          </div>
          <div className="drawer-footer">
            {onDelete && (
              <button
                type="button"
                className="btn btn-secondary objective-delete-btn"
                onClick={() => void onDelete().then(onClose)}
                title="Elimina l'obiettivo (non ha azioni)"
              >
                <Trash2 size={14} />
                <span>Elimina</span>
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              {isSaving ? 'Salvataggio…' : isEdit ? 'Salva obiettivo' : 'Crea obiettivo'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

interface NewActionInput extends ActionFieldsValue {
  clientId: string;
  contactId: string;
}

interface NewActionDrawerProps {
  objective: AccountObjective;
  clients: Client[];
  initialClientId: string;
  onClose: () => void;
  onSave: (input: NewActionInput) => Promise<void>;
}

/** Nuova azione dentro un obiettivo: l'obiettivo è fisso, si sceglie solo il cliente (se più d'uno). */
function NewActionDrawer({ objective, clients, initialClientId, onClose, onSave }: NewActionDrawerProps) {
  const objectiveClients = useMemo(
    () => objective.clientIds
      .map((clientId) => clients.find((client) => client.id === clientId))
      .filter((client): client is Client => Boolean(client)),
    [clients, objective.clientIds],
  );
  const [clientId, setClientId] = useState(initialClientId || objectiveClients[0]?.id || '');
  const [contactId, setContactId] = useState('');
  const [fields, setFields] = useState<ActionFieldsValue>(createEmptyActionFields);
  const [isSaving, setIsSaving] = useState(false);
  const selectedClient = objectiveClients.find((client) => client.id === clientId);
  const contacts = getNamedContacts(selectedClient);

  useEffect(() => {
    setContactId(contacts[0]?.id || '');
    // Solo al cambio cliente: il contatto di default è il primo del cliente scelto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const canSave = !isSaving && Boolean(clientId) && Boolean(fields.actionType);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    try {
      await onSave({ ...fields, note: fields.note.trim(), clientId, contactId });
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
          <h3>Nuova azione · {selectedClient?.name || 'Cliente'}</h3>
          <div className="drawer-close" onClick={onClose} role="button" tabIndex={0}>
            <X size={20} />
          </div>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="drawer-body">
            <div className="objective-locked" aria-label="Obiettivo">
              <Target size={15} />
              <div>
                <span>Obiettivo</span>
                <strong>{objective.title}</strong>
              </div>
            </div>
            {objectiveClients.length > 1 && (
              <div className="form-group">
                <label htmlFor="accounting-client">Cliente *</label>
                <select
                  id="accounting-client"
                  className="form-select"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  required
                >
                  {objectiveClients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>
            )}
            <ContactSelect id="accounting-contact" contacts={contacts} value={contactId} onChange={setContactId} />
            <ActionFields idPrefix="accounting-action" value={fields} onChange={setFields} isTypeRequired />
          </div>
          <div className="drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              {isSaving ? 'Salvataggio…' : 'Salva azione'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

interface CloseCycleDrawerProps {
  copy: TrackCopy;
  row: AccountingClientRow;
  onClose: () => void;
  onSave: (input: { outcome: AccountingOutcome; note: string; actionDate: string }) => Promise<void>;
}

function CloseCycleDrawer({ copy, row, onClose, onSave }: CloseCycleDrawerProps) {
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
          <h3>Chiudi · {row.client.name}</h3>
          <div className="drawer-close" onClick={onClose} role="button" tabIndex={0}>
            <X size={20} />
          </div>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="drawer-body">
            <p className="funnel-track-note">
              Chiudi l&apos;obiettivo «{row.objective.title}» su {row.client.name} con il suo esito.
              Con una nuova azione si riapre.
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
                    {copy.outcomeOption[value]}
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
              {isSaving ? 'Salvataggio…' : `Chiudi come ${copy.outcome[outcome]}`}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function StatusBadge({ status, copy }: { status: AccountingStatus; copy: TrackCopy }) {
  if (status === 'open') return null;
  return <span className={`accounting-outcome-badge is-${status}`}>{copy.outcome[status]}</span>;
}

function ClientHistory({ row, copy }: { row: AccountingClientRow; copy: TrackCopy }) {
  if (!row.closure && row.actions.length === 0) {
    return <p className="accounting-previous-cycles">Nessuna azione ancora su questo obiettivo: usa + per registrare la prima.</p>;
  }
  return (
    <>
      <ul className="accounting-history">
        {row.closure && (
          <li className={`accounting-history-closure is-${row.status}`}>
            <StatusBadge status={row.status} copy={copy} />
            <span>{formatActionDateDisplay(row.closure.actionDate)}</span>
            {row.closure.author && <span className="client-last-action-detail">{row.closure.author}</span>}
            <p>{row.closure.note || 'Chiuso.'}</p>
          </li>
        )}
        {row.actions.map((action) => (
          <li key={action.id}>
            <span className="client-last-action-type">{formatActionType(action)}</span>
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
          {row.previousCycles} {row.previousCycles === 1 ? 'chiusura precedente' : 'chiusure precedenti'} su questo obiettivo
          (le trovi nella scheda cliente).
        </p>
      )}
    </>
  );
}

const COLUMN_COUNT = 7;

/** Obiettivi di un funnel: Account (clienti caldi) o Sales (new business), stesso schema. */
export function AccountingView({ track = 'warm', toolbarExtra }: { track?: FunnelTrack; toolbarExtra?: ReactNode }) {
  const copy = TRACK_COPY[track];
  const { clients, currentOwner, showToast } = useCrm();
  const { workspaceId } = useWorkspace();
  const db = useMemo(() => createBrowserSupabaseClient(), []);
  const [actions, setActions] = useState<ClientAction[]>([]);
  const [objectives, setObjectives] = useState<AccountObjective[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(db));
  const [filter, setFilter] = useState<AccountingFilter>('open');
  const [closingRow, setClosingRow] = useState<AccountingClientRow | null>(null);
  const [search, setSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [actionTarget, setActionTarget] = useState<{ objective: AccountObjective; clientId: string } | null>(null);
  const [objectiveDrawer, setObjectiveDrawer] = useState<{ objective?: AccountObjective } | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);
  const owners = useMemo(() => getOwnersForWorkspace(workspaceId), [workspaceId]);
  const activeOwnerFilter = useMemo(
    () => new Set(ownerFilter.filter((item) => (owners as readonly string[]).includes(item))),
    [ownerFilter, owners],
  );

  useEffect(() => {
    setOwnerFilter(readOwnerFilter(track));
  }, [track]);

  const changeOwnerFilter = (next: string[]): void => {
    setOwnerFilter(next);
    writeOwnerFilter(track, next);
  };

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    setIsLoading(true);
    Promise.all([fetchAllClientActions(db), fetchAccountObjectives(db, workspaceId)])
      .then(([loadedActions, loadedObjectives]) => {
        if (cancelled) return;
        setActions(loadedActions);
        setObjectives(loadedObjectives.filter((objective) => objective.track === track));
      })
      .catch((error) => {
        showToast(`Errore lettura obiettivi: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [db, showToast, track, workspaceId]);

  const workspaceClients = useMemo(
    () => clients.filter((client) => isClientInWorkspace(client, workspaceId)),
    [clients, workspaceId],
  );
  const objectiveClients = useMemo(
    () => workspaceClients
      .filter((client) => isObjectiveClient(client, track, clients))
      .sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [clients, track, workspaceClients],
  );
  const objectiveRows = useMemo(
    () => buildAccountingObjectiveRows(objectives, workspaceClients, actions, getTodayString())
      .filter((row) => activeOwnerFilter.size === 0 || activeOwnerFilter.has(normalizeOwner(row.objective.owner) || '')),
    [actions, activeOwnerFilter, objectives, workspaceClients],
  );
  const allClientRows = useMemo(() => objectiveRows.flatMap((row) => row.clients), [objectiveRows]);
  const counts = useMemo(() => ({
    open: allClientRows.filter((row) => matchesFilter(row, 'open')).length,
    red: allClientRows.filter((row) => matchesFilter(row, 'red')).length,
    won: allClientRows.filter((row) => matchesFilter(row, 'won')).length,
    lost: allClientRows.filter((row) => matchesFilter(row, 'lost')).length,
  }), [allClientRows]);
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return objectiveRows
      .map((row) => {
        const titleMatches = !query || row.objective.title.toLowerCase().includes(query);
        const clientRows = row.clients
          .filter((clientRow) => matchesFilter(clientRow, filter))
          .filter((clientRow) => titleMatches || clientRow.client.name.toLowerCase().includes(query));
        return { ...row, clients: clientRows };
      })
      // Un obiettivo appena creato senza clienti visibili resta tra gli aperti.
      .filter((row) => row.clients.length > 0
        || (filter === 'open' && row.objective.clientIds.length === 0 && (!query || row.objective.title.toLowerCase().includes(query))));
  }, [filter, objectiveRows, search]);

  const toggleExpanded = (key: string): void => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const saveAction = async (objective: AccountObjective, input: NewActionInput): Promise<void> => {
    if (!db) return;
    const saved = await insertClientAction(db, {
      id: createUniqueId('client-action'),
      clientId: input.clientId,
      actionType: input.actionType,
      actionDate: input.actionDate,
      note: input.note,
      objective: objective.title,
      objectiveId: objective.id,
      author: currentOwner || objective.owner || '',
      createdAt: '',
      contactId: input.contactId,
      redAfterDays: input.redAfterDays,
      outcome: null,
    });
    setActions((prev) => [saved, ...prev]);
  };

  const handleSaveAction = async (objective: AccountObjective, input: NewActionInput): Promise<void> => {
    try {
      await saveAction(objective, input);
      showToast('Azione registrata anche sulla scheda cliente.', 'success');
    } catch (error) {
      showToast(`Errore salvataggio azione: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
      throw error;
    }
  };

  const handleSaveObjective = async (input: ObjectiveDrawerInput, existing?: AccountObjective): Promise<void> => {
    if (!db) return;
    try {
      if (existing) {
        await updateAccountObjective(db, existing.id, {
          title: input.title,
          note: input.note,
          owner: input.owner,
          clientIds: input.clientIds,
        });
        setObjectives((prev) => prev.map((item) => (item.id === existing.id
          ? { ...item, title: input.title, note: input.note, owner: input.owner, clientIds: input.clientIds }
          : item)));
        if (input.title !== existing.title) {
          setActions((prev) => prev.map((action) => (action.objectiveId === existing.id
            ? { ...action, objective: input.title }
            : action)));
        }
        showToast('Obiettivo aggiornato.', 'success');
        return;
      }
      const created = await insertAccountObjective(db, {
        id: createUniqueId('objective'),
        workspaceId,
        track,
        title: input.title,
        note: input.note,
        owner: input.owner,
        clientIds: input.clientIds,
        createdAt: '',
      });
      setObjectives((prev) => [created, ...prev]);
      const [onlyClientId] = input.clientIds;
      if (input.clientIds.length === 1 && onlyClientId && input.firstAction.actionType) {
        await saveAction(created, {
          ...input.firstAction,
          note: input.firstAction.note.trim(),
          clientId: onlyClientId,
          contactId: input.firstContactId,
        });
      }
      showToast('Obiettivo creato.', 'success');
    } catch (error) {
      showToast(`Errore salvataggio obiettivo: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
      throw error;
    }
  };

  const handleDeleteObjective = async (objective: AccountObjective): Promise<void> => {
    if (!db) return;
    try {
      await deleteAccountObjective(db, objective.id);
      setObjectives((prev) => prev.filter((item) => item.id !== objective.id));
      showToast('Obiettivo eliminato.', 'success');
    } catch (error) {
      showToast(`Errore eliminazione: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
      throw error;
    }
  };

  const handleOwnerChange = async (objective: AccountObjective, owner: string): Promise<void> => {
    if (!db) return;
    try {
      await updateAccountObjective(db, objective.id, { owner });
      setObjectives((prev) => prev.map((item) => (item.id === objective.id ? { ...item, owner } : item)));
      showToast(owner ? `«${objective.title}» ora è seguito da ${owner}.` : `Owner rimosso da «${objective.title}».`, 'success');
    } catch (error) {
      showToast(`Errore cambio owner: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
    }
  };

  const handleCloseCycle = async (
    row: AccountingClientRow,
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
        objective: row.objective.title,
        objectiveId: row.objective.id,
        author: currentOwner || '',
        createdAt: '',
        contactId: row.lastAction?.contactId || '',
        redAfterDays: null,
        outcome: input.outcome,
      });
      setActions((prev) => [saved, ...prev]);
      showToast(`${row.client.name} chiuso come ${copy.outcome[input.outcome]}.`, 'success');
    } catch (error) {
      showToast(`Errore chiusura: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
      throw error;
    }
  };

  const editingObjective = objectiveDrawer?.objective;
  const editingLockedClientIds = useMemo(() => {
    if (!editingObjective) return new Set<string>();
    return new Set(actions
      .filter((action) => action.objectiveId === editingObjective.id)
      .map((action) => action.clientId));
  }, [actions, editingObjective]);

  const renderOwnerSelect = (objective: AccountObjective) => (
    <select
      className="table-cell-select"
      value={normalizeOwner(objective.owner) || ''}
      onChange={(event) => void handleOwnerChange(objective, event.target.value)}
      disabled={!db}
      aria-label={`Owner di ${objective.title}`}
    >
      <option value="">—</option>
      {owners.map((item) => (
        <option key={item} value={item}>{item}</option>
      ))}
    </select>
  );

  const renderClientRow = (row: AccountingClientRow, options: { isGroupChild: boolean }) => {
    const key = `${row.objective.id}|${row.client.id}`;
    const isExpanded = expandedKeys.has(key);
    const lastNote = row.closure?.note || row.lastAction?.note || '';
    const contactLabel = row.lastAction ? resolveContactLabel(row.client, row.lastAction.contactId) : '—';
    return (
      <Fragment key={key}>
        <tr
          className={`mobile-card-row accounting-row is-${row.status === 'open' ? row.semaforo : row.status}${options.isGroupChild ? ' is-group-child' : ''}`}
        >
          <td className="funnel-col-semaforo is-card-lead">
            {row.status === 'open' ? (
              <span
                className={`funnel-semaforo funnel-semaforo-${row.semaforo}`}
                title={SEMAFORO_TITLES[row.semaforo]}
                aria-label={SEMAFORO_TITLES[row.semaforo]}
              />
            ) : (
              <StatusBadge status={row.status} copy={copy} />
            )}
          </td>
          <td className="is-card-title">
            <button
              type="button"
              className="funnel-client-toggle"
              onClick={() => toggleExpanded(key)}
            >
              <ChevronRight size={14} className={`row-expand-icon${isExpanded ? ' is-expanded' : ''}`} />
              <span className="funnel-client-toggle-text">
                <strong>{row.client.name}</strong>
                {contactLabel !== '—' && <small className="funnel-entry-contact">{contactLabel}</small>}
                {!options.isGroupChild && (
                  <small className="accounting-objective-title">
                    <Target size={11} />
                    {row.objective.title}
                  </small>
                )}
              </span>
            </button>
          </td>
          <td data-label="Owner">
            {options.isGroupChild
              ? <span className="accounting-owner-inherited">{row.objective.owner || '—'}</span>
              : renderOwnerSelect(row.objective)}
          </td>
          <td className="accounting-note-cell is-card-full" data-label="Ultima azione">
            {row.closure ? (
              lastNote || 'Chiuso.'
            ) : row.lastAction ? (
              <>
                <span className="client-last-action-type">{formatActionType(row.lastAction)}</span>
                {lastNote && <span className="accounting-last-note" title={lastNote}>{lastNote}</span>}
              </>
            ) : (
              <span className="accounting-empty-note">Nessuna azione ancora</span>
            )}
          </td>
          <td data-label="Data">{row.lastAction ? formatActionDateDisplay(row.lastAction.actionDate) : '—'}</td>
          <td data-label={row.closure ? 'Chiuso' : 'Scadenza'}>
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
          <td className="accounting-row-actions is-card-actions">
            {row.status === 'open' && row.lastAction && (
              <button
                type="button"
                className="btn-table-action"
                title={`Chiudi con esito ${copy.outcome.won} o ${copy.outcome.lost}`}
                onClick={() => setClosingRow(row)}
                disabled={!db}
              >
                <CheckCircle2 size={14} />
                <span>Chiudi</span>
              </button>
            )}
            {!options.isGroupChild && (
              <button
                type="button"
                className="btn-table-action"
                title="Modifica obiettivo"
                onClick={() => setObjectiveDrawer({ objective: row.objective })}
                disabled={!db}
              >
                <Pencil size={14} />
              </button>
            )}
            <button
              type="button"
              className="btn-table-action"
              title={row.status === 'open' ? 'Nuova azione su questo obiettivo' : 'Riapri con una nuova azione'}
              onClick={() => setActionTarget({ objective: row.objective, clientId: row.client.id })}
              disabled={!db}
            >
              <Plus size={14} />
            </button>
          </td>
        </tr>
        {isExpanded && (
          <tr className="accounting-history-row mobile-card-detail">
            <td colSpan={COLUMN_COUNT}>
              {!options.isGroupChild && row.objective.note && (
                <p className="accounting-objective-note"><strong>Nota obiettivo:</strong> {row.objective.note}</p>
              )}
              <ClientHistory row={row} copy={copy} />
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const renderObjectiveRow = (row: AccountingObjectiveRow) => {
    if (!row.isGroup && row.clients[0]) return renderClientRow(row.clients[0], { isGroupChild: false });
    // Gli obiettivi di gruppo sono aperti di default: si ricorda solo chi è stato chiuso.
    const collapseKey = `collapsed:${row.objective.id}`;
    const isExpanded = !expandedKeys.has(collapseKey);
    const redCount = row.clients.filter((clientRow) => clientRow.status === 'open' && clientRow.semaforo === 'red').length;
    return (
      <Fragment key={row.objective.id}>
        <tr className="mobile-card-row accounting-objective-row">
          <td className="funnel-col-semaforo is-card-lead">
            <span className={`funnel-semaforo funnel-semaforo-${redCount > 0 ? 'red' : 'green'}`} />
          </td>
          <td className="is-card-title">
            <button
              type="button"
              className="funnel-client-toggle"
              onClick={() => toggleExpanded(collapseKey)}
            >
              <ChevronRight size={14} className={`row-expand-icon${isExpanded ? ' is-expanded' : ''}`} />
              <span className="funnel-client-toggle-text">
                <strong className="accounting-objective-heading">
                  <Target size={14} />
                  {row.objective.title}
                </strong>
                <small className="funnel-entry-contact">
                  {row.objective.clientIds.length} clienti
                  {redCount > 0 ? ` · ${redCount} in ritardo` : ''}
                </small>
              </span>
            </button>
          </td>
          <td data-label="Owner">{renderOwnerSelect(row.objective)}</td>
          <td className="accounting-note-cell is-card-full" data-label="Nota">
            {row.objective.note || <span className="accounting-empty-note">—</span>}
          </td>
          <td colSpan={2} className="is-card-hidden" />
          <td className="accounting-row-actions is-card-actions">
            <button
              type="button"
              className="btn-table-action"
              title="Modifica obiettivo e clienti"
              onClick={() => setObjectiveDrawer({ objective: row.objective })}
              disabled={!db}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="btn-table-action"
              title="Nuova azione su un cliente dell'obiettivo"
              onClick={() => setActionTarget({ objective: row.objective, clientId: '' })}
              disabled={!db || row.objective.clientIds.length === 0}
            >
              <Plus size={14} />
            </button>
          </td>
        </tr>
        {isExpanded && row.clients.map((clientRow) => renderClientRow(clientRow, { isGroupChild: true }))}
      </Fragment>
    );
  };

  return (
    <>
      <div className="table-filter-bar accounting-toolbar">
        <div className="filter-left">
          <div className="search-box">
            <Search size={18} />
            <input
              className="search-input"
              placeholder="Cerca cliente o obiettivo..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="proposals-list-chips" role="group" aria-label={`Filtra ${copy.name}`}>
            {([
              ['open', 'Aperti'],
              ['red', 'In ritardo'],
              ['won', copy.outcome.won],
              ['lost', copy.outcome.lost],
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
          {toolbarExtra}
          <div className="proposals-list-chips" role="group" aria-label="Filtra per owner">
            <button
              type="button"
              className={`clients-filter-chip${activeOwnerFilter.size === 0 ? ' is-active' : ''}`}
              aria-pressed={activeOwnerFilter.size === 0}
              onClick={() => changeOwnerFilter([])}
            >
              Tutti
            </button>
            {owners.map((item) => (
              <button
                key={item}
                type="button"
                className={`clients-filter-chip${activeOwnerFilter.has(item) ? ' is-active' : ''}`}
                aria-pressed={activeOwnerFilter.has(item)}
                title={`Solo gli obiettivi seguiti da ${item}`}
                onClick={() => changeOwnerFilter(activeOwnerFilter.has(item)
                  ? ownerFilter.filter((value) => value !== item)
                  : [...ownerFilter, item])}
              >
                Solo {item.split(' ')[0]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setObjectiveDrawer({})}
            disabled={!db}
          >
            <Plus size={16} />
            <span>Nuovo obiettivo</span>
          </button>
        </div>
      </div>
      <div className="commercial-funnel-table-wrap glass-card">
        <table className="analysis-table accounting-table mobile-card-table">
          <thead>
            <tr>
              <th className="funnel-col-semaforo">Semaforo</th>
              <th>Cliente · Obiettivo</th>
              <th>Owner</th>
              <th>Ultima azione</th>
              <th>Data</th>
              <th>{filter === 'won' || filter === 'lost' ? 'Chiuso' : 'Scadenza'}</th>
              <th> </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={COLUMN_COUNT} className="mail-campaigns-empty">Caricamento obiettivi…</td></tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="mail-campaigns-empty">
                  {objectiveRows.length === 0
                    ? `Nessun obiettivo in ${copy.name}. Usa «Nuovo obiettivo» per scegliere cosa vuoi ottenere e su quali clienti.`
                    : filter === 'open'
                      ? `Nessun obiettivo aperto: tutti i clienti sono chiusi come ${copy.outcome.won} o ${copy.outcome.lost}.`
                      : 'Nessun obiettivo con questi filtri.'}
                </td>
              </tr>
            ) : (
              visibleRows.map(renderObjectiveRow)
            )}
          </tbody>
        </table>
      </div>
      {closingRow && (
        <CloseCycleDrawer
          copy={copy}
          row={closingRow}
          onClose={() => setClosingRow(null)}
          onSave={(input) => handleCloseCycle(closingRow, input)}
        />
      )}
      {actionTarget && (
        <NewActionDrawer
          objective={actionTarget.objective}
          clients={workspaceClients}
          initialClientId={actionTarget.clientId}
          onClose={() => setActionTarget(null)}
          onSave={(input) => handleSaveAction(actionTarget.objective, input)}
        />
      )}
      {objectiveDrawer && (
        <ObjectiveDrawer
          copy={copy}
          clients={editingObjective
            ? [...objectiveClients, ...workspaceClients.filter((client) => editingObjective.clientIds.includes(client.id)
              && !objectiveClients.some((item) => item.id === client.id))]
            : objectiveClients}
          owners={owners}
          objective={editingObjective}
          lockedClientIds={editingLockedClientIds}
          defaultOwner={currentOwner || ''}
          onClose={() => setObjectiveDrawer(null)}
          onSave={(input) => handleSaveObjective(input, editingObjective)}
          onDelete={editingObjective && editingLockedClientIds.size === 0
            ? () => handleDeleteObjective(editingObjective)
            : undefined}
        />
      )}
    </>
  );
}
