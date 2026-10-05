'use client';

import { useState } from 'react';
import { GitMerge, Layers, X } from 'lucide-react';
import {
  DUPLICATE_REASON_LABELS,
  suggestPrimaryClient,
} from '@/lib/crm/client-duplicates';
import type { DuplicateCandidate } from '@/lib/crm/client-duplicates';
import { formatCurrency } from '@/lib/crm/utils';
import type { Client } from '@/lib/types/crm';
import { useCrm } from '@/providers/crm-provider';

function totalRevenue(client: Client): number {
  return (client.rev2023 || 0) + (client.rev2024 || 0) + (client.rev2025 || 0) + (client.rev2026 || 0);
}

function ClientSummary({ client, isPrimary, onChoose }: { client: Client; isPrimary: boolean; onChoose: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isPrimary}
      className={`duplicate-client-option${isPrimary ? ' is-primary' : ''}`}
      onClick={onChoose}
    >
      <span className="duplicate-client-badge">{isPrimary ? 'Principale (resta)' : 'L’altro'}</span>
      <strong>{client.name.trim()}</strong>
      <span className="duplicate-client-meta">
        {client.type} · {client.owner} · {client.relationship}
      </span>
      <span className="duplicate-client-meta">
        Fatturato {formatCurrency(totalRevenue(client))} · {client.contacts.length} contatti
      </span>
    </button>
  );
}

function DuplicateCard({
  candidate,
  onMerge,
  onGroup,
  onDismiss,
}: {
  candidate: DuplicateCandidate;
  onMerge: (sourceId: string, targetId: string) => Promise<void>;
  onGroup: (childId: string, parentId: string) => Promise<void>;
  onDismiss: (pairKey: string) => Promise<void>;
}) {
  const [primaryId, setPrimaryId] = useState(() => suggestPrimaryClient(candidate.first, candidate.second).id);
  const [isWorking, setIsWorking] = useState(false);
  const primary = primaryId === candidate.first.id ? candidate.first : candidate.second;
  const secondary = primary.id === candidate.first.id ? candidate.second : candidate.first;

  const handleMerge = async (): Promise<void> => {
    const confirmed = window.confirm(
      `"${secondary.name.trim()}" è lo stesso cliente scritto male?\n\n`
      + `Contatti, azioni, campagne, task, proposte creative, OKR e fatturato passano a "${primary.name.trim()}" `
      + `e "${secondary.name.trim()}" viene eliminato.`,
    );
    if (!confirmed) return;
    setIsWorking(true);
    try {
      await onMerge(secondary.id, primary.id);
    } finally {
      setIsWorking(false);
    }
  };

  const handleGroup = async (): Promise<void> => {
    setIsWorking(true);
    try {
      await onGroup(secondary.id, primary.parentClientId || primary.id);
    } finally {
      setIsWorking(false);
    }
  };

  const handleDismiss = async (): Promise<void> => {
    setIsWorking(true);
    try {
      await onDismiss(candidate.pairKey);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="duplicate-card">
      <p className="duplicate-reason">{DUPLICATE_REASON_LABELS[candidate.reason]}</p>
      <div className="duplicate-clients" role="radiogroup" aria-label="Scegli il cliente principale">
        <ClientSummary
          client={candidate.first}
          isPrimary={primary.id === candidate.first.id}
          onChoose={() => setPrimaryId(candidate.first.id)}
        />
        <ClientSummary
          client={candidate.second}
          isPrimary={primary.id === candidate.second.id}
          onChoose={() => setPrimaryId(candidate.second.id)}
        />
      </div>
      <div className="duplicate-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleDismiss()} disabled={isWorking}>
          Clienti diversi
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void handleGroup()}
          disabled={isWorking}
          title="Restano due ragioni sociali distinte, raggruppate sotto il principale"
        >
          <Layers size={14} />
          <span>Ragione sociale del gruppo</span>
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void handleMerge()}
          disabled={isWorking}
          title="Errore di nome: tutto passa al principale e l'altro viene eliminato"
        >
          <GitMerge size={14} />
          <span>Stesso cliente: elimina «{secondary.name.trim()}»</span>
        </button>
      </div>
    </div>
  );
}

interface ClientDuplicatesDrawerProps {
  candidates: DuplicateCandidate[];
  isLoading: boolean;
  onDismiss: (pairKey: string) => Promise<void>;
  onMerged: () => Promise<void>;
  onClose: () => void;
}

export function ClientDuplicatesDrawer({
  candidates,
  isLoading,
  onDismiss,
  onMerged,
  onClose,
}: ClientDuplicatesDrawerProps) {
  const { clients, mergeClients, setClientParent, showToast } = useCrm();

  const handleMerge = async (sourceId: string, targetId: string): Promise<void> => {
    await mergeClients(sourceId, targetId);
    await onMerged();
  };

  const handleGroup = async (childId: string, parentId: string): Promise<void> => {
    const child = clients.find((item) => item.id === childId);
    const parent = clients.find((item) => item.id === parentId);
    if (clients.some((item) => item.parentClientId === childId)) {
      showToast(`"${child?.name.trim()}" ha già ragioni sociali sotto: scegli lui come principale.`, 'warning');
      return;
    }
    await setClientParent(childId, parentId);
    showToast(`"${child?.name.trim()}" è ora una ragione sociale di "${parent?.name.trim()}".`, 'success');
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} aria-hidden />
      <div className="drawer open duplicates-drawer">
        <div className="drawer-header">
          <h3>Possibili duplicati</h3>
          <div className="drawer-close" onClick={onClose} role="button" tabIndex={0}>
            <X size={20} />
          </div>
        </div>
        <div className="drawer-body">
          <p className="funnel-track-note">
            Clienti con nomi simili. Scegli quale è il principale, poi: <strong>Stesso cliente</strong> se
            l&apos;altro è un errore di nome (gli passa tutto e viene eliminato); <strong>Ragione sociale del
            gruppo</strong> se sono società diverse dello stesso cliente, come Campari (restano entrambe, raggruppate
            sotto il principale).
          </p>
          {isLoading ? (
            <p className="contacts-panel-empty">Ricerca duplicati…</p>
          ) : candidates.length === 0 ? (
            <p className="contacts-panel-empty">Nessun possibile duplicato da controllare.</p>
          ) : (
            <div className="duplicate-list">
              {candidates.map((candidate) => (
                <DuplicateCard
                  key={candidate.pairKey}
                  candidate={candidate}
                  onMerge={handleMerge}
                  onGroup={handleGroup}
                  onDismiss={onDismiss}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
