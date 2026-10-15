'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers, Unlink, X } from 'lucide-react';
import { ClientSearchSelect } from '@/components/clients/client-search-select';
import { formatCurrency } from '@/lib/crm/utils';
import { isClientInWorkspace } from '@/lib/crm/workspace-access';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { deleteClientAlias, fetchClientAliases } from '@/lib/supabase/client-aliases-database';
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
 * Macro cliente: le ragioni sociali di un cliente si mettono sotto un macro cliente scelto tra
 * gli esistenti. Una ragione sociale perde le sue proprietà: rapporto, owner, fatturato e OKR
 * sono quelli del macro cliente.
 */
export function ClientAliasesCard({ client }: ClientAliasesCardProps) {
  const { clients, setClientParent, showToast } = useCrm();
  const db = useMemo(() => createBrowserSupabaseClient(), []);
  const [aliases, setAliases] = useState<ClientAlias[]>([]);
  const [macroId, setMacroId] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    setAliases([]);
    setMacroId('');
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

  const macro = client.parentClientId
    ? clients.find((item) => item.id === client.parentClientId)
    : undefined;

  const children = useMemo(
    () => clients
      .filter((item) => item.parentClientId === client.id)
      .sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [client.id, clients],
  );

  // Un macro cliente è sempre un cliente «in cima»: non una ragione sociale di un altro.
  const macroCandidates = useMemo(
    () => clients
      .filter((item) => item.id !== client.id && !item.parentClientId && isClientInWorkspace(item, client.workspaceId))
      .sort((left, right) => left.name.localeCompare(right.name, 'it')),
    [client.id, client.workspaceId, clients],
  );

  const handleSetMacro = async (): Promise<void> => {
    const target = macroCandidates.find((item) => item.id === macroId);
    if (!target) return;
    const movedChildren = children.length > 0
      ? `\n\nAnche le sue ${children.length} ragioni sociali passano sotto "${target.name.trim()}".`
      : '';
    const confirmed = window.confirm(
      `Mettere "${client.name.trim()}" sotto il macro cliente "${target.name.trim()}"?\n\n`
      + `"${client.name.trim()}" perde le sue proprietà: rapporto, owner, fatturato e OKR contano su `
      + `"${target.name.trim()}" e non compare più come cliente a sé nella lista.${movedChildren}`,
    );
    if (!confirmed) return;
    setIsWorking(true);
    try {
      await setClientParent(client.id, target.id);
      showToast(`"${client.name.trim()}" ora fa parte di "${target.name.trim()}".`, 'success');
      setMacroId('');
    } catch {
      // Il provider mostra già l'errore.
    } finally {
      setIsWorking(false);
    }
  };

  const handleDetach = async (target: Client): Promise<void> => {
    const macroName = (target.id === client.id ? macro?.name : client.name)?.trim() || 'macro cliente';
    if (!window.confirm(`Togliere "${target.name.trim()}" da "${macroName}"? Torna un cliente a sé, con rapporto calcolato sul suo fatturato.`)) return;
    setIsWorking(true);
    try {
      await setClientParent(target.id, null);
      showToast(`"${target.name.trim()}" è di nuovo un cliente a sé.`, 'success');
    } catch {
      // Il provider mostra già l'errore.
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

  if (!db) return null;

  if (macro) {
    return (
      <div className="client-aliases">
        <div className="contacts-panel-header">
          <strong>Macro cliente</strong>
        </div>
        <div className="client-group-parent">
          <Layers size={14} />
          <span>
            Ragione sociale di <strong>{macro.name.trim()}</strong>: rapporto, owner, fatturato e OKR contano sul macro cliente.
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void handleDetach(client)}
            disabled={isWorking}
          >
            <Unlink size={13} />
            <span>Togli dal macro</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="client-aliases">
      <div className="contacts-panel-header">
        <strong>Macro cliente</strong>
      </div>
      {children.length > 0 || aliases.length > 0 ? (
        <>
          <p className="client-aliases-hint">
            È un macro cliente: fatturato, OKR e rapporto qui sotto valgono per tutto il gruppo.
          </p>
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
                  title="Togli dal macro cliente"
                  onClick={() => void handleDetach(child)}
                  disabled={isWorking}
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
        </>
      ) : (
        <p className="client-aliases-hint">
          Se questo cliente è una ragione sociale di un altro, mettilo sotto il suo macro cliente:
          da lì il CRM ragiona solo sul macro.
        </p>
      )}
      <div className="client-aliases-form">
        <ClientSearchSelect
          activeClients={macroCandidates}
          coldClients={[]}
          value={macroId}
          onChange={setMacroId}
          placeholder="Metti sotto un macro cliente…"
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void handleSetMacro()}
          disabled={isWorking || !macroId}
        >
          <Layers size={14} />
          <span>Unisci</span>
        </button>
      </div>
    </div>
  );
}
