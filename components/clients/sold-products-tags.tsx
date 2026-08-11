'use client';

import { useMemo } from 'react';
import { buildClientSoldProducts } from '@/lib/crm/client-sold-products';
import { formatCurrency } from '@/lib/crm/utils';
import type { Client, OkrRecord } from '@/lib/types/crm';

const PRODUCT_TAG_CLASS: Record<string, string> = {
  Prod: 'product-sold-tag--prod',
  'Mini Prod': 'product-sold-tag--mini-prod',
  Content: 'product-sold-tag--content',
  Evento: 'product-sold-tag--evento',
};

interface SoldProductsTagsProps {
  client: Client;
  okrRecords: OkrRecord[];
}

export function SoldProductsTags({ client, okrRecords }: SoldProductsTagsProps) {
  const soldProducts = useMemo(
    () => buildClientSoldProducts(okrRecords, client.name),
    [client.name, okrRecords],
  );

  return (
    <div className="product-offers-block product-sold-block">
      <span className="product-offers-label">Prodotti venduti</span>
      <p className="product-offers-hint">Da OKR importati, ordinati per fatturato.</p>
      {soldProducts.length === 0 ? (
        <p className="product-offers-empty">Nessun OKR registrato per questo cliente.</p>
      ) : (
        <div className="product-offers-tags">
          {soldProducts.map((product) => {
            const tagClass = PRODUCT_TAG_CLASS[product.productType] || '';
            return (
              <span
                key={product.productType}
                className={`product-offer-tag product-sold-tag is-active ${tagClass}`.trim()}
                style={{ cursor: 'default' }}
                title={`${product.count} OKR · ${formatCurrency(product.totalAmount)}`}
              >
                <span className="product-offer-dot" />
                {product.productType}
                <span className="product-sold-amount">{formatCurrency(product.totalAmount)}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
