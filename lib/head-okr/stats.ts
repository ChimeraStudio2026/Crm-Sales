import type { HeadOkrProgram, HeadOkrKeyResult } from '@/lib/types/head-okr';

export interface HeadOkrProgressSummary {
  totalKeyResults: number;
  doneKeyResults: number;
  inProgressKeyResults: number;
  progressRatio: number;
}

function collectKeyResults(program: HeadOkrProgram): HeadOkrKeyResult[] {
  return program.content.checkpoints.flatMap((checkpoint) => (
    checkpoint.objectives.flatMap((objective) => objective.keyResults)
  ));
}

export function buildHeadOkrProgressSummary(program: HeadOkrProgram): HeadOkrProgressSummary {
  const keyResults = collectKeyResults(program);
  const totalKeyResults = keyResults.length;
  const doneKeyResults = keyResults.filter((item) => item.status === 'Done').length;
  const inProgressKeyResults = keyResults.filter((item) => item.status === 'In Progress').length;
  const progressRatio = totalKeyResults > 0 ? doneKeyResults / totalKeyResults : 0;
  return {
    totalKeyResults,
    doneKeyResults,
    inProgressKeyResults,
    progressRatio,
  };
}
