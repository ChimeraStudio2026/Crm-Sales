import { CATALOG_ROWS } from '@/lib/quotes/catalog-data';
import type { QuoteSectionCode } from '@/lib/quotes/types';

export interface CatalogEntry {
  name: string;
  sections: readonly QuoteSectionCode[];
  dailyCost: number;
  dailyPrice: number;
  nightlyPrice: number;
  overtimePrice: number;
  holidayMultiplier: number;
  timeValue: string;
  defaultNic: number;
}

export const CATALOG: readonly CatalogEntry[] = CATALOG_ROWS.map(
  ([name, sections, dailyCost, dailyPrice, nightlyPrice, overtimePrice, holidayMultiplier, timeValue, defaultNic]) => ({
    name,
    sections,
    dailyCost,
    dailyPrice,
    nightlyPrice,
    overtimePrice,
    holidayMultiplier,
    timeValue,
    defaultNic,
  }),
);

function normalizeCatalogName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

const CATALOG_BY_NAME = new Map(CATALOG.map((entry) => [normalizeCatalogName(entry.name), entry]));

export function findCatalogEntry(name: string | null | undefined): CatalogEntry | null {
  if (!name) return null;
  return CATALOG_BY_NAME.get(normalizeCatalogName(name)) ?? null;
}

export function searchCatalog(query: string, section?: QuoteSectionCode): CatalogEntry[] {
  const needle = normalizeCatalogName(query);
  return CATALOG.filter((entry) => {
    if (section && !entry.sections.includes(section)) return false;
    return !needle || normalizeCatalogName(entry.name).includes(needle);
  });
}

/** Listino in formato compatto per il prompt di Claude: una riga per voce. */
export function formatCatalogForPrompt(): string {
  const header = 'nome | sezioni | prezzo giornaliero € | prezzo notturno € | orario';
  const lines = CATALOG.map((entry) =>
    [entry.name, entry.sections.join(','), entry.dailyPrice, entry.nightlyPrice, entry.timeValue || '-'].join(' | '),
  );
  return [header, ...lines].join('\n');
}
