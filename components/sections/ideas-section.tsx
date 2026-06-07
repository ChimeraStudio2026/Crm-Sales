'use client';

import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Download, Paperclip, Plus, PlusCircle, Search, Trash2 } from 'lucide-react';
import { IDEA_CATEGORIES, OWNERS } from '@/lib/constants/crm';
import { createUniqueId, getTodayString, isClientInActiveSection, isClientInColdSection } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import { ClientSearchSelect } from '@/components/clients/client-search-select';
import { TopHeader } from '@/components/layout/top-header';
import type { Idea, IdeaItemType, IdeaStatus, Owner, TaskSubtask } from '@/lib/types/crm';

const TASK_STATUS_FILTERS: { id: 'all' | IdeaStatus; label: string }[] = [
  { id: 'all', label: 'Tutte' },
  { id: 'Da fare', label: 'Da fare' },
  { id: 'In progress', label: 'In progress' },
  { id: 'Fatto', label: 'Fatto' },
];
const COLUMNS: { status: IdeaStatus; id: string; label: string; color: string }[] = [
  { status: 'Da fare', id: 'todo', label: 'Da fare', color: '#ef4444' },
  { status: 'In progress', id: 'progress', label: 'In progress', color: '#f59e0b' },
  { status: 'Fatto', id: 'done', label: 'Fatto', color: '#10b981' },
];

