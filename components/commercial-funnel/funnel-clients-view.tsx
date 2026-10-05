'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronRight, GripVertical, Search } from 'lucide-react';
import { resolveFunnelContactLabel } from '@/lib/commercial-funnel/contacts';
import { resolveFunnelSemaforo, resolveFunnelStageDisplay } from '@/lib/commercial-funnel/index';
import {
  readFunnelClientOrder,
  readFunnelClientSortMode,
  writeFunnelClientOrder,
  writeFunnelClientSortMode,
  type FunnelClientSortMode,
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
  const [sortMode, setSortMode] = useState<FunnelClientSortMode>('alpha');
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Preferences live in localStorage, so read them after mount to keep SSR markup stable.
  useEffect(() => {
    setSortMode(readFunnelClientSortMode());
    setCustomOrder(readFunnelClientOrder());
  }, []);

  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );
  const campaignById = useMemo(
    () => new Map(mailCampaigns.map((campaign) => [campaign.id, campaign])),
    [mailCampaigns],
  );

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

  // Custom order: saved positions first, then entries not placed yet (new ones) in A–Z order.
  const orderedRows = useMemo((): FunnelClientRow[] => {
    if (sortMode !== 'custom') return rows;
    const position = new Map(customOrder.map((id, index) => [id, index]));
    return [...rows].sort((left, right) => {
      const posA = position.get(left.entry.id) ?? Number.MAX_SAFE_INTEGER;
      const posB = position.get(right.entry.id) ?? Number.MAX_SAFE_INTEGER;
      return posA - posB;
    });
  }, [rows, sortMode, customOrder]);

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

  const changeSortMode = (mode: FunnelClientSortMode): void => {
    setSortMode(mode);
    writeFunnelClientSortMode(mode);
  };

  const saveOrder = (nextIds: string[]): void => {
    // Keep ids of entries not shown here (other campaigns/filters) so their place is not lost.
    const shown = new Set(nextIds);
    const hidden = customOrder.filter((id) => !shown.has(id));
    const merged = [...nextIds, ...hidden];
    setCustomOrder(merged);
    writeFunnelClientOrder(merged);
  };

  /** Moves `entryId` to the slot of `targetId` within the full (unfiltered) ordered list. */
  const moveEntry = (entryId: string, targetId: string): void => {
    if (entryId === targetId) return;
    const ids = orderedRows.map((row) => row.entry.id);
    const from = ids.indexOf(entryId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, entryId);
    saveOrder(ids);
  };

  const moveEntryBy = (entryId: string, delta: -1 | 1): void => {
    const visibleIds = filteredRows.map((row) => row.entry.id);
    const index = visibleIds.indexOf(entryId);
    const target = visibleIds[index + delta];
    if (target) moveEntry(entryId, target);
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

  const renderListRow = (row: FunnelClientRow, index: number): React.ReactNode => {
    const isExpanded = expandedEntries.has(row.entry.id);
    const clientName = row.client?.name || 'Cliente non trovato';
    const isCustom = sortMode === 'custom';
    const entryId = row.entry.id;
    const rowClassName = [
      'funnel-client-view-row',
      isExpanded ? 'is-expanded' : '',
      isCustom ? 'is-sortable' : '',
      draggedEntryId === entryId ? 'is-dragging' : '',
      dropTargetId === entryId && draggedEntryId !== entryId ? 'is-drop-target' : '',
    ].filter(Boolean).join(' ');
    return (
      <div
        key={entryId}
        className={rowClassName}
        onDragOver={isCustom ? (event) => {
          if (!draggedEntryId) return;
          event.preventDefault();
          setDropTargetId(entryId);
        } : undefined}
        onDrop={isCustom ? (event) => {
          event.preventDefault();
          if (draggedEntryId) moveEntry(draggedEntryId, entryId);
          setDraggedEntryId(null);
          setDropTargetId(null);
        } : undefined}
      >
        {isCustom && (
          <span className="funnel-client-view-reorder">
            <span
              className="funnel-client-view-drag-handle"
              draggable
              role="button"
              tabIndex={-1}
              aria-label={`Trascina ${clientName}`}
              title="Trascina per riordinare"
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', entryId);
                setDraggedEntryId(entryId);
              }}
              onDragEnd={() => {
                setDraggedEntryId(null);
                setDropTargetId(null);
              }}
            >
              <GripVertical size={16} />
            </span>
            <button
              type="button"
              className="funnel-client-view-move-btn"
              onClick={() => moveEntryBy(entryId, -1)}
              disabled={index === 0}
              aria-label={`Sposta ${clientName} su`}
              title="Sposta su"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              className="funnel-client-view-move-btn"
              onClick={() => moveEntryBy(entryId, 1)}
              disabled={index === filteredRows.length - 1}
              aria-label={`Sposta ${clientName} giù`}
              title="Sposta giù"
            >
              <ArrowDown size={14} />
            </button>
          </span>
        )}
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
        <div className="funnel-client-view-sort" role="group" aria-label="Ordinamento clienti">
          <span className="tasks-filter-label">Ordine:</span>
          <button
            type="button"
            className={`funnel-client-view-sort-btn${sortMode === 'alpha' ? ' is-active' : ''}`}
            aria-pressed={sortMode === 'alpha'}
            onClick={() => changeSortMode('alpha')}
          >
            A–Z
          </button>
          <button
            type="button"
            className={`funnel-client-view-sort-btn${sortMode === 'custom' ? ' is-active' : ''}`}
            aria-pressed={sortMode === 'custom'}
            onClick={() => changeSortMode('custom')}
          >
            Personalizzato
          </button>
        </div>
        <span className="funnel-client-view-count">{filteredRows.length} clienti</span>
      </div>
      {filteredRows.length === 0 ? (
        <p className="mail-campaigns-empty glass-card funnel-client-view-empty-state">
          Nessun cliente corrisponde ai filtri selezionati.
        </p>
      ) : (
        <div
          className={`funnel-client-view-list glass-card${showCampaignColumn ? ' has-campaign-column' : ''}${sortMode === 'custom' ? ' is-custom-order' : ''}`}
        >
          {sortMode === 'custom' && (
            <p className="funnel-client-view-sort-hint">
              Trascina i clienti dalla maniglia o usa le frecce: l&apos;ordine resta salvato su questo dispositivo.
            </p>
          )}
          <div className="funnel-client-view-header">
            {sortMode === 'custom' && <span aria-hidden />}
            <span>Cliente</span>
            {showCampaignColumn && <span>Campagna</span>}
            <span>Stage</span>
            <span>Owner</span>
            <span>Semaforo</span>
            <span>Ultima azione</span>
          </div>
          {filteredRows.map((row, index) => renderListRow(row, index))}
        </div>
      )}
    </div>
  );
}

function entryOwnerLabel(row: FunnelClientRow): string {
  return row.entry.owner || row.client?.owner || '—';
}
