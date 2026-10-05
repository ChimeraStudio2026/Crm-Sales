'use client';

import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { resolveCanonicalClientBrandName } from '@/lib/crm/client-brand-aliases';
import {
  formatProposalCurrency,
  formatProposalDateLabel,
  resolveProposalValue,
} from '@/lib/sales-proposals/stats';
import { useSalesProposals } from '@/lib/sales-proposals/use-sales-proposals';
import type { Client } from '@/lib/types/crm';
import type { SalesProposal } from '@/lib/types/sales-proposals';

/** Ordine degli stati come su Cerbero: prima le aperte, poi gli esiti. */
const STATUS_ORDER = ['Proposal Started', 'Quotation', 'Si', 'No'] as const;

const STATUS_LABELS: Record<string, string> = {
  'Proposal Started': 'Proposal Started',
  Quotation: 'Quotation',
  Si: 'Accettate (Si)',
  No: 'Rifiutate (No)',
};

function normalizeClientKey(name: string): string {
  return resolveCanonicalClientBrandName(name.trim().replace(/\s+/g, ' ')).toLowerCase();
}

function resolveStatusClassName(stato: string): string {
  if (stato === 'Si') return 'is-accepted';
  if (stato === 'No') return 'is-rejected';
  if (stato === 'Quotation') return 'is-quotation';
  return 'is-started';
}

function ProposalLine({ proposal }: { proposal: SalesProposal }) {
  const value = resolveProposalValue(proposal);
  return (
    <li className="client-proposal-line">
      <span className="client-proposal-name">{proposal.nome}</span>
      <span className="client-proposal-meta">
        {proposal.categoria || '—'}
        {' · '}
        {value === null ? 'nessun prezzo' : formatProposalCurrency(value)}
        {' · '}
        {formatProposalDateLabel(proposal.creatoIl)}
      </span>
    </li>
  );
}

interface ClientProposalsCardProps {
  client: Client;
}

export function ClientProposalsCard({ client }: ClientProposalsCardProps) {
  const { proposals, isLoading, error } = useSalesProposals(client.workspaceId);
  const [showAll, setShowAll] = useState(false);

  const clientProposals = useMemo(() => {
    const clientKey = normalizeClientKey(client.name);
    return proposals
      .filter((proposal) => proposal.cliente && normalizeClientKey(proposal.cliente) === clientKey)
      .sort((left, right) => right.creatoIl.localeCompare(left.creatoIl));
  }, [client.name, proposals]);

  const latest = clientProposals[0];
  const groups = useMemo(() => {
    const knownStatuses = new Set<string>(STATUS_ORDER);
    const statuses = [
      ...STATUS_ORDER,
      ...Array.from(new Set(clientProposals.map((proposal) => proposal.stato)))
        .filter((stato) => !knownStatuses.has(stato)),
    ];
    return statuses
      .map((stato) => ({
        stato,
        items: clientProposals.filter((proposal) => proposal.stato === stato),
      }))
      .filter((group) => group.items.length > 0);
  }, [clientProposals]);

  return (
    <div className="client-proposals">
      <div className="contacts-panel-header">
        <strong>Proposte</strong>
        {clientProposals.length > 0 && (
          <span className="client-proposals-count">{clientProposals.length} su Cerbero</span>
        )}
      </div>
      {isLoading ? (
        <p className="contacts-panel-empty">Caricamento proposte…</p>
      ) : error ? (
        <p className="contacts-panel-empty">Proposte non disponibili: {error}</p>
      ) : !latest ? (
        <p className="contacts-panel-empty">Nessuna proposta Cerbero per questo cliente.</p>
      ) : (
        <>
          <div className="client-proposal-latest">
            <div className="client-proposal-latest-head">
              <FileText size={15} />
              <span>Ultima proposta uscita</span>
              <span className={`proposal-status-pill ${resolveStatusClassName(latest.stato)}`}>{latest.stato}</span>
            </div>
            <ProposalLine proposal={latest} />
          </div>
          <div className="client-proposal-groups">
            {groups.map((group) => {
              const visibleItems = showAll ? group.items : group.items.slice(0, 3);
              return (
                <div key={group.stato} className="client-proposal-group">
                  <div className="client-proposal-group-head">
                    <span className={`proposal-status-pill ${resolveStatusClassName(group.stato)}`}>
                      {STATUS_LABELS[group.stato] || group.stato || 'Senza stato'}
                    </span>
                    <span className="client-proposals-count">{group.items.length}</span>
                  </div>
                  <ul>
                    {visibleItems.map((proposal) => (
                      <ProposalLine key={proposal.id} proposal={proposal} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          {groups.some((group) => group.items.length > 3) && (
            <button
              type="button"
              className="client-last-action-history-toggle"
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll ? 'Mostra meno' : 'Mostra tutte le proposte'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