function filterTasksByStatus(tasks: Idea[], statusFilter: 'all' | IdeaStatus): Idea[] {
  if (statusFilter === 'all') return tasks;
  return tasks.filter((task) => task.status === statusFilter);
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
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | IdeaItemType>('all');
  const [viewMode, setViewMode] = useState<TaskViewMode>('list');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | IdeaStatus>('all');
  const [showForm, setShowForm] = useState(false);
  const [editIdea, setEditIdea] = useState<Idea | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({});
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<Record<string, string>>({});
  const saveDescriptionTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Idea['category']>('Content');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<IdeaStatus>('Da fare');
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState<IdeaItemType>('idea');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState<Owner[]>(['Jeck']);

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
  const assignableClients = useMemo(
    () => [...activeClients, ...coldClients],
    [activeClients, coldClients],
  );

  const filtered = useMemo(() => ideas.filter((idea) => {
    const client = clients.find((c) => c.id === idea.clientId);
    const clientName = client?.name.toLowerCase() || '';
    const query = search.toLowerCase().trim();
    const isTaskVisible = idea.itemType !== 'task' || (currentOwner ? idea.assignees.includes(currentOwner) : false);
    const matchesQuery = !query ||
      idea.name.toLowerCase().includes(query) ||
      idea.description.toLowerCase().includes(query) ||
      clientName.includes(query);
    const matchesType = typeFilter === 'all' || idea.itemType === typeFilter;
    return isTaskVisible && matchesQuery && matchesType && (
      !categoryFilter || idea.itemType === 'task' || idea.category === categoryFilter
    );
  }), [ideas, clients, currentOwner, search, categoryFilter, typeFilter]);

  const filteredTasks = useMemo(
    () => filterTasksByStatus(
      filtered.filter((idea) => idea.itemType === 'task'),
      taskStatusFilter,
    ),
    [filtered, taskStatusFilter],
  );

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

  const resetForm = (nextType: IdeaItemType = 'idea'): void => {
    setEditIdea(null);
    setName('');
    setCategory('Content');
    setClientId(nextType === 'task' ? '' : (assignableClients[0]?.id || ''));
    setStatus('Da fare');
    setDescription('');
    setItemType(nextType);
    setDueDate('');
    setAssignees(currentOwner ? [currentOwner] : ['Jeck']);
  };

  const openNew = (nextType: IdeaItemType = 'idea'): void => {
    resetForm(nextType);
    setShowForm(true);
  };

  const openEdit = (idea: Idea): void => {
    setEditIdea(idea);
    setName(idea.name);
    setCategory(idea.category);
    setClientId(idea.clientId);
    setStatus(idea.status);
    setDescription(idea.description);
    setItemType(idea.itemType || 'idea');
    setDueDate(idea.dueDate || '');
    setAssignees(idea.assignees?.length ? idea.assignees : ['Jeck']);
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

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    await saveIdea({
      id: editIdea?.id,
      name,
      category: itemType === 'task' ? 'Content' : category,
      clientId: clientId || '',
      status,
      description,
      itemType,
      dueDate: itemType === 'task' ? dueDate : '',
      assignees: itemType === 'task' ? assignees : [],
      subtasks: editIdea?.subtasks || [],
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
    await saveIdea({ ...task, dueDate: nextDueDate });
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
        void saveIdea({ ...task, description: value });
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
      void saveIdea({ ...task, description: value });
    }
  };

  const toggleSubtask = async (task: Idea, subtaskId: string): Promise<void> => {
    const nextSubtasks = (task.subtasks || []).map((subtask) => (
      subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
    ));
    await saveIdea({ ...task, subtasks: nextSubtasks });
  };

  const addSubtask = async (task: Idea): Promise<void> => {
    const title = (newSubtaskTitles[task.id] || '').trim();
    if (!title) return;
    const nextSubtask: TaskSubtask = {
      id: createUniqueId('subtask'),
      title,
      completed: false,
    };
    await saveIdea({ ...task, subtasks: [...(task.subtasks || []), nextSubtask] });
    setNewSubtaskTitles((prev) => ({ ...prev, [task.id]: '' }));
  };

  const handleAttachmentChange = async (task: Idea, files: FileList | null): Promise<void> => {
    const file = files?.[0];
    if (!file) return;
    await uploadTaskAttachment(task.id, file);
  };

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
              <label key={subtask.id} className={`task-subtask-item${subtask.completed ? ' is-completed' : ''}`}>
                <input
                  type="checkbox"
                  checked={subtask.completed}
                  onChange={() => void toggleSubtask(task, subtask.id)}
                />
                <span className="task-subtask-check" />
                <span className="task-subtask-title">{subtask.title}</span>
              </label>
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
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(task)}>Modifica titolo</button>
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

  const renderTasksAsanaList = (sections: { id?: string; title: string; tasks: Idea[]; subtitle?: string }[]) => (
    <div className="tasks-asana-list glass-card">
      <div className="tasks-list-toolbar">
        <div className="tasks-status-filters" role="group" aria-label="Filtra per stato">
          {TASK_STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`tasks-filter-btn${taskStatusFilter === filter.id ? ' is-active' : ''}`}
              onClick={() => setTaskStatusFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
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

  const renderIdeaCard = (idea: Idea) => {
    const client = clients.find((item) => item.id === idea.clientId);
    const isColdClient = client ? isClientInColdSection(client) : false;
    return (
      <div key={idea.id} className="idea-card">
        <div className="idea-card-header">
          <span className="idea-item-type-tag is-idea">Idea</span>
          <span className="badge">{idea.category}</span>
          <span className="idea-card-client">
            {client?.name || '—'}
            {isColdClient ? ' · freddo' : ''}
          </span>
        </div>
        <h4 className="idea-card-title">{idea.name}</h4>
        <p className="idea-card-desc">{idea.description}</p>
        <div className="idea-card-footer">
          <span className="idea-card-date">{idea.dateAdded || getTodayString()}</span>
          <div className="idea-card-actions">
            <button type="button" className="btn-card-move edit" onClick={() => openEdit(idea)}>✎</button>
            <button type="button" className="btn-card-move delete" onClick={() => void deleteIdea(idea.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="table-filter-bar">
            <div className="filter-left">
              <div className="search-box">
                <Search size={18} />
                <input className="search-input" placeholder="Cerca idea o task..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | IdeaItemType)}>
                <option value="all">Tutti i tipi</option>
                <option value="idea">Solo Idee</option>
                <option value="task">Solo Task</option>
              </select>
              <select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Tutte le Categorie</option>
                {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
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
                  onClick={() => {
                    setViewMode('clients');
                    if (typeFilter === 'idea') setTypeFilter('task');
                  }}
                >
                  Clienti
                </button>
              </div>
              <button type="button" className="btn btn-primary" onClick={() => openNew('idea')}>
                <PlusCircle size={16} />
                <span>+ IDEA // Task</span>
              </button>
            </div>
          </div>
          {viewMode === 'board' ? (
            <div className="kanban-board">
              {COLUMNS.map((col) => {
                const colIdeas = filtered.filter((idea) => idea.status === col.status);
                return (
                  <div key={col.id} className="kanban-column">
                    <div className="kanban-column-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                        <h3>{col.label}</h3>
                      </div>
                      <span className="badge">{colIdeas.length}</span>
                    </div>
                    <div className="kanban-cards-container">
                      {colIdeas.map((idea) => (
                        idea.itemType === 'task' ? renderTaskCard(idea) : renderIdeaCard(idea)
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'list' ? (
            renderTasksAsanaList([
              { title: 'Today', tasks: todayTasks },
              { title: 'Altre task', tasks: otherTasks },
            ])
          ) : (
            renderTasksAsanaList(
              clientGroupedTasks.map(({ clientId, clientName, tasks }) => ({
                id: clientId,
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
            <div className="drawer-header"><h3>{editIdea ? 'Modifica elemento' : 'Nuova Idea // Task'}</h3></div>
            <form onSubmit={handleSubmit}>
              <div className="drawer-body">
                <div className="form-group">
                  <label>Tipo</label>
                  <div className="idea-type-switch" role="group" aria-label="Tipo elemento">
                    <button
                      type="button"
                      className={`idea-type-switch-btn${itemType === 'idea' ? ' is-active is-idea' : ''}`}
                      onClick={() => setItemType('idea')}
                    >
                      Idea
                    </button>
                    <button
                      type="button"
                      className={`idea-type-switch-btn${itemType === 'task' ? ' is-active is-task' : ''}`}
                      onClick={() => setItemType('task')}
                    >
                      Task
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>{itemType === 'task' ? 'Titolo Task *' : 'Nome Idea *'}</label>
                  <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                {itemType === 'idea' && (
                  <div className="form-group">
                    <label>Categoria</label>
                    <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value as Idea['category'])}>
                      {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>{itemType === 'task' ? 'Cliente (opzionale)' : 'Cliente *'}</label>
                  <ClientSearchSelect
                    activeClients={activeClients}
                    coldClients={coldClients}
                    value={clientId}
                    onChange={setClientId}
                    required={itemType === 'idea'}
                  />
                </div>
                {itemType === 'task' && (
                  <>
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
                  </>
                )}
                <div className="form-group">
                  <label>Stato</label>
                  <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as IdeaStatus)}>
                    {COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{itemType === 'task' ? 'Descrizione' : 'Descrizione *'}</label>
                  <textarea
                    className="form-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required={itemType === 'idea'}
                  />
                </div>
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
