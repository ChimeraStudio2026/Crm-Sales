'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { findDuplicateCandidates } from '@/lib/crm/client-duplicates';
import type { DuplicateCandidate } from '@/lib/crm/client-duplicates';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import {
  fetchClientAliases,
  fetchDuplicateDismissals,
  insertDuplicateDismissal,
} from '@/lib/supabase/client-aliases-database';
import type { ClientAlias } from '@/lib/supabase/client-aliases-database';
import type { Client } from '@/lib/types/crm';

export function useDuplicateCandidates(clients: Client[]): {
  candidates: DuplicateCandidate[];
  aliases: ClientAlias[];
  isLoading: boolean;
  dismiss: (pairKey: string) => Promise<void>;
  reload: () => Promise<void>;
} {
  const db = useMemo(() => createBrowserSupabaseClient(), []);
  const [aliases, setAliases] = useState<ClientAlias[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(Boolean(db));

  const reload = useCallback(async (): Promise<void> => {
    if (!db) return;
    setIsLoading(true);
    try {
      const [loadedAliases, loadedDismissals] = await Promise.all([
        fetchClientAliases(db),
        fetchDuplicateDismissals(db),
      ]);
      setAliases(loadedAliases);
      setDismissed(new Set(loadedDismissals));
    } catch (error) {
      console.error('Duplicate data load failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const candidates = useMemo(
    () => (isLoading ? [] : findDuplicateCandidates(clients, aliases, dismissed)),
    [aliases, clients, dismissed, isLoading],
  );

  const dismiss = useCallback(async (pairKey: string): Promise<void> => {
    if (!db) return;
    await insertDuplicateDismissal(db, pairKey);
    setDismissed((prev) => new Set(prev).add(pairKey));
  }, [db]);

  return { candidates, aliases, isLoading, dismiss, reload };
}
