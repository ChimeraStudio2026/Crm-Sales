'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Client } from '@/lib/types/crm';

interface ClientSearchSelectProps {
  activeClients: Client[];
  coldClients: Client[];
  value: string;
  onChange: (clientId: string) => void;
  required?: boolean;
  placeholder?: string;
}

function filterClientsByQuery(clients: Client[], query: string): Client[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return clients;
  return clients.filter((client) => client.name.toLowerCase().includes(normalizedQuery));
}

export function ClientSearchSelect({
  activeClients,
  coldClients,
  value,
  onChange,
  required = false,
  placeholder = 'Cerca cliente per nome...',
}: ClientSearchSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const allClients = useMemo(
    () => [...activeClients, ...coldClients],
    [activeClients, coldClients],
  );
  const selectedClient = allClients.find((client) => client.id === value);
  const filteredActive = useMemo(
    () => filterClientsByQuery(activeClients, query),
    [activeClients, query],
  );
  const filteredCold = useMemo(
    () => filterClientsByQuery(coldClients, query),
    [coldClients, query],
  );
  const hasResults = filteredActive.length > 0 || filteredCold.length > 0;

  useEffect(() => {
    if (isOpen) return;
    setQuery(selectedClient?.name || '');
  }, [selectedClient?.name, value, isOpen]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleSelect = (client: Client): void => {
    onChange(client.id);
    setQuery(client.name);
    setIsOpen(false);
  };

  const handleInputChange = (nextQuery: string): void => {
    setQuery(nextQuery);
    setIsOpen(true);
    if (selectedClient && nextQuery.trim() !== selectedClient.name.trim()) {
      onChange('');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const firstMatch = filteredActive[0] || filteredCold[0];
      if (firstMatch) handleSelect(firstMatch);
    }
  };

  return (
    <div className="client-search-select" ref={rootRef}>
      <div className="client-search-input-wrap">
        <Search size={16} className="client-search-icon" aria-hidden="true" />
        <input
          type="text"
          className="form-input client-search-input"
          value={query}
          placeholder={placeholder}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="client-search-options"
        />
      </div>
      <input type="hidden" value={value} required={required} tabIndex={-1} aria-hidden="true" />
      {isOpen && (
        <div id="client-search-options" className="client-search-dropdown" role="listbox">
          {!hasResults ? (
            <p className="client-search-empty">Nessun cliente trovato.</p>
          ) : (
            <>
              {filteredActive.length > 0 ? (
                <div className="client-search-group">
                  <p className="client-search-group-label">Lista clienti</p>
                  {filteredActive.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      role="option"
                      aria-selected={client.id === value}
                      className={`client-search-option${client.id === value ? ' is-selected' : ''}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelect(client)}
                    >
                      {client.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {filteredCold.length > 0 ? (
                <div className="client-search-group">
                  <p className="client-search-group-label">Clienti freddi</p>
                  {filteredCold.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      role="option"
                      aria-selected={client.id === value}
                      className={`client-search-option${client.id === value ? ' is-selected' : ''}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelect(client)}
                    >
                      {client.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
