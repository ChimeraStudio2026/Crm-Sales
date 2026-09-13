'use client';

import { useMemo } from 'react';
import {
  resolveHeadOkrRowClassName,
  resolveHeadOkrStatusClassName,
  resolveHeadOkrValueLabelClassName,
} from '@/lib/head-okr/status-style';
import { buildHeadOkrProgressSummary } from '@/lib/head-okr/stats';
import { HEAD_OKR_STATUS_OPTIONS } from '@/lib/types/head-okr';
import type { HeadOkrKeyResult, HeadOkrProgram, HeadOkrProgramContent } from '@/lib/types/head-okr';

interface HeadOkrProgramViewProps {
  program: HeadOkrProgram;
  canEdit: boolean;
  onSaveProgram: (payload: {
    introText?: string;
    roleTitle?: string;
    sheetTitle?: string;
    content?: HeadOkrProgramContent;
  }) => Promise<void>;
  isSaving: boolean;
}

function HeadOkrStatusBadge({ status }: { status: string }) {
  return (
    <span className={`head-okr-status-badge ${resolveHeadOkrStatusClassName(status)}`}>
      {status}
    </span>
  );
}

function HeadOkrEditableField({
  canEdit,
  value,
  className,
  multiline = false,
  onCommit,
}: {
  canEdit: boolean;
  value: string;
  className?: string;
  multiline?: boolean;
  onCommit: (nextValue: string) => void;
}) {
  if (!canEdit) {
    return <span className={className}>{value || '—'}</span>;
  }
  if (multiline) {
    return (
      <textarea
        className={`head-okr-field head-okr-field-multiline ${className ?? ''}`}
        rows={3}
        defaultValue={value}
        onBlur={(event) => {
          const nextValue = event.target.value.trim();
          if (nextValue !== value.trim()) onCommit(nextValue);
        }}
      />
    );
  }
  return (
    <input
      className={`head-okr-field ${className ?? ''}`}
      type="text"
      defaultValue={value}
      onBlur={(event) => {
        const nextValue = event.target.value.trim();
        if (nextValue !== value.trim()) onCommit(nextValue);
      }}
    />
  );
}

