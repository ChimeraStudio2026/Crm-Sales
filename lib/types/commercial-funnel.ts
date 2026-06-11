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
}

export interface CommercialFunnelEntry {
  id: string;
  clientId: string;
  actions: FunnelActionSlot[];
  lostReason: string;
  createdAt: string;
}

export type FunnelSemaforoState = 'green' | 'red';

export interface FunnelRowStatus {
  label: string;
  date: string;
}
