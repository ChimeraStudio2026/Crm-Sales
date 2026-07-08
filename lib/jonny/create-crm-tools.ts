import type { SupabaseClient } from '@supabase/supabase-js';
import { tool } from 'ai';
import { z } from 'zod';
import { OWNER_ZOD_ENUM } from '@/lib/constants/crm';
import {
  createClientTaskAction,
  getClientDetailsAction,
  getCrmSummary,
  listIdeasAction,
  listOpenTasksAction,
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
          .enum(['Nuovo Cliente', 'Ricorrente', 'Top 20%', 'Da recuperare', 'Perso', 'Eliminato'])
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
    listOpenTasks: tool({
      description: 'Task aperti (non completati). Opzionale filtro per assignee Jeck/Virgi/Martina.',
      inputSchema: z.object({
        assignee: z.enum(OWNER_ZOD_ENUM).optional(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (input) => listOpenTasksAction(cache, input),
    }),
    listIdeas: tool({
      description: 'Idee commerciali (non task). Opzionale filtro per status kanban.',
      inputSchema: z.object({
        status: z.enum(['Da fare', 'In progress', 'Fatto']).optional(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (input) => listIdeasAction(cache, input),
    }),
    updateClientAction: tool({
      description: 'Aggiorna il campo azione di un cliente e imposta la data azione a oggi.',
      inputSchema: z.object({
        clientName: z.string(),
        action: z.string().describe('Nuovo testo azione per il cliente'),
      }),
      execute: async (input) => updateClientActionText(cache, input),
    }),
    createClientTask: tool({
      description: 'Crea un task collegato a un cliente nel kanban Task & Idee.',
      inputSchema: z.object({
        clientName: z.string(),
        title: z.string(),
        taskType: z.enum(['call', 'follow-up', 'proposta', 'email', 'meeting', 'altro']).optional(),
        dueDate: z.string().optional().describe('Data scadenza YYYY-MM-DD'),
        assignee: z.enum(OWNER_ZOD_ENUM).optional(),
        notes: z.string().optional(),
      }),
      execute: async (input) => createClientTaskAction(cache, input),
    }),
  };
}

export type CrmTools = ReturnType<typeof createCrmTools>;
