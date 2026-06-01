'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, PlusCircle, Search, Trash2 } from 'lucide-react';
import { IDEA_CATEGORIES } from '@/lib/constants/crm';
import { useCrm } from '@/providers/crm-provider';
import { TopHeader } from '@/components/layout/top-header';
import type { Idea, IdeaStatus } from '@/lib/types/crm';
import { getTodayString } from '@/lib/crm/utils';

const COLUMNS: { status: IdeaStatus; id: string; label: string; color: string }[] = [
  { status: 'Da fare', id: 'todo', label: 'Da fare', color: '#ef4444' },
  { status: 'In progress', id: 'progress', label: 'In progress', color: '#f59e0b' },
  { status: 'Fatto', id: 'done', label: 'Fatto', color: '#10b981' },
];

export function IdeasSection() {
  const { clients, ideas, saveIdea, deleteIdea, moveIdeaStatus } = useCrm();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editIdea, setEditIdea] = useState<Idea | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Idea['category']>('Content');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<IdeaStatus>('Da fare');
  const [description, setDescription] = useState('');

  const filtered = useMemo(() => ideas.filter((idea) => {
    const client = clients.find((c) => c.id === idea.clientId);
    const clientName = client?.name.toLowerCase() || '';
    const query = search.toLowerCase().trim();
    const matchesQuery = !query ||
      idea.name.toLowerCase().includes(query) ||
      idea.description.toLowerCase().includes(query) ||
      clientName.includes(query);
    return matchesQuery && (!categoryFilter || idea.category === categoryFilter);
  }), [ideas, clients, search, categoryFilter]);

  const openNew = () => {
    setEditIdea(null);
    setName('');
    setCategory('Content');
    setClientId(clients[0]?.id || '');
    setStatus('Da fare');
    setDescription('');
    setShowForm(true);
  };

  const openEdit = (idea: Idea) => {
    setEditIdea(idea);
    setName(idea.name);
    setCategory(idea.category);
    setClientId(idea.clientId);
    setStatus(idea.status);
    setDescription(idea.description);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveIdea({ id: editIdea?.id, name, category, clientId, status, description });
    setShowForm(false);
  };

  const shiftStatus = (idea: Idea, direction: 'left' | 'right') => {
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
                <input className="search-input" placeholder="Cerca idea..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Tutte le Categorie</option>
                {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-right">
              <button type="button" className="btn btn-primary" onClick={openNew}>
                <PlusCircle size={16} />
                <span>+ IDEA</span>
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
                      return (
                        <div key={idea.id} className="idea-card">
                          <div className="idea-card-header">
                            <span className="badge">{idea.category}</span>
                            <span className="idea-card-client">{client?.name || '—'}</span>
                          </div>
                          <h4 className="idea-card-title">{idea.name}</h4>
                          <p className="idea-card-desc">{idea.description}</p>
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
            <div className="drawer-header"><h3>{editIdea ? 'Modifica Idea' : 'Nuova Idea'}</h3></div>
            <form onSubmit={handleSubmit}>
              <div className="drawer-body">
                <div className="form-group">
                  <label>Nome Idea *</label>
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
                  <select className="form-select" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
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
                <button type="submit" className="btn btn-primary">Salva Idea</button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
