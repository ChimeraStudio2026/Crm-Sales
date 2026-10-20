import * as z from 'zod/v4';
import { QUOTE_SECTION_CODES } from '@/lib/quotes/sections';

// Bozza restituita da Claude. Claude sceglie le voci e le quantità;
// i prezzi di listino li rimette il server (vedi applyAssistantDraft).
export const AssistantQuoteItemSchema = z.object({
  section: z.enum(QUOTE_SECTION_CODES),
  catalogName: z
    .string()
    .describe('Nome esatto della voce di listino, oppure stringa vuota per una voce libera (es. budget location).'),
  job: z.string().describe('Testo della colonna JOB.'),
  note: z.string(),
  qty: z.number(),
  prepDays: z.number().describe('Giorni di preparazione; 0 se non servono.'),
  days: z.number().describe('Giorni di ripresa o lavoro.'),
  customUnitPrice: z
    .number()
    .nullable()
    .describe('Solo per voci libere o se l\'utente impone un prezzo; null per usare il listino.'),
});

export const AssistantQuoteOutputSchema = z.object({
  name: z.string(),
  description: z.string(),
  qty: z.number(),
  duration: z.string().describe('Es. "30s", oppure "-".'),
  format: z.string().describe('Es. "9:16", "16:9", oppure "-".'),
});

export const AssistantQuoteSchema = z.object({
  reply: z.string().describe('Messaggio breve all\'utente: cosa hai impostato e cosa resta da chiarire.'),
  openQuestions: z.array(z.string()).describe('Domande aperte per completare il preventivo; vuoto se nessuna.'),
  quote: z.object({
    title: z.string().describe('Titolo del progetto, es. "Campagna settembre".'),
    clientName: z.string(),
    directClient: z.string().describe('Brand finale se il cliente è un\'agenzia; altrimenti vuoto.'),
    description: z.string(),
    country: z.string(),
    sectionNotes: z
      .array(z.object({ section: z.enum(QUOTE_SECTION_CODES), note: z.string() }))
      .describe('Nota di riepilogo per sezione, es. "1x director; 1x director of photography".'),
    items: z.array(AssistantQuoteItemSchema),
    outputs: z.array(AssistantQuoteOutputSchema),
    productionFeePct: z.number(),
    targetTotal: z
      .number()
      .nullable()
      .describe('Totale tondo richiesto dall\'utente (es. 19000): il server calcola il premium. null se non richiesto.'),
  }),
});

export type AssistantQuote = z.infer<typeof AssistantQuoteSchema>;
