'use client';

import { useCallback, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { parseHeadOkrFrameworkBuffer } from '@/lib/head-okr/parse-framework-xlsx';
import { resolveExcelImportFileIssue } from '@/lib/crm/excel';
import type { ToastType } from '@/providers/crm-provider';

interface HeadOkrImportCardProps {
  isDisabled?: boolean;
  onImport: (buffer: ArrayBuffer) => Promise<void>;
  onToast: (message: string, type?: ToastType) => void;
}

export function HeadOkrImportCard({ isDisabled = false, onImport, onToast }: HeadOkrImportCardProps) {
  const [isImporting, setIsImporting] = useState(false);
  const handleFile = useCallback(async (file: File): Promise<void> => {
    const fileIssue = resolveExcelImportFileIssue(file);
    if (fileIssue) {
      onToast(fileIssue, 'danger');
      return;
    }
    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const draft = parseHeadOkrFrameworkBuffer(buffer);
      const keyResultCount = draft.content.checkpoints.reduce(
        (total, checkpoint) => total + checkpoint.objectives.reduce(
          (objectiveTotal, objective) => objectiveTotal + objective.keyResults.length,
          0,
        ),
        0,
      );
      if (keyResultCount === 0) {
        onToast('Nessun Key Result riconosciuto. Controlla il formato del foglio OKR Head.', 'danger');
        return;
      }
      await onImport(buffer);
      onToast(`OKR importati per ${draft.headName} (${keyResultCount} KR).`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import OKR Head fallito.';
      onToast(message, 'danger');
    } finally {
      setIsImporting(false);
    }
  }, [onImport, onToast]);
  return (
    <div className={`glass-card head-okr-import-card${isDisabled ? ' is-disabled' : ''}`}>
      <div className="head-okr-import-head">
        <CloudUpload size={22} />
        <div>
          <h3>Importa framework Excel</h3>
          <p>Stesso template per tutti gli Head (checkpoint, obiettivi, colonne Key Result / Status / Metro / Valore / Note Jeck).</p>
        </div>
      </div>
      <label className="btn btn-secondary head-okr-import-button">
        {isImporting ? 'Importazione…' : 'Carica .xlsx'}
        <input
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          disabled={isDisabled || isImporting}
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
}
