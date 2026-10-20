import type { AssistantQuote } from '@/lib/quotes/assistant-schema';
import { findCatalogEntry } from '@/lib/quotes/catalog';
import { computeQuoteTotals, premiumForTargetTotal } from '@/lib/quotes/calc';
import { createEmptySectionNotes } from '@/lib/quotes/draft';
import type { QuoteDraft, QuoteItem, QuoteOutput } from '@/lib/quotes/types';

function nonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Applica la bozza di Claude al preventivo corrente. I prezzi delle voci di
 * listino vengono sempre dal listino, mai dal modello: Claude decide solo
 * quali voci, quante e per quanti giorni.
 */
export function applyAssistantDraft(current: QuoteDraft, draft: AssistantQuote['quote']): QuoteDraft {
  const items: QuoteItem[] = draft.items.map((item) => {
    const entry = findCatalogEntry(item.catalogName);
    const listPrice = entry?.dailyPrice ?? 0;
    return {
      id: crypto.randomUUID(),
      section: item.section,
      catalogName: entry?.name ?? '',
      job: item.job || entry?.name || '',
      note: item.note,
      qty: nonNegative(item.qty) || 1,
      prepDays: nonNegative(item.prepDays),
      days: nonNegative(item.days),
      unitPrice: item.customUnitPrice !== null ? nonNegative(item.customUnitPrice) : listPrice,
      unitCost: entry ? entry.dailyCost : null,
      nic: 0,
      extras: 0,
    };
  });
  const outputs: QuoteOutput[] = draft.outputs.map((output) => ({
    id: crypto.randomUUID(),
    name: output.name,
    description: output.description,
    qty: nonNegative(output.qty) || 1,
    duration: output.duration || '-',
    format: output.format || '-',
  }));
  const sectionNotes = createEmptySectionNotes().map((entry) => ({
    ...entry,
    note: draft.sectionNotes.find((note) => note.section === entry.section)?.note ?? '',
  }));
  const productionFeePct = Number.isFinite(draft.productionFeePct) ? draft.productionFeePct : current.productionFeePct;
  const next: QuoteDraft = {
    ...current,
    title: draft.title || current.title,
    clientName: draft.clientName || current.clientName,
    directClient: draft.directClient || current.directClient,
    description: draft.description || current.description,
    country: draft.country || current.country,
    sectionNotes,
    items,
    outputs,
    productionFeePct,
  };
  next.premium = draft.targetTotal !== null ? premiumForTargetTotal(next, draft.targetTotal) : 0;
  return next;
}

/** Bozza corrente nel formato che Claude restituisce, per mandargliela a ogni turno. */
export function quoteToAssistantDraft(quote: QuoteDraft): AssistantQuote['quote'] {
  return {
    title: quote.title,
    clientName: quote.clientName,
    directClient: quote.directClient,
    description: quote.description,
    country: quote.country,
    sectionNotes: quote.sectionNotes.filter((entry) => entry.note.trim()),
    items: quote.items.map((item) => {
      const entry = findCatalogEntry(item.catalogName);
      return {
        section: item.section,
        catalogName: item.catalogName,
        job: item.job,
        note: item.note,
        qty: item.qty,
        prepDays: item.prepDays,
        days: item.days,
        customUnitPrice: entry && entry.dailyPrice === item.unitPrice ? null : item.unitPrice,
      };
    }),
    outputs: quote.outputs.map(({ name, description, qty, duration, format }) => ({
      name,
      description,
      qty,
      duration,
      format,
    })),
    productionFeePct: quote.productionFeePct,
    // Un premium diverso da zero vuol dire che il totale è stato fissato a mano: lo ripassiamo come obiettivo.
    targetTotal: quote.premium !== 0 ? computeQuoteTotals(quote).total : null,
  };
}
