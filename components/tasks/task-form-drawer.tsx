'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { OWNERS } from '@/lib/constants/crm';
import { createUniqueId, getTodayString, isClientInActiveSection, isClientInColdSection } from '@/lib/crm/utils';
import { ClientSearchSelect } from '@/components/clients/client-search-select';
import { useCrm } from '@/providers/crm-provider';
import type { Idea, IdeaStatus, Owner, TaskSubtask } from '@/lib/types/crm';

const TASK_STATUSES: { status: IdeaStatus; label: string }[] = [
  { status: 'Da fare', label: 'Da fare' },
  { status: 'In progress', label: 'In progress' },
  { status: 'Fatto', label: 'Fatto' },
];

export interface TaskFormPreset {
  name?: string;
  clientId?: string;
  description?: string;
  dueDate?: string;
  assignees?: Owner[];
  status?: IdeaStatus;
}

interface TaskFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Idea | null;
  preset?: TaskFormPreset;
  lockClient?: boolean;
  onCreated?: (taskId: string) => void | Promise<void>;
}

export function TaskFormDrawer({
  isOpen,
  onClose,
  taskToEdit = null,
  preset,
  lockClient = false,
  onCreated,
}: TaskFormDrawerProps) {
  const { clients, currentOwner, saveIdea } = useCrm();
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<IdeaStatus>('Da fare');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState<Owner[]>(['Jeck']);
  const [formSubtasks, setFormSubtasks] = useState<TaskSubtask[]>([]);
  const [newFormSubtaskTitle, setNewFormSubtaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeClients = useMemo(
    () => clients
      .filter((client) => isClientInActiveSection(client))
      .sort((a, b) => a.name.localeCompare(b.name, 'it')),
    [clients],
  );
  const coldClients = useMemo(
    () => clients
      .filter((client) => isClientInColdSection(client))
      .sort((a, b) => a.name.localeCompare(b.name, 'it')),
    [clients],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (taskToEdit) {
      setName(taskToEdit.name);
      setClientId(taskToEdit.clientId);
      setStatus(taskToEdit.status);
      setDescription(taskToEdit.description);
      setDueDate(taskToEdit.dueDate || '');
      setAssignees(taskToEdit.assignees?.length ? taskToEdit.assignees : ['Jeck']);
      setFormSubtasks(taskToEdit.subtasks || []);
      setNewFormSubtaskTitle('');
      return;
    }
    setName(preset?.name || '');
    setClientId(preset?.clientId || '');
    setStatus(preset?.status || 'Da fare');
    setDescription(preset?.description || '');
    setDueDate(preset?.dueDate || getTodayString());
    setAssignees(
      preset?.assignees?.length
        ? preset.assignees
        : currentOwner
          ? [currentOwner]
          : ['Jeck'],
    );
    setFormSubtasks([]);
    setNewFormSubtaskTitle('');
  }, [currentOwner, isOpen, preset, taskToEdit]);

  const toggleAssignee = (owner: Owner): void => {
    setAssignees((prev) => {
      if (prev.includes(owner)) {
        const next = prev.filter((value) => value !== owner);
        return next.length > 0 ? next : [owner];
      }
      if (prev.length >= 2) return prev;
      return [...prev, owner];
    });
  };

  const addFormSubtask = (): void => {
    const title = newFormSubtaskTitle.trim();
    if (!title) return;
    setFormSubtasks((prev) => [
      ...prev,
      { id: createUniqueId('subtask'), title, completed: false },
    ]);
    setNewFormSubtaskTitle('');
  };

  const updateFormSubtaskTitle = (subtaskId: string, title: string): void => {
    setFormSubtasks((prev) => prev.map((subtask) => (
      subtask.id === subtaskId ? { ...subtask, title } : subtask
    )));
  };

  const removeFormSubtask = (subtaskId: string): void => {
    setFormSubtasks((prev) => prev.filter((subtask) => subtask.id !== subtaskId));
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const taskId = taskToEdit?.id || createUniqueId('idea');
      await saveIdea({
        id: taskId,
        name,
        category: 'Content',
        clientId: clientId || '',
        status,
        description,
        itemType: 'task',
        dueDate,
        assignees,
        subtasks: formSubtasks,
        attachments: taskToEdit?.attachments || [],
      });
      if (!taskToEdit && onCreated) {
        await onCreated(taskId);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} />
      <div className="drawer open">
        <div className="drawer-header">
          <h3>{taskToEdit ? 'Modifica Task' : 'Nuova Task'}</h3>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="drawer-body">
            <div className="form-group">
              <label>Titolo Task *</label>
              <input
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Cliente (opzionale)</label>
              {lockClient && clientId ? (
                <input
                  className="form-input"
                  value={clients.find((client) => client.id === clientId)?.name || 'Cliente'}
                  readOnly
                />
              ) : (
                <ClientSearchSelect
                  activeClients={activeClients}
                  coldClients={coldClients}
                  value={clientId}
                  onChange={setClientId}
                />
              )}
            </div>
            <div className="form-group">
              <label>Deadline *</label>
              <input
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Owner (max 2)</label>
              <div className="idea-assignee-list">
                {OWNERS.map((owner) => (
                  <label key={owner} className="idea-assignee-option">
                    <input
                      type="checkbox"
                      checked={assignees.includes(owner)}
                      disabled={!assignees.includes(owner) && assignees.length >= 2}
                      onChange={() => toggleAssignee(owner)}
                    />
                    <span>{owner}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Stato</label>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as IdeaStatus)}
              >
                {TASK_STATUSES.map((item) => (
                  <option key={item.status} value={item.status}>{item.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Descrizione</label>
              <textarea
                className="form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Subtask</label>
              <div className="task-subtasks">
                <div className="task-subtasks-list">
                  {formSubtasks.map((subtask) => (
                    <div key={subtask.id} className="task-subtask-item task-subtask-item-editable">
                      <span className="task-subtask-check is-placeholder" aria-hidden="true" />
                      <input
                        type="text"
                        className="task-subtask-title-input"
                        value={subtask.title}
                        onChange={(event) => updateFormSubtaskTitle(subtask.id, event.target.value)}
                        placeholder="Titolo subtask"
                      />
                      <button
                        type="button"
                        className="btn-table-action delete task-subtask-delete"
                        onClick={() => removeFormSubtask(subtask.id)}
                        title="Elimina subtask"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="task-subtask-add">
                  <input
                    type="text"
                    className="task-subtask-input"
                    value={newFormSubtaskTitle}
                    onChange={(event) => setNewFormSubtaskTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addFormSubtask();
                      }
                    }}
                    placeholder="Aggiungi subtask..."
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm task-subtask-add-btn"
                    onClick={addFormSubtask}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
