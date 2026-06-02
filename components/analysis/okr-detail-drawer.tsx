'use client';

import { X } from 'lucide-react';
import { getOkrDisplayName } from '@/lib/crm/client-sold-products';
import { getTimelineMonthLabel } from '@/lib/analysis/okr-timeline';
import { formatCurrency } from '@/lib/crm/utils';
import type { OkrRecord } from '@/lib/types/crm';

interface OkrDetailDrawerProps {
  clientName: string;
  year: number;
  monthNumber: number;
  records: OkrRecord[];
  onClose: () => void;
}

export function OkrDetailDrawer({
  clientName,
  year,
  monthNumber,
  records,
  onClose,
}: OkrDetailDrawerProps) {
  const monthLabel = getTimelineMonthLabel(monthNumber);
  const totalAmount = records.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose} />
      <div className="drawer open okr-detail-drawer">
        <div className="drawer-header">
          <div>
            <h3>Dettaglio OKR</h3>
            <p className="okr-detail-drawer-subtitle">
              {clientName} · {monthLabel} {year}
            </p>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>
        <div className="drawer-body">
          <div className="okr-detail-summary">
            <span>{records.length} OKR</span>
            <strong>{formatCurrency(totalAmount)}</strong>
          </div>
          {records.length === 0 ? (
            <p className="okr-detail-empty">Nessun OKR in questo mese.</p>
          ) : (
            <ul className="okr-detail-list">
              {records.map((record) => (
                <li key={record.id} className="okr-detail-item">
                  <div className="okr-detail-item-main">
                    <strong>{getOkrDisplayName(record)}</strong>
                    <span className="okr-detail-item-amount">{formatCurrency(record.amount)}</span>
                  </div>
                  <span className="okr-detail-item-type">{record.productType}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
