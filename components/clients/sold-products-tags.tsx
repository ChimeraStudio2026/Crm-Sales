'use client';

import { useMemo } from 'react';
import { buildClientSoldProducts } from '@/lib/crm/client-sold-products';
import { formatCurrency } from '@/lib/crm/utils';
import type { Client, OkrRecord } from '@/lib/types/crm';

const PRODUCT_TAG_STYLES: Record<string, { bg: string; color: string }> = {
  Prod: { bg: '#fef3c7', color: '#b45309' },
  'Mini Prod': { bg: '#fce7f3', color: '#be185d' },
  Content: { bg: '#dbeafe', color: '#1d4ed8' },
  Evento: { bg: '#d1fae5', color: '#047857' },
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
            const style = PRODUCT_TAG_STYLES[product.productType] || {
              bg: 'var(--bg-hover)',
              color: 'var(--text-secondary)',
            };
            return (
              <span
                key={product.productType}
                className="product-offer-tag product-sold-tag is-active"
                style={{
                  background: style.bg,
                  color: style.color,
                  borderColor: style.color,
                  cursor: 'default',
                }}
                title={`${product.count} OKR · ${formatCurrency(product.totalAmount)}`}
              >
                <span className="product-offer-dot" style={{ background: style.color }} />
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
