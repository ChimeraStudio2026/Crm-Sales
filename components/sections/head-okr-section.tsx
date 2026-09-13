'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { TopHeader } from '@/components/layout/top-header';
import { HeadOkrImportCard } from '@/components/head-okr/head-okr-import-card';
import { HeadOkrProgramView } from '@/components/head-okr/head-okr-program-view';
import { parseHeadOkrFrameworkBuffer } from '@/lib/head-okr/parse-framework-xlsx';
import { buildHeadOkrProgressSummary } from '@/lib/head-okr/stats';
import {
  fetchHeadOkrPrograms,
  updateHeadOkrProgramContent,
  upsertHeadOkrProgramFromDraft,
} from '@/lib/supabase/head-okr-database';
import type { HeadOkrProgram, HeadOkrProgramContent } from '@/lib/types/head-okr';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export function HeadOkrSection() {
  const { showToast } = useCrm();
  const { workspaceId } = useWorkspace();
  const [programs, setPrograms] = useState<HeadOkrProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const loadPrograms = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const rows = await fetchHeadOkrPrograms(workspaceId);
      setPrograms(rows);
      setSelectedProgramId((current) => {
        if (current && rows.some((row) => row.id === current)) return current;
        return rows[0]?.id ?? null;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Caricamento OKR Head fallito.';
      showToast(message, 'danger');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, workspaceId]);
  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);
  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  );
  const handleImport = async (buffer: ArrayBuffer): Promise<void> => {
    const draft = parseHeadOkrFrameworkBuffer(buffer);
    const saved = await upsertHeadOkrProgramFromDraft(workspaceId, draft);
    setPrograms((current) => {
      const withoutSaved = current.filter((program) => program.id !== saved.id);
      return [...withoutSaved, saved].sort((left, right) => left.headName.localeCompare(right.headName, 'it'));
    });
    setSelectedProgramId(saved.id);
  };
  const handleSaveContent = async (content: HeadOkrProgramContent): Promise<void> => {
    if (!selectedProgram) return;
    setIsSaving(true);
    try {
      const saved = await updateHeadOkrProgramContent(selectedProgram.id, content);
      setPrograms((current) => current.map((program) => (
        program.id === saved.id ? saved : program
      )));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Salvataggio OKR fallito.';
      showToast(message, 'danger');
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active head-okr-section">
          <HeadOkrImportCard onImport={handleImport} onToast={showToast} />
          {isLoading ? (
            <p className="proposals-empty">Caricamento framework OKR…</p>
          ) : programs.length === 0 ? (
            <div className="glass-card proposals-panel head-okr-empty">
              <Target size={28} />
              <h3>Nessun OKR Head</h3>
              <p>Importa il file Excel del framework (es. OKR-Virginia-Velcich…) per creare la prima scheda.</p>
            </div>
          ) : (
            <div className="head-okr-layout">
              <aside className="glass-card head-okr-sidebar">
                <h3>Head of</h3>
                <ul className="head-okr-program-list">
                  {programs.map((program) => {
                    const summary = buildHeadOkrProgressSummary(program);
                    return (
                      <li key={program.id}>
                        <button
                          type="button"
                          className={`head-okr-program-item${program.id === selectedProgramId ? ' is-active' : ''}`}
                          onClick={() => setSelectedProgramId(program.id)}
                        >
                          <strong>{program.headName}</strong>
                          <span>{program.roleTitle}</span>
                          <span>{Math.round(summary.progressRatio * 100)}% · {summary.doneKeyResults}/{summary.totalKeyResults} KR</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>
              {selectedProgram ? (
                <HeadOkrProgramView
                  program={selectedProgram}
                  onSaveContent={handleSaveContent}
                  isSaving={isSaving}
                />
              ) : null}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
