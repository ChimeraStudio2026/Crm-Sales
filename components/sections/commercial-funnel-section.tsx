'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GitBranch, Plus, Search } from 'lucide-react';
import { buildFunnelCampaignDashboardRow, filterCampaignsByWorkspace, filterFunnelEntriesByWorkspace, searchFunnelEntriesByBrandName } from '@/lib/commercial-funnel/campaigns';
import { resolveFunnelSemaforo, resolveFunnelStageDisplay } from '@/lib/commercial-funnel/index';
import { buildFunnelStatsSummary } from '@/lib/commercial-funnel/stats';
import { formatActionDateDisplay } from '@/lib/crm/utils';
import { CampaignNameCell } from '@/components/mail-campaigns/campaign-name-cell';
import { CampaignStatusSelect } from '@/components/mail-campaigns/campaign-status-select';
import { CampaignTableActions } from '@/components/mail-campaigns/campaign-table-actions';
import { FunnelStatsCharts } from '@/components/commercial-funnel/funnel-stats-charts';
import { FunnelClientsView } from '@/components/commercial-funnel/funnel-clients-view';
import { OWNERS } from '@/lib/constants/crm';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { TopHeader } from '@/components/layout/top-header';
import type { MailCampaignStatus } from '@/lib/types/mail-campaigns';
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

  const scopedCampaigns = useMemo(
    () => filterCampaignsByWorkspace(mailCampaigns, workspaceId),
    [mailCampaigns, workspaceId],
  );
  const scopedEntries = useMemo(
    () => filterFunnelEntriesByWorkspace(commercialFunnelEntries, workspaceId),
    [commercialFunnelEntries, workspaceId],
  );
  const workspaceStats = useMemo(
    () => buildFunnelStatsSummary(scopedEntries),
    [scopedEntries],
  );

  const rows = useMemo(
    () => scopedCampaigns.map((campaign) => buildFunnelCampaignDashboardRow(
      campaign,
      scopedEntries,
    )),
    [scopedCampaigns, scopedEntries],
  );

  const brandSearchResults = useMemo(
    () => searchFunnelEntriesByBrandName(
      brandSearch,
      scopedEntries,
      clients,
      scopedCampaigns,
      workspaceId,
    ),
    [brandSearch, clients, scopedEntries, scopedCampaigns, workspaceId],
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

  const isBrandSearchActive = brandSearch.trim().length >= BRAND_SEARCH_MIN_LENGTH;
  const displayRows = isBrandSearchActive ? filteredRows : rows;

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="table-filter-bar">
            <div className="filter-left funnel-filter-left">
              <h3 className="commercial-funnel-title">
                <GitBranch size={20} />
                Funnel Commerciale
              </h3>
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
              <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                <Plus size={16} />
                <span>Nuova campagna</span>
              </button>
            </div>
          </div>
          <FunnelStatsCharts title="Totali funnel" stats={workspaceStats} />
          {pageView === 'clients' ? (
            <FunnelClientsView
              entries={scopedEntries}
              clients={clients}
              mailCampaigns={scopedCampaigns}
              showCampaignColumn
            />
          ) : (
            <>
          {isBrandSearchActive && (
            <div className="funnel-brand-search-panel glass-card">
              {brandSearchResults.length === 0 ? (
                <p className="funnel-brand-search-message">Nessun brand trovato nel funnel.</p>
              ) : (
                <table className="analysis-table funnel-brand-search-table">
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
                      return (
                        <tr key={result.entryId}>
                          <td>{result.clientName}</td>
                          <td>{result.campaignName}</td>
                          <td>
                            {status?.label || '—'}
                            {status?.date ? ` (${formatActionDateDisplay(status.date)})` : ''}
                          </td>
                          <td>
                            <span
                              className={`funnel-semaforo funnel-semaforo-${semaforo}`}
                              title={semaforo === 'red' ? 'Fuori tempo (oltre 5 giorni)' : 'In tempo (entro 5 giorni)'}
                              aria-label={semaforo === 'red' ? 'Semaforo rosso' : 'Semaforo verde'}
                            />
                          </td>
                          <td>
                            <Link href={`/funnel/${result.campaignId}`} className="funnel-brand-search-link">
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
            <table className="analysis-table commercial-funnel-table">
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
                      {isBrandSearchActive ? 'Nessuna campagna corrisponde alla ricerca.' : 'Nessuna campagna funnel. Creane una nuova.'}
                    </td>
                  </tr>
                ) : (
                  displayRows.map(({ campaign, totalClients, activeCount, convertedCount, lostCount, redSemaforoCount }) => (
                    <tr key={campaign.id}>
                      <td>
                        <CampaignNameCell campaign={campaign} onSaveName={handleRenameCampaign} />
                      </td>
                      <td>
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
                      <td>
                        <CampaignStatusSelect
                          value={campaign.status}
                          onChange={(nextStatus) => void handleStatusChange(campaign.id, nextStatus)}
                        />
                      </td>
                      <td>{campaign.startDate || '—'}</td>
                      <td className="analysis-num">{totalClients}</td>
                      <td className="analysis-num">{activeCount}</td>
                      <td className="analysis-num funnel-converted-count">{convertedCount}</td>
                      <td className="analysis-num">{lostCount}</td>
                      <td className="analysis-num">
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
                      <td>
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
        </section>
      </div>
      {showForm && (
        <>
          <div className="drawer-overlay open" onClick={() => setShowForm(false)} />
          <div className="drawer open">
            <div className="drawer-header"><h3>Nuova campagna funnel</h3></div>
            <form onSubmit={(event) => void handleCreate(event)}>
              <div className="drawer-body">
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
