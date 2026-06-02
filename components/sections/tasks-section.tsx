'use client';

import { useMemo, useState } from 'react';
import { Calendar, Edit, Plus, Trash2 } from 'lucide-react';
import {
  ASSIGNEES,
  TASK_FILTERS,
  TASK_TYPES,
  countOpenTasks,
  filterTasks,
  getCompletionPercent,
  getTaskTypeMeta,
  isTaskOverdue,
  sortTasksForDisplay,
} from '@/lib/tasks/index';
import { useCrm } from '@/providers/crm-provider';
import { TopHeader } from '@/components/layout/top-header';
import type { ClientTask } from '@/lib/types/crm';

export function TasksSection() {
  const { clients, clientTasks, saveTask, deleteTask, toggleTaskCompleted } = useCrm();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [taskFilter, setTaskFilter] = useState('all');
  const [clientSearch, setClientSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<ClientTask | null>(null);
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('follow-up');
  const [assignee, setAssignee] = useState<(typeof ASSIGNEES)[number]>('Jeck');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const sortedClients = useMemo(() =>
    clients
      .filter((c) => c.relationship !== 'Eliminato')
      .filter((c) => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'it')),
  [clients, clientSearch]);

  const activeClientId = selectedClientId || sortedClients[0]?.id || '';
  const selectedClient = clients.find((c) => c.id === activeClientId);
  const clientTaskList = clientTasks.filter((t) => t.clientId === activeClientId);
  const filteredTasks = sortTasksForDisplay(filterTasks(clientTaskList, taskFilter));
  const percent = getCompletionPercent(clientTaskList);
  const openCount = countOpenTasks(clientTaskList);

  const openNewTask = () => {
    setEditTask(null);
    setTitle('');
    setTaskType('follow-up');
    setAssignee('Jeck');
    setDueDate('');
    setNotes('');
    setShowForm(true);
  };

  const openEditTask = (task: ClientTask) => {
    setEditTask(task);
    setTitle(task.title);
    setTaskType(task.taskType);
    setAssignee(task.assignee);
    setDueDate(task.dueDate);
    setNotes(task.notes);
    setShowForm(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveTask({
      id: editTask?.id,
      clientId: activeClientId,
      title,
      taskType: taskType as ClientTask['taskType'],
      assignee,
      dueDate,
      notes,
    });
    setShowForm(false);
  };

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="tasks-layout">
            <aside className="tasks-client-sidebar glass-card">
              <div className="tasks-sidebar-header"><h3>Clienti</h3></div>
              <input
                type="text"
                className="form-input tasks-client-search"
                placeholder="Cerca cliente..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              <div className="tasks-client-list">
                {sortedClients.map((client) => {
                  const open = countOpenTasks(clientTasks.filter((t) => t.clientId === client.id));
                  return (
                    <button
                      key={client.id}
                      type="button"
                      className={`tasks-client-item${client.id === activeClientId ? ' is-active' : ''}`}
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <span className="tasks-client-name">{client.name}</span>
                      {open > 0 && <span className="tasks-client-badge">{open}</span>}
                    </button>
                  );
                })}
              </div>
            </aside>
            <section className="tasks-main glass-card">
              {selectedClient ? (
                <>
                  <header className="tasks-main-header">
                    <div>
                      <h3>{selectedClient.name}</h3>
                      <p className="tasks-main-sub">{selectedClient.type} · {selectedClient.owner}</p>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={openNewTask}>
                      <Plus size={16} />
                      <span>Nuova task</span>
                    </button>
                  </header>
                  <div className="tasks-progress-wrap">
                    <div className="tasks-progress-meta">
                      <span><strong>{percent}%</strong> completate</span>
                      <span>{openCount} aperte · {clientTaskList.length} totali</span>
                    </div>
                    <div className="tasks-progress-track">
                      <div className="tasks-progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <div className="tasks-filters">
                    {TASK_FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`tasks-filter-btn${taskFilter === f.id ? ' is-active' : ''}`}
                        onClick={() => setTaskFilter(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="tasks-list">
                    {filteredTasks.map((task) => {
                      const meta = getTaskTypeMeta(task.taskType);
                      const overdue = isTaskOverdue(task);
                      return (
                        <article key={task.id} className={`task-card${task.completed ? ' is-completed' : ''}${overdue ? ' is-overdue' : ''}`}>
                          <label className="task-check-wrap">
                            <input
                              type="checkbox"
                              className="task-check"
                              checked={task.completed}
                              onChange={(e) => void toggleTaskCompleted(task.id, e.target.checked)}
                            />
                            <span className="task-check-ui" />
                          </label>
                          <div className="task-card-body">
                            <div className="task-card-top">
                              <span className={`task-type-chip task-type-${task.taskType}`}>{meta.label}</span>
                              <span className="task-assignee-chip">{task.assignee}</span>
                            </div>
                            <h4 className="task-title">{task.title}</h4>
                            {task.notes && <p className="task-notes">{task.notes}</p>}
                            <div className="task-card-footer">
                              {task.dueDate && (
                                <span className={`task-due${overdue ? ' is-overdue' : ''}`}>
                                  <Calendar size={14} /> {task.dueDate}
                                </span>
                              )}
                              <div className="task-card-actions">
                                <button type="button" className="btn-table-action edit" onClick={() => openEditTask(task)}>
                                  <Edit size={16} />
                                </button>
                                <button type="button" className="btn-table-action delete" onClick={() => void deleteTask(task.id)}>
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="tasks-placeholder">
                  <h3>Seleziona un cliente</h3>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
      {showForm && (
        <>
          <div className="drawer-overlay open" onClick={() => setShowForm(false)} />
          <div className="drawer open">
            <div className="drawer-header">
              <h3>{editTask ? 'Modifica Task' : 'Nuova Task'}</h3>
            </div>
            <form onSubmit={handleSaveTask}>
              <div className="drawer-body">
                <div className="form-group">
                  <label>Titolo *</label>
                  <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo</label>
                    <select className="form-select" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                      {TASK_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Assegnatario</label>
                    <select className="form-select" value={assignee} onChange={(e) => setAssignee(e.target.value as (typeof ASSIGNEES)[number])}>
                      {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Scadenza</label>
                  <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Note</label>
                  <textarea className="form-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <div className="drawer-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">Salva Task</button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
