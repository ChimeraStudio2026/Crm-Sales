'use client';

import { getApplicableProductOffers } from '@/lib/crm/product-offers';
import type { ProductOfferId } from '@/lib/constants/product-offers';
import type { Client } from '@/lib/types/crm';

interface ProductOffersTagsProps {
  client: Client;
  enabledOfferIds: ProductOfferId[];
  onToggleOffer: (offerId: ProductOfferId) => Promise<void>;
}

export function ProductOffersTags({
  client,
  enabledOfferIds,
  onToggleOffer,
}: ProductOffersTagsProps) {
  const applicableOffers = getApplicableProductOffers(client.type);

  if (applicableOffers.length === 0) {
    return (
      <div className="product-offers-block">
        <span className="product-offers-label">Prodotti vendibili</span>
        <p className="product-offers-empty">
          Nessuna linea prodotto mappata per la tipologia «{client.type}».
        </p>
      </div>
    );
  }

  return (
    <div className="product-offers-block">
      <span className="product-offers-label">Prodotti vendibili</span>
      <p className="product-offers-hint">Clicca i tag per attivarli o disattivarli.</p>
      <div className="product-offers-tags">
        {applicableOffers.map((offer) => {
          const isEnabled = enabledOfferIds.includes(offer.id);
          return (
            <button
              key={offer.id}
              type="button"
              className={`product-offer-tag product-offer-${offer.id}${isEnabled ? ' is-active' : ' is-inactive'}`}
              style={{
                background: isEnabled ? offer.badgeBg : 'transparent',
                color: isEnabled ? offer.badgeColor : 'var(--text-muted)',
                borderColor: isEnabled ? offer.badgeColor : 'var(--border-color)',
              }}
              title={isEnabled ? 'Disattiva prodotto' : 'Attiva prodotto'}
              onClick={() => void onToggleOffer(offer.id)}
            >
              <span className="product-offer-dot" style={{ background: offer.dotColor }} />
              {offer.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
