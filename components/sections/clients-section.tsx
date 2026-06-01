'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronRight, Download, Edit, FilterX, Search, Sparkles, Trash2 } from 'lucide-react';
import {
  CLIENT_TYPES,
  CRM_TABLE_COLUMN_DEFS,
  DEFAULT_TABLE_COLUMN_ORDER,
  OWNERS,
  RELATIONSHIPS,
} from '@/lib/constants/crm';
import {
  formatActionDateDisplay,
  formatCurrency,
  isActionDateStale,
  isClientInActiveSection,
  shouldHighlightIncompleteClient,
} from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import { ClientDrawer } from '@/components/drawers/client-drawer';
import { ClientDetailPanel } from '@/components/clients/client-detail-panel';
import { TopHeader } from '@/components/layout/top-header';
import type { Client, Relationship, SortState } from '@/lib/types/crm';

const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  'Nuovo Cliente': '⭐ Nuovo Cliente',
  Ricorrente: '⭐⭐ Ricorrente',
  'Top 20%': '⭐⭐⭐ Top 20%',
  Perso: '🟠 Perso',
  Eliminato: '🔴 Eliminato',
};

function isInteractiveTableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    'button, select, input, textarea, a, .client-detail-panel, .table-row-actions, .btn-table-action',
  );
}

export function ClientsSection() {
  const {
    clients,
    deleteClient,
    updateClientField,
    updateClientContacts,
    updateClientAction,
    updateClientProductOffers,
    enrichClientApollo,
  } = useCrm();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterRelationship, setFilterRelationship] = useState('');
  const [sort, setSort] = useState<SortState>({ column: 'name', direction: 'asc' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    let list = clients.filter((c) => {
      if (!isClientInActiveSection(c)) return false;
      const matchesQuery =
        !query ||
        c.name.toLowerCase().includes(query) ||
        c.action.toLowerCase().includes(query) ||
        c.contacts.some((ct) =>
          `${ct.name} ${ct.email} ${ct.role}`.toLowerCase().includes(query),
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
  const columnCount = DEFAULT_TABLE_COLUMN_ORDER.length;

  const handleSort = (column: string) => {
    const columnDef = CRM_TABLE_COLUMN_DEFS[column as keyof typeof CRM_TABLE_COLUMN_DEFS];
    if (!columnDef || !columnDef.sortKey || ('noSort' in columnDef && columnDef.noSort)) return;
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleExpanded = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const openNew = () => {
    setEditClient(null);
    setDrawerOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditClient(client);
    setDrawerOpen(true);
  };

  const renderCell = (client: Client, columnId: string) => {
    switch (columnId) {
      case 'name':
        return (
          <td key={columnId} className="col-nome">
            <div className="client-name-cell">
              <ChevronRight
                size={14}
                className={`row-expand-icon ${expandedClients.has(client.id) ? 'is-expanded' : ''}`}
              />
              <strong>{client.name}</strong>
            </div>
          </td>
        );
      case 'type':
        return (
          <td key={columnId}>
            <select
              className="table-cell-select"
              value={client.type}
              onChange={(e) => void updateClientField(client.id, 'type', e.target.value)}
            >
              {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </td>
        );
      case 'owner':
        return (
          <td key={columnId}>
            <select
              className="table-cell-select"
              value={client.owner}
              onChange={(e) => void updateClientField(client.id, 'owner', e.target.value)}
            >
              {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </td>
        );
      case 'relationship':
        return (
          <td key={columnId}>
            <select
              className="table-cell-select"
              value={client.relationship}
              onChange={(e) => void updateClientField(client.id, 'relationship', e.target.value)}
            >
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>)}
            </select>
          </td>
        );
      case 'rev2026':
        return <td key={columnId} style={{ textAlign: 'right' }}>{formatCurrency(client.rev2026)}</td>;
      case 'rev2025':
        return <td key={columnId} style={{ textAlign: 'right' }}>{formatCurrency(client.rev2025)}</td>;
      case 'actionDate': {
        const isStale = isActionDateStale(client.actionDate);
        return (
          <td
            key={columnId}
            className="col-data-azione"
            title={isStale ? 'Azione non aggiornata da oltre 10 giorni' : undefined}
          >
            {client.actionDate ? (
              <span className={isStale ? 'table-cell-chip cell-date-stale' : undefined}>
                {formatActionDateDisplay(client.actionDate)}
              </span>
            ) : '—'}
          </td>
        );
      }
      case 'actions':
        return (
          <td key={columnId}>
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
        );
      default:
        return <td key={columnId} />;
    }
  };

  return (
    <>
      <TopHeader onQuickAdd={openNew} />
      <div className="content-body is-clients-section">
        <section id="section-clients" className="app-section active">
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
                    {DEFAULT_TABLE_COLUMN_ORDER.map((colId) => {
                      const columnDef = CRM_TABLE_COLUMN_DEFS[colId as keyof typeof CRM_TABLE_COLUMN_DEFS];
                      return (
                        <th
                          key={colId}
                          onClick={() => handleSort(colId)}
                          style={{ cursor: ('noSort' in columnDef && columnDef.noSort) ? 'default' : 'pointer' }}
                        >
                          {columnDef.label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} style={{ textAlign: 'center', padding: 40 }}>
                        Nessun cliente corrisponde ai criteri di ricerca.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((client) => {
                      const isExpanded = expandedClients.has(client.id);
                      return (
                        <Fragment key={client.id}>
                          <tr
                            className={[
                              'client-row-expandable',
                              isExpanded ? 'is-row-expanded' : '',
                              shouldHighlightIncompleteClient(client) ? 'client-row-incomplete' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={(event) => {
                              if (isInteractiveTableTarget(event.target)) return;
                              toggleExpanded(client.id);
                            }}
                          >
                            {DEFAULT_TABLE_COLUMN_ORDER.map((colId) => renderCell(client, colId))}
                          </tr>
                          {isExpanded && (
                            <tr className="client-contacts-detail-row is-visible">
                              <td colSpan={columnCount}>
                                <ClientDetailPanel
                                  client={client}
                                  onUpdateContacts={(contacts) => updateClientContacts(client.id, contacts)}
                                  onUpdateAction={(action) => updateClientAction(client.id, action)}
                                  onUpdateProductOffers={(offerIds) => updateClientProductOffers(client.id, offerIds)}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
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
