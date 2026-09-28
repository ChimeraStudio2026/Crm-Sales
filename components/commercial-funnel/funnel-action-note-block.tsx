'use client';

import { useEffect, useState } from 'react';
import { formatActionDateDisplay } from '@/lib/crm/utils';
import type { FunnelActionSlot } from '@/lib/types/commercial-funnel';
import { useCrm } from '@/providers/crm-provider';

interface FunnelActionNoteBlockProps {
  entryId: string;
  slotIndex: number;
  action: FunnelActionSlot;
  isLocked: boolean;
}

export function FunnelActionNoteBlock({
  entryId,
  slotIndex,
  action,
  isLocked,
}: FunnelActionNoteBlockProps) {
  const { updateFunnelActionNote } = useCrm();
  const [note, setNote] = useState(action.note || '');

  useEffect(() => {
    setNote(action.note || '');
  }, [entryId, slotIndex, action.note]);

  return (
    <div className="funnel-action-note-block">
      <div className="funnel-action-note-header">
        <label htmlFor={`funnel-note-${entryId}-${slotIndex}`}>
          Azione {slotIndex + 1}
          {action.type ? ` · ${action.type}` : ''}
          {action.date ? ` (${formatActionDateDisplay(action.date)})` : ''}
        </label>
      </div>
      <textarea
        id={`funnel-note-${entryId}-${slotIndex}`}
        className="funnel-action-note-input"
        value={note}
        placeholder="Descrivi cosa hai fatto in questa azione..."
        rows={2}
        readOnly={isLocked}
        onChange={(event) => setNote(event.target.value)}
        onBlur={(event) => {
          const nextValue = event.currentTarget.value;
          const nextNote = nextValue.trim();
          setNote(nextValue);
          if (nextNote !== (action.note || '').trim()) {
            void updateFunnelActionNote(entryId, slotIndex, nextNote);
          }
        }}
      />
    </div>
  );
}
