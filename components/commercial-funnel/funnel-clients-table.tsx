'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronRight, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { FunnelActionNoteBlock } from '@/components/commercial-funnel/funnel-action-note-block';
import { FunnelClientPicker } from '@/components/commercial-funnel/funnel-client-picker';
import { FunnelPersoModal } from '@/components/commercial-funnel/funnel-perso-modal';
import {
  FUNNEL_SLOT_COUNT,
  isFunnelActionLocked,
  isFunnelTerminalLost,
  isFunnelTerminalConvertedEntry,
  resolveFunnelSemaforo,
  resolveFunnelStatus,
} from '@/lib/commercial-funnel/index';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';
import { formatActionDateDisplay } from '@/lib/crm/utils';
import { FUNNEL_ACTION_TYPES } from '@/lib/types/commercial-funnel';
import type { CommercialFunnelEntry, FunnelActionType } from '@/lib/types/commercial-funnel';
import { useCrm } from '@/providers/crm-provider';

interface PersoModalState {
  entryId: string;
  clientName: string;
  initialReason: string;
}

interface FunnelClientsTableProps {
  campaignId: string;
  entries: CommercialFunnelEntry[];
  showAddButton?: boolean;
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
    removeFunnelEntry,
    moveFunnelEntryToCampaign,
  } = useCrm();
  const [showPicker, setShowPicker] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [persoModal, setPersoModal] = useState<PersoModalState | null>(null);

  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );

  const existingClientIds = useMemo(
    () => new Set(entries.map((entry) => entry.clientId)),
    [entries],
  );

  const rows = useMemo(
    () => entries
      .map((entry) => ({
        entry,
        client: clientById.get(entry.clientId),
        status: resolveFunnelStatus(entry.actions),
        semaforo: resolveFunnelSemaforo(entry.actions),
        isLost: isFunnelTerminalLost(entry),
        isConverted: isFunnelTerminalConvertedEntry(entry),
        isLocked: isFunnelActionLocked(entry),
      }))
      .sort((a, b) => {
        const nameA = a.client?.name || '';
        const nameB = b.client?.name || '';
        return nameA.localeCompare(nameB, 'it');
      }),
    [entries, clientById],
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
      await updateFunnelAction(entry.id, slotIndex, 'Perso');
      setPersoModal({
        entryId: entry.id,
        clientName: client?.name || 'Cliente',
        initialReason: entry.lostReason,
      });
      return;
    }
    await updateFunnelAction(entry.id, slotIndex, actionType);
  };

  const handlePersoSave = async (reason: string): Promise<void> => {
    if (!persoModal) return;
    await updateFunnelLostReason(persoModal.entryId, reason);
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

  const currentCampaign = mailCampaigns.find((campaign) => campaign.id === campaignId);
  const campaignWorkspaceId = currentCampaign?.workspaceId || DEFAULT_WORKSPACE_ID;

  const otherCampaigns = useMemo(
    () => mailCampaigns
      .filter((campaign) => campaign.id !== campaignId)
      .filter((campaign) => (campaign.workspaceId || DEFAULT_WORKSPACE_ID) === campaignWorkspaceId)
      .sort((a, b) => a.name.localeCompare(b.name, 'it')),
    [campaignId, campaignWorkspaceId, mailCampaigns],
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
                <th className="funnel-col-status">Status</th>
                {Array.from({ length: FUNNEL_SLOT_COUNT }, (_, index) => (
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
                  <td colSpan={FUNNEL_SLOT_COUNT + 4} className="mail-campaigns-empty">
                    Nessun cliente in questa campagna. Usa + per aggiungere clienti freddi.
                  </td>
                </tr>
              ) : (
                rows.map(({ entry, client, status, semaforo, isLost, isConverted, isLocked }) => {
                  const isExpanded = expandedEntries.has(entry.id);
                  const clientName = client?.name || 'Cliente non trovato';
                  const displaySemaforo = isConverted ? 'green' : semaforo;
                  return (
                    <Fragment key={entry.id}>
                      <tr className={`funnel-row${isLost ? ' is-lost' : ''}${isConverted ? ' is-converted' : ''}`}>
                        <td className="funnel-col-semaforo">
                          <span
                            className={`funnel-semaforo funnel-semaforo-${displaySemaforo}`}
                            title={isConverted ? 'Convertito' : displaySemaforo === 'green' ? 'Nei tempi' : 'Fuori tempo'}
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
                                <strong>{clientName}</strong>
                                {entry.clientSource === 'main' && (
                                  <span className="funnel-main-list-badge">Lista</span>
                                )}
                                {isLost && <span className="funnel-lost-badge">Perso</span>}
                                {isConverted && <span className="funnel-converted-badge">Convertito</span>}
                          </button>
                        </td>
                        <td className="funnel-col-status">
                          <div className="funnel-status-cell">
                            <span className="funnel-status-label">{status.label}</span>
                            {status.date && (
                              <small>{formatActionDateDisplay(status.date)}</small>
                            )}
                          </div>
                        </td>
                        {entry.actions.map((action, slotIndex) => (
                          <td key={`${entry.id}-action-${slotIndex}`} className="funnel-col-action">
                            <div className="funnel-action-cell">
                              <select
                                className="table-cell-select funnel-action-select"
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
                          <td colSpan={FUNNEL_SLOT_COUNT + 4}>
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
                                    {client.contacts.map((contact) => (
                                      <li key={contact.id}>
                                        <strong>{contact.name || '—'}</strong>
                                        {contact.email ? ` · ${contact.email}` : ''}
                                        {contact.role ? ` · ${contact.role}` : ''}
                                      </li>
                                    ))}
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
                                    <FunnelActionNoteBlock
                                      key={`${entry.id}-note-${slotIndex}`}
                                      entryId={entry.id}
                                      slotIndex={slotIndex}
                                      action={action}
                                      clientId={entry.clientId}
                                      defaultAssignee={client.owner}
                                      isLocked={isLocked && action.type !== 'Perso'}
                                    />
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
          existingClientIds={existingClientIds}
          onClose={() => setShowPicker(false)}
          onAdd={(refs) => void addClientsToFunnel(campaignId, refs).then(() => setShowPicker(false))}
        />
      )}
      {persoModal && (
        <FunnelPersoModal
          clientName={persoModal.clientName}
          initialReason={persoModal.initialReason}
          onClose={() => setPersoModal(null)}
          onSave={(reason) => void handlePersoSave(reason)}
        />
      )}
    </>
  );
}
