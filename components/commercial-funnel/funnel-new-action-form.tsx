'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { isFunnelTerminalConvertedEntry, isFunnelTerminalLost } from '@/lib/commercial-funnel/index';
import { FUNNEL_ACTION_TYPES } from '@/lib/types/commercial-funnel';
import type { CommercialFunnelEntry, FunnelActionType } from '@/lib/types/commercial-funnel';
import { useCrm } from '@/providers/crm-provider';

interface FunnelNewActionFormProps {
  entry: CommercialFunnelEntry;
}

/** Aggiunge un'azione (con nota) al cliente senza entrare nella campagna. */
export function FunnelNewActionForm({ entry }: FunnelNewActionFormProps) {
  const { addFunnelAction } = useCrm();
  const [actionType, setActionType] = useState<FunnelActionType | ''>('');
  const [note, setNote] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (isFunnelTerminalConvertedEntry(entry)) return null;
  const isLost = isFunnelTerminalLost(entry);
  const availableTypes = FUNNEL_ACTION_TYPES.filter((type) => !(isLost && type === 'Perso'));
  const needsReason = actionType === 'Perso';
  const canSave = Boolean(actionType) && (!needsReason || lostReason.trim()) && !isSaving;

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!actionType || !canSave) return;
    setIsSaving(true);
    try {
      await addFunnelAction(entry.id, actionType, note, lostReason);
      setActionType('');
      setNote('');
      setLostReason('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="funnel-new-action-form" onSubmit={(event) => void handleSubmit(event)}>
      <strong className="funnel-new-action-title">{isLost ? 'Riattiva con una nuova azione' : 'Nuova azione'}</strong>
      <div className="funnel-new-action-fields">
        <select
          className="form-input"
          value={actionType}
          onChange={(event) => setActionType(event.target.value as FunnelActionType | '')}
          aria-label="Tipo di azione"
        >
          <option value="">Tipo di azione…</option>
          {availableTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <input
          className="form-input"
          placeholder="Nota (facoltativa)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {needsReason && (
          <input
            className="form-input"
            placeholder="Motivo della perdita"
            value={lostReason}
            onChange={(event) => setLostReason(event.target.value)}
            required
          />
        )}
        <button type="submit" className="btn btn-primary btn-sm" disabled={!canSave}>
          <Plus size={14} />
          <span>Aggiungi azione</span>
        </button>
      </div>
    </form>
  );
}
