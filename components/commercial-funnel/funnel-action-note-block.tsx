'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { OWNERS } from '@/lib/constants/crm';
import { createUniqueId, formatActionDateDisplay, getTodayString } from '@/lib/crm/utils';
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
    saveIdea,
    updateFunnelActionNote,
    addTaskToFunnelAction,
  } = useCrm();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(getTodayString());
  const [taskAssignee, setTaskAssignee] = useState<Owner>(currentOwner || defaultAssignee);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const linkedTasks = useMemo(
    () => (action.taskIds || [])
      .map((taskId) => ideas.find((idea) => idea.id === taskId && idea.itemType === 'task'))
      .filter((task): task is Idea => !!task),
    [action.taskIds, ideas],
  );

  const handleCreateTask = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    setIsSubmitting(true);
    try {
      const taskId = createUniqueId('idea');
      const actionLabel = action.type || `Azione ${slotIndex + 1}`;
      await saveIdea({
        id: taskId,
        name: title,
        clientId,
        status: 'Da fare',
        description: `Funnel · ${actionLabel}${action.note ? `\n${action.note}` : ''}`,
        itemType: 'task',
        dueDate: taskDueDate,
        assignees: [taskAssignee],
        subtasks: [],
        attachments: [],
      });
      await addTaskToFunnelAction(entryId, slotIndex, taskId);
      setTaskTitle('');
      setTaskDueDate(getTodayString());
      setShowTaskForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTaskForm = (): void => {
    const actionLabel = action.type || `Azione ${slotIndex + 1}`;
    setTaskTitle(action.note.trim() ? `${actionLabel}: ${action.note.trim().slice(0, 60)}` : actionLabel);
    setTaskAssignee(currentOwner || defaultAssignee);
    setShowTaskForm(true);
  };

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
            onClick={openTaskForm}
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
      {showTaskForm && !isLocked && (
        <form className="funnel-action-task-form" onSubmit={(event) => void handleCreateTask(event)}>
          <input
            className="form-input"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Titolo task *"
            required
          />
          <div className="funnel-action-task-form-row">
            <input
              type="date"
              className="form-input"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              required
            />
            <select
              className="form-select"
              value={taskAssignee}
              onChange={(e) => setTaskAssignee(e.target.value as Owner)}
            >
              {OWNERS.map((owner) => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          </div>
          <div className="funnel-action-task-form-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowTaskForm(false)}
            >
              Annulla
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
              {isSubmitting ? 'Salvataggio...' : 'Crea task'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
