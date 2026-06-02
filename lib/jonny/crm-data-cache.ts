import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client, Idea } from '@/lib/types/crm';
import { fetchClients, fetchIdeas } from '@/lib/supabase/database';

export class CrmDataCache {
  private clientsPromise: Promise<Client[]> | null = null;
  private ideasPromise: Promise<Idea[]> | null = null;

  constructor(readonly db: SupabaseClient) {}

  getClients(): Promise<Client[]> {
    if (!this.clientsPromise) {
      this.clientsPromise = fetchClients(this.db);
    }
    return this.clientsPromise;
  }

  getIdeas(): Promise<Idea[]> {
    if (!this.ideasPromise) {
      this.ideasPromise = fetchIdeas(this.db);
    }
    return this.ideasPromise;
  }
}
