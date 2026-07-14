'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronRight, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { FunnelActionNoteBlock } from '@/components/commercial-funnel/funnel-action-note-block';
import { FunnelClientPicker } from '@/components/commercial-funnel/funnel-client-picker';
import { FunnelPersoModal } from '@/components/commercial-funnel/funnel-perso-modal';
import {
  getMaxDisplayActionColumns,
  isFunnelActionLocked,
  isFunnelTerminalLost,
  isFunnelTerminalConvertedEntry,
  isPositiveFunnelActionType,
  padDisplayActions,
  resolveFunnelSemaforo,
  resolveFunnelStageDisplay,
} from '@/lib/commercial-funnel/index';
import {
  buildFunnelEntryKey,
  resolveFunnelContactLabel,
} from '@/lib/commercial-funnel/contacts';
import { filterCampaignsByWorkspace } from '@/lib/commercial-funnel/campaigns';
import { formatActionDateDisplay } from '@/lib/crm/utils';
import { getOwnersForWorkspace } from '@/lib/crm/workspace-clients';
import { isOwner } from '@/lib/constants/crm';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';
import { FUNNEL_ACTION_TYPES } from '@/lib/types/commercial-funnel';
import type { CommercialFunnelEntry, FunnelActionType } from '@/lib/types/commercial-funnel';
import type { Client } from '@/lib/types/crm';
import { useCrm } from '@/providers/crm-provider';

interface PersoModalState {
  entryId: string;
  clientName: string;
  initialReason: string;
  slotIndex?: number;
}

interface FunnelClientsTableProps {
  campaignId: string;
  entries: CommercialFunnelEntry[];
  showAddButton?: boolean;
}

function resolveDisplayOwner(entry: CommercialFunnelEntry, client?: Client): string {
  if (entry.owner && isOwner(entry.owner)) return entry.owner;
  if (client?.owner && isOwner(client.owner)) return client.owner;
  return '';
}

