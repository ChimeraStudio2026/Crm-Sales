import type { SupabaseClient } from '@supabase/supabase-js';
import { tool } from 'ai';
import { z } from 'zod';
import { OWNER_ZOD_ENUM } from '@/lib/constants/crm';
import {
  getClientDetailsAction,
  getCrmSummary,
  searchClientsAction,
  updateClientActionText,
} from '@/lib/jonny/crm-actions';
import { CrmDataCache } from '@/lib/jonny/crm-data-cache';

export function createCrmTools(db: SupabaseClient) {
  const cache = new CrmDataCache(db);
  return {
    getCrmSummary: tool({
      description: 'Conteggi e totali CRM: clienti per rapporto, fatturati 2025/2026, top 5 per rev2026. Usa per domande aggregate (quanti, totale, riepilogo).',
      inputSchema: z.object({}),
      execute: async () => getCrmSummary(cache),
    }),
    searchClients: tool({
      description: 'Cerca clienti per nome parziale, rapporto e/o owner. Usa per elenchi filtrati o trovare un nome.',
      inputSchema: z.object({
        query: z.string().optional().describe('Testo da cercare nel nome cliente'),
        relationship: z
          .enum(['Nuovo Cliente', 'Ricorrente', 'Top 20%', 'Da recuperare', 'Eliminato'])
          .optional(),
        owner: z.enum(OWNER_ZOD_ENUM).optional(),
        limit: z.number().int().min(1).max(8).optional(),
      }),
      execute: async (input) => searchClientsAction(cache, input),
    }),
    getClientDetails: tool({
      description: 'Scheda completa di UN cliente (fatturati, azione, contatti, prodotti). Usa quando chiedono dettagli su un nome specifico.',
      inputSchema: z.object({
        clientName: z.string().describe('Nome o parte del nome del cliente'),
      }),
      execute: async (input) => getClientDetailsAction(cache, input),
    }),
    updateClientAction: tool({
      description: 'Aggiorna il campo azione di un cliente e imposta la data azione a oggi.',
      inputSchema: z.object({
        clientName: z.string(),
        action: z.string().describe('Nuovo testo azione per il cliente'),
      }),
      execute: async (input) => updateClientActionText(cache, input),
    }),
  };
}

export type CrmTools = ReturnType<typeof createCrmTools>;
