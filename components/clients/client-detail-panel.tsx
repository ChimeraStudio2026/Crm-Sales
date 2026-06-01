'use client';

import { useEffect, useState } from 'react';
import { Plus, UserPlus, X } from 'lucide-react';
import { createUniqueId, formatActionDateDisplay } from '@/lib/crm/utils';
import type { Client, ClientContact } from '@/lib/types/crm';

interface ClientDetailPanelProps {
  client: Client;
  onUpdateContacts: (contacts: ClientContact[]) => Promise<void>;
  onUpdateAction: (action: string) => Promise<void>;
}

function createEmptyContact(): ClientContact {
  return {
    id: createUniqueId('contact'),
    email: '',
    name: '',
    role: '',
  };
}

export function ClientDetailPanel({
  client,
  onUpdateContacts,
  onUpdateAction,
}: ClientDetailPanelProps) {
  const [contacts, setContacts] = useState<ClientContact[]>(client.contacts);
  const [actionText, setActionText] = useState(client.action);
  const [isSavingAction, setIsSavingAction] = useState(false);

  useEffect(() => {
    setContacts(client.contacts.length > 0 ? client.contacts : [createEmptyContact()]);
    setActionText(client.action);
  }, [client.id, client.contacts, client.action]);

  const persistContacts = async (nextContacts: ClientContact[]) => {
    const filtered = nextContacts.filter(
      (contact) => contact.email.trim() || contact.name.trim() || contact.role.trim(),
    );
    setContacts(filtered.length > 0 ? nextContacts : [createEmptyContact()]);
    await onUpdateContacts(filtered);
  };

  const handleContactBlur = async () => {
    await persistContacts(contacts);
  };

  const handleAddContact = async () => {
    const nextContacts = [...contacts, createEmptyContact()];
    setContacts(nextContacts);
  };

  const handleDeleteContact = async (contactId: string) => {
    const nextContacts = contacts.filter((contact) => contact.id !== contactId);
    await persistContacts(nextContacts.length > 0 ? nextContacts : [createEmptyContact()]);
  };

  const handleSaveAction = async () => {
    setIsSavingAction(true);
    try {
      await onUpdateAction(actionText);
    } finally {
      setIsSavingAction(false);
    }
  };

  return (
    <div className="client-detail-panel" onClick={(event) => event.stopPropagation()}>
      <div className="client-actions-panel">
        <div className="client-actions-header">
          <strong>Sezione azione</strong>
          <span className="client-actions-hint">
            Data azione: {formatActionDateDisplay(client.actionDate)}
          </span>
        </div>
        <div className="client-actions-add-form client-action-single-form">
          <input
            type="text"
            className="contact-field-input action-log-text"
            value={actionText}
            onChange={(event) => setActionText(event.target.value)}
            placeholder="Descrivi l'azione svolta con questo cliente..."
            aria-label="Azione cliente"
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={isSavingAction}
            onClick={() => void handleSaveAction()}
          >
            <Plus size={14} />
            <span>{isSavingAction ? 'Salvo...' : 'Salva'}</span>
          </button>
        </div>
      </div>
      <div className="contacts-panel-section">
        <div className="contacts-panel-header">
          <strong>Sezione contatti</strong>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleAddContact()}>
            <UserPlus size={14} />
            <span>Aggiungi contatto</span>
          </button>
        </div>
        <div className="contacts-panel-list">
          {contacts.every(
            (contact) => !contact.email.trim() && !contact.name.trim() && !contact.role.trim(),
          ) ? (
            <p className="contacts-panel-empty">Nessun contatto. Aggiungine uno con il pulsante sopra.</p>
          ) : (
            contacts.map((contact) => (
              <div key={contact.id} className="contact-card">
                <div className="contact-card-header">
                  <span className="contact-card-title">Contatto</span>
                  <button
                    type="button"
                    className="btn-contact-delete"
                    title="Elimina contatto"
                    onClick={() => void handleDeleteContact(contact.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  className="contact-field-input"
                  value={contact.name}
                  onChange={(event) => {
                    setContacts((prev) =>
                      prev.map((item) =>
                        item.id === contact.id ? { ...item, name: event.target.value } : item,
                      ),
                    );
                  }}
                  onBlur={() => void handleContactBlur()}
                  placeholder="Nome"
                />
                <input
                  type="email"
                  className="contact-field-input"
                  value={contact.email}
                  onChange={(event) => {
                    setContacts((prev) =>
                      prev.map((item) =>
                        item.id === contact.id ? { ...item, email: event.target.value } : item,
                      ),
                    );
                  }}
                  onBlur={() => void handleContactBlur()}
                  placeholder="Mail"
                />
                <input
                  type="text"
                  className="contact-field-input"
                  value={contact.role}
                  onChange={(event) => {
                    setContacts((prev) =>
                      prev.map((item) =>
                        item.id === contact.id ? { ...item, role: event.target.value } : item,
                      ),
                    );
                  }}
                  onBlur={() => void handleContactBlur()}
                  placeholder="Posizione"
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
