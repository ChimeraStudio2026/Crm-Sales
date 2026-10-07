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

export type FunnelClientSortKey = 'client' | 'campaign' | 'stage' | 'owner' | 'semaforo' | 'lastAction';
export type FunnelClientSortDirection = 'asc' | 'desc';

export interface FunnelClientSort {
  key: FunnelClientSortKey;
  direction: FunnelClientSortDirection;
}

export const DEFAULT_FUNNEL_CLIENT_SORT: FunnelClientSort = { key: 'client', direction: 'asc' };

export const FUNNEL_CLIENT_SORT_STORAGE_KEY = 'crm-funnel-client-sort';

const FUNNEL_CLIENT_SORT_KEYS: readonly FunnelClientSortKey[] = ['client', 'campaign', 'stage', 'owner', 'semaforo', 'lastAction'];

export function readFunnelClientSort(): FunnelClientSort {
  if (typeof window === 'undefined') return DEFAULT_FUNNEL_CLIENT_SORT;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FUNNEL_CLIENT_SORT_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return DEFAULT_FUNNEL_CLIENT_SORT;
    const { key, direction } = parsed as Partial<FunnelClientSort>;
    if (!key || !FUNNEL_CLIENT_SORT_KEYS.includes(key)) return DEFAULT_FUNNEL_CLIENT_SORT;
    return { key, direction: direction === 'desc' ? 'desc' : 'asc' };
  } catch {
    return DEFAULT_FUNNEL_CLIENT_SORT;
  }
}

export function writeFunnelClientSort(sort: FunnelClientSort): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FUNNEL_CLIENT_SORT_STORAGE_KEY, JSON.stringify(sort));
  } catch {
    // Ordinamento non salvabile: resta valido solo per questa visita.
  }
}
