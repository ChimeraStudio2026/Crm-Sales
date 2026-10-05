'use client';

import { useEffect, useMemo, useState } from 'react';
import { GitMerge, Plus, X } from 'lucide-react';
import { ClientSearchSelect } from '@/components/clients/client-search-select';
import { normalizeAliasKey } from '@/lib/crm/client-duplicates';
import { isClientInWorkspace } from '@/lib/crm/workspace-access';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import {
  deleteClientAlias,
  fetchClientAliases,
  upsertClientAlias,
} from '@/lib/supabase/client-aliases-database';
import type { ClientAlias } from '@/lib/supabase/client-aliases-database';
import type { Client } from '@/lib/types/crm';
import { useCrm } from '@/providers/crm-provider';

interface ClientAliasesCardProps {
  client: Client;
}

/**
 * Ragioni sociali collegate al cliente: le sync Cerbero e la scheda cliente le riconoscono
 * come lo stesso cliente. Da qui si possono aggiungere a mano o si può unire un altro cliente.
 */
export function ClientAliasesCard({ client }: ClientAliasesCardProps) {
  const { clients, mergeClients, showToast } = useCrm();
  const db = useMemo(() => createBrowserSupabaseClient(), []);
  const [aliases, setAliases] = useState<ClientAlias[]>([]);
  const [newAlias, setNewAlias] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    setAliases([]);
    setMergeSourceId('');
    if (!db) return;
    let cancelled = false;
    fetchClientAliases(db, client.id)
      .then((loaded) => {
        if (!cancelled) setAliases(loaded);
      })
      .catch((error) => console.error('Client aliases load failed:', error));
    return () => {
      cancelled = true;
    };
  }, [client.id, db]);

  const otherClients = useMemo(
    () => clients
      .filter((item) => item.id !== client.id && isClientInWorkspace(item, client.workspaceId))
      .sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [client.id, client.workspaceId, clients],
  );

  const handleAddAlias = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const aliasName = newAlias.trim();
    if (!db || !aliasName) return;
    if (normalizeAliasKey(aliasName) === normalizeAliasKey(client.name)) {
      showToast('È già il nome del cliente.', 'warning');
      return;
    }
    const existingClient = otherClients.find((item) => normalizeAliasKey(item.name) === normalizeAliasKey(aliasName));
    if (existingClient) {
      showToast(`"${existingClient.name}" esiste già come cliente: usa «Unisci un cliente qui».`, 'warning');
      setMergeSourceId(existingClient.id);
      return;
    }
    setIsWorking(true);
    try {
      const saved = await upsertClientAlias(db, client.id, aliasName);
      setAliases((prev) => [...prev.filter((alias) => alias.id !== saved.id), saved]
        .sort((left, right) => left.aliasName.localeCompare(right.aliasName, 'it')));
      setNewAlias('');
      showToast(`Ragione sociale "${saved.aliasName}" collegata.`, 'success');
    } catch (error) {
      showToast(`Errore: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
    } finally {
      setIsWorking(false);
    }
  };

  const handleRemoveAlias = async (alias: ClientAlias): Promise<void> => {
    if (!db || !window.confirm(`Scollegare "${alias.aliasName}" da questo cliente?`)) return;
    try {
      await deleteClientAlias(db, alias.id);
      setAliases((prev) => prev.filter((item) => item.id !== alias.id));
    } catch (error) {
      showToast(`Errore: ${error instanceof Error ? error.message : 'errore'}`, 'danger');
    }
  };

  const handleMerge = async (): Promise<void> => {
    const source = otherClients.find((item) => item.id === mergeSourceId);
    if (!source) return;
    const confirmed = window.confirm(
      `Unire "${source.name.trim()}" in "${client.name.trim()}"?\n\n`
      + 'Contatti, azioni, campagne, task, proposte creative, OKR e fatturato passano a questo cliente. '
      + `"${source.name.trim()}" diventa una sua ragione sociale e viene eliminato.`,
    );
    if (!confirmed) return;
    setIsWorking(true);
    try {
      await mergeClients(source.id, client.id);
      setMergeSourceId('');
      if (db) setAliases(await fetchClientAliases(db, client.id));
    } finally {
      setIsWorking(false);
    }
  };

  if (!db) return null;

  return (
    <div className="client-aliases">
      <div className="contacts-panel-header">
        <strong>Ragioni sociali collegate</strong>
      </div>
      <p className="client-aliases-hint">
        Altri nomi dello stesso cliente: le proposte e gli OKR da Cerbero intestati a questi nomi finiscono qui.
      </p>
      {aliases.length > 0 ? (
        <ul className="client-aliases-list">
          {aliases.map((alias) => (
            <li key={alias.id} className="client-alias-chip">
              <span>{alias.aliasName}</span>
              <button
                type="button"
                className="btn-contact-delete"
                title="Scollega ragione sociale"
                onClick={() => void handleRemoveAlias(alias)}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="contacts-panel-empty">Nessuna ragione sociale collegata.</p>
      )}
      <div className="client-aliases-tools">
        <form className="client-aliases-form" onSubmit={(event) => void handleAddAlias(event)}>
          <input
            className="form-input"
            placeholder="Aggiungi ragione sociale (es. Campari International Srl)"
            value={newAlias}
            onChange={(event) => setNewAlias(event.target.value)}
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={isWorking || !newAlias.trim()}>
            <Plus size={14} />
            <span>Collega</span>
          </button>
        </form>
        <div className="client-aliases-form">
          <ClientSearchSelect
            activeClients={otherClients}
            coldClients={[]}
            value={mergeSourceId}
            onChange={setMergeSourceId}
            placeholder="Unisci un cliente qui (cerca per nome)…"
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void handleMerge()}
            disabled={isWorking || !mergeSourceId}
          >
            <GitMerge size={14} />
            <span>Unisci qui</span>
          </button>
        </div>
      </div>
    </div>
  );
}
