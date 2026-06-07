'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Copy, ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
import {
  buildConversionByRelationship,
  formatSentDate,
  getContactsForCampaign,
  getStepsForCampaign,
  getTrackingForCampaign,
  getTrackingForContact,
  isSendStepOverdue,
  resolveRelationshipLabel,
} from '@/lib/mail-campaigns/index';
import { MAIL_CAMPAIGN_CONTACT_STATUSES, MAIL_SEND_STATUSES } from '@/lib/constants/mail-campaigns';
import { useCrm } from '@/providers/crm-provider';
import { TopHeader } from '@/components/layout/top-header';
import { CampaignContactPicker } from '@/components/mail-campaigns/campaign-contact-picker';
import { CampaignStepsEditor } from '@/components/mail-campaigns/campaign-steps-editor';
import type {
  MailCampaignContactStatus,
  MailCampaignSendTracking,
  MailCampaignStep,
  MailSendStatus,
} from '@/lib/types/mail-campaigns';
import type { Client } from '@/lib/types/crm';

interface MailCampaignDetailSectionProps {
  campaignId: string;
}

function resolveContactDisplay(client: Client | undefined, contactId: string): {
  companyName: string;
  contactName: string;
} {
  const contact = client?.contacts.find((item) => item.id === contactId);
  return {
    companyName: client?.name || '—',
    contactName: contact?.name || contact?.email || '—',
  };
}

