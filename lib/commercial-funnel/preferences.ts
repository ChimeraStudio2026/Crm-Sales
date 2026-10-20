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

/** Vista di Sales: obiettivi e campagne in un'unica lista, oppure i clienti delle campagne. */
export type SalesPageView = 'list' | 'clients';

export const SALES_PAGE_VIEW_STORAGE_KEY = 'crm-sales-page-view';

export function readSalesPageViewPreference(): SalesPageView {
  if (typeof window === 'undefined') return 'list';
  try {
    return window.localStorage.getItem(SALES_PAGE_VIEW_STORAGE_KEY) === 'clients' ? 'clients' : 'list';
  } catch {
    return 'list';
  }
}

export function writeSalesPageViewPreference(view: SalesPageView): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SALES_PAGE_VIEW_STORAGE_KEY, view);
  } catch {
    // Preferenza non salvabile: la vista vale solo per questa visita.
  }
}

export type FunnelClientSortKey ='client' | 'campaign' | 'stage' | 'owner' | 'semaforo' | 'lastAction';
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

export const FUNNEL_OWNER_FILTER_STORAGE_KEY = 'crm-funnel-owner-filter';

/** Owner selezionati nei toggle del funnel (vuoto = tutti). */
export function readFunnelOwnerFilter(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FUNNEL_OWNER_FILTER_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((owner): owner is string => typeof owner === 'string') : [];
  } catch {
    return [];
  }
}

export function writeFunnelOwnerFilter(owners: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FUNNEL_OWNER_FILTER_STORAGE_KEY, JSON.stringify(owners));
  } catch {
    // Filtro non salvabile: resta valido solo per questa visita.
  }
}
