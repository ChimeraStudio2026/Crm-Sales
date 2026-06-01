'use client';

import { useCallback, useState } from 'react';
import { CheckCircle2, CloudUpload, Eye, X } from 'lucide-react';
import {
  ANALYSIS_YEAR,
  PREVIOUS_ANALYSIS_YEAR,
  SUPPORTED_IMPORT_YEARS,
} from '@/lib/constants/crm';
import {
  getRevenueFieldForImportYear,
  parseExcelImportBufferWithYear,
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

  const applyParseResult = useCallback((result: ExcelImportParseResult) => {
    setParsedClients(result.parsedClients);
    setPendingOkr(result.okrRecords);
    setImportYear(result.importYear);
    setStep('preview');
  }, []);

  const handleFile = useCallback(async (file: File) => {
    showToast(`Analisi del file: ${file.name}...`, 'info');
    try {
      const buffer = await file.arrayBuffer();
      const result = parseExcelBuffer(buffer, file.name);
      if (result.detected.clientCol === -1 || result.detected.importoCol === -1) {
        showToast('Colonne Cliente e Importo non trovate nel file.', 'danger');
        return;
      }
      setRawBuffer(buffer);
      setSourceFilename(file.name);
      applyParseResult(result);
      showToast(`Anteprima pronta (${result.importYear}).`, 'success');
    } catch {
      showToast('Lettura Excel fallita.', 'danger');
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
      await processExcelImport(parsedClients, pendingOkr, importYear);
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
  const revenueField = getRevenueFieldForImportYear(importYear);
  const revenueLabel = importYear === PREVIOUS_ANALYSIS_YEAR ? 'Fatturato 2025' : 'Fatturato 2026';

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
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
                <div className="dropzone-icon"><CloudUpload size={48} /></div>
                <h3>Trascina il tuo file Excel qui</h3>
                <p>O clicca per selezionare (.xlsx, .xls o .csv). Supportati import 2025 e 2026.</p>
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
                    Aggiorna solo i valori diversi da quelli già presenti. I dati esistenti non vengono sovrascritti se invariati.
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
                        let status = 'Nuovo — da completare';
                        if (existing) {
                          status = hasExcelRevenueDifference(existing[revenueField], imported.revenue)
                            ? 'Aggiorna Fatturato'
                            : 'Invariato';
                        }
                        return (
                          <tr key={imported.name}>
                            <td><strong>{imported.name}</strong></td>
                            <td style={{ textAlign: 'center' }}>{imported.recordCount}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(imported.revenue)}</td>
                            <td style={{ textAlign: 'center' }}>{status}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                  <span>Totale {importYear}: <strong>{formatCurrency(totalSum)}</strong></span>
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
