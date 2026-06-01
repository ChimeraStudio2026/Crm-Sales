import type { ClientType } from '@/lib/types/crm';

export type ProductOfferId = 'prod' | 'content' | 'eventi' | 'mini';

export interface ProductOfferDefinition {
  id: ProductOfferId;
  title: string;
  types: ClientType[];
  dotColor: string;
  badgeBg: string;
  badgeColor: string;
}

export const CLIENT_PRODUCT_OFFERS: ProductOfferDefinition[] = [
  {
    id: 'prod',
    title: 'Prod',
    types: ['Agenzia'],
    dotColor: '#8b5cf6',
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    badgeColor: '#7c3aed',
  },
  {
    id: 'content',
    title: 'Content Creation',
    types: ['Agenzia PR', 'Agenzia'],
    dotColor: '#06b6d4',
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    badgeColor: '#0891b2',
  },
  {
    id: 'eventi',
    title: 'Copertura Eventi',
    types: ['Cliente Diretto', 'Agenzia PR'],
    dotColor: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeColor: '#d97706',
  },
  {
    id: 'mini',
    title: 'Mini prod',
    types: ['Agenzia', 'CDP'],
    dotColor: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeColor: '#059669',
  },
];

export const PRODUCT_OFFER_IDS: ProductOfferId[] = CLIENT_PRODUCT_OFFERS.map((offer) => offer.id);
