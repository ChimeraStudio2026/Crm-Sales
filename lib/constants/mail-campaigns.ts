import type {
  MailCampaignContactStatus,
  MailCampaignStatus,
  MailSendStatus,
} from '@/lib/types/mail-campaigns';

export const MAIL_CAMPAIGN_STATUSES: MailCampaignStatus[] = ['Bozza', 'Attiva', 'Chiusa'];

export const MAIL_CAMPAIGN_CONTACT_STATUSES: MailCampaignContactStatus[] = [
  'In Corso',
  'Convertito',
  'Perso',
];

export const MAIL_SEND_STATUSES: MailSendStatus[] = [
  'Da Inviare',
  'Inviata',
  'Non Necessaria',
];

export const MAIL_CAMPAIGN_STATUS_LABELS: Record<MailCampaignStatus, string> = {
  Bozza: 'Bozza',
  Attiva: 'Attiva',
  Chiusa: 'Chiusa',
};

export function normalizeMailCampaignStatus(value: string): MailCampaignStatus {
  if (value === 'Conclusa') return 'Chiusa';
  if ((MAIL_CAMPAIGN_STATUSES as readonly string[]).includes(value)) {
    return value as MailCampaignStatus;
  }
  return 'Bozza';
}
