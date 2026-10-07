'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Search } from 'lucide-react';
import { resolveFunnelContactLabel } from '@/lib/commercial-funnel/contacts';
import { resolveFunnelSemaforo, resolveFunnelStageDisplay } from '@/lib/commercial-funnel/index';
import {
  DEFAULT_FUNNEL_CLIENT_SORT,
  readFunnelClientSort,
  writeFunnelClientSort,
  type FunnelClientSort,
  type FunnelClientSortKey,
} from '@/lib/commercial-funnel/preferences';
import { formatActionDateDisplay } from '@/lib/crm/utils';
import { FUNNEL_STAGES, type CommercialFunnelEntry, type FunnelStage } from '@/lib/types/commercial-funnel';
import type { Client } from '@/lib/types/crm';
import type { MailCampaign } from '@/lib/types/mail-campaigns';

interface FunnelClientsViewProps {
  entries: CommercialFunnelEntry[];
  clients: Client[];
  mailCampaigns: MailCampaign[];
  showCampaignColumn?: boolean;
}

interface FunnelClientRow {
  entry: CommercialFunnelEntry;
  client?: Client;
  campaign?: MailCampaign;
  stageDisplay: ReturnType<typeof resolveFunnelStageDisplay>;
  semaforo: 'green' | 'red';
  contactLabel: string;
}

const STAGE_META: Record<FunnelStage, { label: string; color: string }> = {
  'In contatto': { label: 'In contatto', color: '#58b5e7' },
  'Incontro fissato': { label: 'Incontro fissato', color: '#cd81fb' },
  'Preventivo richiesto': { label: 'Preventivo richiesto', color: '#e2c84a' },
  Convertito: { label: 'Convertito', color: '#6fa460' },
  Perso: { label: 'Perso', color: '#f64330' },
};

/** Colonne che partono dal più recente/rilevante al primo clic. */
const DESC_FIRST_KEYS = new Set<FunnelClientSortKey>(['lastAction']);

function compareRows(left: FunnelClientRow, right: FunnelClientRow, key: FunnelClientSortKey): number {
  switch (key) {
    case 'campaign':
      return (left.campaign?.name || '').localeCompare(right.campaign?.name || '', 'it');
    case 'stage':
      return FUNNEL_STAGES.indexOf(left.entry.stage) - FUNNEL_STAGES.indexOf(right.entry.stage);
    case 'owner':
      return entryOwnerLabel(left).localeCompare(entryOwnerLabel(right), 'it');
    case 'semaforo':
      // In crescente prima i rossi (fuori tempo).
      return (left.semaforo === 'red' ? 0 : 1) - (right.semaforo === 'red' ? 0 : 1);
    case 'lastAction':
      return (left.stageDisplay.date || '').localeCompare(right.stageDisplay.date || '');
    default:
      return (left.client?.name || '').localeCompare(right.client?.name || '', 'it');
  }
}

function FunnelStageBadge({ stage }: { stage: FunnelStage }) {
  const meta = STAGE_META[stage];
  return (
    <span
      className={`funnel-stage-badge funnel-stage-badge-${stage.replace(/\s+/g, '-').toLowerCase()}`}
      style={{ ['--funnel-stage-color' as string]: meta.color }}
    >
      {meta.label}
    </span>
  );
}

