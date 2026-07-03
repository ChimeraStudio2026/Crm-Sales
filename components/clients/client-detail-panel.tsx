'use client';

import { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import type { ProductOfferId } from '@/lib/constants/product-offers';
import { getDefaultProductOfferIds, resolveClientProductOffers } from '@/lib/crm/product-offers';
import { createUniqueId } from '@/lib/crm/utils';
import { ProductOffersTags } from '@/components/clients/product-offers-tags';
import { SoldProductsTags } from '@/components/clients/sold-products-tags';
import { ClientMailCampaignsTab } from '@/components/mail-campaigns/client-mail-campaigns-tab';
import { useCrm } from '@/providers/crm-provider';
import type { Client, ClientContact } from '@/lib/types/crm';

type ClientDetailTab = 'overview' | 'campaigns';

interface ClientDetailPanelProps {
  client: Client;
  onUpdateContacts: (contacts: ClientContact[]) => Promise<void>;
  onUpdateProductOffers: (offerIds: ProductOfferId[]) => Promise<void>;
}

function createEmptyContact(): ClientContact {
  return {
    id: createUniqueId('contact'),
    email: '',
    name: '',
    role: '',
    phone: '',
  };
}

export function ClientDetailPanel({
  client,
  onUpdateContacts,
  onUpdateProductOffers,
}: ClientDetailPanelProps) {
  const { okrRecords } = useCrm();
  const [activeTab, setActiveTab] = useState<ClientDetailTab>('overview');
  const [contacts, setContacts] = useState<ClientContact[]>(client.contacts);
  const enabledOfferIds = resolveClientProductOffers(client.type, client.productOffers);

  useEffect(() => {
    setContacts(client.contacts.length > 0 ? client.contacts : [createEmptyContact()]);
    setActiveTab('overview');
  }, [client.id, client.contacts]);

  const persistContacts = async (nextContacts: ClientContact[]) => {
    const filtered = nextContacts.filter(
      (contact) =>
        contact.email.trim()
        || contact.name.trim()
        || contact.role.trim()
        || contact.phone.trim(),
    );
    const displayContacts = filtered.length > 0 ? nextContacts : [createEmptyContact()];
    setContacts(displayContacts);
    await onUpdateContacts(filtered);
  };

  const handleContactBlur = async () => {
    await persistContacts(contacts);
  };

  const handleAddContact = () => {
    setContacts((prev) => [...prev, createEmptyContact()]);
  };

  const handleDeleteContact = async (contactId: string) => {
    const nextContacts = contacts.filter((contact) => contact.id !== contactId);
    await persistContacts(nextContacts.length > 0 ? nextContacts : [createEmptyContact()]);
  };

  const handleToggleOffer = async (offerId: ProductOfferId) => {
    const applicable = getDefaultProductOfferIds(client.type);
    if (!applicable.includes(offerId)) return;
    const next = enabledOfferIds.includes(offerId)
      ? enabledOfferIds.filter((id) => id !== offerId)
      : [...enabledOfferIds, offerId];
    await onUpdateProductOffers(next);
  };

  return (
    <div className="client-detail-panel" onClick={(event) => event.stopPropagation()}>
      <div className="client-detail-tabs" role="tablist" aria-label="Sezioni scheda cliente">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          className={`client-detail-tab${activeTab === 'overview' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Panoramica
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'campaigns'}
          className={`client-detail-tab${activeTab === 'campaigns' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('campaigns')}
        >
          Campagne Funnel
        </button>
      </div>
      {activeTab === 'campaigns' ? (
        <ClientMailCampaignsTab clientId={client.id} />
      ) : (
        <>
      <div className="client-products-row">
        <ProductOffersTags
          client={client}
          enabledOfferIds={enabledOfferIds}
          onToggleOffer={handleToggleOffer}
        />
        <SoldProductsTags client={client} okrRecords={okrRecords} />
      </div>
      <div className="contacts-panel-section">
        <div className="contacts-panel-header">
          <strong>Sezione contatti</strong>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddContact}>
            <UserPlus size={14} />
            <span>Aggiungi contatto</span>
          </button>
        </div>
        <div className="contacts-panel-list">
          {contacts.length === 0 ? (
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
                  type="tel"
                  className="contact-field-input"
                  value={contact.phone}
                  onChange={(event) => {
                    setContacts((prev) =>
                      prev.map((item) =>
                        item.id === contact.id ? { ...item, phone: event.target.value } : item,
                      ),
                    );
                  }}
                  onBlur={() => void handleContactBlur()}
                  placeholder="Telefono"
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
        </>
      )}
    </div>
  );
}
