'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  formatSentDate,
  getClientCampaignEntries,
  getStepsForCampaign,
  resolveRelationshipLabel,
} from '@/lib/mail-campaigns/index';
import { useCrm } from '@/providers/crm-provider';

interface ClientMailCampaignsTabProps {
  clientId: string;
}

export function ClientMailCampaignsTab({ clientId }: ClientMailCampaignsTabProps) {
  const {
    clients,
    mailCampaigns,
    mailCampaignContacts,
    mailCampaignSteps,
    mailCampaignSendTracking,
  } = useCrm();

  const client = clients.find((item) => item.id === clientId);
  const entries = useMemo(
    () => getClientCampaignEntries(
      clientId,
      mailCampaigns,
      mailCampaignContacts,
      mailCampaignSteps,
      mailCampaignSendTracking,
    ),
    [clientId, mailCampaigns, mailCampaignContacts, mailCampaignSteps, mailCampaignSendTracking],
  );

  if (entries.length === 0) {
    return (
      <p className="client-campaigns-empty">
        Nessuna campagna mail per questo cliente.
      </p>
    );
  }

  return (
    <div className="client-campaigns-tab">
      <table className="analysis-table client-campaigns-table">
        <thead>
          <tr>
            <th>Campagna</th>
            <th>Contatto</th>
            <th>Rapporto</th>
            <th>Step Mail</th>
            <th>Stato Finale</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ campaign, contact, steps, tracking }) => {
            const contactRecord = client?.contacts.find((item) => item.id === contact.contactId);
            const orderedSteps = getStepsForCampaign(steps, campaign.id);
            return (
              <tr key={contact.id}>
                <td><strong>{campaign.name}</strong></td>
                <td>{contactRecord?.name || contactRecord?.email || '—'}</td>
                <td>{resolveRelationshipLabel(client)}</td>
                <td>
                  <div className="client-campaign-steps">
                    {orderedSteps.map((step) => {
                      const item = tracking.find((entry) => entry.stepId === step.id);
                      return (
                        <span key={step.id} className="client-campaign-step-chip">
                          {step.title}: {item?.sendStatus || '—'}
                          {item?.sendStatus === 'Inviata' && item.sentAt ? ` (${formatSentDate(item.sentAt)})` : ''}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td>{contact.status}</td>
                <td>
                  <Link href={`/campaigns/${campaign.id}`} className="btn btn-secondary btn-sm">
                    Apri campagna
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
