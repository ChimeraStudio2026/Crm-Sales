import type { MailCampaign } from '@/lib/types/mail-campaigns';
import type { Client } from '@/lib/types/crm';
import type { CommercialFunnelEntry, FunnelBrandSearchResult } from '@/lib/types/commercial-funnel';
import { isFunnelTerminalConvertedEntry, isFunnelTerminalLost, resolveFunnelSemaforo } from '@/lib/commercial-funnel/index';

export interface FunnelCampaignDashboardRow {
  campaign: MailCampaign;
  totalClients: number;
  activeCount: number;
  convertedCount: number;
  lostCount: number;
  redSemaforoCount: number;
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

export function searchFunnelEntriesByBrandName(
  query: string,
  entries: CommercialFunnelEntry[],
  clients: Client[],
  campaigns: MailCampaign[],
): FunnelBrandSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return [];
  const clientIds = new Set(
    clients
      .filter((client) => client.name.toLowerCase().includes(normalizedQuery))
      .map((client) => client.id),
  );
  return entries
    .filter((entry) => clientIds.has(entry.clientId))
    .map((entry) => {
      const client = clients.find((item) => item.id === entry.clientId);
      const campaign = campaigns.find((item) => item.id === entry.campaignId);
      return {
        entryId: entry.id,
        clientId: entry.clientId,
        clientName: client?.name || entry.clientId,
        campaignId: entry.campaignId,
        campaignName: campaign?.name || entry.campaignId,
        clientSource: entry.clientSource,
      };
    })
    .sort((a, b) => a.clientName.localeCompare(b.clientName, 'it'));
}
