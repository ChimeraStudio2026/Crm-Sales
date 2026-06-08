'use client';

import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Download, Paperclip, Plus, PlusCircle, Search, Trash2 } from 'lucide-react';
import { OWNERS } from '@/lib/constants/crm';
import { createUniqueId, getTodayString, isClientInActiveSection, isClientInColdSection } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import { ClientSearchSelect } from '@/components/clients/client-search-select';
import { TopHeader } from '@/components/layout/top-header';
import type { Idea, IdeaStatus, Owner, TaskSubtask } from '@/lib/types/crm';

const COLUMNS: { status: IdeaStatus; id: string; label: string; color: string }[] = [
  { status: 'Da fare', id: 'todo', label: 'Da fare', color: '#ef4444' },
  { status: 'In progress', id: 'progress', label: 'In progress', color: '#f59e0b' },
  { status: 'Fatto', id: 'done', label: 'Fatto', color: '#10b981' },
];

function excludeTasksByStatus(
  tasks: Idea[],
  excludedStatuses: ReadonlySet<IdeaStatus>,
): Idea[] {
  if (excludedStatuses.size === 0) return tasks;
  return tasks.filter((task) => !excludedStatuses.has(task.status));
}

type TaskViewMode = 'list' | 'board' | 'clients';

export function IdeasSection() {
  const {
    clients,
    ideas,
    currentOwner,
    saveIdea,
    deleteIdea,
    moveIdeaStatus,
    uploadTaskAttachment,
    downloadTaskAttachment,
    removeTaskAttachment,
  } = useCrm();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<TaskViewMode>('list');
  const [excludedTaskStatuses, setExcludedTaskStatuses] = useState<IdeaStatus[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Idea | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({});
  const [subtaskTitleDrafts, setSubtaskTitleDrafts] = useState<Record<string, string>>({});
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<Record<string, string>>({});
  const saveDescriptionTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveSubtaskTitleTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<IdeaStatus>('Da fare');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState<Owner[]>(['Jeck']);
  const [formSubtasks, setFormSubtasks] = useState<TaskSubtask[]>([]);
  const [newFormSubtaskTitle, setNewFormSubtaskTitle] = useState('');

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

  const allTasks = useMemo(
    () => ideas.filter((idea) => idea.itemType === 'task'),
    [ideas],
  );

  const excludedStatusSet = useMemo(
    () => new Set(excludedTaskStatuses),
    [excludedTaskStatuses],
  );

  const filteredTasks = useMemo(() => {
    const query = search.toLowerCase().trim();
    return excludeTasksByStatus(
      allTasks.filter((task) => {
        const client = clients.find((item) => item.id === task.clientId);
        const clientName = client?.name.toLowerCase() || '';
        const matchesOwner = !currentOwner || task.assignees.includes(currentOwner);
        const matchesQuery = !query ||
          task.name.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query) ||
          clientName.includes(query) ||
          (task.subtasks || []).some((subtask) => subtask.title.toLowerCase().includes(query));
        return matchesOwner && matchesQuery;
      }),
      excludedStatusSet,
    );
  }, [allTasks, clients, currentOwner, search, excludedStatusSet]);

  const visibleKanbanColumns = useMemo(
    () => COLUMNS.filter((column) => !excludedStatusSet.has(column.status)),
    [excludedStatusSet],
  );

  const toggleExcludedTaskStatus = (nextStatus: IdeaStatus): void => {
    setExcludedTaskStatuses((prev) => (
      prev.includes(nextStatus) ? prev.filter((item) => item !== nextStatus) : [...prev, nextStatus]
    ));
  };

  const todayString = getTodayString();
  const todayTasks = useMemo(
    () => filteredTasks.filter((task) => task.dueDate === todayString),
    [filteredTasks, todayString],
  );
  const otherTasks = useMemo(
    () => filteredTasks.filter((task) => task.dueDate !== todayString),
    [filteredTasks, todayString],
  );

  const clientGroupedTasks = useMemo(() => {
    const tasksWithClient = filteredTasks.filter((task) => Boolean(task.clientId));
    const groups = new Map<string, Idea[]>();
    tasksWithClient.forEach((task) => {
      const current = groups.get(task.clientId) || [];
      current.push(task);
      groups.set(task.clientId, current);
    });
    return [...groups.entries()]
      .map(([groupClientId, tasks]) => ({
        clientId: groupClientId,
        clientName: clients.find((client) => client.id === groupClientId)?.name || 'Cliente',
        tasks,
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName, 'it'));
  }, [filteredTasks, clients]);

  const resetForm = (): void => {
    setEditTask(null);
    setName('');
    setClientId('');
    setStatus('Da fare');
    setDescription('');
    setDueDate('');
    setAssignees(currentOwner ? [currentOwner] : ['Jeck']);
    setFormSubtasks([]);
    setNewFormSubtaskTitle('');
  };

  const openNew = (): void => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (task: Idea): void => {
    setEditTask(task);
    setName(task.name);
    setClientId(task.clientId);
    setStatus(task.status);
    setDescription(task.description);
    setDueDate(task.dueDate || '');
    setAssignees(task.assignees?.length ? task.assignees : ['Jeck']);
    setFormSubtasks(task.subtasks || []);
    setNewFormSubtaskTitle('');
    setShowForm(true);
  };

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
    await saveIdea({
      id: editTask?.id,
      name,
      category: 'Content',
      clientId: clientId || '',
      status,
      description,
      itemType: 'task',
      dueDate,
      assignees,
      subtasks: formSubtasks,
      attachments: editTask?.attachments || [],
    });
    setShowForm(false);
  };

  const toggleTaskExpanded = (taskId: string): void => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const updateTaskDeadline = async (task: Idea, nextDueDate: string): Promise<void> => {
    await saveIdea({ ...task, itemType: 'task', dueDate: nextDueDate });
  };

  const getDescriptionDraft = (task: Idea): string => (
    descriptionDrafts[task.id] ?? task.description ?? ''
  );

  const scheduleDescriptionSave = (task: Idea, value: string): void => {
    if (saveDescriptionTimerRef.current[task.id]) {
      clearTimeout(saveDescriptionTimerRef.current[task.id]);
    }
    saveDescriptionTimerRef.current[task.id] = setTimeout(() => {
      if (value.trim() !== (task.description || '').trim()) {
        void saveIdea({ ...task, itemType: 'task', description: value });
      }
    }, 600);
  };

  const handleDescriptionChange = (task: Idea, value: string): void => {
    setDescriptionDrafts((prev) => ({ ...prev, [task.id]: value }));
    scheduleDescriptionSave(task, value);
  };

  const handleDescriptionBlur = (task: Idea): void => {
    if (saveDescriptionTimerRef.current[task.id]) {
      clearTimeout(saveDescriptionTimerRef.current[task.id]);
      delete saveDescriptionTimerRef.current[task.id];
    }
    const value = getDescriptionDraft(task);
    if (value.trim() !== (task.description || '').trim()) {
      void saveIdea({ ...task, itemType: 'task', description: value });
    }
  };

  const getSubtaskTitleDraft = (taskId: string, subtask: TaskSubtask): string => (
    subtaskTitleDrafts[`${taskId}:${subtask.id}`] ?? subtask.title
  );

  const scheduleSubtaskTitleSave = (task: Idea, subtaskId: string, value: string): void => {
    const key = `${task.id}:${subtaskId}`;
    if (saveSubtaskTitleTimerRef.current[key]) {
      clearTimeout(saveSubtaskTitleTimerRef.current[key]);
    }
    saveSubtaskTitleTimerRef.current[key] = setTimeout(() => {
      void persistSubtaskTitle(task, subtaskId, value);
    }, 600);
  };

  const persistSubtaskTitle = async (task: Idea, subtaskId: string, value: string): Promise<void> => {
    const trimmed = value.trim();
    if (!trimmed) {
      await deleteSubtask(task, subtaskId);
      return;
    }
    const current = (task.subtasks || []).find((subtask) => subtask.id === subtaskId);
    if (!current || current.title === trimmed) return;
    const nextSubtasks = (task.subtasks || []).map((subtask) => (
      subtask.id === subtaskId ? { ...subtask, title: trimmed } : subtask
    ));
    await saveIdea({ ...task, itemType: 'task', subtasks: nextSubtasks });
  };

  const handleSubtaskTitleChange = (task: Idea, subtaskId: string, value: string): void => {
    const key = `${task.id}:${subtaskId}`;
    setSubtaskTitleDrafts((prev) => ({ ...prev, [key]: value }));
    scheduleSubtaskTitleSave(task, subtaskId, value);
  };

  const handleSubtaskTitleBlur = (task: Idea, subtask: TaskSubtask): void => {
    const key = `${task.id}:${subtask.id}`;
    if (saveSubtaskTitleTimerRef.current[key]) {
      clearTimeout(saveSubtaskTitleTimerRef.current[key]);
      delete saveSubtaskTitleTimerRef.current[key];
    }
    void persistSubtaskTitle(task, subtask.id, getSubtaskTitleDraft(task.id, subtask));
  };

  const toggleSubtask = async (task: Idea, subtaskId: string): Promise<void> => {
    const nextSubtasks = (task.subtasks || []).map((subtask) => (
      subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
    ));
    await saveIdea({ ...task, itemType: 'task', subtasks: nextSubtasks });
  };

  const addSubtask = async (task: Idea): Promise<void> => {
    const title = (newSubtaskTitles[task.id] || '').trim();
    if (!title) return;
    const nextSubtask: TaskSubtask = {
      id: createUniqueId('subtask'),
      title,
      completed: false,
    };
    await saveIdea({ ...task, itemType: 'task', subtasks: [...(task.subtasks || []), nextSubtask] });
    setNewSubtaskTitles((prev) => ({ ...prev, [task.id]: '' }));
  };

  const deleteSubtask = async (task: Idea, subtaskId: string): Promise<void> => {
    const nextSubtasks = (task.subtasks || []).filter((subtask) => subtask.id !== subtaskId);
    await saveIdea({ ...task, itemType: 'task', subtasks: nextSubtasks });
    setSubtaskTitleDrafts((prev) => {
      const next = { ...prev };
      delete next[`${task.id}:${subtaskId}`];
      return next;
    });
  };

  const handleAttachmentChange = async (task: Idea, files: FileList | null): Promise<void> => {
    const file = files?.[0];
    if (!file) return;
    await uploadTaskAttachment(task.id, file);
  };

  const renderFormSubtasks = () => (
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
          <button type="button" className="btn btn-secondary btn-sm task-subtask-add-btn" onClick={addFormSubtask}>
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderTaskStatus = (task: Idea) => (
    <select
      className={`task-status-pill task-status-${task.status.toLowerCase().replace(/\s+/g, '-')}`}
      value={task.status}
      onChange={(event) => void moveIdeaStatus(task.id, event.target.value as IdeaStatus)}
      aria-label="Stato task"
    >
      {COLUMNS.map((column) => (
        <option key={column.status} value={column.status}>{column.label}</option>
      ))}
    </select>
  );

  const renderTaskDeadline = (task: Idea) => (
    <input
      type="date"
      className="task-deadline-input"
      value={task.dueDate || ''}
      onChange={(event) => void updateTaskDeadline(task, event.target.value)}
      aria-label="Deadline task"
    />
  );

  const renderTaskControls = (task: Idea) => (
    <div className="task-inline-controls">
      {renderTaskStatus(task)}
      {renderTaskDeadline(task)}
    </div>
  );

  const renderTaskDetails = (task: Idea) => {
    const client = clients.find((item) => item.id === task.clientId);
    return (
      <div className="task-expand-body">
        <div className="task-expand-meta">
          {client && <span>Cliente: <strong>{client.name}</strong></span>}
          <span>Owner: <strong>{task.assignees.join(', ') || '—'}</strong></span>
        </div>
        <textarea
          className="task-inline-description"
          value={getDescriptionDraft(task)}
          onChange={(event) => handleDescriptionChange(task, event.target.value)}
          onBlur={() => handleDescriptionBlur(task)}
          rows={3}
          placeholder="Aggiungi una descrizione..."
          aria-label="Descrizione task"
        />
        <div className="task-subtasks">
          <strong className="task-subtasks-label">Subtask</strong>
          <div className="task-subtasks-list">
            {(task.subtasks || []).map((subtask) => (
              <div
                key={subtask.id}
                className={`task-subtask-item task-subtask-item-editable${subtask.completed ? ' is-completed' : ''}`}
              >
                <label className="task-subtask-toggle">
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => void toggleSubtask(task, subtask.id)}
                  />
                  <span className="task-subtask-check" />
                </label>
                <input
                  type="text"
                  className="task-subtask-title-input"
                  value={getSubtaskTitleDraft(task.id, subtask)}
                  onChange={(event) => handleSubtaskTitleChange(task, subtask.id, event.target.value)}
                  onBlur={() => handleSubtaskTitleBlur(task, subtask)}
                />
                <button
                  type="button"
                  className="btn-table-action delete task-subtask-delete"
                  onClick={() => void deleteSubtask(task, subtask.id)}
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
              value={newSubtaskTitles[task.id] || ''}
              onChange={(event) => setNewSubtaskTitles((prev) => ({ ...prev, [task.id]: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void addSubtask(task);
                }
              }}
              placeholder="Aggiungi subtask..."
            />
            <button type="button" className="btn btn-secondary btn-sm task-subtask-add-btn" onClick={() => void addSubtask(task)}>
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div className="task-attachments task-attachments-compact">
          <label className="task-attachment-upload-compact" title="Allega documento">
            <Paperclip size={14} />
            <span>Allega</span>
            <input
              type="file"
              onChange={(event) => void handleAttachmentChange(task, event.target.files)}
            />
          </label>
          {(task.attachments || []).length > 0 && (
            <div className="task-attachment-list-compact">
              {task.attachments.map((attachment) => (
                <div key={attachment.id} className="task-attachment-chip">
                  <span>{attachment.name}</span>
                  <button type="button" className="btn-table-action edit" onClick={() => void downloadTaskAttachment(attachment)} title="Scarica">
                    <Download size={13} />
                  </button>
                  <button type="button" className="btn-table-action delete" onClick={() => void removeTaskAttachment(task.id, attachment)} title="Rimuovi">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="task-expanded-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(task)}>Modifica task</button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => void deleteIdea(task.id)}>Elimina</button>
        </div>
      </div>
    );
  };

  const renderTaskCard = (task: Idea) => {
    const isExpanded = expandedTasks.has(task.id);
    return (
      <div key={task.id} className={`task-row-card${isExpanded ? ' is-expanded' : ''}`}>
        <div className="task-row-summary">
          <button
            type="button"
            className="task-expand-toggle"
            onClick={() => toggleTaskExpanded(task.id)}
            aria-label={isExpanded ? 'Chiudi task' : 'Apri task'}
          >
            <ChevronRight size={16} />
          </button>
          <h4 className="task-row-title">{task.name}</h4>
          {renderTaskControls(task)}
        </div>
        {isExpanded && renderTaskDetails(task)}
      </div>
    );
  };

  const renderAsanaRow = (task: Idea) => {
    const client = clients.find((item) => item.id === task.clientId);
    return (
      <div key={task.id} className="tasks-asana-row">
        <button type="button" className="tasks-asana-title" onClick={() => toggleTaskExpanded(task.id)}>
          <ChevronRight size={16} className={expandedTasks.has(task.id) ? 'is-expanded' : ''} />
          <span>{task.name}</span>
        </button>
        {renderTaskStatus(task)}
        {renderTaskDeadline(task)}
        <span>{task.assignees.join(', ') || '—'}</span>
        <span>{client?.name || '—'}</span>
        {expandedTasks.has(task.id) && (
          <div className="tasks-asana-expanded">
            {renderTaskDetails(task)}
          </div>
        )}
      </div>
    );
  };

  const renderTaskListSection = (title: string, tasks: Idea[], subtitle?: string) => (
    <div className="tasks-asana-section">
      <div className="tasks-asana-section-header">
        <div className="tasks-asana-section-title-wrap">
          <h3>{title}</h3>
          {subtitle && <span className="tasks-asana-section-subtitle">{subtitle}</span>}
        </div>
        <span className="tasks-asana-section-count">{tasks.length}</span>
      </div>
      {tasks.length > 0 ? (
        tasks.map((task) => renderAsanaRow(task))
      ) : (
        <p className="tasks-asana-section-empty">Nessuna task in questa sezione.</p>
      )}
    </div>
  );

  const renderTaskStatusFilters = () => (
    <div className="tasks-list-toolbar glass-card">
      <div className="tasks-status-filters" role="group" aria-label="Escludi stati">
        <span className="tasks-filter-label">Nascondi:</span>
        {COLUMNS.map((column) => {
          const isExcluded = excludedStatusSet.has(column.status);
          return (
            <button
              key={column.status}
              type="button"
              aria-pressed={isExcluded}
              className={`tasks-filter-btn${isExcluded ? ' is-excluded' : ''}`}
              onClick={() => toggleExcludedTaskStatus(column.status)}
            >
              {column.label}
            </button>
          );
        })}
        {excludedTaskStatuses.length > 0 && (
          <button
            type="button"
            className="tasks-filter-reset"
            onClick={() => setExcludedTaskStatuses([])}
          >
            Mostra tutti
          </button>
        )}
      </div>
    </div>
  );

  const renderTasksAsanaList = (sections: { id?: string; title: string; tasks: Idea[]; subtitle?: string }[]) => (
    <div className="tasks-asana-list glass-card">
      <div className="tasks-asana-header">
        <span>Task</span>
        <span>Stato</span>
        <span>Data</span>
        <span>Owner</span>
        <span>Cliente</span>
      </div>
      {sections.length > 0 ? (
        sections.map((section) => (
          <div key={section.id || section.title}>
            {renderTaskListSection(section.title, section.tasks, section.subtitle)}
          </div>
        ))
      ) : (
        <p className="tasks-asana-section-empty tasks-asana-list-empty">Nessuna task con cliente associato.</p>
      )}
    </div>
  );

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="table-filter-bar">
            <div className="filter-left">
              <div className="search-box">
                <Search size={18} />
                <input className="search-input" placeholder="Cerca task..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="filter-right">
              <div className="task-view-toggle" role="group" aria-label="Vista task">
                <button
                  type="button"
                  className={`task-view-toggle-btn${viewMode === 'list' ? ' is-active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  Righe
                </button>
                <button
                  type="button"
                  className={`task-view-toggle-btn${viewMode === 'board' ? ' is-active' : ''}`}
                  onClick={() => setViewMode('board')}
                >
                  Kanban
                </button>
                <button
                  type="button"
                  className={`task-view-toggle-btn${viewMode === 'clients' ? ' is-active' : ''}`}
                  onClick={() => setViewMode('clients')}
                >
                  Clienti
                </button>
              </div>
              <button type="button" className="btn btn-primary" onClick={openNew}>
                <PlusCircle size={16} />
                <span>Nuova Task</span>
              </button>
            </div>
          </div>
          {renderTaskStatusFilters()}
          {viewMode === 'board' ? (
            visibleKanbanColumns.length > 0 ? (
              <div className="kanban-board">
                {visibleKanbanColumns.map((col) => {
                  const columnTasks = filteredTasks.filter((task) => task.status === col.status);
                  return (
                    <div key={col.id} className="kanban-column">
                      <div className="kanban-column-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                          <h3>{col.label}</h3>
                        </div>
                        <span className="badge">{columnTasks.length}</span>
                      </div>
                      <div className="kanban-cards-container">
                        {columnTasks.map((task) => renderTaskCard(task))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="tasks-asana-section-empty glass-card">
                Tutte le colonne sono nascoste. Usa &quot;Mostra tutti&quot; nei filtri sopra.
              </p>
            )
          ) : viewMode === 'list' ? (
            renderTasksAsanaList([
              { title: 'Today', tasks: todayTasks },
              { title: 'Altre task', tasks: otherTasks },
            ])
          ) : (
            renderTasksAsanaList(
              clientGroupedTasks.map(({ clientId: groupClientId, clientName, tasks }) => ({
                id: groupClientId,
                title: clientName,
                tasks,
              })),
            )
          )}
        </section>
      </div>
      {showForm && (
        <>
          <div className="drawer-overlay open" onClick={() => setShowForm(false)} />
          <div className="drawer open">
            <div className="drawer-header"><h3>{editTask ? 'Modifica Task' : 'Nuova Task'}</h3></div>
            <form onSubmit={handleSubmit}>
              <div className="drawer-body">
                <div className="form-group">
                  <label>Titolo Task *</label>
                  <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Cliente (opzionale)</label>
                  <ClientSearchSelect
                    activeClients={activeClients}
                    coldClients={coldClients}
                    value={clientId}
                    onChange={setClientId}
                  />
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
                  <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as IdeaStatus)}>
                    {COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
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
                {renderFormSubtasks()}
              </div>
              <div className="drawer-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">Salva</button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
