'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Plus, Search } from 'lucide-react';
import {
  buildFunnelCampaignDashboardRow,
  filterCampaignsByWorkspace,
  filterEntriesByVisibleCampaigns,
  filterFunnelEntriesByWorkspace,
  filterVisibleCampaigns,
  isClosedCampaign,
  searchFunnelEntriesByBrandName,
} from '@/lib/commercial-funnel/campaigns';
import {
  readFunnelOwnerFilter,
  readFunnelTrackPreference,
  readHideClosedFunnelCampaignsPreference,
  writeFunnelOwnerFilter,
  writeFunnelTrackPreference,
  writeHideClosedFunnelCampaignsPreference,
} from '@/lib/commercial-funnel/preferences';
import { normalizeOwner } from '@/lib/crm/owners';
import { getOwnersForWorkspace } from '@/lib/crm/workspace-clients';
import {
  FUNNEL_TRACK_DESCRIPTIONS,
  FUNNEL_TRACK_LABELS,
  filterCampaignsByTrack,
} from '@/lib/commercial-funnel/track';
import { downloadCommercialFunnelExcel } from '@/lib/commercial-funnel/export';
import { resolveFunnelSemaforo, resolveFunnelStageDisplay } from '@/lib/commercial-funnel/index';
import { buildFunnelStatsSummary } from '@/lib/commercial-funnel/stats';
import { formatActionDateDisplay, formatShortItalianDate } from '@/lib/crm/utils';
import { resolveWorkspaceLabel } from '@/lib/constants/workspaces';
import { CampaignNameCell } from '@/components/mail-campaigns/campaign-name-cell';
import { CampaignStatusSelect } from '@/components/mail-campaigns/campaign-status-select';
import { CampaignTableActions } from '@/components/mail-campaigns/campaign-table-actions';
import { FunnelStatsCharts } from '@/components/commercial-funnel/funnel-stats-charts';
import { AccountingView } from '@/components/commercial-funnel/accounting-view';
import { FunnelClientsView } from '@/components/commercial-funnel/funnel-clients-view';
import { OWNERS } from '@/lib/constants/crm';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { TopHeader } from '@/components/layout/top-header';
import type { MailCampaignStatus } from '@/lib/types/mail-campaigns';
import { FUNNEL_TRACKS } from '@/lib/types/commercial-funnel';
import type { FunnelTrack } from '@/lib/types/commercial-funnel';
import type { Owner } from '@/lib/types/crm';

const BRAND_SEARCH_MIN_LENGTH = 2;
type FunnelPageView = 'campaigns' | 'clients';

