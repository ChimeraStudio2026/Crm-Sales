'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronRight, Edit, FilterX, Search, Sparkles, Trash2 } from 'lucide-react';
import {
  CLIENT_TYPES,
  COLD_CLIENT_CATEGORIES,
  COLD_TABLE_COLUMN_ORDER,
  CRM_TABLE_COLUMN_DEFS,
  OWNERS,
} from '@/lib/constants/crm';
import {
  formatActionDateDisplay,
  formatCurrency,
  isActionDateStale,
  isClientInColdSection,
  shouldHighlightIncompleteClient,
} from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import { ClientDrawer } from '@/components/drawers/client-drawer';
import { ClientDetailPanel } from '@/components/clients/client-detail-panel';
import { ClientOriginSelect } from '@/components/clients/client-origin-select';
import { TopHeader } from '@/components/layout/top-header';
import { getClientOriginCellClass } from '@/lib/crm/client-origin';
import type { Client, SortState } from '@/lib/types/crm';

function isInteractiveTableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    'button, select, input, textarea, a, .client-detail-panel, .table-row-actions, .btn-table-action, .cold-category-toggle',
  );
}

function sortClients(list: Client[], sort: SortState): Client[] {
  const col = sort.column as keyof Client;
  return [...list].sort((a, b) => {
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
}

function getCommittedActionValue(target: EventTarget & HTMLInputElement): string {
  return target.value.trim();
}

export function ColdClientsSection() {
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
  const [filterOwner, setFilterOwner] = useState('');
  const [sort, setSort] = useState<SortState>({ column: 'name', direction: 'asc' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(COLD_CLIENT_CATEGORIES.map((category) => category.id)),
  );

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    let list = clients.filter((client) => {
      if (!isClientInColdSection(client)) return false;
      const matchesQuery =
        !query ||
        client.name.toLowerCase().includes(query) ||
        client.action.toLowerCase().includes(query) ||
        client.contacts.some((contact) =>
          `${contact.name} ${contact.email} ${contact.role}`.toLowerCase().includes(query),
        );
      return matchesQuery && (!filterOwner || client.owner === filterOwner);
    });
    return sortClients(list, sort);
  }, [clients, filterOwner, search, sort]);

  const totalCold = clients.filter(isClientInColdSection).length;
  const columnCount = COLD_TABLE_COLUMN_ORDER.length;

  const handleSort = (column: string): void => {
    const columnDef = CRM_TABLE_COLUMN_DEFS[column as keyof typeof CRM_TABLE_COLUMN_DEFS];
    if (!columnDef || !columnDef.sortKey || ('noSort' in columnDef && columnDef.noSort)) return;
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleCategory = (categoryId: string): void => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const toggleExpanded = (clientId: string): void => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const openNew = (): void => {
    setEditClient(null);
    setDrawerOpen(true);
  };

  const openEdit = (client: Client): void => {
    setEditClient(client);
    setDrawerOpen(true);
  };

  const renderCell = (client: Client, columnId: string) => {
    switch (columnId) {
      case 'name': {
        const isDraft = shouldHighlightIncompleteClient(client);
        return (
          <td key={columnId} className="col-nome">
            <div className="client-name-cell">
              <ChevronRight
                size={14}
                className={`row-expand-icon ${expandedClients.has(client.id) ? 'is-expanded' : ''}`}
              />
              <strong>{client.name}</strong>
              {isDraft && (
                <span className="client-draft-badge" title="Completa nome, tipologia, owner, origine e almeno un contatto con email. L'azione è opzionale.">
                  <span className="client-draft-dot" aria-hidden="true" />
                  Bozza
                </span>
              )}
            </div>
          </td>
        );
      }
      case 'type':
        return (
          <td key={columnId}>
            <select
              className="table-cell-select"
              value={client.type}
              onChange={(e) => void updateClientField(client.id, 'type', e.target.value)}
            >
              {CLIENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
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
              {OWNERS.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
            </select>
          </td>
        );
      case 'clientOrigin':
        return (
          <td key={columnId} className={`cell-origin ${getClientOriginCellClass(client.clientOrigin)}`}>
            <ClientOriginSelect
              value={client.clientOrigin}
              onChange={(value) => void updateClientField(client.id, 'clientOrigin', value)}
            />
          </td>
        );
      case 'rev2026':
        return <td key={columnId} style={{ textAlign: 'right' }}>{formatCurrency(client.rev2026)}</td>;
      case 'rev2025':
        return <td key={columnId} style={{ textAlign: 'right' }}>{formatCurrency(client.rev2025)}</td>;
      case 'action':
        return (
          <td key={columnId} className="cold-action-cell">
            <input
              className="cold-action-input"
              defaultValue={client.action}
              placeholder="Azione da fare..."
              onBlur={(event) => {
                const nextAction = getCommittedActionValue(event.currentTarget);
                if (nextAction !== client.action) void updateClientAction(client.id, nextAction);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.currentTarget.blur();
              }}
            />
          </td>
        );
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

  const renderCategoryTable = (categoryClients: Client[]) => (
    <div className="cold-table-container">
      <table className="crm-table cold-clients-table">
        <thead>
          <tr>
            {COLD_TABLE_COLUMN_ORDER.map((colId) => {
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
          {categoryClients.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="cold-empty-row">
                Nessun cliente freddo in questa categoria.
              </td>
            </tr>
          ) : (
            categoryClients.map((client) => {
              const isExpanded = expandedClients.has(client.id);
              return (
                <Fragment key={client.id}>
                  <tr
                    className={[
                      'client-row-expandable',
                      isExpanded ? 'is-row-expanded' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={(event) => {
                      if (isInteractiveTableTarget(event.target)) return;
                      toggleExpanded(client.id);
                    }}
                  >
                    {COLD_TABLE_COLUMN_ORDER.map((colId) => renderCell(client, colId))}
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
  );

  return (
    <>
      <TopHeader onQuickAdd={openNew} />
      <div className="content-body is-cold-section">
        <section className="app-section active">
          <div className="table-filter-bar">
            <div className="filter-left">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Cerca cliente freddo o contatto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="filter-group">
                <select className="filter-select" value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
                  <option value="">Tutti gli Owner</option>
                  {OWNERS.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                </select>
              </div>
            </div>
            <div className="filter-right">
              <span className="quick-stats-badge">{filtered.length} clienti freddi</span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSearch('');
                  setFilterOwner('');
                }}
              >
                <FilterX size={16} />
                <span>Resetta</span>
              </button>
            </div>
          </div>
          <p className="cold-section-hint">
            Prospect con cui non avete <strong>mai lavorato</strong>. I clienti importati da OKR/Excel restano in Lista Clienti.
            Se imposti <strong>Fatturato 2026</strong> &gt; €1, il cliente passa alla lista principale.
          </p>
          <div className="cold-clients-accordion">
            {COLD_CLIENT_CATEGORIES.map((category) => {
              const categoryClients = filtered.filter((client) => client.type === category.type);
              const isExpanded = expandedCategories.has(category.id);
              return (
                <div key={category.id} className={`cold-category${isExpanded ? ' is-expanded' : ''}`}>
                  <div className="cold-category-header">
                    <button
                      type="button"
                      className="cold-category-toggle"
                      onClick={() => toggleCategory(category.id)}
                      aria-expanded={isExpanded}
                    >
                      <ChevronRight className="cold-category-chevron" aria-hidden="true" />
                      <div className="cold-category-title-wrap">
                        <h3>{category.label}</h3>
                        <span className="cold-category-type-hint">{category.type}</span>
                      </div>
                      <span className="badge cold-category-count">{categoryClients.length}</span>
                    </button>
                  </div>
                  {isExpanded ? (
                    <div className="cold-category-body">
                      {renderCategoryTable(categoryClients)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="table-footer cold-section-footer">
            <div className="table-info">
              Mostrati {filtered.length} di {totalCold} clienti freddi
            </div>
          </div>
        </section>
      </div>
      {drawerOpen && (
        <ClientDrawer client={editClient} isCold onClose={() => setDrawerOpen(false)} />
      )}
    </>
  );
}
