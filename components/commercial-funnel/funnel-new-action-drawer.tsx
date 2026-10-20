'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  ActionFields,
  ContactSelect,
  createEmptyActionFields,
  getNamedContacts,
} from '@/components/commercial-funnel/action-fields';
import type { ActionFieldsValue } from '@/components/commercial-funnel/action-fields';
import { isFunnelTerminalLost } from '@/lib/commercial-funnel/index';
import { FUNNEL_ACTION_TYPES } from '@/lib/types/commercial-funnel';
import type { CommercialFunnelEntry, FunnelActionType } from '@/lib/types/commercial-funnel';
import type { Client } from '@/lib/types/crm';
import { useCrm } from '@/providers/crm-provider';

interface FunnelNewActionDrawerProps {
  entry: CommercialFunnelEntry;
  client: Client | undefined;
  onClose: () => void;
}

/** Nuova azione su un cliente della campagna: stessi campi degli obiettivi (contatto, nota, data, semaforo). */
export function FunnelNewActionDrawer({ entry, client, onClose }: FunnelNewActionDrawerProps) {
  const { addFunnelAction, updateFunnelEntryContact } = useCrm();
  const contacts = useMemo(() => getNamedContacts(client), [client]);
  const [contactId, setContactId] = useState(entry.contactId || contacts[0]?.id || '');
  const [fields, setFields] = useState<ActionFieldsValue>(createEmptyActionFields);
  const [lostReason, setLostReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isLost = isFunnelTerminalLost(entry);
  const availableTypes = FUNNEL_ACTION_TYPES.filter((type) => !(isLost && type === 'Perso'));
  const needsReason = fields.actionType === 'Perso';
  const canSave = Boolean(fields.actionType) && (!needsReason || Boolean(lostReason.trim())) && !isSaving;

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    try {
      if (contactId && contactId !== entry.contactId) {
        await updateFunnelEntryContact(entry.id, contactId);
      }
      await addFunnelAction(entry.id, fields.actionType as FunnelActionType, fields.note.trim(), lostReason.trim(), {
        actionDate: fields.actionDate,
        redAfterDays: fields.redAfterDays,
      });
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
          <h3>{isLost ? 'Riattiva' : 'Nuova azione'} · {client?.name || 'Cliente'}</h3>
          <div className="drawer-close" onClick={onClose} role="button" tabIndex={0}>
            <X size={20} />
          </div>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="drawer-body">
            {isLost && (
              <p className="funnel-track-note">
                Il cliente è perso: la nuova azione lo riattiva nella campagna.
              </p>
            )}
            <ContactSelect id="funnel-action-contact" contacts={contacts} value={contactId} onChange={setContactId} />
            <ActionFields
              idPrefix="funnel-action"
              value={fields}
              onChange={setFields}
              isTypeRequired
              actionTypes={availableTypes}
            />
            {needsReason && (
              <div className="form-group">
                <label htmlFor="funnel-action-lost-reason">Motivo della perdita *</label>
                <textarea
                  id="funnel-action-lost-reason"
                  className="form-textarea"
                  rows={2}
                  value={lostReason}
                  onChange={(event) => setLostReason(event.target.value)}
                  required
                />
              </div>
            )}
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
