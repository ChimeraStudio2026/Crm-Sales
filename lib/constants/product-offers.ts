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
    dotColor: '#cd81fb',
    badgeBg: 'rgba(205, 129, 251, 0.2)',
    badgeColor: '#8a3fbf',
  },
  {
    id: 'content',
    title: 'Content Creation',
    types: ['Agenzia PR', 'Agenzia'],
    dotColor: '#58b5e7',
    badgeBg: 'rgba(88, 181, 231, 0.2)',
    badgeColor: '#20719e',
  },
  {
    id: 'eventi',
    title: 'Copertura Eventi',
    types: ['Cliente Diretto', 'Agenzia PR'],
    dotColor: '#e2c84a',
    badgeBg: 'rgba(240, 223, 118, 0.35)',
    badgeColor: '#876a00',
  },
  {
    id: 'mini',
    title: 'Mini prod',
    types: ['Agenzia', 'CDP'],
    dotColor: '#6fa460',
    badgeBg: 'rgba(111, 164, 96, 0.2)',
    badgeColor: '#3f7a33',
  },
];

export const PRODUCT_OFFER_IDS: ProductOfferId[] = CLIENT_PRODUCT_OFFERS.map((offer) => offer.id);
