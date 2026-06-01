'use client';

import { useEffect, useRef, useState } from 'react';
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
    completeRecallWithAction,
  } = useCrm();
  const [awaitingActionId, setAwaitingActionId] = useState<string | null>(null);
  const [actionDraft, setActionDraft] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const filtered = recallFilterStatus
    ? dailyRecallItems.filter((i) => i.status === recallFilterStatus)
    : dailyRecallItems;

  const todoCount = dailyRecallItems.filter((i) => i.status !== 'Done').length;
  const doneCount = dailyRecallItems.filter((i) => i.status === 'Done').length;

  const persistDoneAction = async (clientId: string, action: string) => {
    const trimmed = action.trim();
    if (!trimmed) return;
    await completeRecallWithAction(clientId, trimmed);
    if (awaitingActionId === clientId) {
      setAwaitingActionId(null);
      setActionDraft('');
    }
  };

  const scheduleActionSave = (clientId: string, action: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistDoneAction(clientId, action);
    }, 700);
  };

  const handleStatusChange = async (clientId: string, status: 'To do' | 'Done') => {
    if (status === 'To do') {
      setAwaitingActionId((current) => (current === clientId ? null : current));
      setActionDraft('');
      await updateRecallStatus(clientId, 'To do');
      return;
    }
    const client = clients.find((item) => item.id === clientId);
    setAwaitingActionId(clientId);
    setActionDraft(client?.action || '');
  };

  const handleActionDraftChange = (clientId: string, value: string) => {
    setActionDraft(value);
    scheduleActionSave(clientId, value);
  };

  const handleActionDraftBlur = (clientId: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void persistDoneAction(clientId, actionDraft);
  };

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
                const isAwaitingAction = awaitingActionId === item.clientId;
                const selectValue = isAwaitingAction || isDone ? 'Done' : 'To do';
                return (
                  <div key={item.clientId} className={`recall-card glass-card ${item.slotClass}${isDone ? ' is-done' : ''}`}>
                    <div className="recall-card-header">
                      <span className={`recall-slot-badge ${item.slotClass}`}>{item.slotLabel}</span>
                      <select
                        className="form-select recall-status-select"
                        value={selectValue}
                        onChange={(e) => void handleStatusChange(item.clientId, e.target.value as 'To do' | 'Done')}
                      >
                        <option value="To do">To do</option>
                        <option value="Done">Done</option>
                      </select>
                    </div>
                    <h3 className="recall-client-name">{client.name}</h3>
                    <p className="recall-client-meta">{client.type} · {client.owner}</p>
                    {isAwaitingAction ? (
                      <div className="recall-action-editor">
                        <label htmlFor={`recall-action-${item.clientId}`}>Azione svolta *</label>
                        <textarea
                          id={`recall-action-${item.clientId}`}
                          className="contact-field-input recall-action-textarea"
                          value={actionDraft}
                          onChange={(e) => handleActionDraftChange(item.clientId, e.target.value)}
                          onBlur={() => handleActionDraftBlur(item.clientId)}
                          rows={4}
                          placeholder="Scrivi l'azione fatta con questo cliente..."
                          autoFocus
                        />
                        <p className="recall-action-hint">Salvataggio automatico — si aggiorna anche in Lista Clienti.</p>
                      </div>
                    ) : (
                      <p className="recall-client-action">{client.action || 'Nessuna azione registrata'}</p>
                    )}
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
