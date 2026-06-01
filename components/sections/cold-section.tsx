'use client';

import { useEffect, useMemo, useState } from 'react';
import { Edit, PlusCircle, Search, Sparkles, Trash2 } from 'lucide-react';
import { COLD_CLIENT_CATEGORIES, OWNERS } from '@/lib/constants/crm';
import { formatCurrency, isClientInColdSection } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import { ClientDrawer } from '@/components/drawers/client-drawer';
import { TopHeader } from '@/components/layout/top-header';
import type { Client } from '@/lib/types/crm';

interface InlineRev2026CellProps {
  client: Client;
  onSave: (clientId: string, value: number) => Promise<void>;
}

function InlineRev2026Cell({ client, onSave }: InlineRev2026CellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(String(client.rev2026 || 0));

  useEffect(() => {
    setValue(String(client.rev2026 || 0));
  }, [client.rev2026]);

  const saveValue = async () => {
    const parsed = Number.parseFloat(value);
    const nextValue = Number.isFinite(parsed) ? parsed : 0;
    setValue(String(nextValue));
    if (nextValue !== client.rev2026) {
      await onSave(client.id, nextValue);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <td style={{ textAlign: 'right' }}>
        <input
          type="number"
          className="inline-edit-input cold-rev-input"
          value={value}
          min={0}
          step={0.01}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => void saveValue()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void saveValue();
            if (event.key === 'Escape') {
              setValue(String(client.rev2026 || 0));
              setIsEditing(false);
            }
          }}
          onClick={(event) => event.stopPropagation()}
        />
      </td>
    );
  }

  return (
    <td
      style={{ textAlign: 'right' }}
      className="cell-editable cold-rev-cell"
      title="Clicca per modificare il fatturato 2026"
      onClick={(event) => {
        event.stopPropagation();
        setIsEditing(true);
      }}
    >
      {formatCurrency(client.rev2026)}
    </td>
  );
}

export function ColdClientsSection() {
  const { clients, deleteClient, updateClientField, enrichClientApollo } = useCrm();
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['agenzia']));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  const coldClients = useMemo(() =>
    clients.filter((c) => {
      if (!isClientInColdSection(c)) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q);
    }),
  [clients, search]);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRev2026Save = async (clientId: string, value: number) => {
    await updateClientField(clientId, 'rev2026', value);
  };

  return (
    <>
      <TopHeader onQuickAdd={() => { setEditClient(null); setDrawerOpen(true); }} />
      <div className="content-body">
        <section className="app-section active">
          <div className="table-filter-bar">
            <div className="filter-left">
              <div className="search-box">
                <Search size={18} />
                <input className="search-input" placeholder="Cerca cliente freddo..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="filter-right">
              <span className="quick-stats-badge">{coldClients.length} clienti freddi</span>
              <button type="button" className="btn btn-primary" onClick={() => { setEditClient(null); setDrawerOpen(true); }}>
                <PlusCircle size={16} />
                <span>Nuovo Cliente Freddo</span>
              </button>
            </div>
          </div>
          <p className="cold-section-hint">
            Prospect con cui non avete <strong>mai lavorato</strong>. I clienti importati da OKR/Excel restano in Lista Clienti.
            Se imposti <strong>Fatturato 2026</strong> &gt; €1 qui, il cliente passa alla lista principale.
          </p>
          <div className="cold-clients-accordion">
            {COLD_CLIENT_CATEGORIES.map((category) => {
              const categoryClients = coldClients
                .filter((c) => c.type === category.type)
                .sort((a, b) => a.name.localeCompare(b.name, 'it'));
              const isExpanded = expandedCategories.has(category.id);
              return (
                <div key={category.id} className={`cold-category${isExpanded ? ' is-expanded' : ''}`}>
                  <div className="cold-category-header">
                    <button type="button" className="cold-category-toggle" onClick={() => toggleCategory(category.id)}>
                      <span>{category.label}</span>
                      <span className="badge">{categoryClients.length}</span>
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="cold-category-body">
                      <table className="crm-table">
                        <thead>
                          <tr>
                            <th>Nome</th>
                            <th>Owner</th>
                            <th>Fatturato 2026</th>
                            <th>Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryClients.length === 0 ? (
                            <tr><td colSpan={4} className="cold-empty-row">Nessun cliente freddo.</td></tr>
                          ) : (
                            categoryClients.map((client) => (
                              <tr key={client.id}>
                                <td><strong>{client.name}</strong></td>
                                <td>
                                  <select className="table-cell-select" value={client.owner} onChange={(e) => void updateClientField(client.id, 'owner', e.target.value)}>
                                    {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                </td>
                                <InlineRev2026Cell client={client} onSave={handleRev2026Save} />
                                <td>
                                  <div className="table-row-actions">
                                    <button type="button" className="btn-table-action apollo" onClick={() => void enrichClientApollo(client.id)}>
                                      <Sparkles size={16} />
                                    </button>
                                    <button type="button" className="btn-table-action edit" onClick={() => { setEditClient(client); setDrawerOpen(true); }}>
                                      <Edit size={16} />
                                    </button>
                                    <button type="button" className="btn-table-action delete" onClick={() => void deleteClient(client.id)}>
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
      {drawerOpen && (
        <ClientDrawer client={editClient} isCold onClose={() => setDrawerOpen(false)} />
      )}
    </>
  );
}
