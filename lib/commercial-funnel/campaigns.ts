import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';
import type { MailCampaign } from '@/lib/types/mail-campaigns';
import type { CommercialFunnelEntry } from '@/lib/types/commercial-funnel';
import { isFunnelTerminalConvertedEntry, isFunnelTerminalLost, resolveFunnelSemaforo } from '@/lib/commercial-funnel/index';

export interface FunnelCampaignDashboardRow {
  campaign: MailCampaign;
  totalClients: number;
  activeCount: number;
  convertedCount: number;
  lostCount: number;
  redSemaforoCount: number;
}

export function filterCampaignsByWorkspace(
  campaigns: MailCampaign[],
  workspaceId: string,
): MailCampaign[] {
  return campaigns.filter((campaign) => (campaign.workspaceId || DEFAULT_WORKSPACE_ID) === workspaceId);
}

export function isClosedCampaign(campaign: MailCampaign): boolean {
  return campaign.status === 'Chiusa';
}

export function filterVisibleCampaigns(
  campaigns: MailCampaign[],
  hideClosed: boolean,
): MailCampaign[] {
  if (!hideClosed) {
    return campaigns;
  }
  return campaigns.filter((campaign) => !isClosedCampaign(campaign));
}

export function filterEntriesByVisibleCampaigns(
  entries: CommercialFunnelEntry[],
  visibleCampaignIds: ReadonlySet<string>,
): CommercialFunnelEntry[] {
  return entries.filter((entry) => visibleCampaignIds.has(entry.campaignId));
}

export function filterFunnelEntriesByWorkspace(
  entries: CommercialFunnelEntry[],
  workspaceId: string,
): CommercialFunnelEntry[] {
  return entries.filter((entry) => (entry.workspaceId || DEFAULT_WORKSPACE_ID) === workspaceId);
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

export function countRedFunnelSemafori(entries: CommercialFunnelEntry[]): number {
  return entries.filter((entry) => resolveFunnelSemaforo(entry.actions) === 'red').length;
}

export function buildFunnelCampaignDashboardRow(
  campaign: MailCampaign,
  entries: CommercialFunnelEntry[],
): FunnelCampaignDashboardRow {
  const campaignEntries = getFunnelEntriesForCampaign(entries, campaign.id);
  const lostCount = campaignEntries.filter(isFunnelTerminalLost).length;
  const convertedCount = campaignEntries.filter(isFunnelTerminalConvertedEntry).length;
  return {
    campaign,
    totalClients: campaignEntries.length,
    activeCount: campaignEntries.length - lostCount - convertedCount,
    convertedCount,
    lostCount,
    redSemaforoCount: countRedFunnelSemafori(campaignEntries),
  };
}
