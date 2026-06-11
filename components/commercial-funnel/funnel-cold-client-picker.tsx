'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CLIENT_TYPES } from '@/lib/constants/crm';
import { isClientInColdSection } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';

interface FunnelColdClientPickerProps {
  existingClientIds: Set<string>;
  onClose: () => void;
  onAdd: (clientIds: string[]) => void;
}

export function FunnelColdClientPicker({
  existingClientIds,
  onClose,
  onAdd,
}: FunnelColdClientPickerProps) {
  const { clients } = useCrm();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients
      .filter((client) => isClientInColdSection(client))
      .filter((client) => !existingClientIds.has(client.id))
      .filter((client) => !typeFilter || client.type === typeFilter)
      .filter((client) => {
        if (!query) return true;
        return [
          client.name,
          client.type,
          client.owner,
          ...client.contacts.flatMap((contact) => [contact.name, contact.email]),
        ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [clients, existingClientIds, search, typeFilter]);

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

  const handleSubmit = (): void => {
    onAdd([...selectedIds]);
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} />
      <div className="drawer open mail-contact-picker-drawer">
        <div className="drawer-header"><h3>Aggiungi clienti freddi al funnel</h3></div>
        <div className="drawer-body">
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
            Solo clienti freddi non già presenti nel funnel commerciale.
          </p>
          <div className="mail-picker-list">
            {rows.length === 0 ? (
              <p className="mail-campaigns-empty">Nessun cliente freddo disponibile.</p>
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
