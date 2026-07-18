'use client';

import { useState } from 'react';
import { CREATIVE_PROPOSAL_STAGE_LABELS } from '@/lib/propositivita/index';
import type { CreativeProposalStage } from '@/lib/types/propositivita';
import { getTodayString } from '@/lib/crm/utils';

interface CreativeStageModalProps {
  clientName: string;
  proposalTitle: string;
  currentStage: CreativeProposalStage;
  nextStage: CreativeProposalStage;
  direction: 'forward' | 'backward';
  onClose: () => void;
  onConfirm: (actionDate: string, note: string) => void;
}

export function CreativeStageModal({
  clientName,
  proposalTitle,
  currentStage,
  nextStage,
  direction,
  onClose,
  onConfirm,
}: CreativeStageModalProps) {
  const [actionDate, setActionDate] = useState(getTodayString());
  const [note, setNote] = useState('');
  const directionLabel = direction === 'forward' ? 'Avanza stadio' : 'Torna indietro';

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!actionDate) return;
    onConfirm(actionDate, note.trim());
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} />
      <div className="drawer open creative-stage-modal">
        <div className="drawer-header">
          <h3>{directionLabel} — {clientName}</h3>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="drawer-body">
            <p className="creative-stage-modal-subtitle">{proposalTitle}</p>
            <p className="creative-stage-modal-hint">
              Da <strong>{CREATIVE_PROPOSAL_STAGE_LABELS[currentStage]}</strong>
              {' '}a <strong>{CREATIVE_PROPOSAL_STAGE_LABELS[nextStage]}</strong>
            </p>
            <label className="form-label" htmlFor="creative-stage-date">
              Data *
              <input
                id="creative-stage-date"
                type="date"
                className="form-input"
                value={actionDate}
                onChange={(event) => setActionDate(event.target.value)}
                required
                autoFocus
              />
            </label>
            <label className="form-label" htmlFor="creative-stage-note">
              Nota
              <textarea
                id="creative-stage-note"
                className="form-textarea"
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Aggiungi un commento sul passaggio di stadio..."
              />
            </label>
          </div>
          <div className="drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary">Conferma</button>
          </div>
        </form>
      </div>
    </>
  );
}
