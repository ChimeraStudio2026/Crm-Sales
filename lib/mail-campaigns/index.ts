import type { Client } from '@/lib/types/crm';
import type {
  MailCampaign,
  MailCampaignContact,
  MailCampaignDashboardRow,
  MailCampaignSendTracking,
  MailCampaignStep,
} from '@/lib/types/mail-campaigns';
import { isClientInColdSection } from '@/lib/crm/utils';

export function getStepsForCampaign(
  steps: MailCampaignStep[],
  campaignId: string,
): MailCampaignStep[] {
  return steps
    .filter((step) => step.campaignId === campaignId)
    .sort((a, b) => a.orderNumber - b.orderNumber);
}

export function getContactsForCampaign(
  contacts: MailCampaignContact[],
  campaignId: string,
): MailCampaignContact[] {
  return contacts.filter((contact) => contact.campaignId === campaignId);
}

export function getTrackingForContact(
  tracking: MailCampaignSendTracking[],
  campaignContactId: string,
): MailCampaignSendTracking[] {
  return tracking.filter((item) => item.campaignContactId === campaignContactId);
}

export function getTrackingForCampaign(
  tracking: MailCampaignSendTracking[],
  contacts: MailCampaignContact[],
  campaignId: string,
): MailCampaignSendTracking[] {
  const contactIds = new Set(
    contacts.filter((contact) => contact.campaignId === campaignId).map((contact) => contact.id),
  );
  return tracking.filter((item) => contactIds.has(item.campaignContactId));
}

export function resolveRelationshipLabel(client: Client | undefined): string {
  if (!client) return '—';
  if (client.isColdClient) return 'Contatto Freddo';
  return client.relationship || '—';
}

export function formatSentDate(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('it-IT');
}

function parseDateOnly(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from: Date, to: Date): number {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function isSendStepOverdue(params: {
  step: MailCampaignStep;
  steps: MailCampaignStep[];
  tracking: MailCampaignSendTracking[];
  campaignContact: MailCampaignContact;
  campaign: MailCampaign;
  now?: Date;
}): boolean {
  const { step, steps, tracking, campaignContact, campaign } = params;
  const current = tracking.find((item) => item.stepId === step.id);
  if (!current || current.sendStatus !== 'Da Inviare') return false;
  const orderedSteps = getStepsForCampaign(steps, step.campaignId);
  const stepIndex = orderedSteps.findIndex((item) => item.id === step.id);
  const today = params.now ?? new Date();
  let anchorDate: Date | null = null;
  if (stepIndex <= 0) {
    anchorDate = parseDateOnly(campaign.startDate) ?? new Date(campaignContact.createdAt);
  } else {
    const previousStep = orderedSteps[stepIndex - 1];
    const previousTracking = tracking.find((item) => item.stepId === previousStep.id);
    if (!previousTracking?.sentAt) return false;
    anchorDate = new Date(previousTracking.sentAt);
  }
  if (!anchorDate) return false;
  return daysBetween(anchorDate, today) > step.waitDaysFromPrevious;
}

export function buildCampaignDashboardRow(
  campaign: MailCampaign,
  contacts: MailCampaignContact[],
  steps: MailCampaignStep[],
  tracking: MailCampaignSendTracking[],
): MailCampaignDashboardRow {
  const campaignContacts = getContactsForCampaign(contacts, campaign.id);
  const campaignSteps = getStepsForCampaign(steps, campaign.id);
  const campaignTracking = getTrackingForCampaign(tracking, contacts, campaign.id);
  const mailsTotal = campaignContacts.length * campaignSteps.length;
  const mailsSent = campaignTracking.filter((item) => item.sendStatus === 'Inviata').length;
  const converted = campaignContacts.filter((contact) => contact.status === 'Convertito').length;
  const conversionRate = campaignContacts.length > 0
    ? Math.round((converted / campaignContacts.length) * 1000) / 10
    : 0;
  return {
    campaign,
    totalContacts: campaignContacts.length,
    mailsSent,
    mailsTotal,
    conversionRate,
  };
}

export function buildConversionByRelationship(
  campaignContacts: MailCampaignContact[],
  clients: Client[],
): { label: string; rate: number; total: number; converted: number }[] {
  const groups = new Map<string, { total: number; converted: number }>();
  campaignContacts.forEach((campaignContact) => {
    const client = clients.find((item) => item.id === campaignContact.clientId);
    const label = resolveRelationshipLabel(client);
    const current = groups.get(label) || { total: 0, converted: 0 };
    current.total += 1;
    if (campaignContact.status === 'Convertito') current.converted += 1;
    groups.set(label, current);
  });
  return [...groups.entries()]
    .map(([label, stats]) => ({
      label,
      total: stats.total,
      converted: stats.converted,
      rate: stats.total > 0 ? Math.round((stats.converted / stats.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'it'));
}

export function getClientCampaignEntries(
  clientId: string,
  campaigns: MailCampaign[],
  contacts: MailCampaignContact[],
  steps: MailCampaignStep[],
  tracking: MailCampaignSendTracking[],
): {
  campaign: MailCampaign;
  contact: MailCampaignContact;
  steps: MailCampaignStep[];
  tracking: MailCampaignSendTracking[];
}[] {
  const clientContacts = contacts.filter((contact) => contact.clientId === clientId);
  return clientContacts.map((contact) => ({
    campaign: campaigns.find((campaign) => campaign.id === contact.campaignId)!,
    contact,
    steps: getStepsForCampaign(steps, contact.campaignId),
    tracking: getTrackingForContact(tracking, contact.id),
  })).filter((entry) => entry.campaign);
}

export function flattenClientContacts(clients: Client[]): {
  clientId: string;
  contactId: string;
  clientName: string;
  contactName: string;
  contactEmail: string;
  relationshipLabel: string;
}[] {
  const rows: {
    clientId: string;
    contactId: string;
    clientName: string;
    contactName: string;
    contactEmail: string;
    relationshipLabel: string;
  }[] = [];
  clients.forEach((client) => {
    if (client.relationship === 'Eliminato') return;
    const relationshipLabel = resolveRelationshipLabel(client);
    const contacts = client.contacts.length > 0
      ? client.contacts
      : [{ id: `legacy-${client.id}`, name: '', email: client.email || '', role: '' }];
    contacts.forEach((contact) => {
      if (!contact.name.trim() && !contact.email.trim()) return;
      rows.push({
        clientId: client.id,
        contactId: contact.id,
        clientName: client.name,
        contactName: contact.name || '—',
        contactEmail: contact.email || '',
        relationshipLabel,
      });
    });
  });
  return rows.sort((a, b) => a.clientName.localeCompare(b.clientName, 'it'));
}

export function filterEligibleClientsForCampaign(
  clients: Client[],
  includeCold: boolean,
): Client[] {
  return clients.filter((client) => {
    if (client.relationship === 'Eliminato') return false;
    if (includeCold) return true;
    return !isClientInColdSection(client);
  });
}
