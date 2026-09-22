export const HIDE_CLOSED_FUNNEL_CAMPAIGNS_STORAGE_KEY = 'crm-funnel-hide-closed-campaigns';

export function readHideClosedFunnelCampaignsPreference(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(HIDE_CLOSED_FUNNEL_CAMPAIGNS_STORAGE_KEY) !== 'false';
}

export function writeHideClosedFunnelCampaignsPreference(hideClosed: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HIDE_CLOSED_FUNNEL_CAMPAIGNS_STORAGE_KEY, String(hideClosed));
}
