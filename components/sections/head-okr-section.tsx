'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { TopHeader } from '@/components/layout/top-header';
import { HeadOkrImportCard } from '@/components/head-okr/head-okr-import-card';
import { HeadOkrProgramView } from '@/components/head-okr/head-okr-program-view';
import {
  filterHeadOkrProgramsForViewer,
  isHeadOkrEditorEmail,
  isHeadOkrViewerEmail,
} from '@/lib/crm/head-okr-access';
import { parseHeadOkrFrameworkBuffer } from '@/lib/head-okr/parse-framework-xlsx';
import { buildHeadOkrProgressSummary } from '@/lib/head-okr/stats';
import {
  fetchHeadOkrPrograms,
  updateHeadOkrProgram,
  upsertHeadOkrProgramFromDraft,
} from '@/lib/supabase/head-okr-database';
import type { HeadOkrProgram, HeadOkrProgramContent } from '@/lib/types/head-okr';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useCrm } from '@/providers/crm-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export function HeadOkrSection() {
  const { showToast } = useCrm();
  const { workspaceId } = useWorkspace();
  const [programs, setPrograms] = useState<HeadOkrProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const canEdit = isHeadOkrEditorEmail(userEmail);
  const canView = isHeadOkrViewerEmail(userEmail);
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || '');
    });
  }, []);
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
  const visiblePrograms = useMemo(
    () => filterHeadOkrProgramsForViewer(programs, userEmail),
    [programs, userEmail],
  );
  const selectedProgram = useMemo(
    () => visiblePrograms.find((program) => program.id === selectedProgramId) ?? null,
    [visiblePrograms, selectedProgramId],
  );
  useEffect(() => {
    if (visiblePrograms.length === 0) {
      setSelectedProgramId(null);
      return;
    }
    if (!selectedProgramId || !visiblePrograms.some((program) => program.id === selectedProgramId)) {
      setSelectedProgramId(visiblePrograms[0].id);
    }
  }, [selectedProgramId, visiblePrograms]);
  const handleImport = async (buffer: ArrayBuffer): Promise<void> => {
    if (!canEdit) return;
    const draft = parseHeadOkrFrameworkBuffer(buffer);
    const saved = await upsertHeadOkrProgramFromDraft(workspaceId, draft);
    setPrograms((current) => {
      const withoutSaved = current.filter((program) => program.id !== saved.id);
      return [...withoutSaved, saved].sort((left, right) => left.headName.localeCompare(right.headName, 'it'));
    });
    setSelectedProgramId(saved.id);
  };
  const handleSaveProgram = async (payload: {
    introText?: string;
    roleTitle?: string;
    sheetTitle?: string;
    content?: HeadOkrProgramContent;
  }): Promise<void> => {
    if (!selectedProgram || !canEdit) return;
    setIsSaving(true);
    try {
      const saved = await updateHeadOkrProgram(selectedProgram.id, payload);
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
  if (!canView) {
    return (
      <>
        <TopHeader />
        <div className="content-body">
          <p className="proposals-empty">Non hai accesso a questa sezione.</p>
        </div>
      </>
    );
  }
  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active head-okr-section">
          {canEdit ? (
            <HeadOkrImportCard onImport={handleImport} onToast={showToast} />
          ) : null}
          {isLoading ? (
            <p className="proposals-empty">Caricamento framework OKR…</p>
          ) : visiblePrograms.length === 0 ? (
            <div className="glass-card head-okr-empty">
              <Target size={28} />
              <h3>Nessun OKR Head</h3>
              <p>
                {canEdit
                  ? 'Importa il file Excel del framework per creare la prima scheda.'
                  : 'Il tuo framework OKR non è ancora disponibile.'}
              </p>
            </div>
          ) : (
            <div className={`head-okr-layout${visiblePrograms.length === 1 ? ' head-okr-layout--single' : ''}`}>
              {visiblePrograms.length > 1 ? (
                <aside className="glass-card head-okr-sidebar">
                  <h3>Head of</h3>
                  <ul className="head-okr-program-list">
                    {visiblePrograms.map((program) => {
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
                            <span className="head-okr-program-item-progress">
                              {Math.round(summary.progressRatio * 100)}% · {summary.doneKeyResults}/{summary.totalKeyResults} KR
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </aside>
              ) : null}
              {selectedProgram ? (
                <HeadOkrProgramView
                  program={selectedProgram}
                  canEdit={canEdit}
                  onSaveProgram={handleSaveProgram}
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
