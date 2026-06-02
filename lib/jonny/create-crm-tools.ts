import type { SupabaseClient } from '@supabase/supabase-js';
import { tool } from 'ai';
import { z } from 'zod';
import { OWNER_ZOD_ENUM, OWNERS } from '@/lib/constants/crm';
import {
  createClientTaskAction,
  getClientDetailsAction,
  getCrmSummary,
  listIdeasAction,
  listOpenTasksAction,
  searchClientsAction,
  updateClientActionText,
} from '@/lib/jonny/crm-actions';

export function createCrmTools(db: SupabaseClient) {
  return {
    getCrmSummary: tool({
      description: 'Riepilogo generale del CRM: conteggi clienti, fatturati totali, top clienti per rev2026.',
      inputSchema: z.object({}),
      execute: async () => getCrmSummary(db),
    }),
    searchClients: tool({
      description: 'Cerca clienti per nome parziale, rapporto o owner.',
      inputSchema: z.object({
        query: z.string().optional().describe('Testo da cercare nel nome cliente'),
        relationship: z
          .enum(['Nuovo Cliente', 'Ricorrente', 'Top 20%', 'Perso', 'Eliminato'])
          .optional(),
        owner: z.enum(OWNER_ZOD_ENUM).optional(),
        limit: z.number().int().min(1).max(30).optional(),
      }),
      execute: async (input) => searchClientsAction(db, input),
    }),
    getClientDetails: tool({
      description: 'Dettagli completi di un singolo cliente per nome (match parziale).',
      inputSchema: z.object({
        clientName: z.string().describe('Nome o parte del nome del cliente'),
      }),
      execute: async (input) => getClientDetailsAction(db, input),
    }),
    listOpenTasks: tool({
      description: 'Elenco task non completati.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input) => listOpenTasksAction(db, input),
    }),
    listIdeas: tool({
      description: 'Elenco idee commerciali, opzionalmente filtrate per status.',
      inputSchema: z.object({
        status: z.enum(['Da fare', 'In progress', 'Fatto']).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input) => listIdeasAction(db, input),
    }),
    updateClientAction: tool({
      description: 'Aggiorna il testo azione di un cliente e la data azione (oggi se non vuota).',
      inputSchema: z.object({
        clientName: z.string(),
        action: z.string().describe('Nuovo testo azione per il cliente'),
      }),
      execute: async (input) => updateClientActionText(db, input),
    }),
    createClientTask: tool({
      description: 'Crea un nuovo task collegato a un cliente.',
      inputSchema: z.object({
        clientName: z.string(),
        title: z.string(),
        taskType: z.enum(['call', 'follow-up', 'proposta', 'email', 'meeting', 'altro']).optional(),
        dueDate: z.string().optional().describe('Data scadenza YYYY-MM-DD'),
        assignee: z.enum(OWNER_ZOD_ENUM).optional(),
        notes: z.string().optional(),
      }),
      execute: async (input) => createClientTaskAction(db, input),
    }),
  };
}

export type CrmTools = ReturnType<typeof createCrmTools>;
