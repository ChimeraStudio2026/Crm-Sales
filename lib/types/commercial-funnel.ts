export const FUNNEL_ACTION_TYPES = [
  'Mail Di contatto',
  'Incontro in presenza',
  'Call',
  'Instagram',
  'Messaggio',
  'Fissato appuntamento',
  'Quotazione richiesta',
  'Convertito',
  'Perso',
] as const;

export type FunnelActionType = typeof FUNNEL_ACTION_TYPES[number];

export const FUNNEL_STAGES = [
  'In contatto',
  'Incontro fissato',
  'Preventivo richiesto',
  'Convertito',
  'Perso',
] as const;

export type FunnelStage = typeof FUNNEL_STAGES[number];

export interface FunnelActionSlot {
  type: FunnelActionType | '';
  date: string;
  note: string;
  taskIds: string[];
}

export type FunnelClientSource = 'cold' | 'main';

export interface FunnelClientRef {
  clientId: string;
  contactId: string;
  clientSource: FunnelClientSource;
}

export interface CommercialFunnelEntry {
  id: string;
  workspaceId: string;
  campaignId: string;
  clientId: string;
  contactId: string;
  clientSource: FunnelClientSource;
  owner: string;
  stage: FunnelStage;
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