export function FunnelClientsTable({
  campaignId,
  entries,
  showAddButton = true,
}: FunnelClientsTableProps) {
  const {
    clients,
    mailCampaigns,
    addClientsToFunnel,
    updateFunnelAction,
    updateFunnelLostReason,
    markFunnelEntryLost,
    updateFunnelEntryOwner,
    removeFunnelEntry,
    moveFunnelEntryToCampaign,
  } = useCrm();
  const [showPicker, setShowPicker] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [persoModal, setPersoModal] = useState<PersoModalState | null>(null);

  const workspaceId = useMemo(
    () => mailCampaigns.find((campaign) => campaign.id === campaignId)?.workspaceId || DEFAULT_WORKSPACE_ID,
    [campaignId, mailCampaigns],
  );
  const availableOwners = useMemo(() => getOwnersForWorkspace(workspaceId), [workspaceId]);

  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );

  const existingEntryKeys = useMemo(
    () => new Set(entries.map((entry) => buildFunnelEntryKey(entry.clientId, entry.contactId))),
    [entries],
  );

  const maxActionColumns = useMemo(
    () => getMaxDisplayActionColumns(entries),
    [entries],
  );

  const rows = useMemo(
    () => entries
      .map((entry) => ({
        entry,
        client: clientById.get(entry.clientId),
        status: resolveFunnelStageDisplay(entry),
        semaforo: resolveFunnelSemaforo(entry.actions),
        isLost: isFunnelTerminalLost(entry),
        isConverted: isFunnelTerminalConvertedEntry(entry),
        isLocked: isFunnelActionLocked(entry),
        displayActions: padDisplayActions(
          entry.actions,
          maxActionColumns,
          !isFunnelActionLocked(entry),
        ),
      }))
      .sort((a, b) => {
        const nameA = a.client?.name || '';
        const nameB = b.client?.name || '';
        return nameA.localeCompare(nameB, 'it');
      }),
    [entries, clientById, maxActionColumns],
  );

  const toggleExpanded = (entryId: string): void => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const handleActionChange = async (
    entry: CommercialFunnelEntry,
    slotIndex: number,
    value: string,
  ): Promise<void> => {
    const actionType = value as FunnelActionType | '';
    if (actionType === 'Perso') {
      const client = clientById.get(entry.clientId);
      setPersoModal({
        entryId: entry.id,
        clientName: client?.name || 'Cliente',
        initialReason: entry.lostReason,
        slotIndex,
      });
      return;
    }
    await updateFunnelAction(entry.id, slotIndex, actionType);
  };

  const handlePersoSave = async (reason: string): Promise<void> => {
    if (!persoModal || !reason.trim()) return;
    if (persoModal.slotIndex !== undefined) {
      await markFunnelEntryLost(persoModal.entryId, persoModal.slotIndex, reason);
    } else {
      await updateFunnelLostReason(persoModal.entryId, reason);
    }
    setPersoModal(null);
  };

  const openPersoReason = (entry: CommercialFunnelEntry, clientName: string): void => {
    setPersoModal({
      entryId: entry.id,
      clientName,
      initialReason: entry.lostReason,
    });
  };

  const getPersoSlotIndex = (entry: CommercialFunnelEntry): number => (
    entry.actions.findIndex((action) => action.type === 'Perso')
  );

  const handleReactivate = async (
    entry: CommercialFunnelEntry,
    newActionType: FunnelActionType,
  ): Promise<void> => {
    const persoSlotIndex = getPersoSlotIndex(entry);
    if (persoSlotIndex < 0) return;
    await updateFunnelAction(entry.id, persoSlotIndex, newActionType);
  };

  const reactivatableActionTypes = FUNNEL_ACTION_TYPES.filter(
    (type) => type !== 'Perso' && type !== 'Convertito',
  );

  const otherCampaigns = useMemo(
    () => {
      const currentCampaign = mailCampaigns.find((item) => item.id === campaignId);
      const workspaceCampaigns = currentCampaign
        ? filterCampaignsByWorkspace(mailCampaigns, currentCampaign.workspaceId)
        : mailCampaigns;
      return workspaceCampaigns
        .filter((campaign) => campaign.id !== campaignId)
        .sort((a, b) => a.name.localeCompare(b.name, 'it'));
    },
    [campaignId, mailCampaigns],
  );

  return (
    <>
      {showAddButton && (
        <div className="funnel-campaign-toolbar">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowPicker(true)}>
            <Plus size={16} />
            <span>Aggiungi cliente</span>
          </button>
        </div>
      )}
      <div className="commercial-funnel-table-wrap glass-card">
        <div className="commercial-funnel-table-scroll">
          <table className="analysis-table commercial-funnel-table">
            <thead>
              <tr>
                <th className="funnel-col-semaforo">Semaforo</th>
                <th className="funnel-col-client">Cliente</th>
                <th className="funnel-col-owner">Owner</th>
                <th className="funnel-col-status">Status</th>
                {Array.from({ length: maxActionColumns }, (_, index) => (
                  <th key={`action-header-${index}`} className="funnel-col-action">
                    Azione {index + 1}
                  </th>
                ))}
                <th className="funnel-col-actions"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={maxActionColumns + 5} className="mail-campaigns-empty">
                    Nessun cliente in questa campagna. Usa + per aggiungere clienti freddi.
                  </td>
                </tr>
              ) : (
                rows.map(({ entry, client, status, semaforo, isLost, isConverted, isLocked, displayActions }) => {
                  const isExpanded = expandedEntries.has(entry.id);
                  const clientName = client?.name || 'Cliente non trovato';
                  const contactLabel = resolveFunnelContactLabel(client, entry.contactId);
                  const displayOwner = resolveDisplayOwner(entry, client);
                  const displaySemaforo = isConverted ? 'green' : semaforo;
                  return (
                    <Fragment key={entry.id}>
                      <tr className={`funnel-row${isLost ? ' is-lost' : ''}${isConverted ? ' is-converted' : ''}`}>
                        <td className="funnel-col-semaforo">
                          <span
                            className={`funnel-semaforo funnel-semaforo-${displaySemaforo}`}
                            title={isConverted ? 'Convertito' : displaySemaforo === 'green' ? 'Nei tempi (entro 5 giorni)' : 'Fuori tempo (oltre 5 giorni)'}
                          />
                        </td>
                        <td className="funnel-col-client">
                          <button
                            type="button"
                            className="funnel-client-toggle"
                            onClick={() => toggleExpanded(entry.id)}
                          >
                            <ChevronRight
                              size={14}
                              className={`row-expand-icon${isExpanded ? ' is-expanded' : ''}`}
                            />
                            <span className="funnel-client-toggle-text">
                              <strong>{clientName}</strong>
                              <small className="funnel-entry-contact">{contactLabel}</small>
                            </span>
                            {entry.clientSource === 'main' && (
                                  <span className="funnel-main-list-badge">Lista</span>
                                )}
                                {isLost && <span className="funnel-lost-badge">Perso</span>}
                                {isConverted && <span className="funnel-converted-badge">Convertito</span>}
                          </button>
                        </td>
                        <td className="funnel-col-owner">
                          <select
                            className="table-cell-select funnel-owner-select"
                            value={displayOwner}
                            onChange={(event) => void updateFunnelEntryOwner(entry.id, event.target.value)}
                          >
                            <option value="">—</option>
                            {availableOwners.map((owner) => (
                              <option key={owner} value={owner}>{owner}</option>
                            ))}
                          </select>
                        </td>
                        <td className="funnel-col-status">
                          <div className="funnel-status-cell">
                            <span className="funnel-status-label">{status.label}</span>
                            {status.date && (
                              <small>{formatActionDateDisplay(status.date)}</small>
                            )}
                            {isLost && entry.lostReason && (
                              <small className="funnel-lost-reason-preview" title={entry.lostReason}>
                                {entry.lostReason}
                              </small>
                            )}
                          </div>
                        </td>
                        {displayActions.map((action, slotIndex) => (
                          <td key={`${entry.id}-action-${slotIndex}`} className="funnel-col-action">
                            <div className="funnel-action-cell">
                              <select
                                className={`table-cell-select funnel-action-select${isPositiveFunnelActionType(action.type) ? ' is-positive' : ''}`}
                                value={action.type}
                                disabled={isLocked && action.type !== 'Perso'}
                                onChange={(e) => void handleActionChange(entry, slotIndex, e.target.value)}
                              >
                                <option value="">—</option>
                                {FUNNEL_ACTION_TYPES.map((type) => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                              {action.date && (
                                <small className="funnel-action-date">
                                  {formatActionDateDisplay(action.date)}
                                </small>
                              )}
                            </div>
                          </td>
                        ))}
                        <td className="funnel-col-actions">
                          <div className="table-row-actions">
                            {isLost && (
                              <>
                                <select
                                  className="table-cell-select funnel-reactivate-select"
                                  defaultValue=""
                                  title="Riattiva cliente: scegli nuova azione"
                                  onChange={(event) => {
                                    const value = event.target.value as FunnelActionType;
                                    if (!value) return;
                                    void handleReactivate(entry, value);
                                    event.target.value = '';
                                  }}
                                >
                                  <option value="">Riattiva</option>
                                  {reactivatableActionTypes.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn-table-action"
                                  title="Riporta a nessuna azione (rimuovi Perso)"
                                  onClick={() => {
                                    const persoSlotIndex = getPersoSlotIndex(entry);
                                    if (persoSlotIndex >= 0) {
                                      void updateFunnelAction(entry.id, persoSlotIndex, '');
                                    }
                                  }}
                                >
                                  <RotateCcw size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-table-action"
                                  title="Motivo perdita"
                                  onClick={() => openPersoReason(entry, clientName)}
                                >
                                  Motivo
                                </button>
                              </>
                            )}
                            {otherCampaigns.length > 0 && (
                              <select
                                className="table-cell-select funnel-move-campaign-select"
                                defaultValue=""
                                title="Sposta in altra campagna"
                                onChange={(event) => {
                                  const targetCampaignId = event.target.value;
                                  if (!targetCampaignId) return;
                                  void moveFunnelEntryToCampaign(entry.id, targetCampaignId);
                                  event.target.value = '';
                                }}
                              >
                                <option value="">Sposta campagna</option>
                                {otherCampaigns.map((campaign) => (
                                  <option key={campaign.id} value={campaign.id}>
                                    {campaign.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              className="btn-table-action btn-table-action-danger"
                              title="Rimuovi dalla campagna"
                              onClick={() => void removeFunnelEntry(entry.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && client && (
                        <tr className="funnel-row-expanded">
                          <td colSpan={maxActionColumns + 5}>
                            <div className="funnel-expanded-body">
                              <div className="funnel-expanded-block">
                                <span className="funnel-expanded-label">Tipo cliente</span>
                                <strong>{client.type}</strong>
                              </div>
                              <div className="funnel-expanded-block funnel-expanded-contacts">
                                <span className="funnel-expanded-label">Contatti</span>
                                {client.contacts.length === 0 ? (
                                  <span>Nessun contatto</span>
                                ) : (
                                  <ul>
                                    {client.contacts.map((contact) => {
                                      const isLinked = contact.id === entry.contactId
                                        || (!entry.contactId && client.contacts[0]?.id === contact.id);
                                      return (
                                      <li key={contact.id} className={isLinked ? 'is-linked-contact' : ''}>
                                        <strong>{contact.name || '—'}</strong>
                                        {contact.email ? ` · ${contact.email}` : ''}
                                        {contact.role ? ` · ${contact.role}` : ''}
                                        {isLinked ? ' · collegato al funnel' : ''}
                                      </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                              {entry.lostReason && (
                                <div className="funnel-expanded-block">
                                  <span className="funnel-expanded-label">Motivo perdita</span>
                                  <p>{entry.lostReason}</p>
                                </div>
                              )}
                              <div className="funnel-expanded-block funnel-expanded-notes">
                                <span className="funnel-expanded-label">Note azioni</span>
                                <div className="funnel-action-notes-grid">
                                  {entry.actions.map((action, slotIndex) => (
                                    action.type ? (
                                      <FunnelActionNoteBlock
                                        key={`${entry.id}-note-${slotIndex}`}
                                        entryId={entry.id}
                                        slotIndex={slotIndex}
                                        action={action}
                                        clientId={entry.clientId}
                                        defaultAssignee={isOwner(displayOwner) ? displayOwner : client.owner}
                                        isLocked={isLocked && action.type !== 'Perso'}
                                      />
                                    ) : null
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showPicker && (
        <FunnelClientPicker
          existingEntryKeys={existingEntryKeys}
          onClose={() => setShowPicker(false)}
          onAdd={(refs) => void addClientsToFunnel(campaignId, refs).then(() => setShowPicker(false))}
        />
      )}
      {persoModal && (
        <FunnelPersoModal
          clientName={persoModal.clientName}
          initialReason={persoModal.initialReason}
          isNewLost={persoModal.slotIndex !== undefined}
          onClose={() => setPersoModal(null)}
          onSave={(reason) => void handlePersoSave(reason)}
        />
      )}
    </>
  );
}
