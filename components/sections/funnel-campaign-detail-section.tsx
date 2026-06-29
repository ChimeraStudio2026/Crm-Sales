'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FunnelClientsTable } from '@/components/commercial-funnel/funnel-clients-table';
import { getFunnelEntriesForCampaign } from '@/lib/commercial-funnel/campaigns';
import { isFunnelTerminalConvertedEntry, isFunnelTerminalLost } from '@/lib/commercial-funnel/index';
import { MAIL_CAMPAIGN_STATUS_LABELS } from '@/lib/constants/mail-campaigns';
import { useCrm } from '@/providers/crm-provider';
import { TopHeader } from '@/components/layout/top-header';

interface FunnelCampaignDetailSectionProps {
  campaignId: string;
}

export function FunnelCampaignDetailSection({ campaignId }: FunnelCampaignDetailSectionProps) {
  const { mailCampaigns, commercialFunnelEntries } = useCrm();

  const campaign = mailCampaigns.find((item) => item.id === campaignId);
  const entries = useMemo(
    () => getFunnelEntriesForCampaign(commercialFunnelEntries, campaignId),
    [commercialFunnelEntries, campaignId],
  );

  const stats = useMemo(() => {
    const lostCount = entries.filter(isFunnelTerminalLost).length;
    const convertedCount = entries.filter(isFunnelTerminalConvertedEntry).length;
    return {
      total: entries.length,
      active: entries.length - lostCount - convertedCount,
      converted: convertedCount,
      lost: lostCount,
    };
  }, [entries]);

  if (!campaign) {
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
              <span>
                Stato:{' '}
                <strong>{MAIL_CAMPAIGN_STATUS_LABELS[campaign.status]}</strong>
              </span>
              {campaign.startDate && <span>Inizio: <strong>{campaign.startDate}</strong></span>}
              {campaign.endDate && <span>Fine: <strong>{campaign.endDate}</strong></span>}
              <span>Clienti: <strong>{stats.total}</strong></span>
              <span>Attivi: <strong>{stats.active}</strong></span>
              <span className="funnel-stat-converted">Convertiti: <strong>{stats.converted}</strong></span>
              <span>Persi: <strong>{stats.lost}</strong></span>
            </div>
          </div>
          <FunnelClientsTable campaignId={campaignId} entries={entries} />
        </section>
      </div>
    </>
  );
}
