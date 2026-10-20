import type { QuoteSectionCode } from '@/lib/quotes/types';

export interface QuoteSectionDefinition {
  code: QuoteSectionCode;
  letter: string;
  label: string;
  /** Prefisso degli ID riga, come nei preventivi Cerbero (CAST_01, DIR_02...). */
  rowPrefix: string;
  /** Art Department mostra PREP e SHOOT separati invece di DAYS. */
  splitDays: boolean;
}

// Stesso ordine e lettere dei preventivi Cerbero (la J e la K non esistono).
export const QUOTE_SECTIONS: readonly QuoteSectionDefinition[] = [
  { code: 'PREP', letter: 'A', label: 'PRE - PRODUCTION', rowPrefix: 'PREP', splitDays: false },
  { code: 'CAST', letter: 'B', label: 'CAST', rowPrefix: 'CAST', splitDays: false },
  { code: 'DIR', letter: 'C', label: 'DIRECTOR / CREATIVITY', rowPrefix: 'DIR', splitDays: false },
  { code: 'CREW', letter: 'D', label: 'CREW', rowPrefix: 'CREW', splitDays: false },
  { code: 'LOC', letter: 'E', label: 'LOCATION / STUDIO', rowPrefix: 'LOC', splitDays: false },
  { code: 'ART', letter: 'F', label: 'ART DEPARTMENT', rowPrefix: 'ART', splitDays: true },
  { code: 'EQ', letter: 'G', label: 'EQUIPEMENT RENTAL', rowPrefix: 'EQ', splitDays: false },
  { code: 'LOG', letter: 'H', label: 'LOGISTIC / HOTELS', rowPrefix: 'LOG', splitDays: false },
  { code: 'FOOD', letter: 'I', label: 'FOOD / CATERING', rowPrefix: 'FOOD', splitDays: false },
  { code: 'POST', letter: 'L', label: 'POST - PRODUCTION', rowPrefix: 'POST', splitDays: false },
  { code: 'USAGE', letter: 'M', label: 'USAGE RIGHTS', rowPrefix: 'USAGE', splitDays: false },
  { code: 'INS', letter: 'N', label: 'INSURANCE', rowPrefix: 'INS', splitDays: false },
  { code: 'OTHERS', letter: 'O', label: 'OTHERS / BONUS PAGE', rowPrefix: 'OTH', splitDays: false },
];

export const QUOTE_SECTION_CODES = QUOTE_SECTIONS.map((section) => section.code) as [
  QuoteSectionCode,
  ...QuoteSectionCode[],
];

export const NOT_INCLUDED_NOTE = 'Not-Incl';

export function getQuoteSection(code: QuoteSectionCode): QuoteSectionDefinition {
  return QUOTE_SECTIONS.find((section) => section.code === code) ?? QUOTE_SECTIONS[0];
}

export function isQuoteSectionCode(value: unknown): value is QuoteSectionCode {
  return typeof value === 'string' && QUOTE_SECTION_CODES.includes(value as QuoteSectionCode);
}
