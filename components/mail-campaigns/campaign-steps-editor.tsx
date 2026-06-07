'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createUniqueId } from '@/lib/crm/utils';
import { useCrm } from '@/providers/crm-provider';
import type { MailCampaignStep } from '@/lib/types/mail-campaigns';

interface CampaignStepsEditorProps {
  campaignId: string;
  steps: MailCampaignStep[];
}

export function CampaignStepsEditor({ campaignId, steps }: CampaignStepsEditorProps) {
  const { saveCampaignSteps } = useCrm();
  const [draftSteps, setDraftSteps] = useState<MailCampaignStep[]>(steps);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setDraftSteps(steps);
  }, [steps]);

  const updateStep = (stepId: string, patch: Partial<MailCampaignStep>): void => {
    setDraftSteps((prev) => prev.map((step) => (
      step.id === stepId ? { ...step, ...patch } : step
    )));
  };

  const addStep = (): void => {
    const nextOrder = draftSteps.length > 0
      ? Math.max(...draftSteps.map((step) => step.orderNumber)) + 1
      : 1;
    setDraftSteps((prev) => [...prev, {
      id: createUniqueId('mail-step'),
      campaignId,
      orderNumber: nextOrder,
      title: `Mail ${nextOrder}`,
      templateText: '',
      waitDaysFromPrevious: 3,
    }]);
  };

  const removeStep = (stepId: string): void => {
    setDraftSteps((prev) => prev.filter((step) => step.id !== stepId));
  };

  const handleSave = async (): Promise<void> => {
    const normalized = draftSteps
      .map((step, index) => ({ ...step, orderNumber: index + 1, campaignId }))
      .sort((a, b) => a.orderNumber - b.orderNumber);
    await saveCampaignSteps(campaignId, normalized);
  };

  return (
    <div className={`mail-steps-editor${isOpen ? ' is-open' : ''}`}>
      <button type="button" className="mail-steps-editor-toggle" onClick={() => setIsOpen((prev) => !prev)}>
        Configura flusso mail ({draftSteps.length} step)
      </button>
      {isOpen && (
        <div className="mail-steps-editor-body">
          {draftSteps.map((step) => (
            <div key={step.id} className="mail-step-editor-row">
              <div className="form-row">
                <div className="form-group">
                  <label>Titolo</label>
                  <input
                    className="form-input"
                    value={step.title}
                    onChange={(e) => updateStep(step.id, { title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Giorni attesa</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input"
                    value={step.waitDaysFromPrevious}
                    onChange={(e) => updateStep(step.id, {
                      waitDaysFromPrevious: parseInt(e.target.value, 10) || 0,
                    })}
                  />
                </div>
                <button type="button" className="btn-table-action delete" onClick={() => removeStep(step.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="form-group">
                <label>Template mail</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={step.templateText}
                  onChange={(e) => updateStep(step.id, { templateText: e.target.value })}
                />
              </div>
            </div>
          ))}
          <div className="mail-steps-editor-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={addStep}>
              <Plus size={14} />
              <span>Aggiungi step</span>
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleSave()}>
              Salva flusso
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
