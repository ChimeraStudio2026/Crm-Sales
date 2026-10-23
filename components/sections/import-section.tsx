'use client';

import { useCallback, useState } from 'react';
import { CheckCircle2, CloudUpload, Eye, X } from 'lucide-react';
import {
  ANALYSIS_YEAR,
  REVENUE_YEARS,
  SUPPORTED_IMPORT_YEARS,
} from '@/lib/constants/crm';
import {
  buildExcelColumnDetectionMessage,
  getRevenueFieldForImportYear,
  parseExcelImportBufferWithYear,
  resolveExcelImportFileIssue,
  type ExcelImportParseResult,
} from '@/lib/crm/excel';
import { formatCurrency, hasExcelRevenueDifference } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import { TopHeader } from '@/components/layout/top-header';
import type { ParsedExcelClient } from '@/lib/types/crm';

export function ImportSection() {
  const { clients, parseExcelBuffer, processExcelImport, showToast } = useCrm();
  const [parsedClients, setParsedClients] = useState<ParsedExcelClient[]>([]);
  const [pendingOkr, setPendingOkr] = useState<ExcelImportParseResult['okrRecords']>([]);
  const [importYear, setImportYear] = useState<number>(ANALYSIS_YEAR);
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [sourceFilename, setSourceFilename] = useState('');
  const [step, setStep] = useState<'dropzone' | 'preview'>('dropzone');
  const [isProcessing, setIsProcessing] = useState(false);

  const [importMeta, setImportMeta] = useState<Pick<ExcelImportParseResult, 'format' | 'sheetName' | 'creditNoteCount' | 'yearHint' | 'replaceYearOkr'>>({
    format: 'okr',
    sheetName: '',
    creditNoteCount: 0,
    yearHint: null,
    replaceYearOkr: false,
  });

  const applyParseResult = useCallback((result: ExcelImportParseResult) => {
    setParsedClients(result.parsedClients);
    setPendingOkr(result.okrRecords);
    setImportYear(result.importYear);
    setImportMeta({
      format: result.format,
      sheetName: result.sheetName,
      creditNoteCount: result.creditNoteCount,
      yearHint: result.yearHint,
      replaceYearOkr: result.replaceYearOkr,
    });
    setStep('preview');
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const fileIssue = resolveExcelImportFileIssue(file);
    if (fileIssue) {
      showToast(fileIssue, 'danger');
      return;
    }
    showToast(`Analisi del file: ${file.name}...`, 'info');
    try {
      const buffer = await file.arrayBuffer();
      const result = parseExcelBuffer(buffer, file.name);
      if (result.detected.clientCol === -1 || result.detected.importoCol === -1) {
        showToast(buildExcelColumnDetectionMessage(result.headers), 'danger');
        return;
      }
      setRawBuffer(buffer);
      setSourceFilename(file.name);
      applyParseResult(result);
      showToast(`Anteprima pronta (${result.importYear}).`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lettura Excel fallita.';
      showToast(message, 'danger');
    }
  }, [applyParseResult, parseExcelBuffer, showToast]);

  const handleYearChange = (year: number) => {
    if (!rawBuffer) return;
    const result = parseExcelImportBufferWithYear(rawBuffer, year, sourceFilename);
    applyParseResult(result);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleCommit = async () => {
    setIsProcessing(true);
    try {
      await processExcelImport(parsedClients, pendingOkr, importYear, importMeta.format, importMeta.replaceYearOkr);
      setStep('dropzone');
      setParsedClients([]);
      setPendingOkr([]);
      setRawBuffer(null);
      setSourceFilename('');
      setImportYear(ANALYSIS_YEAR);
    } finally {
      setIsProcessing(false);
    }
  };

  const totalSum = parsedClients.reduce((sum, client) => sum + client.revenue, 0);
  const okrTotalSum = pendingOkr.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const revenueField = getRevenueFieldForImportYear(importYear);
  const revenueLabel = `Fatturato ${importYear}`;

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="import-section">
            {step === 'dropzone' && (
              <div
                className="glass-card dropzone-card"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => document.getElementById('excel-file-input')?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  id="excel-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
                <div className="dropzone-icon"><CloudUpload size={48} /></div>
                <h3>Trascina il tuo file Excel qui</h3>
                <p>
                  O clicca per selezionare (.xlsx, .xls o .csv). Non usare .xsl (non è Excel).
                  Supportati import {REVENUE_YEARS[0]}–{REVENUE_YEARS[REVENUE_YEARS.length - 1]}.
                </p>
                <span className="btn btn-secondary">Seleziona File</span>
              </div>
            )}
            {step === 'preview' && (
              <div className="glass-card excel-mapping-card">
                <div className="chart-header">
                  <h3><Eye size={20} /> Anteprima Dati Aggregati ({importYear})</h3>
                  <button type="button" className="btn btn-secondary btn-icon" onClick={() => setStep('dropzone')}>
                    <X size={16} />
                  </button>
                </div>
                <div className="import-preview-toolbar">
                  <label htmlFor="import-year-select">Anno import</label>
                  <select
                    id="import-year-select"
                    className="form-select"
                    value={importYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                  >
                    {SUPPORTED_IMPORT_YEARS.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <p className="import-preview-note">
                    {importMeta.format === 'invoice' && (
                      <>Formato fatture rilevato ({importMeta.sheetName}). </>
                    )}
                    {importMeta.format === 'legacy-line' && (
                      <>Formato righe fatturato ({importMeta.sheetName}). </>
                    )}
                    {importMeta.format === 'legacy-line' && importMeta.yearHint && importYear !== importMeta.yearHint && (
                      <> Attenzione: seleziona anno <strong>{importMeta.yearHint}</strong> per questo file.</>
                    )}
                    {importMeta.format === 'legacy-line' && importMeta.yearHint && importYear === importMeta.yearHint && (
                      <> Anno {importMeta.yearHint} rilevato dal nome file.</>
                    )}
                    Le note di credito (importi negativi) vengono sottratte dal totale cliente.
                    {importMeta.replaceYearOkr && (
                      <> Gli OKR {importYear} già presenti verranno sostituiti dal file. </>
                    )}
                    {importMeta.creditNoteCount > 0 && (
                      <>{importMeta.creditNoteCount} righe NC in anteprima.</>
                    )}
                  </p>
                </div>
                <div className="import-preview-wrapper">
                  <table className="import-preview-table">
                    <thead>
                      <tr>
                        <th>Nome Cliente</th>
                        <th>N. Record</th>
                        <th>{revenueLabel}</th>
                        <th>Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedClients.map((imported) => {
                        const existing = clients.find(
                          (c) => c.name.toLowerCase() === imported.name.toLowerCase(),
                        );
                        let statusLabel = 'Nuovo (bozza)';
                        let statusClass = 'import-status-new';
                        if (existing) {
                          if (hasExcelRevenueDifference(existing[revenueField], imported.revenue)) {
                            statusLabel = 'Aggiorna fatturato';
                            statusClass = 'import-status-update';
                          } else {
                            statusLabel = 'Invariato';
                            statusClass = 'import-status-unchanged';
                          }
                        }
                        return (
                          <tr key={imported.name}>
                            <td><strong>{imported.name}</strong></td>
                            <td style={{ textAlign: 'center' }}>{imported.recordCount}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(imported.revenue)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`import-status-badge ${statusClass}`}>{statusLabel}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                  <span>
                    Totale {importYear}: <strong>{formatCurrency(totalSum)}</strong>
                    {pendingOkr.length > 0 && (
                      <> · <strong>{pendingOkr.length}</strong> OKR · {formatCurrency(okrTotalSum)}</>
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setStep('dropzone')}>Annulla</button>
                    <button type="button" className="btn btn-success" disabled={isProcessing} onClick={() => void handleCommit()}>
                      <CheckCircle2 size={16} />
                      <span>{isProcessing ? 'Importazione...' : 'Conferma ed importa'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
