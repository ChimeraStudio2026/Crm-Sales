'use client';

import { useState } from 'react';

interface FunnelPersoModalProps {
  clientName: string;
  initialReason?: string;
  isNewLost?: boolean;
  onClose: () => void;
  onSave: (reason: string) => void;
}

export function FunnelPersoModal({
  clientName,
  initialReason = '',
  isNewLost = false,
  onClose,
  onSave,
}: FunnelPersoModalProps) {
  const [reason, setReason] = useState(initialReason);
  const trimmedReason = reason.trim();
  const canSave = trimmedReason.length > 0;

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!canSave) return;
    onSave(trimmedReason);
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} />
      <div className="drawer open funnel-perso-modal">
        <div className="drawer-header">
          <h3>{isNewLost ? 'Lead persa' : 'Motivo perdita'} — {clientName}</h3>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="drawer-body">
            <p className="funnel-perso-hint">
              {isNewLost
                ? 'Per segnare la lead come Perso devi indicare il motivo della perdita.'
                : 'Aggiorna il motivo per cui la lead è stata persa.'}
            </p>
            <label htmlFor="funnel-perso-reason">
              Lost reason
            </label>
            <textarea
              id="funnel-perso-reason"
              className="form-textarea"
              rows={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Es. Nessuna risposta dopo la quotazione, budget insufficiente..."
              required
              autoFocus
            />
          </div>
          <div className="drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              {isNewLost ? 'Segna come Perso' : 'Salva motivo'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
