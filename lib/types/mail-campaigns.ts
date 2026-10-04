import type { FunnelTrack } from '@/lib/types/commercial-funnel';

export type MailCampaignStatus = 'Bozza' | 'Attiva' | 'Chiusa';

export type MailCampaignContactStatus = 'In Corso' | 'Convertito' | 'Perso';

export type MailSendStatus = 'Da Inviare' | 'Inviata' | 'Non Necessaria';

export interface MailCampaign {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: MailCampaignStatus;
  startDate: string;
  endDate: string;
  owner: string;
  funnelTrack: FunnelTrack;
  createdAt: string;
}

export interface MailCampaignStep {
  id: string;
  campaignId: string;
  orderNumber: number;
  title: string;
  templateText: string;
  waitDaysFromPrevious: number;
}

export interface MailCampaignContact {
  id: string;
  campaignId: string;
  clientId: string;
  contactId: string;
  status: MailCampaignContactStatus;
  outcomeNotes: string;
  createdAt: string;
}

export interface MailCampaignSendTracking {
  id: string;
  campaignContactId: string;
  stepId: string;
  sendStatus: MailSendStatus;
  sentAt: string;
}

export interface MailCampaignDashboardRow {
  campaign: MailCampaign;
  totalContacts: number;
  mailsSent: number;
  mailsTotal: number;
  conversionRate: number;
}

export interface MailCampaignContactRef {
  clientId: string;
  contactId: string;
}
