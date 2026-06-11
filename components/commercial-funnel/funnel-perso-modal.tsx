'use client';

import { useState } from 'react';

interface FunnelPersoModalProps {
  clientName: string;
  initialReason?: string;
  onClose: () => void;
  onSave: (reason: string) => void;
}

export function FunnelPersoModal({
  clientName,
  initialReason = '',
  onClose,
  onSave,
}: FunnelPersoModalProps) {
  const [reason, setReason] = useState(initialReason);

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    onSave(reason.trim());
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} />
      <div className="drawer open funnel-perso-modal">
        <div className="drawer-header">
          <h3>Cliente perso — {clientName}</h3>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="drawer-body">
            <p className="funnel-perso-hint">
              Spiega perché il cliente è stato perso. Il record resterà nel funnel con stato Perso.
            </p>
            <label htmlFor="funnel-perso-reason">
              Motivo della perdita
            </label>
            <textarea
              id="funnel-perso-reason"
              className="form-textarea"
              rows={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Es. Nessuna risposta dopo la quotazione, budget insufficiente..."
              required
            />
          </div>
          <div className="drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary">Salva motivo</button>
          </div>
        </form>
      </div>
    </>
  );
}
