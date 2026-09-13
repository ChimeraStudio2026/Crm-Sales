'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { HEAD_OKR_STATUS_OPTIONS } from '@/lib/types/head-okr';
import type { HeadOkrProgram, HeadOkrProgramContent } from '@/lib/types/head-okr';
import { buildHeadOkrProgressSummary } from '@/lib/head-okr/stats';

interface HeadOkrProgramViewProps {
  program: HeadOkrProgram;
  onSaveContent: (content: HeadOkrProgramContent) => Promise<void>;
  isSaving: boolean;
}

function formatMultilineText(value: string): string {
  return value.trim();
}

export function HeadOkrProgramView({ program, onSaveContent, isSaving }: HeadOkrProgramViewProps) {
  const progress = useMemo(() => buildHeadOkrProgressSummary(program), [program]);
  const [openCheckpointId, setOpenCheckpointId] = useState<string | null>(
    program.content.checkpoints[0]?.id ?? null,
  );
  const handleKeyResultChange = async (
    checkpointId: string,
    objectiveId: string,
    keyResultId: string,
    patch: Partial<{ status: string; adminNote: string }>,
  ): Promise<void> => {
    const nextContent: HeadOkrProgramContent = {
      checkpoints: program.content.checkpoints.map((checkpoint) => {
        if (checkpoint.id !== checkpointId) return checkpoint;
        return {
          ...checkpoint,
          objectives: checkpoint.objectives.map((objective) => {
            if (objective.id !== objectiveId) return objective;
            return {
              ...objective,
              keyResults: objective.keyResults.map((keyResult) => {
                if (keyResult.id !== keyResultId) return keyResult;
                return { ...keyResult, ...patch };
              }),
            };
          }),
        };
      }),
    };
    await onSaveContent(nextContent);
  };
  return (
    <div className="head-okr-program">
      <div className="glass-card proposals-panel head-okr-program-head">
        <div className="proposals-panel-head">
          <h3>{program.sheetTitle || program.headName}</h3>
          <p>
            {program.roleTitle}
            {program.frameworkLabel ? ` · Framework ${program.frameworkLabel}` : ''}
            {program.frameworkStartDate ? ` · dal ${new Date(`${program.frameworkStartDate}T00:00:00`).toLocaleDateString('it-IT')}` : ''}
          </p>
        </div>
        {program.introText ? (
          <p className="head-okr-intro">{formatMultilineText(program.introText)}</p>
        ) : null}
        <div className="head-okr-progress-row">
          <span>{progress.doneKeyResults}/{progress.totalKeyResults} KR completati</span>
          <span>{progress.inProgressKeyResults} in corso</span>
          <strong>{Math.round(progress.progressRatio * 100)}%</strong>
          {isSaving ? <span className="head-okr-saving">Salvataggio…</span> : null}
        </div>
      </div>
      <div className="head-okr-checkpoints">
        {program.content.checkpoints.map((checkpoint) => {
          const isOpen = openCheckpointId === checkpoint.id;
          return (
            <div key={checkpoint.id} className={`analysis-accordion head-okr-checkpoint${isOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="analysis-accordion-toggle"
                onClick={() => setOpenCheckpointId(isOpen ? null : checkpoint.id)}
                aria-expanded={isOpen}
              >
                <ChevronRight size={18} className="analysis-accordion-icon" />
                <span>{checkpoint.title}</span>
              </button>
              {isOpen ? (
                <div className="analysis-accordion-body head-okr-checkpoint-body">
                  {checkpoint.objectives.map((objective) => (
                    <div key={objective.id} className="head-okr-objective">
                      <div className="head-okr-objective-head">
                        <h4>{objective.title}</h4>
                        {objective.description ? <p>{objective.description}</p> : null}
                      </div>
                      <div className="analysis-table-wrap">
                        <table className="analysis-table head-okr-table">
                          <thead>
                            <tr>
                              <th>Key Result</th>
                              <th>Status</th>
                              <th>Metro Di Valutazione</th>
                              <th>Valore</th>
                              <th>Note Jeck</th>
                            </tr>
                          </thead>
                          <tbody>
                            {objective.keyResults.map((keyResult) => (
                              <tr key={keyResult.id}>
                                <td className="head-okr-kr-title">{keyResult.title}</td>
                                <td>
                                  <select
                                    className="filter-select head-okr-status-select"
                                    value={keyResult.status}
                                    onChange={(event) => {
                                      void handleKeyResultChange(
                                        checkpoint.id,
                                        objective.id,
                                        keyResult.id,
                                        { status: event.target.value },
                                      );
                                    }}
                                  >
                                    {HEAD_OKR_STATUS_OPTIONS.map((status) => (
                                      <option key={status} value={status}>{status}</option>
                                    ))}
                                    {!HEAD_OKR_STATUS_OPTIONS.includes(keyResult.status as typeof HEAD_OKR_STATUS_OPTIONS[number]) && keyResult.status ? (
                                      <option value={keyResult.status}>{keyResult.status}</option>
                                    ) : null}
                                  </select>
                                </td>
                                <td className="head-okr-metric">{keyResult.evaluationMetric}</td>
                                <td>{keyResult.valueLabel || '—'}</td>
                                <td>
                                  <textarea
                                    className="head-okr-admin-note"
                                    rows={2}
                                    defaultValue={keyResult.adminNote}
                                    placeholder="Note Jeck…"
                                    onBlur={(event) => {
                                      const nextValue = event.target.value.trim();
                                      if (nextValue === keyResult.adminNote) return;
                                      void handleKeyResultChange(
                                        checkpoint.id,
                                        objective.id,
                                        keyResult.id,
                                        { adminNote: nextValue },
                                      );
                                    }}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
