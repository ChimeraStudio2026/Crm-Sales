'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CLIENT_TYPES } from '@/lib/constants/crm';
import { isClientInColdSection, isClientInMainList } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import type { FunnelClientRef, FunnelClientSource } from '@/lib/types/commercial-funnel';

type FunnelPickerTab = 'cold' | 'main';

interface FunnelClientPickerProps {
  existingClientIds: Set<string>;
  onClose: () => void;
  onAdd: (refs: FunnelClientRef[]) => void;
}

export function FunnelClientPicker({
  existingClientIds,
  onClose,
  onAdd,
}: FunnelClientPickerProps) {
  const { clients } = useCrm();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeTab, setActiveTab] = useState<FunnelPickerTab>('cold');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const clientSource: FunnelClientSource = activeTab === 'main' ? 'main' : 'cold';

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients
      .filter((client) => (
        activeTab === 'cold'
          ? isClientInColdSection(client)
          : isClientInMainList(client)
      ))
      .filter((client) => !existingClientIds.has(client.id))
      .filter((client) => !typeFilter || client.type === typeFilter)
      .filter((client) => {
        if (!query) return true;
        return [
          client.name,
          client.type,
          client.owner,
          client.relationship,
          ...client.contacts.flatMap((contact) => [contact.name, contact.email]),
        ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [activeTab, clients, existingClientIds, search, typeFilter]);

  const toggleRow = (clientId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const selectAllVisible = (): void => {
    setSelectedIds(new Set(rows.map((row) => row.id)));
  };

  const handleTabChange = (tab: FunnelPickerTab): void => {
    setActiveTab(tab);
    setSelectedIds(new Set());
  };

  const handleSubmit = (): void => {
    onAdd([...selectedIds].map((clientId) => ({ clientId, clientSource })));
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} />
      <div className="drawer open mail-contact-picker-drawer">
        <div className="drawer-header"><h3>Aggiungi clienti alla campagna</h3></div>
        <div className="drawer-body">
          <div className="funnel-picker-tabs">
            <button
              type="button"
              className={`funnel-picker-tab${activeTab === 'cold' ? ' is-active' : ''}`}
              onClick={() => handleTabChange('cold')}
            >
              Clienti freddi
            </button>
            <button
              type="button"
              className={`funnel-picker-tab${activeTab === 'main' ? ' is-active' : ''}`}
              onClick={() => handleTabChange('main')}
            >
              Lista clienti
            </button>
          </div>
          <div className="mail-picker-toolbar">
            <div className="search-box">
              <Search size={18} />
              <input
                className="search-input"
                placeholder="Cerca cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Tutte le tipologie</option>
              {CLIENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllVisible}>
              Seleziona tutti ({rows.length})
            </button>
          </div>
          <p className="mail-picker-hint">
            {activeTab === 'cold'
              ? 'Clienti freddi: se convertiti passano in Lista Clienti. Se persi restano nel funnel.'
              : 'Lista clienti: il cliente resta sempre in Lista Clienti, anche se convertito o perso nella campagna.'}
          </p>
          <div className="mail-picker-list">
            {rows.length === 0 ? (
              <p className="mail-campaigns-empty">Nessun cliente disponibile con i filtri attuali.</p>
            ) : (
              rows.map((client) => (
                <label
                  key={client.id}
                  className={`mail-picker-row${selectedIds.has(client.id) ? ' is-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(client.id)}
                    onChange={() => toggleRow(client.id)}
                  />
                  <div className="mail-picker-row-body">
                    <strong>{client.name}</strong>
                    <span>{client.type} · {client.owner}</span>
                    <small>
                      {client.contacts.length > 0
                        ? client.contacts.map((contact) => contact.email || contact.name).join(', ')
                        : 'Nessun contatto'}
                    </small>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
        <div className="drawer-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedIds.size === 0}
            onClick={handleSubmit}
          >
            Aggiungi {selectedIds.size} clienti
          </button>
        </div>
      </div>
    </>
  );
}
