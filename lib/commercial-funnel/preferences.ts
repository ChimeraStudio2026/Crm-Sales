import type { FunnelTrack } from '@/lib/types/commercial-funnel';

export const HIDE_CLOSED_FUNNEL_CAMPAIGNS_STORAGE_KEY = 'crm-funnel-hide-closed-campaigns';

export function readHideClosedFunnelCampaignsPreference(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(HIDE_CLOSED_FUNNEL_CAMPAIGNS_STORAGE_KEY) !== 'false';
}

export function writeHideClosedFunnelCampaignsPreference(hideClosed: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HIDE_CLOSED_FUNNEL_CAMPAIGNS_STORAGE_KEY, String(hideClosed));
}

export const FUNNEL_TRACK_STORAGE_KEY = 'crm-funnel-track';

export function readFunnelTrackPreference(): FunnelTrack {
  if (typeof window === 'undefined') return 'cold';
  try {
    return window.localStorage.getItem(FUNNEL_TRACK_STORAGE_KEY) === 'warm' ? 'warm' : 'cold';
  } catch {
    return 'cold';
  }
}

export function writeFunnelTrackPreference(track: FunnelTrack): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FUNNEL_TRACK_STORAGE_KEY, track);
  } catch {
    // Preferenza non salvabile (storage bloccato): si riparte da "freddi".
  }
}

export type FunnelClientSortMode = 'alpha' | 'custom';

export const FUNNEL_CLIENT_SORT_MODE_STORAGE_KEY = 'crm-funnel-client-sort-mode';
export const FUNNEL_CLIENT_ORDER_STORAGE_KEY = 'crm-funnel-client-order';

export function readFunnelClientSortMode(): FunnelClientSortMode {
  if (typeof window === 'undefined') return 'alpha';
  try {
    return window.localStorage.getItem(FUNNEL_CLIENT_SORT_MODE_STORAGE_KEY) === 'custom' ? 'custom' : 'alpha';
  } catch {
    return 'alpha';
  }
}

export function writeFunnelClientSortMode(mode: FunnelClientSortMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FUNNEL_CLIENT_SORT_MODE_STORAGE_KEY, mode);
  } catch {
    // Preferenza non salvabile: resta valida solo per questa visita.
  }
}

/** Entry ids in the order chosen by the user (one list shared by every funnel view). */
export function readFunnelClientOrder(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FUNNEL_CLIENT_ORDER_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function writeFunnelClientOrder(entryIds: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FUNNEL_CLIENT_ORDER_STORAGE_KEY, JSON.stringify(entryIds));
  } catch {
    // Ordine non salvabile: resta valido solo per questa visita.
  }
}
