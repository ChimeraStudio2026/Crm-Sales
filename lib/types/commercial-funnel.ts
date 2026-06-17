export const FUNNEL_ACTION_TYPES = [
  'Mail Di contatto',
  'Incontro in presenza',
  'Call',
  'Quotazione richiesta',
  'Convertito',
  'Perso',
] as const;

export type FunnelActionType = typeof FUNNEL_ACTION_TYPES[number];

export interface FunnelActionSlot {
  type: FunnelActionType | '';
  date: string;
  note: string;
  taskIds: string[];
}

export type FunnelClientSource = 'cold' | 'main';

export interface FunnelClientRef {
  clientId: string;
  clientSource: FunnelClientSource;
}

export interface CommercialFunnelEntry {
  id: string;
  campaignId: string;
  clientId: string;
  clientSource: FunnelClientSource;
  actions: FunnelActionSlot[];
  lostReason: string;
  createdAt: string;
}

export type FunnelSemaforoState = 'green' | 'red';

export interface FunnelRowStatus {
  label: string;
  date: string;
}

export interface FunnelBrandSearchResult {
  entryId: string;
  clientId: string;
  clientName: string;
  campaignId: string;
  campaignName: string;
  clientSource: FunnelClientSource;
}
