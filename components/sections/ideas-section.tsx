'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, PlusCircle, Search, Trash2 } from 'lucide-react';
import { IDEA_CATEGORIES, OWNERS } from '@/lib/constants/crm';
import { isClientInActiveSection, isClientInColdSection } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import { ClientSearchSelect } from '@/components/clients/client-search-select';
import { TopHeader } from '@/components/layout/top-header';
import type { Idea, IdeaItemType, IdeaStatus, Owner } from '@/lib/types/crm';
import { formatActionDateDisplay, getTodayString } from '@/lib/crm/utils';

const COLUMNS: { status: IdeaStatus; id: string; label: string; color: string }[] = [
  { status: 'Da fare', id: 'todo', label: 'Da fare', color: '#ef4444' },
  { status: 'In progress', id: 'progress', label: 'In progress', color: '#f59e0b' },
  { status: 'Fatto', id: 'done', label: 'Fatto', color: '#10b981' },
];

export function IdeasSection() {
  const { clients, ideas, saveIdea, deleteIdea, moveIdeaStatus } = useCrm();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | IdeaItemType>('all');
  const [showForm, setShowForm] = useState(false);
  const [editIdea, setEditIdea] = useState<Idea | null>(null);
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
    const matchesQuery = !query ||
      idea.name.toLowerCase().includes(query) ||
      idea.description.toLowerCase().includes(query) ||
      clientName.includes(query);
    const matchesType = typeFilter === 'all' || idea.itemType === typeFilter;
    return matchesQuery && matchesType && (!categoryFilter || idea.category === categoryFilter);
  }), [ideas, clients, search, categoryFilter, typeFilter]);

  const resetForm = (nextType: IdeaItemType = 'idea'): void => {
    setEditIdea(null);
    setName('');
    setCategory('Content');
    setClientId(assignableClients[0]?.id || '');
    setStatus('Da fare');
    setDescription('');
    setItemType(nextType);
    setDueDate('');
    setAssignees(['Jeck']);
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
      return [...prev, owner];
    });
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    await saveIdea({
      id: editIdea?.id,
      name,
      category,
      clientId,
      status,
      description,
      itemType,
      dueDate: itemType === 'task' ? dueDate : '',
      assignees: itemType === 'task' ? assignees : [],
    });
    setShowForm(false);
  };

  const shiftStatus = (idea: Idea, direction: 'left' | 'right'): void => {
    const order: IdeaStatus[] = ['Da fare', 'In progress', 'Fatto'];
    const idx = order.indexOf(idea.status);
    const next = direction === 'right' ? order[idx + 1] : order[idx - 1];
    if (next) void moveIdeaStatus(idea.id, next);
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
              <button type="button" className="btn btn-primary" onClick={() => openNew('idea')}>
                <PlusCircle size={16} />
                <span>+ IDEA // Task</span>
              </button>
            </div>
          </div>
          <div className="kanban-board">
            {COLUMNS.map((col) => {
              const colIdeas = filtered.filter((i) => i.status === col.status);
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
                    {colIdeas.map((idea) => {
                      const client = clients.find((c) => c.id === idea.clientId);
                      const isTask = idea.itemType === 'task';
                      const isColdClient = client ? isClientInColdSection(client) : false;
                      return (
                        <div key={idea.id} className="idea-card">
                          <div className="idea-card-header">
                            <span className={`idea-item-type-tag ${isTask ? 'is-task' : 'is-idea'}`}>
                              {isTask ? 'Task' : 'Idea'}
                            </span>
                            <span className="badge">{idea.category}</span>
                            <span className="idea-card-client">
                              {client?.name || '—'}
                              {isColdClient ? ' · freddo' : ''}
                            </span>
                          </div>
                          <h4 className="idea-card-title">{idea.name}</h4>
                          <p className="idea-card-desc">{idea.description}</p>
                          {isTask && (
                            <div className="idea-card-task-meta">
                              {idea.dueDate && (
                                <span>Deadline: {formatActionDateDisplay(idea.dueDate)}</span>
                              )}
                              {idea.assignees.length > 0 && (
                                <span>Owner: {idea.assignees.join(', ')}</span>
                              )}
                            </div>
                          )}
                          <div className="idea-card-footer">
                            <span className="idea-card-date">{idea.dateAdded || getTodayString()}</span>
                            <div className="idea-card-actions">
                              {col.status !== 'Da fare' && (
                                <button type="button" className="btn-card-move left" onClick={() => shiftStatus(idea, 'left')}>
                                  <ChevronLeft size={14} />
                                </button>
                              )}
                              <button type="button" className="btn-card-move edit" onClick={() => openEdit(idea)}>✎</button>
                              <button type="button" className="btn-card-move delete" onClick={() => void deleteIdea(idea.id)}>
                                <Trash2 size={14} />
                              </button>
                              {col.status !== 'Fatto' && (
                                <button type="button" className="btn-card-move right" onClick={() => shiftStatus(idea, 'right')}>
                                  <ChevronRight size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
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
                <div className="form-group">
                  <label>Categoria</label>
                  <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value as Idea['category'])}>
                    {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Cliente *</label>
                  <ClientSearchSelect
                    activeClients={activeClients}
                    coldClients={coldClients}
                    value={clientId}
                    onChange={setClientId}
                    required
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
                      <label>Owner</label>
                      <div className="idea-assignee-list">
                        {OWNERS.map((owner) => (
                          <label key={owner} className="idea-assignee-option">
                            <input
                              type="checkbox"
                              checked={assignees.includes(owner)}
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
                  <label>Descrizione *</label>
                  <textarea className="form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} required />
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
