'use client';

import { useMemo, useState } from 'react';
import { Mail, PlusCircle } from 'lucide-react';
import { buildCampaignDashboardRow } from '@/lib/mail-campaigns/index';
import { CampaignNameCell } from '@/components/mail-campaigns/campaign-name-cell';
import { CampaignStatusSelect } from '@/components/mail-campaigns/campaign-status-select';
import { CampaignTableActions } from '@/components/mail-campaigns/campaign-table-actions';
import { useCrm } from '@/providers/crm-provider';
import { TopHeader } from '@/components/layout/top-header';
import type { MailCampaignStatus } from '@/lib/types/mail-campaigns';

export function MailCampaignsSection() {
  const {
    mailCampaigns,
    mailCampaignSteps,
    mailCampaignContacts,
    mailCampaignSendTracking,
    saveMailCampaign,
    updateMailCampaignStatus,
    deleteMailCampaignById,
  } = useCrm();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MailCampaignStatus>('Bozza');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const rows = useMemo(
    () => mailCampaigns.map((campaign) => buildCampaignDashboardRow(
      campaign,
      mailCampaignContacts,
      mailCampaignSteps,
      mailCampaignSendTracking,
    )),
    [mailCampaigns, mailCampaignContacts, mailCampaignSteps, mailCampaignSendTracking],
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
    window.location.href = `/campaigns/${campaignId}`;
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

  const handleStatusChange = async (
    campaignId: string,
    nextStatus: MailCampaignStatus,
  ): Promise<void> => {
    await updateMailCampaignStatus(campaignId, nextStatus);
  };

  const handleDeleteCampaign = async (campaignId: string, campaignName: string): Promise<void> => {
    if (!window.confirm(`Eliminare la campagna "${campaignName}"?\n\nVerranno rimossi anche contatti e tracciamento mail collegati.`)) {
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
              <h3 className="mail-campaigns-title"><Mail size={20} /> Campagne Mail</h3>
            </div>
            <div className="filter-right">
              <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                <PlusCircle size={16} />
                <span>Nuova Campagna</span>
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
                  <th>Contatti Totali</th>
                  <th>Mail Inviate / Totali</th>
                  <th>Tasso Conversione</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="mail-campaigns-empty">
                      Nessuna campagna. Creane una per iniziare a tracciare le mail manuali.
                    </td>
                  </tr>
                ) : (
                  rows.map(({ campaign, totalContacts, mailsSent, mailsTotal, conversionRate }) => (
                    <tr key={campaign.id}>
                      <td>
                        <CampaignNameCell campaign={campaign} onSaveName={handleRenameCampaign} />
                      </td>
                      <td>
                        <CampaignStatusSelect
                          value={campaign.status}
                          onChange={(nextStatus) => void handleStatusChange(campaign.id, nextStatus)}
                        />
                      </td>
                      <td>{campaign.startDate || '—'}</td>
                      <td className="analysis-num">{totalContacts}</td>
                      <td className="analysis-num">{mailsSent} / {mailsTotal}</td>
                      <td className="analysis-num">{conversionRate}%</td>
                      <td>
                        <CampaignTableActions
                          manageHref={`/campaigns/${campaign.id}`}
                          manageLabel="Gestisci Campagna"
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
            <div className="drawer-header"><h3>Nuova Campagna Mail</h3></div>
            <form onSubmit={handleCreate}>
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
                <button type="submit" className="btn btn-primary">Crea Campagna</button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
