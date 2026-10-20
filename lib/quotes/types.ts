export type QuoteSectionCode =
  | 'PREP'
  | 'CAST'
  | 'DIR'
  | 'CREW'
  | 'LOC'
  | 'ART'
  | 'EQ'
  | 'LOG'
  | 'FOOD'
  | 'POST'
  | 'USAGE'
  | 'INS'
  | 'OTHERS';

export type QuoteStatus = 'draft' | 'pending' | 'accepted' | 'rejected';

export interface QuoteItem {
  id: string;
  section: QuoteSectionCode;
  /** Nome della voce di listino da cui arriva il prezzo; vuoto per voci libere. */
  catalogName: string;
  job: string;
  note: string;
  qty: number;
  /** Giorni di preparazione (colonna PREP, usata soprattutto in Art Department). */
  prepDays: number;
  /** Giorni di ripresa / lavoro (colonna DAYS o SHOOT). */
  days: number;
  unitPrice: number;
  /** Costo unitario da listino: serve solo a calcolare il margine, non va in stampa. */
  unitCost: number | null;
  nic: number;
  extras: number;
}

export interface QuoteOutput {
  id: string;
  name: string;
  description: string;
  qty: number;
  duration: string;
  format: string;
}

export interface QuoteSectionNote {
  section: QuoteSectionCode;
  note: string;
}

export interface QuoteChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface QuoteDraft {
  id: string;
  code: string;
  title: string;
  version: string;
  status: QuoteStatus;
  clientName: string;
  clientVat: string;
  clientAddress: string;
  directClient: string;
  country: string;
  description: string;
  quoteDate: string;
  validityDays: number;
  productionFeePct: number;
  /** Aggiustamento finale sul totale: positivo = premium, negativo = sconto. */
  premium: number;
  vatPct: number;
  paymentTerms: string;
  sectionNotes: QuoteSectionNote[];
  items: QuoteItem[];
  outputs: QuoteOutput[];
  chat: QuoteChatMessage[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteSectionTotals {
  section: QuoteSectionCode;
  subtotal: number;
  extras: number;
  fee: number;
  total: number;
  cost: number;
}

export interface QuoteTotals {
  sections: QuoteSectionTotals[];
  subtotal: number;
  extras: number;
  fee: number;
  premium: number;
  total: number;
  vat: number;
  totalWithVat: number;
  /** Costo stimato delle sole voci con costo di listino. */
  cost: number;
  margin: number;
  marginPct: number;
}
