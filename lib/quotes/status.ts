import type { QuoteStatus } from '@/lib/quotes/types';

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Bozza',
  pending: 'Inviato',
  accepted: 'Accettato',
  rejected: 'Rifiutato',
};

export const QUOTE_STATUSES = Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[];
