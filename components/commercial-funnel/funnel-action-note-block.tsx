'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { TaskFormDrawer, type TaskFormPreset } from '@/components/tasks/task-form-drawer';
import { formatActionDateDisplay } from '@/lib/crm/utils';
import type { FunnelActionSlot } from '@/lib/types/commercial-funnel';
import type { Idea, Owner } from '@/lib/types/crm';
import { useCrm } from '@/providers/crm-provider';

interface FunnelActionNoteBlockProps {
  entryId: string;
  slotIndex: number;
  action: FunnelActionSlot;
  clientId: string;
  defaultAssignee: Owner;
  isLocked: boolean;
}

export function FunnelActionNoteBlock({
  entryId,
  slotIndex,
  action,
  clientId,
  defaultAssignee,
  isLocked,
}: FunnelActionNoteBlockProps) {
  const {
    ideas,
    currentOwner,
    updateFunnelActionNote,
    addTaskToFunnelAction,
  } = useCrm();
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);

  const linkedTasks = useMemo(
    () => (action.taskIds || [])
      .map((taskId) => ideas.find((idea) => idea.id === taskId && idea.itemType === 'task'))
      .filter((task): task is Idea => !!task),
    [action.taskIds, ideas],
  );

  const taskPreset = useMemo((): TaskFormPreset => {
    const actionLabel = action.type || `Azione ${slotIndex + 1}`;
    return {
      name: action.note.trim()
        ? `${actionLabel}: ${action.note.trim().slice(0, 60)}`
        : actionLabel,
      clientId,
      description: `Funnel · ${actionLabel}${action.note ? `\n${action.note}` : ''}`,
      assignees: [currentOwner || defaultAssignee],
    };
  }, [action.note, action.type, clientId, currentOwner, defaultAssignee, slotIndex]);

  return (
    <div className="funnel-action-note-block">
      <div className="funnel-action-note-header">
        <label htmlFor={`funnel-note-${entryId}-${slotIndex}`}>
          Azione {slotIndex + 1}
          {action.type ? ` · ${action.type}` : ''}
          {action.date ? ` (${formatActionDateDisplay(action.date)})` : ''}
        </label>
        {!isLocked && (
          <button
            type="button"
            className="funnel-action-add-task-btn"
            title="Aggiungi task"
            onClick={() => setShowTaskDrawer(true)}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      <textarea
        id={`funnel-note-${entryId}-${slotIndex}`}
        className="funnel-action-note-input"
        defaultValue={action.note || ''}
        placeholder="Descrivi cosa hai fatto in questa azione..."
        rows={2}
        readOnly={isLocked}
        onBlur={(event) => {
          const nextNote = event.currentTarget.value.trim();
          if (nextNote !== (action.note || '').trim()) {
            void updateFunnelActionNote(entryId, slotIndex, nextNote);
          }
        }}
      />
      {linkedTasks.length > 0 && (
        <ul className="funnel-action-task-list">
          {linkedTasks.map((task) => (
            <li key={task.id}>
              <Link href="/ideas" className="funnel-action-task-link">
                {task.name}
              </Link>
              <span className="funnel-action-task-meta">
                {task.status}
                {task.dueDate ? ` · ${formatActionDateDisplay(task.dueDate)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <TaskFormDrawer
        isOpen={showTaskDrawer}
        onClose={() => setShowTaskDrawer(false)}
        preset={taskPreset}
        lockClient
        onCreated={(taskId) => addTaskToFunnelAction(entryId, slotIndex, taskId)}
      />
    </div>
  );
}
