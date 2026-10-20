import { QUOTE_SECTIONS } from '@/lib/quotes/sections';
import type { QuoteDraft, QuoteItem, QuoteSectionCode, QuoteSectionTotals, QuoteTotals } from '@/lib/quotes/types';

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function itemWorkDays(item: QuoteItem): number {
  return (item.prepDays || 0) + (item.days || 0);
}

/** PRICE di riga come in Cerbero: QTY × giorni × UNIT PRICE, maggiorato del NIC. */
export function itemPrice(item: QuoteItem): number {
  return roundCents(item.qty * itemWorkDays(item) * item.unitPrice * (1 + (item.nic || 0) / 100));
}

export function itemCost(item: QuoteItem): number {
  if (item.unitCost === null) return 0;
  return roundCents(item.qty * itemWorkDays(item) * item.unitCost);
}

export function computeQuoteTotals(
  quote: Pick<QuoteDraft, 'items' | 'productionFeePct' | 'premium' | 'vatPct'>,
): QuoteTotals {
  const feeRate = (quote.productionFeePct || 0) / 100;
  const sections: QuoteSectionTotals[] = QUOTE_SECTIONS.map(({ code }) => {
    const items = quote.items.filter((item) => item.section === code);
    const subtotal = roundCents(items.reduce((sum, item) => sum + itemPrice(item), 0));
    const extras = roundCents(items.reduce((sum, item) => sum + (item.extras || 0), 0));
    const fee = roundCents(subtotal * feeRate);
    const cost = roundCents(items.reduce((sum, item) => sum + itemCost(item), 0));
    return { section: code, subtotal, extras, fee, total: roundCents(subtotal + fee), cost };
  });
  const subtotal = roundCents(sections.reduce((sum, section) => sum + section.subtotal, 0));
  const extras = roundCents(sections.reduce((sum, section) => sum + section.extras, 0));
  const fee = roundCents(sections.reduce((sum, section) => sum + section.fee, 0));
  const premium = roundCents(quote.premium || 0);
  const total = roundCents(subtotal + fee + premium);
  const vat = roundCents(total * ((quote.vatPct || 0) / 100));
  const cost = roundCents(sections.reduce((sum, section) => sum + section.cost, 0));
  const margin = roundCents(total - cost);
  return {
    sections,
    subtotal,
    extras,
    fee,
    premium,
    total,
    vat,
    totalWithVat: roundCents(total + vat),
    cost,
    margin,
    marginPct: total > 0 ? margin / total : 0,
  };
}

export function getSectionTotals(totals: QuoteTotals, code: QuoteSectionCode): QuoteSectionTotals {
  return totals.sections.find((section) => section.section === code) ?? {
    section: code,
    subtotal: 0,
    extras: 0,
    fee: 0,
    total: 0,
    cost: 0,
  };
}

/** Premium che porta il totale a una cifra tonda scelta (es. 19.000 €). */
export function premiumForTargetTotal(
  quote: Pick<QuoteDraft, 'items' | 'productionFeePct' | 'vatPct'>,
  targetTotal: number,
): number {
  const base = computeQuoteTotals({ ...quote, premium: 0 });
  return roundCents(targetTotal - base.total);
}

export function formatQuoteCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}
