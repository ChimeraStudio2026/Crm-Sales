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
