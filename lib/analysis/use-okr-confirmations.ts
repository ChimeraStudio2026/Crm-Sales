'use client';

import { useMemo } from 'react';
import { buildOkrConfirmationIndex } from '@/lib/analysis/okr-timeline';
import type { OkrConfirmationIndex } from '@/lib/analysis/okr-timeline';
import { useSalesProposals } from '@/lib/sales-proposals/use-sales-proposals';
import { useWorkspace } from '@/providers/workspace-provider';

/** Date di conferma degli OKR, dalle proposte Cerbero del workspace (lettura condivisa e in cache). */
export function useOkrConfirmations(): OkrConfirmationIndex {
  const { workspaceId } = useWorkspace();
  const { proposals } = useSalesProposals(workspaceId);
  return useMemo(() => buildOkrConfirmationIndex(proposals), [proposals]);
}
