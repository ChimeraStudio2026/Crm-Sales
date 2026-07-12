'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Search } from 'lucide-react';
import { resolveFunnelContactLabel } from '@/lib/commercial-funnel/contacts';
import { resolveFunnelSemaforo, resolveFunnelStageDisplay } from '@/lib/commercial-funnel/index';
import { formatActionDateDisplay } from '@/lib/crm/utils';
import { FUNNEL_STAGES, type CommercialFunnelEntry, type FunnelStage } from '@/lib/types/commercial-funnel';
import type { Client } from '@/lib/types/crm';
import type { MailCampaign } from '@/lib/types/mail-campaigns';

type FunnelClientsViewMode = 'list' | 'board';

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
  'In contatto': { label: 'In contatto', color: '#3b82f6' },
  'Incontro fissato': { label: 'Incontro fissato', color: '#8b5cf6' },
  'Preventivo richiesto': { label: 'Preventivo richiesto', color: '#f59e0b' },
  Convertito: { label: 'Convertito', color: '#16a34a' },
  Perso: { label: 'Perso', color: '#dc2626' },
};

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
  const [viewMode, setViewMode] = useState<FunnelClientsViewMode>('list');
  const [search, setSearch] = useState('');
  const [hiddenStages, setHiddenStages] = useState<FunnelStage[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );
  const campaignById = useMemo(
    () => new Map(mailCampaigns.map((campaign) => [campaign.id, campaign])),
    [mailCampaigns],
  );
  const hiddenStageSet = useMemo(() => new Set(hiddenStages), [hiddenStages]);

  const rows = useMemo((): FunnelClientRow[] => entries
    .map((entry) => {
      const client = clientById.get(entry.clientId);
      return {
        entry,
        client,
        campaign: campaignById.get(entry.campaignId),
        stageDisplay: resolveFunnelStageDisplay(entry),
        semaforo: resolveFunnelSemaforo(entry.actions),
        contactLabel: resolveFunnelContactLabel(client, entry.contactId),
      };
    })
    .sort((left, right) => {
      const nameA = left.client?.name || '';
      const nameB = right.client?.name || '';
      return nameA.localeCompare(nameB, 'it');
    }), [entries, clientById, campaignById]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (hiddenStageSet.has(row.entry.stage)) return false;
      if (!query) return true;
      const clientName = row.client?.name || '';
      const campaignName = row.campaign?.name || '';
      return clientName.toLowerCase().includes(query)
        || campaignName.toLowerCase().includes(query)
        || row.entry.owner.toLowerCase().includes(query)
        || row.entry.stage.toLowerCase().includes(query);
    });
  }, [hiddenStageSet, rows, search]);

  const toggleHiddenStage = (stage: FunnelStage): void => {
    setHiddenStages((current) => (
      current.includes(stage)
        ? current.filter((item) => item !== stage)
        : [...current, stage]
    ));
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
      <div key={row.entry.id} className={`funnel-client-view-row${isExpanded ? ' is-expanded' : ''}`}>
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

  const renderBoardCard = (row: FunnelClientRow): React.ReactNode => {
    const clientName = row.client?.name || 'Cliente non trovato';
    return (
      <div key={row.entry.id} className="funnel-client-board-card">
        <div className="funnel-client-board-card-head">
          <strong>{clientName}</strong>
          <span
            className={`funnel-semaforo funnel-semaforo-${row.semaforo}`}
            title={row.semaforo === 'red' ? 'Fuori tempo' : 'Nei tempi'}
          />
        </div>
        {showCampaignColumn && (
          <span className="funnel-client-board-campaign">{row.campaign?.name || '—'}</span>
        )}
        <div className="funnel-client-board-meta">
          <span>{entryOwnerLabel(row)}</span>
          {row.stageDisplay.date && (
            <span>{formatActionDateDisplay(row.stageDisplay.date)}</span>
          )}
        </div>
        {row.entry.lostReason && row.entry.stage === 'Perso' && (
          <p className="funnel-client-board-note">{row.entry.lostReason}</p>
        )}
        {row.campaign && (
          <Link href={`/funnel/${row.campaign.id}`} className="funnel-client-board-link">
            Apri campagna
          </Link>
        )}
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
        <div className="filter-right">
          <div className="task-view-toggle" role="group" aria-label="Vista clienti funnel">
            <button
              type="button"
              className={`task-view-toggle-btn${viewMode === 'list' ? ' is-active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              Righe
            </button>
            <button
              type="button"
              className={`task-view-toggle-btn${viewMode === 'board' ? ' is-active' : ''}`}
              onClick={() => setViewMode('board')}
            >
              Kanban
            </button>
          </div>
        </div>
      </div>
      <div className="tasks-list-toolbar glass-card funnel-client-view-filters">
        <div className="tasks-status-filters" role="group" aria-label="Filtra per stage">
          <span className="tasks-filter-label">Nascondi stage:</span>
          {FUNNEL_STAGES.map((stage) => {
            const isHidden = hiddenStageSet.has(stage);
            return (
              <button
                key={stage}
                type="button"
                aria-pressed={isHidden}
                className={`tasks-filter-btn funnel-stage-filter-btn${isHidden ? ' is-excluded' : ''}`}
                onClick={() => toggleHiddenStage(stage)}
              >
                {STAGE_META[stage].label}
              </button>
            );
          })}
          {hiddenStages.length > 0 && (
            <button
              type="button"
              className="tasks-filter-reset"
              onClick={() => setHiddenStages([])}
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
      ) : viewMode === 'board' ? (
        <div className="kanban-board funnel-client-board">
          {FUNNEL_STAGES.filter((stage) => !hiddenStageSet.has(stage)).map((stage) => {
            const columnRows = filteredRows.filter((row) => row.entry.stage === stage);
            const meta = STAGE_META[stage];
            return (
              <div key={stage} className="kanban-column funnel-client-board-column">
                <div className="kanban-column-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: meta.color,
                        display: 'inline-block',
                      }}
                    />
                    <h3>{meta.label}</h3>
                  </div>
                  <span className="badge">{columnRows.length}</span>
                </div>
                <div className="kanban-cards-container">
                  {columnRows.map((row) => renderBoardCard(row))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`funnel-client-view-list glass-card${showCampaignColumn ? ' has-campaign-column' : ''}`}>
          <div className="funnel-client-view-header">
            <span>Cliente</span>
            {showCampaignColumn && <span>Campagna</span>}
            <span>Stage</span>
            <span>Owner</span>
            <span>Semaforo</span>
            <span>Ultima azione</span>
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
