'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { CLIENT_ORIGINS, CLIENT_TYPES, OWNERS, RELATIONSHIPS } from '@/lib/constants/crm';
import { createUniqueId } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import type { Client, ClientContact, Owner } from '@/lib/types/crm';

interface ClientDrawerProps {
  client: Client | null;
  isCold: boolean;
  onClose: () => void;
}

export function ClientDrawer({ client, isCold, onClose }: ClientDrawerProps) {
  const { saveClient, enrichClientApollo } = useCrm();
  const [name, setName] = useState('');
  const [type, setType] = useState(CLIENT_TYPES[0]);
  const [owner, setOwner] = useState<Owner>('Jeck');
  const [clientOrigin, setClientOrigin] = useState<Client['clientOrigin']>('');
  const [relationship, setRelationship] = useState<Client['relationship']>('Nuovo Cliente');
  const [rev2025, setRev2025] = useState(0);
  const [rev2026, setRev2026] = useState(0);
  const [description, setDescription] = useState('');
  const [action, setAction] = useState('');
  const [contacts, setContacts] = useState<ClientContact[]>([{ id: createUniqueId('contact'), email: '', name: '', role: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setType(client.type);
      setOwner(client.owner);
      setClientOrigin(client.clientOrigin || '');
      setRelationship(client.relationship);
      setRev2025(client.rev2025);
      setRev2026(client.rev2026);
      setDescription(client.description);
      setAction(client.action);
      setContacts(client.contacts.length > 0 ? client.contacts : [{ id: createUniqueId('contact'), email: '', name: '', role: '' }]);
    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await saveClient(
        {
          id: client?.id,
          name,
          type,
          owner,
          clientOrigin,
          relationship,
          rev2025,
          rev2026,
          description,
          action,
          contacts,
          manualRelationship: client?.manualRelationship ?? false,
        },
        { isEdit: !!client, id: client?.id, isCold },
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} aria-hidden />
      <div className="drawer open" id="client-drawer">
        <div className="drawer-header">
          <h3>{client ? 'Modifica Cliente' : 'Aggiungi Cliente'}</h3>
          <div className="drawer-close" onClick={onClose} role="button" tabIndex={0}>
            <X size={20} />
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="drawer-body">
            <div className="form-group">
              <label htmlFor="form-name">Nome Cliente *</label>
              <input id="form-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="form-type">Tipologia</label>
              <select id="form-type" className="form-select" value={type} onChange={(e) => setType(e.target.value as Client['type'])}>
                {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="form-owner">Owner</label>
              <select id="form-owner" className="form-select" value={owner} onChange={(e) => setOwner(e.target.value as Client['owner'])}>
                {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="form-client-origin">Origine Cliente</label>
              <select
                id="form-client-origin"
                className="form-select"
                value={clientOrigin}
                onChange={(e) => setClientOrigin(e.target.value as Client['clientOrigin'])}
              >
                <option value="">Seleziona origine</option>
                {CLIENT_ORIGINS.map((origin) => <option key={origin} value={origin}>{origin}</option>)}
              </select>
            </div>
            {!isCold && (
              <>
                <div className="form-group">
                  <label htmlFor="form-relationship">Stato Rapporto</label>
                  <select id="form-relationship" className="form-select" value={relationship} onChange={(e) => setRelationship(e.target.value as Client['relationship'])}>
                    {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="form-rev-2025">Fatturato 2025 (€)</label>
                  <input id="form-rev-2025" type="number" className="form-input" value={rev2025} min={0} step={0.01} onChange={(e) => setRev2025(parseFloat(e.target.value) || 0)} />
                </div>
              </>
            )}
            <div className="form-group">
              <label htmlFor="form-rev-2026">Fatturato 2026 (€)</label>
              <input id="form-rev-2026" type="number" className="form-input" value={rev2026} min={0} step={0.01} onChange={(e) => setRev2026(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group">
              <label>Contatti</label>
              {contacts.map((contact, index) => (
                <div key={contact.id} className="form-contact-row-inline">
                  <input className="form-input" placeholder="Nome" value={contact.name} onChange={(e) => {
                    const next = [...contacts];
                    next[index] = { ...contact, name: e.target.value };
                    setContacts(next);
                  }} />
                  <input className="form-input" placeholder="Mail" value={contact.email} onChange={(e) => {
                    const next = [...contacts];
                    next[index] = { ...contact, email: e.target.value };
                    setContacts(next);
                  }} />
                  <input className="form-input" placeholder="Posizione" value={contact.role} onChange={(e) => {
                    const next = [...contacts];
                    next[index] = { ...contact, role: e.target.value };
                    setContacts(next);
                  }} />
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setContacts([...contacts, { id: createUniqueId('contact'), email: '', name: '', role: '' }])}>
                Aggiungi contatto
              </button>
            </div>
            <div className="form-group">
              <label htmlFor="form-relationship-note">Nota rapporto</label>
              <textarea id="form-relationship-note" className="form-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="form-action">Azione Eseguita</label>
              <input id="form-action" className="form-input" value={action} onChange={(e) => setAction(e.target.value)} />
            </div>
          </div>
          <div className="drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
            {client ? (
              <button
                type="button"
                className="btn btn-secondary btn-apollo-drawer"
                onClick={() => void enrichClientApollo(client.id)}
              >
                <Sparkles size={16} />
                <span>Apollo</span>
              </button>
            ) : null}
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Salvataggio...' : 'Salva Cliente'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
