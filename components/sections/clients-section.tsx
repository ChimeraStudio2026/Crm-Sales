'use client';

import { useMemo, useState } from 'react';
import { Download, Edit, FilterX, Search, Sparkles, Trash2 } from 'lucide-react';
import {
  CLIENT_TYPES,
  DEFAULT_TABLE_COLUMN_ORDER,
  OWNERS,
  RELATIONSHIPS,
} from '@/lib/constants/crm';
import {
  formatCurrency,
  isClientInActiveSection,
  shouldHighlightIncompleteClient,
} from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import { ClientDrawer } from '@/components/drawers/client-drawer';
import { TopHeader } from '@/components/layout/top-header';
import type { Client, Relationship, SortState } from '@/lib/types/crm';

const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  'Nuovo Cliente': '⭐ Nuovo Cliente',
  Ricorrente: '⭐⭐ Ricorrente',
  'Top 20%': '⭐⭐⭐ Top 20%',
  Perso: '🟠 Perso',
  Eliminato: '🔴 Eliminato',
};

export function ClientsSection() {
  const { clients, deleteClient, updateClientField, enrichClientApollo } = useCrm();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterRelationship, setFilterRelationship] = useState('');
  const [sort, setSort] = useState<SortState>({ column: 'name', direction: 'asc' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    let list = clients.filter((c) => {
      if (!isClientInActiveSection(c)) return false;
      const matchesQuery =
        !query ||
        c.name.toLowerCase().includes(query) ||
        c.contacts.some((ct) =>
          `${ct.email} ${ct.role}`.toLowerCase().includes(query),
        );
      return (
        matchesQuery &&
        (!filterType || c.type === filterType) &&
        (!filterOwner || c.owner === filterOwner) &&
        (!filterRelationship || c.relationship === filterRelationship)
      );
    });
    const col = sort.column as keyof Client;
    list = [...list].sort((a, b) => {
      let valA: string | number = a[col] as string | number;
      let valB: string | number = b[col] as string | number;
      if (col === 'rev2025' || col === 'rev2026') {
        valA = Number(a[col]) || 0;
        valB = Number(b[col]) || 0;
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = String(valB).toLowerCase();
      }
      if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [clients, filterOwner, filterRelationship, filterType, search, sort]);

  const totalActive = clients.filter(isClientInActiveSection).length;

  const handleSort = (column: string) => {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const openNew = () => {
    setEditClient(null);
    setDrawerOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditClient(client);
    setDrawerOpen(true);
  };

  return (
    <>
      <TopHeader onQuickAdd={openNew} />
      <div className="content-body">
        <section className="app-section active">
          <div className="table-filter-bar">
            <div className="filter-left">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Cerca cliente o contatto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="filter-group">
                <select className="filter-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">Tutte le Tipologie</option>
                  {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className="filter-select" value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
                  <option value="">Tutti gli Owner</option>
                  {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <select className="filter-select" value={filterRelationship} onChange={(e) => setFilterRelationship(e.target.value)}>
                  <option value="">Tutti i Rapporti</option>
                  {RELATIONSHIPS.map((r) => <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>)}
                </select>
              </div>
            </div>
            <div className="filter-right">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSearch('');
                  setFilterType('');
                  setFilterOwner('');
                  setFilterRelationship('');
                }}
              >
                <FilterX size={16} />
                <span>Resetta</span>
              </button>
              <button type="button" className="btn btn-success">
                <Download size={16} />
                <span>Esporta</span>
              </button>
            </div>
          </div>
          <div className="table-container">
            <div className="crm-table-scroll-viewport">
              <table className="crm-table">
                <thead>
                  <tr>
                    {DEFAULT_TABLE_COLUMN_ORDER.map((colId) => (
                      <th
                        key={colId}
                        onClick={() => handleSort(colId)}
                        style={{ cursor: 'pointer' }}
                      >
                        {colId === 'name' && 'Nome Cliente'}
                        {colId === 'type' && 'Tipologia'}
                        {colId === 'owner' && 'Owner'}
                        {colId === 'relationship' && 'Rapporto'}
                        {colId === 'rev2026' && 'Fatturato 2026'}
                        {colId === 'rev2025' && 'Fatturato 2025'}
                      </th>
                    ))}
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={DEFAULT_TABLE_COLUMN_ORDER.length + 1} style={{ textAlign: 'center', padding: 40 }}>
                        Nessun cliente corrisponde ai criteri di ricerca.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((client) => (
                      <tr
                        key={client.id}
                        className={shouldHighlightIncompleteClient(client) ? 'client-row-incomplete' : ''}
                      >
                        <td><strong>{client.name}</strong></td>
                        <td>
                          <select
                            className="table-cell-select"
                            value={client.type}
                            onChange={(e) => void updateClientField(client.id, 'type', e.target.value)}
                          >
                            {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td>
                          <select
                            className="table-cell-select"
                            value={client.owner}
                            onChange={(e) => void updateClientField(client.id, 'owner', e.target.value)}
                          >
                            {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>
                        <td>
                          <select
                            className="table-cell-select"
                            value={client.relationship}
                            onChange={(e) => void updateClientField(client.id, 'relationship', e.target.value)}
                          >
                            {RELATIONSHIPS.map((r) => <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>)}
                          </select>
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(client.rev2026)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(client.rev2025)}</td>
                        <td>
                          <div className="table-row-actions">
                            <button type="button" className="btn-table-action apollo" title="Apollo" onClick={() => void enrichClientApollo(client.id)}>
                              <Sparkles size={16} />
                            </button>
                            <button type="button" className="btn-table-action edit" title="Modifica" onClick={() => openEdit(client)}>
                              <Edit size={16} />
                            </button>
                            <button type="button" className="btn-table-action delete" title="Elimina" onClick={() => void deleteClient(client.id)}>
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
            <div className="table-footer">
              <div className="table-info">
                Mostrati {filtered.length} di {totalActive} clienti
              </div>
            </div>
          </div>
        </section>
      </div>
      {drawerOpen && (
        <ClientDrawer
          client={editClient}
          isCold={false}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}