export function MailCampaignDetailSection({ campaignId }: MailCampaignDetailSectionProps) {
  const {
    clients,
    mailCampaigns,
    mailCampaignSteps,
    mailCampaignContacts,
    mailCampaignSendTracking,
    addContactsToCampaign,
    removeContactFromCampaign,
    updateCampaignContactStatus,
    updateCampaignContactNotes,
    markMailSentToday,
    updateMailSendStatus,
  } = useCrm();
  const [showPicker, setShowPicker] = useState(false);
  const [activePopup, setActivePopup] = useState<{
    trackingId: string;
    step: MailCampaignStep;
    tracking: MailCampaignSendTracking;
  } | null>(null);
  const notesTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const campaign = mailCampaigns.find((item) => item.id === campaignId);
  const steps = useMemo(
    () => getStepsForCampaign(mailCampaignSteps, campaignId),
    [mailCampaignSteps, campaignId],
  );
  const contacts = useMemo(
    () => getContactsForCampaign(mailCampaignContacts, campaignId),
    [mailCampaignContacts, campaignId],
  );
  const tracking = useMemo(
    () => getTrackingForCampaign(mailCampaignSendTracking, mailCampaignContacts, campaignId),
    [mailCampaignSendTracking, mailCampaignContacts, campaignId],
  );

  const convertedCount = contacts.filter((contact) => contact.status === 'Convertito').length;
  const conversionRate = contacts.length > 0
    ? Math.round((convertedCount / contacts.length) * 1000) / 10
    : 0;
  const conversionByRelationship = useMemo(
    () => buildConversionByRelationship(contacts, clients),
    [contacts, clients],
  );

  const handleCopyTemplate = async (text: string): Promise<void> => {
    await navigator.clipboard.writeText(text);
  };

  const scheduleNotesSave = (campaignContactId: string, value: string): void => {
    if (notesTimerRef.current[campaignContactId]) {
      clearTimeout(notesTimerRef.current[campaignContactId]);
    }
    notesTimerRef.current[campaignContactId] = setTimeout(() => {
      void updateCampaignContactNotes(campaignContactId, value);
    }, 600);
  };

  if (!campaign) {
    return (
      <>
        <TopHeader />
        <div className="content-body">
          <p className="mail-campaigns-empty">Campagna non trovata.</p>
          <Link href="/campaigns" className="btn btn-secondary">Torna all&apos;elenco</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="mail-campaign-detail-header glass-card">
            <div className="mail-campaign-detail-top">
              <Link href="/campaigns" className="btn btn-secondary btn-sm">
                <ArrowLeft size={14} />
                <span>Elenco campagne</span>
              </Link>
              <button type="button" className="btn btn-primary" onClick={() => setShowPicker(true)}>
                <Plus size={16} />
                <span>Aggiungi Contatti</span>
              </button>
            </div>
            <h2>{campaign.name}</h2>
            <p className="mail-campaign-detail-desc">{campaign.description || 'Nessuna descrizione.'}</p>
            <div className="mail-campaign-detail-meta">
              <span>Stato: <strong>{campaign.status}</strong></span>
              <span>Inizio: <strong>{campaign.startDate || '—'}</strong></span>
              <span>Fine: <strong>{campaign.endDate || '—'}</strong></span>
              <span>Step mail: <strong>{steps.length}</strong></span>
            </div>
            <CampaignStepsEditor campaignId={campaignId} steps={steps} />
            <div className="mail-campaign-kpi-grid">
              <div className="analysis-kpi-card">
                <span className="analysis-kpi-label">Tasso Conversione Totale</span>
                <strong className="analysis-kpi-value">{conversionRate}%</strong>
                <span className="analysis-kpi-hint">{convertedCount} / {contacts.length} convertiti</span>
              </div>
              {conversionByRelationship.map((item) => (
                <div key={item.label} className="analysis-kpi-card">
                  <span className="analysis-kpi-label">Conv. {item.label}</span>
                  <strong className="analysis-kpi-value">{item.rate}%</strong>
                  <span className="analysis-kpi-hint">{item.converted} / {item.total}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mail-campaign-registry glass-card">
            <div className="mail-campaign-registry-scroll">
              <table className="mail-campaign-registry-table">
                <thead>
                  <tr>
                    <th className="mail-col-contact">Contatto</th>
                    <th className="mail-col-relationship">Rapporto</th>
                    {steps.map((step) => (
                      <th key={step.id} className="mail-col-step">{step.title}</th>
                    ))}
                    <th className="mail-col-status">Stato Finale</th>
                    <th className="mail-col-notes">Note / Esito</th>
                    <th className="mail-col-actions" aria-label="Azioni" />
                  </tr>
                </thead>
                <tbody>
                  {contacts.length === 0 ? (
                    <tr>
                      <td colSpan={steps.length + 5} className="mail-campaigns-empty">
                        Nessun contatto in campagna. Usa &quot;Aggiungi Contatti&quot; per iniziare.
                      </td>
                    </tr>
                  ) : (
                    contacts.map((campaignContact) => {
                      const client = clients.find((item) => item.id === campaignContact.clientId);
                      const display = resolveContactDisplay(client, campaignContact.contactId);
                      const contactTracking = getTrackingForContact(tracking, campaignContact.id);
                      return (
                        <tr key={campaignContact.id}>
                          <td className="mail-col-contact">
                            <strong>{display.companyName}</strong>
                            <span className="mail-contact-sub">{display.contactName}</span>
                            <Link href="/clients" className="mail-client-link" title="Vai alla lista clienti">
                              <ExternalLink size={13} />
                              Scheda
                            </Link>
                          </td>
                          <td className="mail-col-relationship">
                            {resolveRelationshipLabel(client)}
                          </td>
                          {steps.map((step) => {
                            const stepTracking = contactTracking.find((item) => item.stepId === step.id);
                            if (!stepTracking) {
                              return <td key={step.id}>—</td>;
                            }
                            const isOverdue = isSendStepOverdue({
                              step,
                              steps,
                              tracking: contactTracking,
                              campaignContact,
                              campaign,
                            });
                            return (
                              <td key={step.id} className={`mail-send-cell mail-send-${stepTracking.sendStatus.replace(/\s+/g, '-').toLowerCase()}${isOverdue ? ' is-overdue' : ''}`}>
                                {stepTracking.sendStatus === 'Da Inviare' ? (
                                  <button
                                    type="button"
                                    className="mail-send-btn"
                                    onClick={() => setActivePopup({ trackingId: stepTracking.id, step, tracking: stepTracking })}
                                  >
                                    {isOverdue && <AlertTriangle size={14} />}
                                    Da Inviare
                                  </button>
                                ) : (
                                  <span>
                                    {stepTracking.sendStatus}
                                    {stepTracking.sendStatus === 'Inviata' && stepTracking.sentAt && (
                                      <small>{formatSentDate(stepTracking.sentAt)}</small>
                                    )}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="mail-col-status">
                            <select
                              className="table-cell-select"
                              value={campaignContact.status}
                              onChange={(e) => void updateCampaignContactStatus(
                                campaignContact.id,
                                e.target.value as MailCampaignContactStatus,
                              )}
                            >
                              {MAIL_CAMPAIGN_CONTACT_STATUSES.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          </td>
                          <td className="mail-col-notes">
                            <textarea
                              className="mail-notes-input"
                              defaultValue={campaignContact.outcomeNotes}
                              rows={2}
                              placeholder="Note esito..."
                              onChange={(e) => scheduleNotesSave(campaignContact.id, e.target.value)}
                              onBlur={(e) => void updateCampaignContactNotes(campaignContact.id, e.target.value)}
                            />
                          </td>
                          <td className="mail-col-actions">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm mail-remove-contact-btn"
                              title="Rimuovi dalla campagna"
                              onClick={() => {
                                if (window.confirm('Rimuovere questo contatto dalla campagna?')) {
                                  void removeContactFromCampaign(campaignContact.id);
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {showPicker && (
        <CampaignContactPicker
          campaignId={campaignId}
          existingContacts={contacts}
          onClose={() => setShowPicker(false)}
          onAdd={(refs) => void addContactsToCampaign(campaignId, refs).then(() => setShowPicker(false))}
        />
      )}

      {activePopup && (
        <>
          <div className="drawer-overlay open" onClick={() => setActivePopup(null)} />
          <div className="mail-send-popup open">
            <h4>{activePopup.step.title}</h4>
            <textarea
              className="form-textarea mail-template-preview"
              readOnly
              rows={8}
              value={activePopup.step.templateText || 'Nessun template definito per questo step.'}
            />
            <div className="mail-send-popup-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void handleCopyTemplate(activePopup.step.templateText)}
              >
                <Copy size={14} />
                <span>Copia Testo</span>
              </button>
              <select
                className="form-select"
                value={activePopup.tracking.sendStatus}
                onChange={(e) => void updateMailSendStatus(
                  activePopup.trackingId,
                  e.target.value as MailSendStatus,
                )}
              >
                {MAIL_SEND_STATUSES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() => {
                  void markMailSentToday(activePopup.trackingId);
                  setActivePopup(null);
                }}
              >
                Segna come Inviata oggi
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
