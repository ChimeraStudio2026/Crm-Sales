import { CLIENT_PRODUCT_OFFERS, type ProductOfferDefinition, type ProductOfferId } from '@/lib/constants/product-offers';
import type { Client, ClientType } from '@/lib/types/crm';

export function getApplicableProductOffers(clientType: ClientType): ProductOfferDefinition[] {
  return CLIENT_PRODUCT_OFFERS.filter((offer) => offer.types.includes(clientType));
}

export function getDefaultProductOfferIds(clientType: ClientType): ProductOfferId[] {
  return getApplicableProductOffers(clientType).map((offer) => offer.id);
}

export function resolveClientProductOffers(
  clientType: ClientType,
  storedOffers: string[] | null | undefined,
): ProductOfferId[] {
  const applicable = getDefaultProductOfferIds(clientType);
  if (!Array.isArray(storedOffers) || storedOffers.length === 0) {
    return applicable;
  }
  const filtered = storedOffers.filter(
    (offerId): offerId is ProductOfferId =>
      applicable.includes(offerId as ProductOfferId),
  );
  return filtered.length > 0 ? filtered : applicable;
}

export function normalizeClientProductOffers(client: Client): ProductOfferId[] {
  const resolved = resolveClientProductOffers(client.type, client.productOffers);
  client.productOffers = resolved;
  return resolved;
}

export function isProductOfferEnabled(client: Client, offerId: ProductOfferId): boolean {
  const offers = normalizeClientProductOffers(client);
  return offers.includes(offerId);
}

export function toggleClientProductOffer(client: Client, offerId: ProductOfferId): ProductOfferId[] {
  const applicable = getDefaultProductOfferIds(client.type);
  if (!applicable.includes(offerId)) return normalizeClientProductOffers(client);
  const current = normalizeClientProductOffers(client);
  const next = current.includes(offerId)
    ? current.filter((id) => id !== offerId)
    : [...current, offerId];
  client.productOffers = next;
  return next;
}

export function reconcileProductOffersForTypeChange(
  nextType: ClientType,
  currentOffers: string[] | null | undefined,
): ProductOfferId[] {
  return resolveClientProductOffers(nextType, currentOffers);
}
