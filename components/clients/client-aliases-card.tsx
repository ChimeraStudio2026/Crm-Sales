'use client';

import { useEffect, useMemo, useState } from 'react';
import { GitMerge, Layers, Plus, Unlink, X } from 'lucide-react';
import { ClientSearchSelect } from '@/components/clients/client-search-select';
import { normalizeAliasKey } from '@/lib/crm/client-duplicates';
import { formatCurrency } from '@/lib/crm/utils';
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

function totalRevenue(client: Client): number {
  return (client.rev2023 || 0) + (client.rev2024 || 0) + (client.rev2025 || 0) + (client.rev2026 || 0);
}

/**
 * Ragioni sociali del cliente (es. Campari): altri clienti raggruppati sotto questo, ciascuno con i suoi
 * dati, più eventuali ragioni sociali solo-nome per gli import Cerbero. A parte, l'unione dei duplicati
 * nati da un errore di nome, che elimina il cliente sbagliato.
 */
export function ClientAliasesCard({ client }: ClientAliasesCardProps) {
  const { clients, mergeClients, setClientParent, showToast } = useCrm();
  const db = useMemo(() => createBrowserSupabaseClient(), []);
  const [aliases, setAliases] = useState<ClientAlias[]>([]);
  const [groupClientId, setGroupClientId] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    setAliases([]);
    setGroupClientId('');
    setMergeSourceId('');
    if (!db) return;
    let cancelled = false;
    fetchClientAliases(db, client.id)
      .then((loaded) => {
        if (!cancelled) setAliases(loaded.filter((alias) => alias.kind === 'entity'));
      })
      .catch((error) => console.error('Client aliases load failed:', error));
    return () => {
      cancelled = true;
    };
  }, [client.id, db]);

  const parent = client.parentClientId
    ? clients.find((item) => item.id === client.parentClientId)
    : undefined;

  const children = useMemo(
    () => clients
      .filter((item) => item.parentClientId === client.id)
      .sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [client.id, clients],
  );

  const otherClients = useMemo(
    () => clients
      .filter((item) => item.id !== client.id && isClientInWorkspace(item, client.workspaceId))
      .sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [client.id, client.workspaceId, clients],
  );

  // Si possono raggruppare solo clienti che non sono già in un gruppo (né principali né ragioni sociali).
  const groupableClients = useMemo(
    () => otherClients.filter((item) => !item.parentClientId && !clients.some((other) => other.parentClientId === item.id)),
    [clients, otherClients],
  );

  const groupClient = async (target: Client): Promise<void> => {
    setIsWorking(true);
    try {
      await setClientParent(target.id, client.id);
      showToast(`"${target.name.trim()}" è ora una ragione sociale di "${client.name.trim()}".`, 'success');
      setGroupClientId('');
      setNewAlias('');
    } catch {
      // Il provider mostra già l'errore.
    } finally {
      setIsWorking(false);
    }
  };

  const handleGroupExisting = async (): Promise<void> => {
    const target = groupableClients.find((item) => item.id === groupClientId);
    if (target) await groupClient(target);
  };

  const handleAddAlias = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const aliasName = newAlias.trim();
    if (!db || !aliasName) return;
    if (normalizeAliasKey(aliasName) === normalizeAliasKey(client.name)) {
      showToast('È già il nome del cliente.', 'warning');
      return;
    }
    // Se la ragione sociale esiste già come cliente, la si raggruppa sotto questo invece di duplicarla.
    const existingClient = otherClients.find((item) => normalizeAliasKey(item.name) === normalizeAliasKey(aliasName));
    if (existingClient) {
      if (existingClient.parentClientId === client.id) {
        showToast(`"${existingClient.name.trim()}" è già una ragione sociale di questo cliente.`, 'info');
        return;
      }
      if (!groupableClients.some((item) => item.id === existingClient.id)) {
        showToast(`"${existingClient.name.trim()}" fa già parte di un altro gruppo: staccalo prima da lì.`, 'warning');
        return;
      }
      await groupClient(existingClient);
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

  const handleUngroup = async (target: Client): Promise<void> => {
    const groupName = (target.id === client.id ? parent?.name : client.name)?.trim() || 'gruppo';
    if (!window.confirm(`Staccare "${target.name.trim()}" da "${groupName}"? Torna un cliente a sé.`)) return;
    try {
      await setClientParent(target.id, null);
    } catch {
      // Il provider mostra già l'errore.
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
      `"${source.name.trim()}" è questo stesso cliente scritto male?\n\n`
      + `Contatti, azioni, campagne, task, proposte creative, OKR e fatturato passano a "${client.name.trim()}" `
      + `e "${source.name.trim()}" viene eliminato.`,
    );
    if (!confirmed) return;
    setIsWorking(true);
    try {
      await mergeClients(source.id, client.id);
      setMergeSourceId('');
    } finally {
      setIsWorking(false);
    }
  };

  if (!db) return null;

  if (parent) {
    return (
      <div className="client-aliases">
        <div className="contacts-panel-header">
          <strong>Ragioni sociali</strong>
        </div>
        <div className="client-group-parent">
          <Layers size={14} />
          <span>
            Ragione sociale del gruppo <strong>{parent.name.trim()}</strong>
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void handleUngroup(client)}
          >
            <Unlink size={13} />
            <span>Stacca dal gruppo</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="client-aliases">
      <div className="contacts-panel-header">
        <strong>Ragioni sociali del gruppo</strong>
      </div>
      <p className="client-aliases-hint">
        Società diverse dello stesso cliente (es. Campari): restano clienti distinti, raggruppati qui.
        Le proposte Cerbero di tutto il gruppo si vedono in questa scheda.
      </p>
      {children.length > 0 || aliases.length > 0 ? (
        <ul className="client-group-list">
          {children.map((child) => (
            <li key={child.id} className="client-group-item">
              <span className="client-group-name">{child.name.trim()}</span>
              <span className="client-group-meta">
                {formatCurrency(totalRevenue(child))} · {child.contacts.length} contatti
              </span>
              <button
                type="button"
                className="btn-contact-delete"
                title="Stacca dal gruppo"
                onClick={() => void handleUngroup(child)}
              >
                <X size={12} />
              </button>
            </li>
          ))}
          {aliases.map((alias) => (
            <li key={alias.id} className="client-group-item">
              <span className="client-group-name">{alias.aliasName}</span>
              <span className="client-group-meta">solo nome, per gli import</span>
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
        <p className="contacts-panel-empty">Nessuna altra ragione sociale nel gruppo.</p>
      )}
      <div className="client-aliases-tools">
        <div className="client-aliases-form">
          <ClientSearchSelect
            activeClients={groupableClients}
            coldClients={[]}
            value={groupClientId}
            onChange={setGroupClientId}
            placeholder="Aggiungi un cliente esistente al gruppo…"
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void handleGroupExisting()}
            disabled={isWorking || !groupClientId}
          >
            <Layers size={14} />
            <span>Raggruppa</span>
          </button>
        </div>
        <form className="client-aliases-form" onSubmit={(event) => void handleAddAlias(event)}>
          <input
            className="form-input"
            placeholder="Oppure scrivi una ragione sociale non ancora nel CRM"
            value={newAlias}
            onChange={(event) => setNewAlias(event.target.value)}
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={isWorking || !newAlias.trim()}>
            <Plus size={14} />
            <span>Collega</span>
          </button>
        </form>
      </div>
      <div className="contacts-panel-header client-aliases-merge-head">
        <strong>Duplicato per errore di nome</strong>
      </div>
      <p className="client-aliases-hint">
        Se un altro cliente è questo stesso scritto male, uniscilo qui: gli passa tutto e viene eliminato.
      </p>
      <div className="client-aliases-form">
        <ClientSearchSelect
          activeClients={otherClients}
          coldClients={[]}
          value={mergeSourceId}
          onChange={setMergeSourceId}
          placeholder="Cerca il cliente scritto male…"
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void handleMerge()}
          disabled={isWorking || !mergeSourceId}
        >
          <GitMerge size={14} />
          <span>Unisci ed elimina</span>
        </button>
      </div>
    </div>
  );
}
