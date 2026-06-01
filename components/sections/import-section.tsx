'use client';

import { useCallback, useState } from 'react';
import { CheckCircle2, CloudUpload, Eye, X } from 'lucide-react';
import { formatCurrency, hasExcelRevenueDifference } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import { TopHeader } from '@/components/layout/top-header';
import type { ParsedExcelClient } from '@/lib/types/crm';

export function ImportSection() {
  const { clients, parseExcelBuffer, processExcelImport, showToast } = useCrm();
  const [parsedClients, setParsedClients] = useState<ParsedExcelClient[]>([]);
  const [pendingOkr, setPendingOkr] = useState<ReturnType<typeof parseExcelBuffer>['okrRecords']>([]);
  const [step, setStep] = useState<'dropzone' | 'preview'>('dropzone');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    showToast(`Analisi del file: ${file.name}...`, 'info');
    try {
      const buffer = await file.arrayBuffer();
      const result = parseExcelBuffer(buffer);
      if (result.detected.clientCol === -1 || result.detected.importoCol === -1) {
        showToast('Colonne Cliente e Importo non trovate nel file.', 'danger');
        return;
      }
      setParsedClients(result.parsedClients);
      setPendingOkr(result.okrRecords);
      setStep('preview');
      showToast('Anteprima pronta.', 'success');
    } catch {
      showToast('Lettura Excel fallita.', 'danger');
    }
  }, [parseExcelBuffer, showToast]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleCommit = async () => {
    setIsProcessing(true);
    try {
      await processExcelImport(parsedClients, pendingOkr);
      setStep('dropzone');
      setParsedClients([]);
      setPendingOkr([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const totalSum = parsedClients.reduce((s, c) => s + c.revenue, 0);

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
                <p>O clicca per selezionare (.xlsx, .xls o .csv)</p>
                <span className="btn btn-secondary">Seleziona File</span>
              </div>
            )}
            {step === 'preview' && (
              <div className="glass-card excel-mapping-card">
                <div className="chart-header">
                  <h3><Eye size={20} /> Anteprima Dati Aggregati (Fatturato 2026)</h3>
                  <button type="button" className="btn btn-secondary btn-icon" onClick={() => setStep('dropzone')}>
                    <X size={16} />
                  </button>
                </div>
                <div className="import-preview-wrapper">
                  <table className="import-preview-table">
                    <thead>
                      <tr>
                        <th>Nome Cliente</th>
                        <th>N. Record</th>
                        <th>Fatturato 2026</th>
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
                          status = hasExcelRevenueDifference(existing.rev2026, imported.revenue)
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
                  <span>Totale: <strong>{formatCurrency(totalSum)}</strong></span>
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
