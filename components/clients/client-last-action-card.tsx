'use client';

import { useEffect, useMemo, useState } from 'react';
import { History, Plus, Trash2 } from 'lucide-react';
import { buildClientActivity } from '@/lib/crm/client-activity';
import { createUniqueId, formatActionDateDisplay, getTodayString } from '@/lib/crm/utils';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import {
  deleteClientAction,
  fetchClientActions,
  insertClientAction,
} from '@/lib/supabase/client-actions-database';
import { CLIENT_ACTION_TYPES } from '@/lib/types/client-actions';
import type { ClientAction, ClientActionType } from '@/lib/types/client-actions';
import { useCrm } from '@/providers/crm-provider';
import { useOptionalReminders } from '@/providers/reminders-provider';

const HISTORY_PREVIEW_LIMIT = 5;

interface ClientLastActionCardProps {
  clientId: string;
}

export function ClientLastActionCard({ clientId }: ClientLastActionCardProps) {
  const { clients, commercialFunnelEntries, mailCampaigns, currentOwner, showToast } = useCrm();
  const reminders = useOptionalReminders();
  const db = useMemo(() => createBrowserSupabaseClient(), []);
  const [clientActions, setClientActions] = useState<ClientAction[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(db));
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [actionType, setActionType] = useState<ClientActionType>('Call');
  const [actionDate, setActionDate] = useState(getTodayString());
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Un macro cliente mostra anche le azioni delle sue ragioni sociali.
  const groupIds = useMemo(
    () => [clientId, ...clients.filter((client) => client.parentClientId === clientId).map((client) => client.id)],
    [clientId, clients],
  );
  const groupIdsKey = groupIds.join('|');

  useEffect(() => {
    setShowForm(false);
    setShowHistory(false);
    setClientActions([]);
    if (!db) return;
    let cancelled = false;
    setIsLoading(true);
    fetchClientActions(db, groupIdsKey.split('|'))
      .then((loaded) => {
        if (!cancelled) setClientActions(loaded);
      })
      .catch((error) => {
        console.error('Client actions load failed:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, db, groupIdsKey]);

  const activity = useMemo(
    () => buildClientActivity(
      clientActions,
      commercialFunnelEntries.filter((entry) => groupIds.includes(entry.clientId)),
      mailCampaigns,
      clients.find((client) => client.id === clientId)?.contacts || [],
    ),
    [clientActions, clientId, clients, commercialFunnelEntries, groupIds, mailCampaigns],
  );
  const lastAction = activity[0];
  const history = activity.slice(1, HISTORY_PREVIEW_LIMIT + 1);

  const resetForm = (): void => {
    setActionType('Call');
    setActionDate(getTodayString());
    setNote('');
    setShowForm(false);
  };

  const handleSave = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!db || !actionDate) return;
    setIsSaving(true);
    try {
      const saved = await insertClientAction(db, {
        id: createUniqueId('client-action'),
        clientId,
        actionType,
        actionDate,
        note: note.trim(),
        author: currentOwner || '',
        createdAt: '',
        contactId: '',
        redAfterDays: null,
        outcome: null,
      });
      setClientActions((prev) => [saved, ...prev]);
      reminders?.noteClientAction(saved);
      resetForm();
      showToast('Azione registrata.', 'success');
    } catch (error) {
      showToast(`Errore salvataggio azione: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (actionId: string): Promise<void> => {
    if (!db || !window.confirm('Eliminare questa azione?')) return;
    try {
      await deleteClientAction(db, actionId);
      setClientActions((prev) => prev.filter((action) => action.id !== actionId));
    } catch (error) {
      showToast(`Errore eliminazione azione: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
    }
  };

  const renderDeleteButton = (itemKey: string) => {
    if (!itemKey.startsWith('client-')) return null;
    const actionId = itemKey.slice('client-'.length);
    return (
      <button
        type="button"
        className="btn-contact-delete"
        title="Elimina azione"
        onClick={() => void handleDelete(actionId)}
      >
        <Trash2 size={13} />
      </button>
    );
  };

  return (
    <div className="client-last-action">
      <div className="contacts-panel-header">
        <strong>Ultima azione</strong>
        {db && !showForm && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(true)}>
            <Plus size={14} />
            <span>Registra azione</span>
          </button>
        )}
      </div>

      {showForm && (
        <form className="client-last-action-form" onSubmit={(event) => void handleSave(event)}>
          <select
            className="form-select"
            value={actionType}
            onChange={(event) => setActionType(event.target.value as ClientActionType)}
          >
            {CLIENT_ACTION_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <input
            type="date"
            className="form-input"
            value={actionDate}
            onChange={(event) => setActionDate(event.target.value)}
            required
          />
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Nota: cosa è successo e qual è il prossimo passo"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="client-last-action-form-buttons">
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetForm}>Annulla</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={isSaving}>
              {isSaving ? 'Salvataggio…' : 'Salva azione'}
            </button>
          </div>
        </form>
      )}

      {isLoading && !lastAction ? (
        <p className="contacts-panel-empty">Caricamento…</p>
      ) : !lastAction ? (
        <p className="client-last-action-empty">
          Nessuna azione registrata su questo cliente. Ogni cliente deve avere un&apos;azione e un prossimo passo.
        </p>
      ) : (
        <div className="client-last-action-current">
          <div className="client-last-action-meta">
            <span className="client-last-action-type">{lastAction.actionType}</span>
            <span>{formatActionDateDisplay(lastAction.date)}</span>
            <span className="client-last-action-detail">{lastAction.detail}</span>
            {renderDeleteButton(lastAction.key)}
          </div>
          <p className={`client-last-action-note${lastAction.note ? '' : ' is-empty'}`}>
            {lastAction.note || 'Nessuna nota.'}
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div className="client-last-action-history">
          <button
            type="button"
            className="client-last-action-history-toggle"
            onClick={() => setShowHistory((prev) => !prev)}
          >
            <History size={13} />
            <span>{showHistory ? 'Nascondi azioni precedenti' : `Azioni precedenti (${activity.length - 1})`}</span>
          </button>
          {showHistory && (
            <ul>
              {history.map((item) => (
                <li key={item.key}>
                  <div className="client-last-action-meta">
                    <span className="client-last-action-type">{item.actionType}</span>
                    <span>{formatActionDateDisplay(item.date)}</span>
                    <span className="client-last-action-detail">{item.detail}</span>
                    {renderDeleteButton(item.key)}
                  </div>
                  {item.note && <p className="client-last-action-note">{item.note}</p>}
                  {item.objective && (
                    <p className="client-last-action-note"><strong>Obiettivo:</strong> {item.objective}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
