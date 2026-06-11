import type { MailCampaign } from '@/lib/types/mail-campaigns';
import type { CommercialFunnelEntry } from '@/lib/types/commercial-funnel';
import { isFunnelTerminalLost } from '@/lib/commercial-funnel/index';

export interface FunnelCampaignDashboardRow {
  campaign: MailCampaign;
  totalClients: number;
  activeCount: number;
  lostCount: number;
}

export function getFunnelEntriesForCampaign(
  entries: CommercialFunnelEntry[],
  campaignId: string,
): CommercialFunnelEntry[] {
  return entries.filter((entry) => entry.campaignId === campaignId);
}

export function getFunnelEntriesForClient(
  entries: CommercialFunnelEntry[],
  clientId: string,
): CommercialFunnelEntry[] {
  return entries.filter((entry) => entry.clientId === clientId);
}

export function buildFunnelCampaignDashboardRow(
  campaign: MailCampaign,
  entries: CommercialFunnelEntry[],
): FunnelCampaignDashboardRow {
  const campaignEntries = getFunnelEntriesForCampaign(entries, campaign.id);
  const lostCount = campaignEntries.filter(isFunnelTerminalLost).length;
  return {
    campaign,
    totalClients: campaignEntries.length,
    activeCount: campaignEntries.length - lostCount,
    lostCount,
  };
}
