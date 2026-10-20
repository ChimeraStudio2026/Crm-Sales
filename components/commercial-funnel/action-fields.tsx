'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ClientSearchSelect } from '@/components/clients/client-search-select';
import { getTodayString } from '@/lib/crm/utils';
import {
  ACCOUNT_OBJECTIVE_ACTION_TYPES,
  DEFAULT_RED_AFTER_DAYS,
  RED_AFTER_DAYS_OPTIONS,
} from '@/lib/types/client-actions';
import type { Client, ClientContact } from '@/lib/types/crm';

/** Campi di un'azione condivisi da obiettivi (Account e Sales) e campagne Sales. */
export interface ActionFieldsValue {
  actionType: string;
  note: string;
  actionDate: string;
  redAfterDays: number;
}

export function createEmptyActionFields(): ActionFieldsValue {
  return { actionType: '', note: '', actionDate: getTodayString(), redAfterDays: DEFAULT_RED_AFTER_DAYS };
}

/** Tipo preimpostato + nota, data e semaforo: uguali per obiettivi singoli e di gruppo. */
export function ActionFields({
  idPrefix,
  value,
  onChange,
  isTypeRequired,
  actionTypes = ACCOUNT_OBJECTIVE_ACTION_TYPES,
}: {
  idPrefix: string;
  value: ActionFieldsValue;
  onChange: (next: ActionFieldsValue) => void;
  isTypeRequired: boolean;
  /** Tipi proposti: di default quelli degli obiettivi (Account e Sales). */
  actionTypes?: readonly string[];
}) {
  return (
    <>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-type`}>Azione{isTypeRequired ? ' *' : ''}</label>
        <select
          id={`${idPrefix}-type`}
          className="form-select"
          value={value.actionType}
          onChange={(event) => onChange({ ...value, actionType: event.target.value })}
          required={isTypeRequired}
        >
          <option value="">{isTypeRequired ? 'Scegli il tipo di azione…' : 'Nessuna azione per ora'}</option>
          {actionTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
      {value.actionType && (
        <>
          <div className="form-group">
            <label htmlFor={`${idPrefix}-note`}>Nota</label>
            <textarea
              id={`${idPrefix}-note`}
              className="form-textarea"
              rows={3}
              placeholder="Cosa è stato fatto e qual è il prossimo passo"
              value={value.note}
              onChange={(event) => onChange({ ...value, note: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor={`${idPrefix}-date`}>Data azione</label>
            <input
              id={`${idPrefix}-date`}
              type="date"
              className="form-input"
              value={value.actionDate}
              onChange={(event) => onChange({ ...value, actionDate: event.target.value })}
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
                  aria-checked={value.redAfterDays === days}
                  className={`clients-filter-chip${value.redAfterDays === days ? ' is-active' : ''}`}
                  onClick={() => onChange({ ...value, redAfterDays: days })}
                >
                  {days} giorni
                </button>
              ))}
            </div>
            <small className="accounting-red-after-hint">
              Se entro {value.redAfterDays} giorni non registri una nuova azione, il semaforo diventa rosso.
            </small>
          </div>
        </>
      )}
    </>
  );
}

export function getNamedContacts(client: Client | undefined): ClientContact[] {
  return client?.contacts.filter((contact) => contact.name.trim() || contact.email.trim()) || [];
}

/** Contatto del cliente a cui si collega l'azione. */
export function ContactSelect({
  id,
  contacts,
  value,
  onChange,
}: {
  id: string;
  contacts: ClientContact[];
  value: string;
  onChange: (contactId: string) => void;
}) {
  return (
    <div className="form-group">
      <label htmlFor={id}>Contatto</label>
      <select
        id={id}
        className="form-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={contacts.length === 0}
      >
        {contacts.length === 0 ? (
          <option value="">Nessun contatto su questo cliente</option>
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
  );
}

/** Clienti scelti come chip con ricerca: usato da «Nuovo obiettivo» e «Nuova campagna». */
export function ClientChipsField({
  clients,
  clientIds,
  onChange,
  lockedClientIds,
  lockedTitle = '',
  removeLabel,
  placeholder,
  hint,
}: {
  clients: Client[];
  clientIds: string[];
  onChange: (clientIds: string[]) => void;
  /** Clienti che non si possono togliere (es. hanno già azioni). */
  lockedClientIds?: ReadonlySet<string>;
  lockedTitle?: string;
  removeLabel: string;
  placeholder: string;
  hint: string;
}) {
  const [pickerValue, setPickerValue] = useState('');
  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const pickableClients = useMemo(
    () => clients.filter((client) => !clientIds.includes(client.id)),
    [clientIds, clients],
  );

  const addClient = (clientId: string): void => {
    if (!clientId) return;
    if (!clientIds.includes(clientId)) onChange([...clientIds, clientId]);
    setPickerValue('');
  };

  return (
    <div className="form-group">
      <label>Clienti *</label>
      {clientIds.length > 0 && (
        <ul className="objective-client-chips">
          {clientIds.map((clientId) => {
            const isLocked = lockedClientIds?.has(clientId) ?? false;
            return (
              <li key={clientId} className="objective-client-chip">
                <span>{clientById.get(clientId)?.name || 'Cliente non trovato'}</span>
                <button
                  type="button"
                  aria-label={removeLabel}
                  title={isLocked ? lockedTitle : removeLabel}
                  disabled={isLocked}
                  onClick={() => onChange(clientIds.filter((item) => item !== clientId))}
                >
                  <X size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ClientSearchSelect
        activeClients={pickableClients}
        coldClients={[]}
        value={pickerValue}
        onChange={addClient}
        placeholder={clientIds.length === 0 ? placeholder : 'Aggiungi un altro cliente...'}
      />
      <small className="accounting-red-after-hint">{hint}</small>
    </div>
  );
}
