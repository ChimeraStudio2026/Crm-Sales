'use client';

import { useState } from 'react';
import { Layers, X } from 'lucide-react';
import {
  DUPLICATE_REASON_LABELS,
  suggestPrimaryClient,
} from '@/lib/crm/client-duplicates';
import type { DuplicateCandidate } from '@/lib/crm/client-duplicates';
import { formatCurrency } from '@/lib/crm/utils';
import { getClientTotalRevenue } from '@/lib/crm/revenue';
import type { Client } from '@/lib/types/crm';
import { useCrm } from '@/providers/crm-provider';

function totalRevenue(client: Client): number {
  return getClientTotalRevenue(client);
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
      <span className="duplicate-client-badge">{isPrimary ? 'Macro cliente' : 'Ragione sociale'}</span>
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
  onGroup,
  onDismiss,
}: {
  candidate: DuplicateCandidate;
  onGroup: (childId: string, parentId: string) => Promise<void>;
  onDismiss: (pairKey: string) => Promise<void>;
}) {
  const [primaryId, setPrimaryId] = useState(() => suggestPrimaryClient(candidate.first, candidate.second).id);
  const [isWorking, setIsWorking] = useState(false);
  const primary = primaryId === candidate.first.id ? candidate.first : candidate.second;
  const secondary = primary.id === candidate.first.id ? candidate.second : candidate.first;

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
          className="btn btn-primary btn-sm"
          onClick={() => void handleGroup()}
          disabled={isWorking}
          title="L'altro perde le sue proprietà: rapporto, owner, fatturato e OKR contano sul macro cliente"
        >
          <Layers size={14} />
          <span>Unisci sotto «{primary.name.trim()}»</span>
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
  const { clients, setClientParent, showToast } = useCrm();

  const handleGroup = async (childId: string, parentId: string): Promise<void> => {
    const child = clients.find((item) => item.id === childId);
    const parent = clients.find((item) => item.id === parentId);
    await setClientParent(childId, parentId);
    showToast(`"${child?.name.trim()}" ora fa parte del macro cliente "${parent?.name.trim()}".`, 'success');
    await onMerged();
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
            Clienti con nomi simili. Scegli quale è il <strong>macro cliente</strong> e unisci l&apos;altro sotto di
            lui: perde le sue proprietà e rapporto, owner, fatturato e OKR contano sul macro cliente.
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