export function CommercialFunnelSection() {
  const router = useRouter();
  const {
    clients,
    mailCampaigns,
    commercialFunnelEntries,
    saveMailCampaign,
    updateMailCampaignOwner,
    updateMailCampaignStatus,
    deleteMailCampaignById,
  } = useCrm();
  const { workspaceId } = useWorkspace();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MailCampaignStatus>('Bozza');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [owner, setOwner] = useState<Owner | ''>('');
  const [brandSearch, setBrandSearch] = useState('');
  const [pageView, setPageView] = useState<FunnelPageView>('campaigns');
  const [hideClosedCampaigns, setHideClosedCampaigns] = useState(true);
  const [hideClosedPreferenceReady, setHideClosedPreferenceReady] = useState(false);
  const [track, setTrack] = useState<FunnelTrack>('cold');
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);

  useEffect(() => {
    setHideClosedCampaigns(readHideClosedFunnelCampaignsPreference());
    setHideClosedPreferenceReady(true);
    setTrack(readFunnelTrackPreference());
    setOwnerFilter(readFunnelOwnerFilter());
  }, []);

  const changeOwnerFilter = (next: string[]): void => {
    setOwnerFilter(next);
    writeFunnelOwnerFilter(next);
  };

  const toggleOwnerFilter = (ownerName: string): void => {
    changeOwnerFilter(ownerFilter.includes(ownerName)
      ? ownerFilter.filter((item) => item !== ownerName)
      : [...ownerFilter, ownerName]);
  };

  const handleTrackChange = (nextTrack: FunnelTrack): void => {
    setTrack(nextTrack);
    writeFunnelTrackPreference(nextTrack);
  };

  useEffect(() => {
    if (!hideClosedPreferenceReady) return;
    writeHideClosedFunnelCampaignsPreference(hideClosedCampaigns);
  }, [hideClosedCampaigns, hideClosedPreferenceReady]);

  const workspaceCampaigns = useMemo(
    () => filterCampaignsByWorkspace(mailCampaigns, workspaceId),
    [mailCampaigns, workspaceId],
  );
  const campaignCountByTrack = useMemo(
    () => ({
      cold: filterCampaignsByTrack(workspaceCampaigns, 'cold').length,
      warm: filterCampaignsByTrack(workspaceCampaigns, 'warm').length,
    }),
    [workspaceCampaigns],
  );
  const scopedCampaigns = useMemo(
    () => filterCampaignsByTrack(workspaceCampaigns, track),
    [track, workspaceCampaigns],
  );
  const scopedEntries = useMemo(
    () => filterEntriesByVisibleCampaigns(
      filterFunnelEntriesByWorkspace(commercialFunnelEntries, workspaceId),
      new Set(scopedCampaigns.map((campaign) => campaign.id)),
    ),
    [commercialFunnelEntries, scopedCampaigns, workspaceId],
  );
  const closedCampaignCount = useMemo(
    () => scopedCampaigns.filter((campaign) => isClosedCampaign(campaign)).length,
    [scopedCampaigns],
  );
  const visibleCampaigns = useMemo(
    () => filterVisibleCampaigns(scopedCampaigns, hideClosedCampaigns),
    [hideClosedCampaigns, scopedCampaigns],
  );
  const visibleCampaignIds = useMemo(
    () => new Set(visibleCampaigns.map((campaign) => campaign.id)),
    [visibleCampaigns],
  );
  const visibleEntries = useMemo(
    () => filterEntriesByVisibleCampaigns(scopedEntries, visibleCampaignIds),
    [scopedEntries, visibleCampaignIds],
  );
  // Toggle owner: le campagne si filtrano per owner della campagna, i clienti per owner del contatto.
  const workspaceOwners = useMemo(() => getOwnersForWorkspace(workspaceId), [workspaceId]);
  const activeOwnerFilter = useMemo(
    () => new Set(ownerFilter.filter((item) => workspaceOwners.includes(item as Owner))),
    [ownerFilter, workspaceOwners],
  );
  const clientOwnerById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.owner])),
    [clients],
  );
  const ownerCampaigns = useMemo(
    () => (activeOwnerFilter.size === 0
      ? visibleCampaigns
      : visibleCampaigns.filter((campaign) => activeOwnerFilter.has(normalizeOwner(campaign.owner) || ''))),
    [activeOwnerFilter, visibleCampaigns],
  );
  const ownerEntries = useMemo(
    () => (activeOwnerFilter.size === 0
      ? visibleEntries
      : visibleEntries.filter((entry) => {
        const entryOwner = normalizeOwner(entry.owner) || normalizeOwner(clientOwnerById.get(entry.clientId));
        return activeOwnerFilter.has(entryOwner || '');
      })),
    [activeOwnerFilter, clientOwnerById, visibleEntries],
  );

  // I totali seguono la vista: contatti dell'owner (Clienti) o contatti delle sue campagne (Campagne).
  const workspaceStats = useMemo(() => {
    if (pageView === 'clients' || activeOwnerFilter.size === 0) return buildFunnelStatsSummary(ownerEntries);
    const ownerCampaignIds = new Set(ownerCampaigns.map((campaign) => campaign.id));
    return buildFunnelStatsSummary(visibleEntries.filter((entry) => ownerCampaignIds.has(entry.campaignId)));
  }, [activeOwnerFilter, ownerCampaigns, ownerEntries, pageView, visibleEntries]);

  const rows = useMemo(
    () => ownerCampaigns.map((campaign) => buildFunnelCampaignDashboardRow(
      campaign,
      visibleEntries,
    )),
    [ownerCampaigns, visibleEntries],
  );

  const brandSearchResults = useMemo(
    () => searchFunnelEntriesByBrandName(
      brandSearch,
      visibleEntries,
      clients,
      ownerCampaigns,
      workspaceId,
    ),
    [brandSearch, clients, visibleEntries, ownerCampaigns, workspaceId],
  );

  const filteredRows = useMemo(() => {
    const query = brandSearch.trim().toLowerCase();
    if (query.length < BRAND_SEARCH_MIN_LENGTH) return rows;
    const matchingCampaignIds = new Set(brandSearchResults.map((result) => result.campaignId));
    if (matchingCampaignIds.size === 0) return [];
    return rows.filter((row) => matchingCampaignIds.has(row.campaign.id));
  }, [brandSearch, brandSearchResults, rows]);

  const handleCreate = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const campaignId = await saveMailCampaign({
      workspaceId,
      funnelTrack: track,
      name,
      description,
      status,
      startDate,
      endDate,
      owner,
    });
    setShowForm(false);
    setName('');
    setDescription('');
    setStatus('Bozza');
    setStartDate('');
    setEndDate('');
    setOwner('');
    router.push(`/funnel/${campaignId}`);
  };

  const handleRenameCampaign = async (campaignId: string, name: string): Promise<void> => {
    const campaign = mailCampaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    await saveMailCampaign({
      id: campaign.id,
      name,
      description: campaign.description,
      status: campaign.status,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      owner: campaign.owner,
      createdAt: campaign.createdAt,
    });
  };

  const handleOwnerChange = async (campaignId: string, nextOwner: Owner | ''): Promise<void> => {
    await updateMailCampaignOwner(campaignId, nextOwner);
  };

  const handleStatusChange = async (
    campaignId: string,
    nextStatus: MailCampaignStatus,
  ): Promise<void> => {
    await updateMailCampaignStatus(campaignId, nextStatus);
  };

  const handleDeleteCampaign = async (campaignId: string, campaignName: string): Promise<void> => {
    if (!window.confirm(`Eliminare la campagna "${campaignName}"?\n\nVerranno rimossi anche clienti e dati del funnel collegati.`)) {
      return;
    }
    await deleteMailCampaignById(campaignId);
  };

  const handleDownloadExcel = (): void => {
    downloadCommercialFunnelExcel({
      entries: visibleEntries,
      clients,
      mailCampaigns: visibleCampaigns,
      workspaceLabel: `${resolveWorkspaceLabel(workspaceId)} ${FUNNEL_TRACK_LABELS[track]}`,
    });
  };

  const isBrandSearchActive = brandSearch.trim().length >= BRAND_SEARCH_MIN_LENGTH;
  const displayRows = isBrandSearchActive ? filteredRows : rows;

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="funnel-track-tabs" role="tablist" aria-label="Tipo di funnel">
            {FUNNEL_TRACKS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={track === item}
                className={`funnel-track-tab funnel-track-tab-${item}${track === item ? ' is-active' : ''}`}
                onClick={() => handleTrackChange(item)}
              >
                <span className="funnel-track-tab-label">
                  {FUNNEL_TRACK_LABELS[item]}
                  {item === 'cold' && (
                    <span className="funnel-track-tab-count">{campaignCountByTrack[item]}</span>
                  )}
                </span>
                <small>{FUNNEL_TRACK_DESCRIPTIONS[item]}</small>
              </button>
            ))}
          </div>
          {track === 'warm' ? (
            <AccountingView />
          ) : (
          <>
          <div className="table-filter-bar">
            <div className="filter-left funnel-filter-left">
              <div className="search-box funnel-brand-search-box">
                <Search size={18} />
                <input
                  className="search-input"
                  placeholder="Cerca brand nel funnel..."
                  value={brandSearch}
                  onChange={(event) => setBrandSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="filter-right">
              <div className="task-view-toggle" role="group" aria-label="Vista funnel">
                <button
                  type="button"
                  className={`task-view-toggle-btn${pageView === 'campaigns' ? ' is-active' : ''}`}
                  onClick={() => setPageView('campaigns')}
                >
                  Campagne
                </button>
                <button
                  type="button"
                  className={`task-view-toggle-btn${pageView === 'clients' ? ' is-active' : ''}`}
                  onClick={() => setPageView('clients')}
                >
                  Clienti
                </button>
              </div>
              {closedCampaignCount > 0 ? (
                <button
                  type="button"
                  className={`clients-filter-chip ${hideClosedCampaigns ? 'is-active' : ''}`}
                  onClick={() => setHideClosedCampaigns((prev) => !prev)}
                  title={hideClosedCampaigns ? 'Mostra campagne chiuse' : 'Nascondi campagne chiuse'}
                >
                  {hideClosedCampaigns ? 'Chiuse nascoste' : 'Chiuse visibili'}
                  <span className="clients-filter-chip-count">{closedCampaignCount}</span>
                </button>
              ) : null}
              <button type="button" className="btn btn-secondary" onClick={handleDownloadExcel}>
                <Download size={16} />
                <span>Scarica Excel</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                <Plus size={16} />
                <span>Nuova campagna</span>
              </button>
            </div>
          </div>
          <div className="funnel-owner-filter" role="group" aria-label="Filtra per owner">
            <span className="tasks-filter-label">Owner:</span>
            <button
              type="button"
              className={`clients-filter-chip${activeOwnerFilter.size === 0 ? ' is-active' : ''}`}
              aria-pressed={activeOwnerFilter.size === 0}
              onClick={() => changeOwnerFilter([])}
            >
              Tutti
            </button>
            {workspaceOwners.map((ownerName) => (
              <button
                key={ownerName}
                type="button"
                className={`clients-filter-chip${activeOwnerFilter.has(ownerName) ? ' is-active' : ''}`}
                aria-pressed={activeOwnerFilter.has(ownerName)}
                title={pageView === 'clients'
                  ? `Solo i contatti di ${ownerName}`
                  : `Solo le campagne di ${ownerName}`}
                onClick={() => toggleOwnerFilter(ownerName)}
              >
                Solo {ownerName.split(' ')[0]}
              </button>
            ))}
          </div>
          <FunnelStatsCharts title={`Totali ${FUNNEL_TRACK_LABELS[track]}`} stats={workspaceStats} />
          {pageView === 'clients' ? (
            <FunnelClientsView
              entries={ownerEntries}
              clients={clients}
              mailCampaigns={visibleCampaigns}
              showCampaignColumn
            />
          ) : (
            <>
          {isBrandSearchActive && (
            <div className="funnel-brand-search-panel glass-card">
              {brandSearchResults.length === 0 ? (
                <p className="funnel-brand-search-message">Nessun brand trovato nel funnel.</p>
              ) : (
                <table className="analysis-table funnel-brand-search-table mobile-card-table">
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Campagna</th>
                      <th>Stage</th>
                      <th>Semaforo</th>
                      <th> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandSearchResults.map((result) => {
                      const entry = commercialFunnelEntries.find((item) => item.id === result.entryId);
                      const status = entry ? resolveFunnelStageDisplay(entry) : null;
                      const semaforo = entry ? resolveFunnelSemaforo(entry.actions) : 'green';
                      const entryHref = `/funnel/${result.campaignId}?entry=${encodeURIComponent(result.entryId)}`;
                      return (
                        <tr
                          key={result.entryId}
                          className="funnel-brand-search-row mobile-card-row"
                          onClick={() => router.push(entryHref)}
                        >
                          <td className="is-card-title">{result.clientName}</td>
                          <td data-label="Campagna">{result.campaignName}</td>
                          <td data-label="Stage">
                            {status?.label || '—'}
                            {status?.date ? ` (${formatActionDateDisplay(status.date)})` : ''}
                          </td>
                          <td data-label="Semaforo">
                            <span
                              className={`funnel-semaforo funnel-semaforo-${semaforo}`}
                              title={semaforo === 'red' ? 'Fuori tempo (oltre 5 giorni)' : 'In tempo (entro 5 giorni)'}
                              aria-label={semaforo === 'red' ? 'Semaforo rosso' : 'Semaforo verde'}
                            />
                          </td>
                          <td className="is-card-actions">
                            <Link
                              href={entryHref}
                              className="funnel-brand-search-link"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Apri
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
          <div className="commercial-funnel-table-wrap glass-card">
            <table className="analysis-table commercial-funnel-table mobile-card-table">
              <thead>
                <tr>
                  <th>Campagna</th>
                  <th>Owner</th>
                  <th>Stato</th>
                  <th>Inizio</th>
                  <th>Clienti</th>
                  <th>Attivi</th>
                  <th>Convertiti</th>
                  <th>Persi</th>
                  <th>Semaforo</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="mail-campaigns-empty">
                      {isBrandSearchActive
                        ? 'Nessuna campagna corrisponde alla ricerca.'
                        : hideClosedCampaigns && closedCampaignCount > 0
                          ? 'Tutte le campagne visibili sono chiuse. Mostrale con «Chiuse nascoste».'
                          : `Nessuna campagna in ${FUNNEL_TRACK_LABELS[track]}. Creane una nuova.`}
                    </td>
                  </tr>
                ) : (
                  displayRows.map(({ campaign, totalClients, activeCount, convertedCount, lostCount, redSemaforoCount }) => (
                    <tr key={campaign.id} className="mobile-card-row">
                      <td className="is-card-title">
                        <CampaignNameCell campaign={campaign} onSaveName={handleRenameCampaign} />
                      </td>
                      <td data-label="Owner">
                        <select
                          className="table-cell-select"
                          value={campaign.owner}
                          onChange={(event) => void handleOwnerChange(
                            campaign.id,
                            event.target.value as Owner | '',
                          )}
                        >
                          <option value="">—</option>
                          {OWNERS.map((profile) => (
                            <option key={profile} value={profile}>{profile}</option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Stato">
                        <CampaignStatusSelect
                          value={campaign.status}
                          onChange={(nextStatus) => void handleStatusChange(campaign.id, nextStatus)}
                        />
                      </td>
                      <td className="funnel-campaign-date" data-label="Inizio">{campaign.startDate ? formatShortItalianDate(campaign.startDate) : '—'}</td>
                      <td className="analysis-num is-card-stat" data-label="Clienti">{totalClients}</td>
                      <td className="analysis-num is-card-stat" data-label="Attivi">{activeCount}</td>
                      <td className="analysis-num funnel-converted-count is-card-stat" data-label="Convertiti">{convertedCount}</td>
                      <td className="analysis-num is-card-stat" data-label="Persi">{lostCount}</td>
                      <td className="analysis-num" data-label="Semaforo">
                        <span
                          className={`funnel-semaforo-count${redSemaforoCount > 0 ? ' has-red' : ''}`}
                          title={redSemaforoCount > 0
                            ? `${redSemaforoCount} clienti oltre 5 giorni senza prossima azione`
                            : 'Nessun cliente oltre 5 giorni'}
                        >
                          <span
                            className={`funnel-semaforo ${redSemaforoCount > 0 ? 'funnel-semaforo-red' : 'funnel-semaforo-green'}`}
                            aria-hidden
                          />
                          {redSemaforoCount}
                        </span>
                      </td>
                      <td className="is-card-actions">
                        <CampaignTableActions
                          manageHref={`/funnel/${campaign.id}`}
                          manageLabel="Apri campagna"
                          onDelete={() => void handleDeleteCampaign(campaign.id, campaign.name)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
            </>
          )}
          </>
          )}
        </section>
      </div>
      {showForm && (
        <>
          <div className="drawer-overlay open" onClick={() => setShowForm(false)} />
          <div className="drawer open">
            <div className="drawer-header"><h3>Nuova campagna · {FUNNEL_TRACK_LABELS[track]}</h3></div>
            <form onSubmit={(event) => void handleCreate(event)}>
              <div className="drawer-body">
                <p className={`funnel-track-note funnel-track-note-${track}`}>
                  La campagna verrà creata in <strong>{FUNNEL_TRACK_LABELS[track]}</strong>:
                  potrai aggiungere solo {track === 'warm'
                    ? 'clienti che hanno fatturato almeno 1€'
                    : 'clienti che non hanno ancora fatturato'}.
                </p>
                <div className="form-group">
                  <label>Nome Campagna *</label>
                  <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Descrizione</label>
                  <textarea className="form-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Owner</label>
                    <select
                      className="form-select"
                      value={owner}
                      onChange={(event) => setOwner(event.target.value as Owner | '')}
                    >
                      <option value="">—</option>
                      {OWNERS.map((profile) => (
                        <option key={profile} value={profile}>{profile}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Stato</label>
                    <CampaignStatusSelect
                      className="form-select"
                      value={status}
                      onChange={setStatus}
                    />
                  </div>
                  <div className="form-group">
                    <label>Data Inizio</label>
                    <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Data Fine</label>
                    <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="drawer-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">Crea campagna</button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
