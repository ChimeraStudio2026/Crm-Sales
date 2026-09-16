'use client';

import { useCallback, useMemo, useState } from 'react';
import { CloudUpload, FileSpreadsheet } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { parseSalesProposalsBuffer, buildProposalDedupKey } from '@/lib/sales-proposals/parse';
import { upsertSalesProposalsFromImport } from '@/lib/supabase/sales-proposals-database';
import type { SalesProposal, SalesProposalImportRow, SalesProposalParseIssue } from '@/lib/types/sales-proposals';
import type { ToastType } from '@/providers/crm-provider';

interface ProposalsImportCardProps {
  workspaceId: string;
  existingProposals: SalesProposal[];
  isDisabled?: boolean;
  onImported: () => Promise<void>;
  onToast: (message: string, type?: ToastType) => void;
}

interface ImportPreview {
  filename: string;
  incoming: SalesProposalImportRow[];
  newRows: SalesProposalImportRow[];
  alreadyPresent: number;
  skipped: SalesProposalParseIssue[];
}

function getTodayBatchDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ProposalsImportCard({
  workspaceId,
  existingProposals,
  isDisabled = false,
  onImported,
  onToast,
}: ProposalsImportCardProps) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const existingKeys = useMemo(() => {
    return new Set(existingProposals.map((proposal) => buildProposalDedupKey(proposal.nome, proposal.creatoIl)));
  }, [existingProposals]);

  const applyFile = useCallback(async (file: File): Promise<void> => {
    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseSalesProposalsBuffer(buffer);
      const newRows = parsed.rows.filter((row) => !existingKeys.has(buildProposalDedupKey(row.nome, row.creatoIl)));
      setPreview({
        filename: file.name,
        incoming: parsed.rows,
        newRows,
        alreadyPresent: parsed.rows.length - newRows.length,
        skipped: parsed.skipped,
      });
      onToast(`Anteprima pronta: ${newRows.length} nuove su ${parsed.rows.length} righe valide.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lettura CSV fallita.';
      onToast(message, 'danger');
    } finally {
      setIsParsing(false);
    }
  }, [existingKeys, onToast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) void applyFile(file);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void applyFile(file);
  };

  const handleImport = async (): Promise<void> => {
    if (!preview || preview.incoming.length === 0) return;
    const db = createBrowserSupabaseClient();
    if (!db) {
      onToast('Supabase non configurato.', 'danger');
      return;
    }
    setIsImporting(true);
    try {
      await upsertSalesProposalsFromImport(
        db,
        preview.incoming,
        workspaceId,
        getTodayBatchDate(),
      );
      await onImported();
      const updatedCount = preview.alreadyPresent;
      const createdCount = preview.newRows.length;
      onToast(
        `Sincronizzate ${preview.incoming.length} proposte (${createdCount} nuove, ${updatedCount} aggiornate).`,
        'success',
      );
      setPreview(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import fallito.';
      onToast(message, 'danger');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="glass-card proposals-import-card">
      <div className="proposals-import-head">
        <div>
          <h3><FileSpreadsheet size={18} /> Importa scarico CSV</h3>
          <p>
            Ogni ricarica allinea stato, date Si/No e importi sul file CSV.
            Le proposte già presenti (Nome + Creato il) vengono aggiornate.
          </p>
        </div>
        <label className="btn btn-secondary proposals-import-btn">
          <CloudUpload size={16} />
          {isParsing ? 'Analisi...' : 'Seleziona file'}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            hidden
            onChange={handleFileChange}
            disabled={isDisabled || isParsing || isImporting}
          />
        </label>
      </div>
      <div
        className="proposals-import-drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        Trascina qui il CSV dei preventivi, oppure usa il pulsante.
      </div>
      {preview ? (
        <div className="proposals-import-preview">
          <p>
            <strong>{preview.filename}</strong>
            {' · '}
            {preview.incoming.length} valide
            {' · '}
            {preview.newRows.length} nuove
            {' · '}
            {preview.alreadyPresent} da aggiornare
            {preview.skipped.length > 0 ? ` · ${preview.skipped.length} saltate` : ''}
          </p>
          <div className="proposals-import-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={isImporting || preview.incoming.length === 0}
              onClick={() => void handleImport()}
            >
              {isImporting ? 'Sincronizzazione...' : `Sincronizza ${preview.incoming.length} proposte`}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPreview(null)}>
              Annulla
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
