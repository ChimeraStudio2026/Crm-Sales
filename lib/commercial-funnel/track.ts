import type { Client } from '@/lib/types/crm';
import type { CommercialFunnelEntry, FunnelTrack } from '@/lib/types/commercial-funnel';
import type { MailCampaign } from '@/lib/types/mail-campaigns';
import { isFunnelTerminalConvertedEntry } from '@/lib/commercial-funnel/index';

export const FUNNEL_TRACK_LABELS: Record<FunnelTrack, string> = {
  cold: 'Clienti freddi',
  warm: 'Clienti caldi',
};

export const FUNNEL_TRACK_DESCRIPTIONS: Record<FunnelTrack, string> = {
  cold: 'New business: clienti che non hanno ancora fatturato. Seguiti da SDR e Virginia.',
  warm: 'Clienti esistenti: hanno fatturato almeno 1€. Seguiti da Martina.',
};

export function getClientTotalRevenue(client: Client): number {
  return (Number(client.rev2023) || 0)
    + (Number(client.rev2024) || 0)
    + (Number(client.rev2025) || 0)
    + (Number(client.rev2026) || 0);
}

/** Un cliente è caldo se ci ha fatturato almeno 1€, altrimenti è freddo. */
export function resolveClientFunnelTrack(client: Client): FunnelTrack {
  return getClientTotalRevenue(client) > 0 ? 'warm' : 'cold';
}

export function normalizeFunnelTrack(value: unknown): FunnelTrack {
  return value === 'warm' ? 'warm' : 'cold';
}

export function filterCampaignsByTrack(
  campaigns: MailCampaign[],
  track: FunnelTrack,
): MailCampaign[] {
  return campaigns.filter((campaign) => normalizeFunnelTrack(campaign.funnelTrack) === track);
}

/**
 * Il cliente non appartiene al funnel della sua campagna.
 * Eccezione: un cliente freddo convertito nel funnel freddi diventa caldo, ed è corretto che resti lì.
 */
export function isFunnelEntryOutOfTrack(
  entry: CommercialFunnelEntry,
  client: Client | undefined,
  campaignTrack: FunnelTrack,
): boolean {
  if (!client) return false;
  const clientTrack = resolveClientFunnelTrack(client);
  if (clientTrack === campaignTrack) return false;
  if (campaignTrack === 'cold' && isFunnelTerminalConvertedEntry(entry)) return false;
  return true;
}
