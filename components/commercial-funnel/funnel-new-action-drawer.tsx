'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { isFunnelTerminalLost } from '@/lib/commercial-funnel/index';
import { FUNNEL_ACTION_TYPES } from '@/lib/types/commercial-funnel';
import type { CommercialFunnelEntry, FunnelActionType } from '@/lib/types/commercial-funnel';
import { useCrm } from '@/providers/crm-provider';

interface FunnelNewActionDrawerProps {
  entry: CommercialFunnelEntry;
  clientName: string;
  onClose: () => void;
}

/** Nuova azione su un cliente della campagna: tipo preimpostato + nota, come in Account. */
export function FunnelNewActionDrawer({ entry, clientName, onClose }: FunnelNewActionDrawerProps) {
  const { addFunnelAction } = useCrm();
  const [actionType, setActionType] = useState<FunnelActionType | ''>('');
  const [note, setNote] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isLost = isFunnelTerminalLost(entry);
  const availableTypes = FUNNEL_ACTION_TYPES.filter((type) => !(isLost && type === 'Perso'));
  const needsReason = actionType === 'Perso';
  const canSave = Boolean(actionType) && (!needsReason || Boolean(lostReason.trim())) && !isSaving;

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!actionType || !canSave) return;
    setIsSaving(true);
    try {
      await addFunnelAction(entry.id, actionType, note.trim(), lostReason.trim());
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
          <h3>{isLost ? 'Riattiva' : 'Nuova azione'} · {clientName}</h3>
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
            <div className="form-group">
              <label htmlFor="funnel-action-type">Azione *</label>
              <select
                id="funnel-action-type"
                className="form-select"
                value={actionType}
                onChange={(event) => setActionType(event.target.value as FunnelActionType | '')}
                required
              >
                <option value="">Scegli il tipo di azione…</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="funnel-action-note">Nota</label>
              <textarea
                id="funnel-action-note"
                className="form-textarea"
                rows={4}
                placeholder="Cosa è stato fatto e qual è il prossimo passo"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
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
