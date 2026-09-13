'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { resolveHeadOkrRowClassName, resolveHeadOkrStatusClassName } from '@/lib/head-okr/status-style';
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
  const [openCheckpointId, setOpenCheckpointId] = useState<string | null>(
    program.content.checkpoints[0]?.id ?? null,
  );
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
      <div className="glass-card head-okr-program-head">
        <div className="head-okr-program-head-top">
          <div>
            {canEdit ? (
              <HeadOkrEditableField
                canEdit
                value={program.sheetTitle || program.headName}
                className="head-okr-title-input"
                onCommit={(sheetTitle) => void onSaveProgram({ sheetTitle })}
              />
            ) : (
              <h3>{program.sheetTitle || program.headName}</h3>
            )}
            {canEdit ? (
              <HeadOkrEditableField
                canEdit
                value={program.roleTitle}
                className="head-okr-subtitle-input"
                onCommit={(roleTitle) => void onSaveProgram({ roleTitle })}
              />
            ) : (
              <p className="head-okr-role-line">
                {program.roleTitle}
                {program.frameworkLabel ? ` · Framework ${program.frameworkLabel}` : ''}
                {program.frameworkStartDate ? ` · dal ${new Date(`${program.frameworkStartDate}T00:00:00`).toLocaleDateString('it-IT')}` : ''}
              </p>
            )}
          </div>
          <div className="head-okr-progress-card">
            <span className="head-okr-progress-label">Avanzamento</span>
            <strong className="head-okr-progress-value">{Math.round(progress.progressRatio * 100)}%</strong>
            <div className="head-okr-progress-bar" aria-hidden="true">
              <div className="head-okr-progress-fill" style={{ width: `${Math.round(progress.progressRatio * 100)}%` }} />
            </div>
            <span className="head-okr-progress-meta">
              {progress.doneKeyResults}/{progress.totalKeyResults} KR · {progress.inProgressKeyResults} in corso
            </span>
          </div>
        </div>
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
        {isSaving ? <p className="head-okr-saving">Salvataggio…</p> : null}
        {!canEdit ? (
          <p className="head-okr-readonly-hint">Sola lettura — aggiornamenti a cura di Jeck.</p>
        ) : null}
      </div>
      <div className="head-okr-checkpoints">
        {program.content.checkpoints.map((checkpoint) => {
          const isOpen = openCheckpointId === checkpoint.id;
          return (
            <div key={checkpoint.id} className={`glass-card head-okr-checkpoint${isOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="head-okr-checkpoint-toggle"
                onClick={() => setOpenCheckpointId(isOpen ? null : checkpoint.id)}
                aria-expanded={isOpen}
              >
                <ChevronRight size={18} className="head-okr-checkpoint-icon" />
                <span>{checkpoint.title}</span>
              </button>
              {isOpen ? (
                <div className="head-okr-checkpoint-body">
                  {checkpoint.objectives.map((objective) => (
                    <div key={objective.id} className="head-okr-objective">
                      <div className="head-okr-objective-head">
                        <HeadOkrEditableField
                          canEdit={canEdit}
                          value={objective.title}
                          className="head-okr-objective-title"
                          onCommit={(title) => void patchObjective(checkpoint.id, objective.id, { title })}
                        />
                        {(objective.description || canEdit) ? (
                          <HeadOkrEditableField
                            canEdit={canEdit}
                            multiline
                            value={objective.description}
                            className="head-okr-objective-desc"
                            onCommit={(description) => void patchObjective(checkpoint.id, objective.id, { description })}
                          />
                        ) : null}
                      </div>
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
                                <td>
                                  <HeadOkrEditableField
                                    canEdit={canEdit}
                                    multiline
                                    value={keyResult.title}
                                    onCommit={(title) => void patchKeyResult(checkpoint.id, objective.id, keyResult.id, { title })}
                                  />
                                </td>
                                <td>
                                  {canEdit ? (
                                    <select
                                      className={`filter-select head-okr-status-select ${resolveHeadOkrStatusClassName(String(keyResult.status))}`}
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
                                <td>
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
                                <td>
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
                                <td>
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
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
