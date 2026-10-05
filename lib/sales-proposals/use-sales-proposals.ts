'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fetchSalesProposals } from '@/lib/supabase/sales-proposals-database';
import type { SalesProposal } from '@/lib/types/sales-proposals';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedProposals {
  loadedAt: number;
  request: Promise<SalesProposal[]>;
}

// Le schede cliente si aprono una alla volta: una sola lettura condivisa per workspace.
const cacheByWorkspace = new Map<string, CachedProposals>();

function loadProposals(workspaceId: string): Promise<SalesProposal[]> {
  const cached = cacheByWorkspace.get(workspaceId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.request;
  const db = createBrowserSupabaseClient();
  if (!db) return Promise.resolve([]);
  const request = fetchSalesProposals(db, workspaceId).catch((error) => {
    cacheByWorkspace.delete(workspaceId);
    throw error;
  });
  cacheByWorkspace.set(workspaceId, { loadedAt: Date.now(), request });
  return request;
}

export function useSalesProposals(workspaceId: string): {
  proposals: SalesProposal[];
  isLoading: boolean;
  error: string;
} {
  const [proposals, setProposals] = useState<SalesProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadProposals(workspaceId)
      .then((rows) => {
        if (!cancelled) {
          setProposals(rows);
          setError('');
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Errore lettura proposte.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return { proposals, isLoading, error };
}