export function FunnelClientsView({
  entries,
  clients,
  mailCampaigns,
  showCampaignColumn = false,
}: FunnelClientsViewProps) {
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<FunnelClientSort>(DEFAULT_FUNNEL_CLIENT_SORT);

  // La preferenza vive in localStorage: si legge dopo il mount per non cambiare il markup SSR.
  useEffect(() => {
    setSort(readFunnelClientSort());
  }, []);

  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );
  const campaignById = useMemo(
    () => new Map(mailCampaigns.map((campaign) => [campaign.id, campaign])),
    [mailCampaigns],
  );

  const rows = useMemo((): FunnelClientRow[] => entries.map((entry) => {
    const client = clientById.get(entry.clientId);
    return {
      entry,
      client,
      campaign: campaignById.get(entry.campaignId),
      stageDisplay: resolveFunnelStageDisplay(entry),
      semaforo: resolveFunnelSemaforo(entry.actions),
      contactLabel: resolveFunnelContactLabel(client, entry.contactId),
    };
  }), [entries, clientById, campaignById]);

  const orderedRows = useMemo((): FunnelClientRow[] => {
    const direction = sort.direction === 'desc' ? -1 : 1;
    return [...rows].sort((left, right) => {
      // Senza data di ultima azione si finisce sempre in fondo.
      if (sort.key === 'lastAction' && !left.stageDisplay.date !== !right.stageDisplay.date) {
        return left.stageDisplay.date ? -1 : 1;
      }
      return compareRows(left, right, sort.key) * direction || compareRows(left, right, 'client');
    });
  }, [rows, sort]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orderedRows.filter((row) => {
      if (selectedStage && row.entry.stage !== selectedStage) return false;
      if (!query) return true;
      const clientName = row.client?.name || '';
      const campaignName = row.campaign?.name || '';
      return clientName.toLowerCase().includes(query)
        || campaignName.toLowerCase().includes(query)
        || row.entry.owner.toLowerCase().includes(query)
        || row.entry.stage.toLowerCase().includes(query);
    });
  }, [orderedRows, search, selectedStage]);

  const changeSort = (key: FunnelClientSortKey): void => {
    const next: FunnelClientSort = sort.key === key
      ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: DESC_FIRST_KEYS.has(key) ? 'desc' : 'asc' };
    setSort(next);
    writeFunnelClientSort(next);
  };

  const renderSortHead = (key: FunnelClientSortKey, label: string): React.ReactNode => {
    const isActive = sort.key === key;
    const Icon = !isActive ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        className={`funnel-client-view-sort-head${isActive ? ' is-active' : ''}`}
        onClick={() => changeSort(key)}
        aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
        title={`Ordina per ${label.toLowerCase()}`}
      >
        <span>{label}</span>
        <Icon size={12} className="funnel-client-view-sort-icon" />
      </button>
    );
  };

  const toggleStageFilter = (stage: FunnelStage): void => {
    setSelectedStage((current) => (current === stage ? null : stage));
  };

  const toggleExpanded = (entryId: string): void => {
    setExpandedEntries((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const renderExpandedBody = (row: FunnelClientRow): React.ReactNode => {
    const { entry, client } = row;
    const filledActions = entry.actions.filter((action) => action.type);
    return (
      <div className="funnel-client-view-expanded">
        <div className="funnel-client-view-expanded-meta">
          <span>Owner: {entry.owner || client?.owner || '—'}</span>
          <span>Contatto: {row.contactLabel}</span>
          {entry.clientSource === 'main' && <span>Lista principale</span>}
        </div>
        {entry.lostReason && (
          <p className="funnel-client-view-lost-reason">
            <strong>Motivo perdita:</strong> {entry.lostReason}
          </p>
        )}
        {filledActions.length > 0 ? (
          <ul className="funnel-client-view-actions">
            {filledActions.map((action, index) => (
              <li key={`${entry.id}-action-${index}`}>
                <strong>{action.type}</strong>
                {action.date ? ` · ${formatActionDateDisplay(action.date)}` : ''}
                {action.note ? ` · ${action.note}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="funnel-client-view-empty">Nessuna azione registrata.</p>
        )}
        {row.campaign && (
          <Link href={`/funnel/${row.campaign.id}`} className="funnel-client-view-link">
            Apri campagna
          </Link>
        )}
      </div>
    );
  };

  const renderListRow = (row: FunnelClientRow): React.ReactNode => {
    const isExpanded = expandedEntries.has(row.entry.id);
    const clientName = row.client?.name || 'Cliente non trovato';
    return (
      <div
        key={row.entry.id}
        className={`funnel-client-view-row${isExpanded ? ' is-expanded' : ''}`}
      >
        <button
          type="button"
          className="funnel-client-view-name"
          onClick={() => toggleExpanded(row.entry.id)}
        >
          <ChevronRight size={16} className={isExpanded ? 'is-expanded' : ''} />
          <span>{clientName}</span>
        </button>
        {showCampaignColumn && (
          <span className="funnel-client-view-campaign">{row.campaign?.name || '—'}</span>
        )}
        <FunnelStageBadge stage={row.entry.stage} />
        <span>{entryOwnerLabel(row)}</span>
        <span className="funnel-client-view-semaforo">
          <span
            className={`funnel-semaforo funnel-semaforo-${row.semaforo}`}
            title={row.semaforo === 'red' ? 'Fuori tempo' : 'Nei tempi'}
          />
        </span>
        <span>{row.stageDisplay.date ? formatActionDateDisplay(row.stageDisplay.date) : '—'}</span>
        {isExpanded && renderExpandedBody(row)}
      </div>
    );
  };

  return (
    <div className="funnel-client-view">
      <div className="table-filter-bar funnel-client-view-toolbar">
        <div className="filter-left">
          <div className="search-box">
            <Search size={18} />
            <input
              className="search-input"
              placeholder="Cerca cliente, campagna, owner..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="tasks-list-toolbar glass-card funnel-client-view-filters">
        <div className="tasks-status-filters" role="group" aria-label="Filtra per stage">
          <span className="tasks-filter-label">Stage:</span>
          {FUNNEL_STAGES.map((stage) => {
            const isSelected = selectedStage === stage;
            return (
              <button
                key={stage}
                type="button"
                aria-pressed={isSelected}
                className={`tasks-filter-btn funnel-stage-filter-btn${isSelected ? ' is-active' : ''}`}
                style={{ ['--funnel-stage-color' as string]: STAGE_META[stage].color }}
                onClick={() => toggleStageFilter(stage)}
              >
                {STAGE_META[stage].label}
              </button>
            );
          })}
          {selectedStage && (
            <button
              type="button"
              className="tasks-filter-reset"
              onClick={() => setSelectedStage(null)}
            >
              Mostra tutti
            </button>
          )}
        </div>
        <span className="funnel-client-view-count">{filteredRows.length} clienti</span>
      </div>
      {filteredRows.length === 0 ? (
        <p className="mail-campaigns-empty glass-card funnel-client-view-empty-state">
          Nessun cliente corrisponde ai filtri selezionati.
        </p>
      ) : (
        <div
          className={`funnel-client-view-list glass-card${showCampaignColumn ? ' has-campaign-column' : ''}`}
        >
          <div className="funnel-client-view-header">
            {renderSortHead('client', 'Cliente')}
            {showCampaignColumn && renderSortHead('campaign', 'Campagna')}
            {renderSortHead('stage', 'Stage')}
            {renderSortHead('owner', 'Owner')}
            {renderSortHead('semaforo', 'Semaforo')}
            {renderSortHead('lastAction', 'Ultima azione')}
          </div>
          {filteredRows.map((row) => renderListRow(row))}
        </div>
      )}
    </div>
  );
}

function entryOwnerLabel(row: FunnelClientRow): string {
  return row.entry.owner || row.client?.owner || '—';
}
