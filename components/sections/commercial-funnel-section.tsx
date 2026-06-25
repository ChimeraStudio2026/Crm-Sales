'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GitBranch, Plus, Search } from 'lucide-react';
import { buildFunnelCampaignDashboardRow, searchFunnelEntriesByBrandName } from '@/lib/commercial-funnel/campaigns';
import { resolveFunnelSemaforo, resolveFunnelStatus } from '@/lib/commercial-funnel/index';
import { formatActionDateDisplay } from '@/lib/crm/utils';
import { CampaignNameCell } from '@/components/mail-campaigns/campaign-name-cell';
import { CampaignTableActions } from '@/components/mail-campaigns/campaign-table-actions';
import { MAIL_CAMPAIGN_STATUS_LABELS } from '@/lib/constants/mail-campaigns';
import { OWNERS } from '@/lib/constants/crm';
import { useCrm } from '@/providers/crm-provider';
import { TopHeader } from '@/components/layout/top-header';
import type { MailCampaignStatus } from '@/lib/types/mail-campaigns';
import type { Owner } from '@/lib/types/crm';

const BRAND_SEARCH_MIN_LENGTH = 2;

export function CommercialFunnelSection() {
  const router = useRouter();
  const {
    clients,
    mailCampaigns,
    commercialFunnelEntries,
    saveMailCampaign,
    updateMailCampaignOwner,
    deleteMailCampaignById,
  } = useCrm();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MailCampaignStatus>('Bozza');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [owner, setOwner] = useState<Owner | ''>('');
  const [brandSearch, setBrandSearch] = useState('');

  const rows = useMemo(
    () => mailCampaigns.map((campaign) => buildFunnelCampaignDashboardRow(
      campaign,
      commercialFunnelEntries,
    )),
    [mailCampaigns, commercialFunnelEntries],
  );

  const brandSearchResults = useMemo(
    () => searchFunnelEntriesByBrandName(
      brandSearch,
      commercialFunnelEntries,
      clients,
      mailCampaigns,
    ),
    [brandSearch, clients, commercialFunnelEntries, mailCampaigns],
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
              <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                <Plus size={16} />
                <span>Nuova campagna</span>
              </button>
            </div>
          </div>
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
                      <th>Ultima azione</th>
                      <th>Semaforo</th>
                      <th> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandSearchResults.map((result) => {
                      const entry = commercialFunnelEntries.find((item) => item.id === result.entryId);
                      const status = entry ? resolveFunnelStatus(entry.actions) : null;
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
                              title={semaforo === 'red' ? 'Fuori tempo' : 'In tempo'}
                              aria-label={semaforo === 'red' ? 'Semaforo rosso' : 'Semaforo verde'}
                            />
                          </td>
                          <td>
                            <Link href={`/funnel/${result.campaignId}`} className="funnel-brand-search-link">
                              Apri campagna
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
          <div className="mail-campaigns-table-wrap glass-card">
            <table className="analysis-table mail-campaigns-table">
              <thead>
                <tr>
                  <th>Nome Campagna</th>
                  <th>Owner</th>
                  <th>Stato</th>
                  <th>Data Inizio</th>
                  <th>Clienti</th>
                  <th>Attivi</th>
                  <th>Convertiti</th>
                  <th>Persi</th>
                  <th>Semafori rossi</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="mail-campaigns-empty">
                      {isBrandSearchActive
                        ? 'Nessuna campagna contiene il brand cercato.'
                        : 'Nessuna campagna. Creane una con + per iniziare il funnel commerciale.'}
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
                        <span className={`mail-campaign-status mail-campaign-status-${campaign.status.toLowerCase()}`}>
                          {MAIL_CAMPAIGN_STATUS_LABELS[campaign.status]}
                        </span>
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
                            ? `${redSemaforoCount} clienti fuori tempo sulla prossima azione`
                            : 'Nessun cliente fuori tempo'}
                        >
                          <span
                            className={`funnel-semaforo ${redSemaforoCount > 0 ? 'funnel-semaforo-red' : 'funnel-semaforo-green'}`}
                            aria-hidden
                          />
                          <span>{redSemaforoCount}</span>
                        </span>
                      </td>
                      <td>
                        <CampaignTableActions
                          manageHref={`/funnel/${campaign.id}`}
                          manageLabel="Gestisci campagna"
                          onDelete={() => void handleDeleteCampaign(campaign.id, campaign.name)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                    <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as MailCampaignStatus)}>
                      <option value="Bozza">Bozza</option>
                      <option value="Attiva">Attiva</option>
                      <option value="Conclusa">Conclusa</option>
                    </select>
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
