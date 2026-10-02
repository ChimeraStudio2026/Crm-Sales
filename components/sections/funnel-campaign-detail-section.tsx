'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FunnelClientsTable } from '@/components/commercial-funnel/funnel-clients-table';
import { FunnelClientsView } from '@/components/commercial-funnel/funnel-clients-view';
import { FunnelStatsCharts } from '@/components/commercial-funnel/funnel-stats-charts';
import { CampaignStatusSelect } from '@/components/mail-campaigns/campaign-status-select';
import { getFunnelEntriesForCampaign } from '@/lib/commercial-funnel/campaigns';
import { buildFunnelStatsSummary } from '@/lib/commercial-funnel/stats';
import { filterCampaignsByWorkspace } from '@/lib/commercial-funnel/campaigns';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { TopHeader } from '@/components/layout/top-header';

interface FunnelCampaignDetailSectionProps {
  campaignId: string;
  focusEntryId?: string;
}

type CampaignDetailView = 'table' | 'clients';

export function FunnelCampaignDetailSection({ campaignId, focusEntryId }: FunnelCampaignDetailSectionProps) {
  const { clients, mailCampaigns, commercialFunnelEntries, updateMailCampaignStatus } = useCrm();
  const { workspaceId } = useWorkspace();
  const [detailView, setDetailView] = useState<CampaignDetailView>('table');

  const campaign = mailCampaigns.find((item) => item.id === campaignId);
  const isCampaignInWorkspace = campaign
    ? filterCampaignsByWorkspace([campaign], workspaceId).length > 0
    : false;
  const entries = useMemo(
    () => getFunnelEntriesForCampaign(commercialFunnelEntries, campaignId),
    [commercialFunnelEntries, campaignId],
  );

  const stats = useMemo(
    () => buildFunnelStatsSummary(entries),
    [entries],
  );

  if (!campaign || !isCampaignInWorkspace) {
    return (
      <>
        <TopHeader />
        <div className="content-body">
          <p className="mail-campaigns-empty">Campagna non trovata.</p>
          <Link href="/funnel" className="btn btn-secondary">Torna all&apos;elenco</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="funnel-campaign-detail-header glass-card">
            <div className="funnel-campaign-detail-top">
              <Link href="/funnel" className="btn btn-secondary btn-sm">
                <ArrowLeft size={16} />
                <span>Campagne</span>
              </Link>
            </div>
            <h2>{campaign.name}</h2>
            {campaign.description && (
              <p className="funnel-campaign-detail-desc">{campaign.description}</p>
            )}
            <div className="funnel-campaign-detail-meta">
              <span className="funnel-campaign-detail-status">
                Stato:{' '}
                <CampaignStatusSelect
                  className="table-cell-select funnel-campaign-status-select"
                  value={campaign.status}
                  onChange={(nextStatus) => void updateMailCampaignStatus(campaign.id, nextStatus)}
                />
              </span>
              {campaign.startDate && <span>Inizio: <strong>{campaign.startDate}</strong></span>}
              {campaign.endDate && <span>Fine: <strong>{campaign.endDate}</strong></span>}
            </div>
          </div>
          <FunnelStatsCharts title="Totali campagna" stats={stats} />
          <div className="funnel-campaign-view-toolbar">
            <div className="task-view-toggle" role="group" aria-label="Vista campagna">
              <button
                type="button"
                className={`task-view-toggle-btn${detailView === 'table' ? ' is-active' : ''}`}
                onClick={() => setDetailView('table')}
              >
                Tabella azioni
              </button>
              <button
                type="button"
                className={`task-view-toggle-btn${detailView === 'clients' ? ' is-active' : ''}`}
                onClick={() => setDetailView('clients')}
              >
                Clienti
              </button>
            </div>
          </div>
          {detailView === 'clients' ? (
            <FunnelClientsView
              entries={entries}
              clients={clients}
              mailCampaigns={mailCampaigns}
            />
          ) : (
            <FunnelClientsTable campaignId={campaignId} entries={entries} focusEntryId={focusEntryId} />
          )}
        </section>
      </div>
    </>
  );
}
