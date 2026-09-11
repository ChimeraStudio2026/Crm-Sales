'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { flattenClientContacts, getCampaignEligibleClients } from '@/lib/mail-campaigns/index';
import { RELATIONSHIPS } from '@/lib/constants/crm';
import { useCrm } from '@/providers/crm-provider';
import type { MailCampaignContact, MailCampaignContactRef } from '@/lib/types/mail-campaigns';

interface CampaignContactPickerProps {
  campaignId: string;
  existingContacts: MailCampaignContact[];
  onClose: () => void;
  onAdd: (refs: MailCampaignContactRef[]) => void;
}

export function CampaignContactPicker({
  existingContacts,
  onClose,
  onAdd,
}: CampaignContactPickerProps) {
  const { clients } = useCrm();
  const [search, setSearch] = useState('');
  const [relationshipFilter, setRelationshipFilter] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const existingKeys = useMemo(
    () => new Set(existingContacts.map((contact) => `${contact.clientId}:${contact.contactId}`)),
    [existingContacts],
  );

  const eligibleClients = useMemo(
    () => getCampaignEligibleClients(clients),
    [clients],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return flattenClientContacts(eligibleClients)
      .filter((row) => !existingKeys.has(`${row.clientId}:${row.contactId}`))
      .filter((row) => {
        if (relationshipFilter && row.relationshipLabel !== relationshipFilter) {
          const client = clients.find((item) => item.id === row.clientId);
          return client?.relationship === relationshipFilter;
        }
        return true;
      })
      .filter((row) => !query || [
        row.clientName,
        row.contactName,
        row.contactEmail,
        row.relationshipLabel,
      ].some((value) => value.toLowerCase().includes(query)));
  }, [eligibleClients, existingKeys, search, relationshipFilter, clients]);

  const toggleRow = (key: string): void => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllVisible = (): void => {
    setSelectedKeys(new Set(rows.map((row) => `${row.clientId}:${row.contactId}`)));
  };

  const handleSubmit = (): void => {
    const refs = [...selectedKeys].map((key) => {
      const [clientId, contactId] = key.split(':');
      return { clientId, contactId };
    });
    onAdd(refs);
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} />
      <div className="drawer open mail-contact-picker-drawer">
        <div className="drawer-header"><h3>Aggiungi Contatti alla Campagna</h3></div>
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
              value={relationshipFilter}
              onChange={(e) => setRelationshipFilter(e.target.value)}
            >
              <option value="">Tutti i rapporti</option>
              {RELATIONSHIPS.filter((item) => item !== 'Eliminato').map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllVisible}>
              Seleziona tutti ({rows.length})
            </button>
          </div>
          <p className="mail-picker-hint">
            Tutti i clienti attivi sono disponibili, inclusi quelli freddi e con qualsiasi rapporto.
          </p>
          <div className="mail-picker-list">
            {rows.length === 0 ? (
              <p className="mail-campaigns-empty">Nessun contatto disponibile con i filtri attuali.</p>
            ) : (
              rows.map((row) => {
                const key = `${row.clientId}:${row.contactId}`;
                return (
                  <label key={key} className={`mail-picker-row${selectedKeys.has(key) ? ' is-selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      onChange={() => toggleRow(key)}
                    />
                    <div className="mail-picker-row-body">
                      <strong>{row.clientName}</strong>
                      <span>{row.contactName}{row.contactEmail ? ` · ${row.contactEmail}` : ''}</span>
                      <small>{row.relationshipLabel}</small>
                    </div>
                  </label>
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
            disabled={selectedKeys.size === 0}
            onClick={handleSubmit}
          >
            Aggiungi {selectedKeys.size} contatti
          </button>
        </div>
      </div>
    </>
  );
}
