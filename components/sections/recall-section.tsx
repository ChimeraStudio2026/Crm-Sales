'use client';

import { RefreshCw } from 'lucide-react';
import { RECALL_TOTAL_COUNT } from '@/lib/constants/crm';
import { formatItalianDate, getTodayString } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import { TopHeader } from '@/components/layout/top-header';

export function RecallSection() {
  const {
    clients,
    dailyRecallItems,
    recallFilterStatus,
    setRecallFilterStatus,
    refreshRecall,
    updateRecallStatus,
  } = useCrm();

  const filtered = recallFilterStatus
    ? dailyRecallItems.filter((i) => i.status === recallFilterStatus)
    : dailyRecallItems;

  const todoCount = dailyRecallItems.filter((i) => i.status !== 'Done').length;
  const doneCount = dailyRecallItems.filter((i) => i.status === 'Done').length;

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="recall-header-bar">
            <div className="recall-header-info">
              <h2>I tuoi {RECALL_TOTAL_COUNT} clienti da ricontattare oggi</h2>
              <p>Selezione del {formatItalianDate(getTodayString())} — {todoCount} da fare, {doneCount} completati</p>
              <div className="recall-legend">
                <span className="recall-legend-item"><strong>1×</strong> ⭐⭐⭐ Top 20%</span>
                <span className="recall-legend-item"><strong>2×</strong> ⭐⭐ Ricorrente</span>
                <span className="recall-legend-item"><strong>2×</strong> ⭐ Nuovo Cliente</span>
              </div>
            </div>
            <div className="recall-header-actions">
              <select
                className="form-select recall-filter-select"
                value={recallFilterStatus}
                onChange={(e) => setRecallFilterStatus(e.target.value)}
              >
                <option value="">Tutti</option>
                <option value="To do">To do</option>
                <option value="Done">Done</option>
              </select>
              <button type="button" className="btn btn-secondary" onClick={() => void refreshRecall()}>
                <RefreshCw size={16} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
          <div className="recall-cards-grid">
            {filtered.length === 0 ? (
              <div className="recall-empty glass-card">
                <h3>Nessun contatto in questa vista</h3>
              </div>
            ) : (
              filtered.map((item) => {
                const client = clients.find((c) => c.id === item.clientId);
                if (!client) return null;
                const isDone = item.status === 'Done';
                return (
                  <div key={item.clientId} className={`recall-card glass-card ${item.slotClass}${isDone ? ' is-done' : ''}`}>
                    <div className="recall-card-header">
                      <span className={`recall-slot-badge ${item.slotClass}`}>{item.slotLabel}</span>
                      <select
                        className="form-select recall-status-select"
                        value={item.status}
                        onChange={(e) => void updateRecallStatus(item.clientId, e.target.value as 'To do' | 'Done')}
                      >
                        <option value="To do">To do</option>
                        <option value="Done">Done</option>
                      </select>
                    </div>
                    <h3 className="recall-client-name">{client.name}</h3>
                    <p className="recall-client-meta">{client.type} · {client.owner}</p>
                    <p className="recall-client-action">{client.action || 'Nessuna azione registrata'}</p>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </>
  );
}
