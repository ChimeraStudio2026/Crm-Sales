import { findCatalogEntry } from '@/lib/quotes/catalog';
import { NOT_INCLUDED_NOTE, QUOTE_SECTIONS } from '@/lib/quotes/sections';
import type { QuoteDraft, QuoteItem, QuoteOutput, QuoteSectionCode, QuoteSectionNote } from '@/lib/quotes/types';

export const DEFAULT_PRODUCTION_FEE_PCT = 15;
export const DEFAULT_VAT_PCT = 22;
export const DEFAULT_VALIDITY_DAYS = 30;

function newId(): string {
  return crypto.randomUUID();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptySectionNotes(): QuoteSectionNote[] {
  return QUOTE_SECTIONS.map(({ code }) => ({ section: code, note: '' }));
}

export function createEmptyQuoteDraft(createdBy: string): QuoteDraft {
  const now = new Date().toISOString();
  return {
    id: newId(),
    code: '',
    title: '',
    version: 'V1',
    status: 'draft',
    clientName: '',
    clientVat: '',
    clientAddress: '',
    directClient: '',
    country: 'ITA',
    description: '',
    quoteDate: todayIso(),
    validityDays: DEFAULT_VALIDITY_DAYS,
    productionFeePct: DEFAULT_PRODUCTION_FEE_PCT,
    premium: 0,
    vatPct: DEFAULT_VAT_PCT,
    paymentTerms: 'DA DEFINIRE',
    sectionNotes: createEmptySectionNotes(),
    items: [],
    outputs: [],
    chat: [],
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

export function createQuoteItem(section: QuoteSectionCode, catalogName = ''): QuoteItem {
  const entry = findCatalogEntry(catalogName);
  return {
    id: newId(),
    section,
    catalogName: entry?.name ?? '',
    job: entry?.name ?? '',
    note: '',
    qty: 1,
    prepDays: 0,
    days: 1,
    unitPrice: entry?.dailyPrice ?? 0,
    unitCost: entry ? entry.dailyCost : null,
    nic: 0,
    extras: 0,
  };
}

export function createQuoteOutput(): QuoteOutput {
  return { id: newId(), name: '', description: '', qty: 1, duration: '-', format: '-' };
}

export function getSectionNote(quote: Pick<QuoteDraft, 'sectionNotes'>, code: QuoteSectionCode): string {
  return quote.sectionNotes.find((entry) => entry.section === code)?.note ?? '';
}

/** Nota da stampare nel REPORT: le sezioni vuote risultano "Not-Incl" come in Cerbero. */
export function resolveSectionReportNote(quote: QuoteDraft, code: QuoteSectionCode): string {
  const note = getSectionNote(quote, code).trim();
  if (note) return note;
  return quote.items.some((item) => item.section === code) ? '' : NOT_INCLUDED_NOTE;
}

export function setSectionNote(quote: QuoteDraft, code: QuoteSectionCode, note: string): QuoteSectionNote[] {
  const notes = quote.sectionNotes.length ? quote.sectionNotes : createEmptySectionNotes();
  return notes.map((entry) => (entry.section === code ? { ...entry, note } : entry));
}

/** Codice riga stile Cerbero (CREW_01, CREW_02...) calcolato dall'ordine nella sezione. */
export function resolveItemCode(quote: Pick<QuoteDraft, 'items'>, item: QuoteItem): string {
  const prefix = QUOTE_SECTIONS.find((section) => section.code === item.section)?.rowPrefix ?? item.section;
  const index = quote.items.filter((entry) => entry.section === item.section).indexOf(item);
  return `${prefix}_${String(index + 1).padStart(2, '0')}`;
}

export function buildQuoteDisplayTitle(quote: Pick<QuoteDraft, 'code' | 'title' | 'clientName' | 'version'>): string {
  const head = quote.code ? `${quote.code} || ` : '';
  const client = quote.clientName ? `${quote.clientName} ` : '';
  const version = quote.version ? ` - ${quote.version}` : '';
  return `${head}${client}${quote.title || 'Nuovo preventivo'}${version}`.trim();
}
