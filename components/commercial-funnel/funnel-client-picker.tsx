'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CLIENT_TYPES } from '@/lib/constants/crm';
import {
  getAvailableFunnelContacts,
  isFunnelClientFullyAdded,
} from '@/lib/commercial-funnel/contacts';
import { isClientInColdSection } from '@/lib/crm/utils';
import { FUNNEL_TRACK_LABELS, resolveClientFunnelTrack } from '@/lib/commercial-funnel/track';
import { isClientInWorkspace } from '@/lib/crm/workspace-access';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import type { FunnelClientRef, FunnelTrack } from '@/lib/types/commercial-funnel';

interface FunnelClientPickerProps {
  track: FunnelTrack;
  existingEntryKeys: Set<string>;
  onClose: () => void;
  onAdd: (refs: FunnelClientRef[]) => void;
}

export function FunnelClientPicker({
  track,
  existingEntryKeys,
  onClose,
  onAdd,
}: FunnelClientPickerProps) {
  const { clients } = useCrm();
  const { workspaceId } = useWorkspace();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedContactByClient, setSelectedContactByClient] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients
      .filter((client) => isClientInWorkspace(client, workspaceId))
      .filter((client) => resolveClientFunnelTrack(client) === track)
      .filter((client) => !isFunnelClientFullyAdded(client, existingEntryKeys))
      .filter((client) => !typeFilter || client.type === typeFilter)
      .filter((client) => {
        if (!query) return true;
        return [
          client.name,
          client.type,
          client.owner,
          client.relationship,
          ...client.contacts.flatMap((contact) => [contact.name, contact.email, contact.role]),
        ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [clients, existingEntryKeys, search, track, typeFilter, workspaceId]);

  const selectedClientIds = useMemo(
    () => new Set(Object.keys(selectedContactByClient)),
    [selectedContactByClient],
  );

  const toggleRow = (clientId: string): void => {
    setSelectedContactByClient((prev) => {
      if (prev[clientId] !== undefined) {
        const next = { ...prev };
        delete next[clientId];
        return next;
      }
      const client = clients.find((item) => item.id === clientId);
      if (!client) return prev;
      const availableContacts = getAvailableFunnelContacts(client, existingEntryKeys);
      if (availableContacts.length === 0) return prev;
      return {
        ...prev,
        [clientId]: availableContacts[0]?.id || '',
      };
    });
  };

  const updateContactSelection = (clientId: string, contactId: string): void => {
    setSelectedContactByClient((prev) => ({
      ...prev,
      [clientId]: contactId,
    }));
  };

  const selectAllVisible = (): void => {
    const next: Record<string, string> = {};
    rows.forEach((client) => {
      const availableContacts = getAvailableFunnelContacts(client, existingEntryKeys);
      if (availableContacts.length === 0) return;
      next[client.id] = availableContacts[0]?.id || '';
    });
    setSelectedContactByClient(next);
  };

  const handleSubmit = (): void => {
    const refs: FunnelClientRef[] = Object.entries(selectedContactByClient).map(([clientId, contactId]) => {
      const client = clients.find((item) => item.id === clientId);
      return {
        clientId,
        contactId,
        clientSource: client && isClientInColdSection(client) ? 'cold' : 'main',
      };
    });
    onAdd(refs);
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} />
      <div className="drawer open mail-contact-picker-drawer">
        <div className="drawer-header"><h3>Aggiungi clienti · {FUNNEL_TRACK_LABELS[track]}</h3></div>
        <div className="drawer-body">
          <div className="mail-picker-toolbar">
            <div className="search-box">
              <Search size={18} />
              <input
                className="search-input"
                placeholder="Cerca cliente o contatto..."
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
            {track === 'warm'
              ? 'Qui trovi solo clienti caldi (hanno fatturato almeno 1€). I clienti freddi vanno nelle campagne di Clienti freddi.'
              : 'Qui trovi solo clienti freddi (non hanno ancora fatturato). I clienti caldi vanno nelle campagne di Clienti caldi.'}
            {' '}Associa il contatto di riferimento per questa campagna.
          </p>
          <div className="mail-picker-list">
            {rows.length === 0 ? (
              <p className="mail-campaigns-empty">Nessun cliente disponibile con i filtri attuali.</p>
            ) : (
              rows.map((client) => {
                const availableContacts = getAvailableFunnelContacts(client, existingEntryKeys);
                const isSelected = selectedClientIds.has(client.id);
                const selectedContactId = selectedContactByClient[client.id]
                  ?? availableContacts[0]?.id
                  ?? '';
                return (
                  <div
                    key={client.id}
                    className={`mail-picker-row funnel-picker-row${isSelected ? ' is-selected' : ''}`}
                  >
                    <label className="funnel-picker-row-main">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(client.id)}
                      />
                      <div className="mail-picker-row-body">
                        <strong>
                          {client.name}
                          {isClientInColdSection(client) && (
                            <span className="funnel-cold-badge">Freddo</span>
                          )}
                        </strong>
                        <span>{client.type} · {client.owner}</span>
                        <small>
                          {client.contacts.length > 0
                            ? `${client.contacts.length} contatti associati`
                            : 'Nessun contatto strutturato'}
                        </small>
                      </div>
                    </label>
                    {isSelected && (
                      <div className="funnel-picker-contact-select-wrap">
                        <label className="funnel-picker-contact-label" htmlFor={`funnel-contact-${client.id}`}>
                          Contatto
                        </label>
                        <select
                          id={`funnel-contact-${client.id}`}
                          className="form-select funnel-picker-contact-select"
                          value={selectedContactId}
                          onChange={(event) => updateContactSelection(client.id, event.target.value)}
                        >
                          {availableContacts.map((contact) => (
                            <option key={contact.id || 'default'} value={contact.id}>
                              {contact.name.trim() || client.name}
                              {contact.email ? ` · ${contact.email}` : ''}
                              {contact.role ? ` · ${contact.role}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="drawer-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedClientIds.size === 0}
            onClick={handleSubmit}
          >
            Aggiungi {selectedClientIds.size} {selectedClientIds.size === 1 ? 'cliente' : 'clienti'}
          </button>
        </div>
      </div>
    </>
  );
}