export function HeadOkrProgramView({
  program,
  canEdit,
  onSaveProgram,
  isSaving,
}: HeadOkrProgramViewProps) {
  const progress = useMemo(() => buildHeadOkrProgressSummary(program), [program]);
  const updateContent = async (nextContent: HeadOkrProgramContent): Promise<void> => {
    await onSaveProgram({ content: nextContent });
  };
  const patchKeyResult = async (
    checkpointId: string,
    objectiveId: string,
    keyResultId: string,
    patch: Partial<HeadOkrKeyResult>,
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
    await updateContent(nextContent);
  };
  const patchObjective = async (
    checkpointId: string,
    objectiveId: string,
    patch: { title?: string; description?: string },
  ): Promise<void> => {
    const nextContent: HeadOkrProgramContent = {
      checkpoints: program.content.checkpoints.map((checkpoint) => {
        if (checkpoint.id !== checkpointId) return checkpoint;
        return {
          ...checkpoint,
          objectives: checkpoint.objectives.map((objective) => {
            if (objective.id !== objectiveId) return objective;
            return { ...objective, ...patch };
          }),
        };
      }),
    };
    await updateContent(nextContent);
  };
  return (
    <div className="head-okr-program">
      <div className="head-okr-sheet">
        <div className="head-okr-banner head-okr-banner--main">
          {canEdit ? (
            <HeadOkrEditableField
              canEdit
              value={program.sheetTitle || program.headName}
              className="head-okr-banner-input head-okr-banner-input--title"
              onCommit={(sheetTitle) => void onSaveProgram({ sheetTitle })}
            />
          ) : (
            <h2 className="head-okr-banner-text">{program.sheetTitle || program.headName}</h2>
          )}
        </div>
        <div className="head-okr-intro-block">
          {(program.introText || canEdit) ? (
            canEdit ? (
              <HeadOkrEditableField
                canEdit
                multiline
                value={program.introText}
                className="head-okr-intro-input"
                onCommit={(introText) => void onSaveProgram({ introText })}
              />
            ) : (
              <p className="head-okr-intro">{program.introText}</p>
            )
          ) : null}
          <div className="head-okr-sheet-meta">
            <span>
              {program.frameworkLabel ? `Framework ${program.frameworkLabel}` : ''}
              {program.frameworkStartDate ? ` · dal ${new Date(`${program.frameworkStartDate}T00:00:00`).toLocaleDateString('it-IT')}` : ''}
            </span>
            <span className="head-okr-sheet-progress">
              {progress.doneKeyResults}/{progress.totalKeyResults} KR completati · {Math.round(progress.progressRatio * 100)}%
            </span>
            {isSaving ? <span className="head-okr-saving">Salvataggio…</span> : null}
            {!canEdit ? <span className="head-okr-readonly-hint">Sola lettura</span> : null}
          </div>
        </div>
        {program.content.checkpoints.map((checkpoint) => (
          <section key={checkpoint.id} className="head-okr-checkpoint-block">
            <div className="head-okr-banner head-okr-banner--checkpoint">
              <h3 className="head-okr-banner-text">{checkpoint.title}</h3>
            </div>
            {checkpoint.objectives.map((objective) => (
              <div key={objective.id} className="head-okr-objective-block">
                <div className="head-okr-banner head-okr-banner--objective">
                  {canEdit ? (
                    <HeadOkrEditableField
                      canEdit
                      value={objective.title}
                      className="head-okr-banner-input head-okr-banner-input--objective"
                      onCommit={(title) => void patchObjective(checkpoint.id, objective.id, { title })}
                    />
                  ) : (
                    <h4 className="head-okr-banner-text">{objective.title}</h4>
                  )}
                </div>
                {(objective.description || canEdit) ? (
                  <div className="head-okr-objective-desc-row">
                    <HeadOkrEditableField
                      canEdit={canEdit}
                      multiline
                      value={objective.description}
                      className="head-okr-objective-desc"
                      onCommit={(description) => void patchObjective(checkpoint.id, objective.id, { description })}
                    />
                  </div>
                ) : null}
                <div className="head-okr-table-wrap">
                  <table className="head-okr-table">
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
                        <tr
                          key={keyResult.id}
                          className={resolveHeadOkrRowClassName(String(keyResult.status))}
                        >
                          <td className="head-okr-col-kr">
                            <HeadOkrEditableField
                              canEdit={canEdit}
                              multiline
                              value={keyResult.title}
                              onCommit={(title) => void patchKeyResult(checkpoint.id, objective.id, keyResult.id, { title })}
                            />
                          </td>
                          <td className="head-okr-col-status">
                            {canEdit ? (
                              <select
                                className={`head-okr-status-select ${resolveHeadOkrStatusClassName(String(keyResult.status))}`}
                                value={keyResult.status}
                                onChange={(event) => {
                                  void patchKeyResult(checkpoint.id, objective.id, keyResult.id, {
                                    status: event.target.value,
                                  });
                                }}
                              >
                                {HEAD_OKR_STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                              </select>
                            ) : (
                              <HeadOkrStatusBadge status={String(keyResult.status)} />
                            )}
                          </td>
                          <td className="head-okr-col-metric">
                            <HeadOkrEditableField
                              canEdit={canEdit}
                              multiline
                              value={keyResult.evaluationMetric}
                              onCommit={(evaluationMetric) => void patchKeyResult(
                                checkpoint.id,
                                objective.id,
                                keyResult.id,
                                { evaluationMetric },
                              )}
                            />
                          </td>
                          <td className={`head-okr-col-value ${resolveHeadOkrValueLabelClassName(keyResult.valueLabel)}`}>
                            <HeadOkrEditableField
                              canEdit={canEdit}
                              value={keyResult.valueLabel}
                              onCommit={(valueLabel) => void patchKeyResult(
                                checkpoint.id,
                                objective.id,
                                keyResult.id,
                                { valueLabel },
                              )}
                            />
                          </td>
                          <td className="head-okr-col-note">
                            <HeadOkrEditableField
                              canEdit={canEdit}
                              multiline
                              value={keyResult.adminNote}
                              onCommit={(adminNote) => void patchKeyResult(
                                checkpoint.id,
                                objective.id,
                                keyResult.id,
                                { adminNote },
                              )}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
