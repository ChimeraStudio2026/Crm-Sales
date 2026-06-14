'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GitBranch, Plus } from 'lucide-react';
import { buildFunnelCampaignDashboardRow } from '@/lib/commercial-funnel/campaigns';
import { CampaignNameCell } from '@/components/mail-campaigns/campaign-name-cell';
import { CampaignTableActions } from '@/components/mail-campaigns/campaign-table-actions';
import { MAIL_CAMPAIGN_STATUS_LABELS } from '@/lib/constants/mail-campaigns';
import { useCrm } from '@/providers/crm-provider';
import { TopHeader } from '@/components/layout/top-header';
import type { MailCampaignStatus } from '@/lib/types/mail-campaigns';

export function CommercialFunnelSection() {
  const router = useRouter();
  const {
    mailCampaigns,
    commercialFunnelEntries,
    saveMailCampaign,
    deleteMailCampaignById,
  } = useCrm();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MailCampaignStatus>('Bozza');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const rows = useMemo(
    () => mailCampaigns.map((campaign) => buildFunnelCampaignDashboardRow(
      campaign,
      commercialFunnelEntries,
    )),
    [mailCampaigns, commercialFunnelEntries],
  );

  const handleCreate = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const campaignId = await saveMailCampaign({
      name,
      description,
      status,
      startDate,
      endDate,
    });
    setShowForm(false);
    setName('');
    setDescription('');
    setStatus('Bozza');
    setStartDate('');
    setEndDate('');
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
      createdAt: campaign.createdAt,
    });
  };

  const handleDeleteCampaign = async (campaignId: string, campaignName: string): Promise<void> => {
    if (!window.confirm(`Eliminare la campagna "${campaignName}"?\n\nVerranno rimossi anche clienti e dati del funnel collegati.`)) {
      return;
    }
    await deleteMailCampaignById(campaignId);
  };

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="table-filter-bar">
            <div className="filter-left">
              <h3 className="commercial-funnel-title">
                <GitBranch size={20} />
                Funnel Commerciale
              </h3>
            </div>
            <div className="filter-right">
              <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                <Plus size={16} />
                <span>Nuova campagna</span>
              </button>
            </div>
          </div>
          <div className="mail-campaigns-table-wrap glass-card">
            <table className="analysis-table mail-campaigns-table">
              <thead>
                <tr>
                  <th>Nome Campagna</th>
                  <th>Stato</th>
                  <th>Data Inizio</th>
                  <th>Clienti</th>
                  <th>Attivi</th>
                  <th>Persi</th>
                  <th>Semafori rossi</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="mail-campaigns-empty">
                      Nessuna campagna. Creane una con + per iniziare il funnel commerciale.
                    </td>
                  </tr>
                ) : (
                  rows.map(({ campaign, totalClients, activeCount, lostCount, redSemaforoCount }) => (
                    <tr key={campaign.id}>
                      <td>
                        <CampaignNameCell campaign={campaign} onSaveName={handleRenameCampaign} />
                      </td>
                      <td>
                        <span className={`mail-campaign-status mail-campaign-status-${campaign.status.toLowerCase()}`}>
                          {MAIL_CAMPAIGN_STATUS_LABELS[campaign.status]}
                        </span>
                      </td>
                      <td>{campaign.startDate || '—'}</td>
                      <td className="analysis-num">{totalClients}</td>
                      <td className="analysis-num">{activeCount}</td>
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
