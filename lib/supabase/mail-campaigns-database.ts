import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';
import {
  embedCampaignOwnerInDescription,
  resolveCampaignOwner,
} from '@/lib/mail-campaigns/campaign-owner';
import type {
  MailCampaign,
  MailCampaignContact,
  MailCampaignSendTracking,
  MailCampaignStep,
} from '@/lib/types/mail-campaigns';

let mailCampaignOwnerColumnAvailable: boolean | null = null;

function isMissingOwnerColumnError(error: { message?: string; code?: string }): boolean {
  const message = (error.message || '').toLowerCase();
  return message.includes('owner') && (
    message.includes('does not exist')
    || message.includes('could not find')
    || error.code === 'PGRST204'
  );
}

export function isMailCampaignOwnerColumnAvailable(): boolean {
  return mailCampaignOwnerColumnAvailable !== false;
}

export async function probeMailCampaignOwnerColumn(db: SupabaseClient): Promise<boolean> {
  const { error } = await db.from('mail_campaigns').select('owner').limit(1);
  mailCampaignOwnerColumnAvailable = !error;
  return mailCampaignOwnerColumnAvailable;
}

function buildMailCampaignRows(
  campaigns: MailCampaign[],
  includeOwnerColumn: boolean,
): Record<string, unknown>[] {
  return campaigns.map((campaign) => {
    const description = includeOwnerColumn
      ? campaign.description || ''
      : embedCampaignOwnerInDescription(campaign.description || '', campaign.owner || '');
    const row: Record<string, unknown> = {
      id: campaign.id,
      workspace_id: campaign.workspaceId || DEFAULT_WORKSPACE_ID,
      name: campaign.name,
      description,
      status: campaign.status,
      start_date: campaign.startDate || null,
      end_date: campaign.endDate || null,
      updated_at: new Date().toISOString(),
    };
    if (includeOwnerColumn) row.owner = campaign.owner || '';
    return row;
  });
}

interface MailCampaignRow {
  id: string;
  workspace_id: string | null;
  name: string;
  description: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  owner: string | null;
  created_at: string;
}

interface MailCampaignStepRow {
  id: string;
  campaign_id: string;
  order_number: number;
  title: string;
  template_text: string;
  wait_days_from_previous: number;
}

interface MailCampaignContactRow {
  id: string;
  campaign_id: string;
  client_id: string;
  contact_id: string;
  status: string;
  outcome_notes: string;
  created_at: string;
}

interface MailCampaignSendTrackingRow {
  id: string;
  campaign_contact_id: string;
  step_id: string;
  send_status: string;
  sent_at: string | null;
}

function rowToCampaign(row: MailCampaignRow): MailCampaign {
  const resolved = resolveCampaignOwner(
    mailCampaignOwnerColumnAvailable !== false ? row.owner : null,
    row.description || '',
  );
  return {
    id: row.id,
    workspaceId: row.workspace_id || DEFAULT_WORKSPACE_ID,
    name: row.name,
    description: resolved.description,
    status: row.status as MailCampaign['status'],
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    owner: resolved.owner,
    createdAt: row.created_at || '',
  };
}

function rowToStep(row: MailCampaignStepRow): MailCampaignStep {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    orderNumber: Number(row.order_number) || 1,
    title: row.title,
    templateText: row.template_text || '',
    waitDaysFromPrevious: Number(row.wait_days_from_previous) || 0,
  };
}

function rowToContact(row: MailCampaignContactRow): MailCampaignContact {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    clientId: row.client_id,
    contactId: row.contact_id,
    status: row.status as MailCampaignContact['status'],
    outcomeNotes: row.outcome_notes || '',
    createdAt: row.created_at || '',
  };
}

function rowToTracking(row: MailCampaignSendTrackingRow): MailCampaignSendTracking {
  return {
    id: row.id,
    campaignContactId: row.campaign_contact_id,
    stepId: row.step_id,
    sendStatus: row.send_status as MailCampaignSendTracking['sendStatus'],
    sentAt: row.sent_at || '',
  };
}

export interface MailCampaignDataBundle {
  campaigns: MailCampaign[];
  steps: MailCampaignStep[];
  contacts: MailCampaignContact[];
  tracking: MailCampaignSendTracking[];
}

export async function fetchMailCampaignData(
  db: SupabaseClient,
): Promise<MailCampaignDataBundle> {
  await probeMailCampaignOwnerColumn(db);
  const [campaignsRes, stepsRes, contactsRes, trackingRes] = await Promise.all([
    db.from('mail_campaigns').select('*').order('created_at', { ascending: false }),
    db.from('mail_campaign_steps').select('*').order('order_number'),
    db.from('mail_campaign_contacts').select('*').order('created_at', { ascending: false }),
    db.from('mail_campaign_send_tracking').select('*'),
  ]);
  if (campaignsRes.error) throw campaignsRes.error;
  if (stepsRes.error) throw stepsRes.error;
  if (contactsRes.error) throw contactsRes.error;
  if (trackingRes.error) throw trackingRes.error;
  return {
    campaigns: (campaignsRes.data || []).map((row) => rowToCampaign(row as MailCampaignRow)),
    steps: (stepsRes.data || []).map((row) => rowToStep(row as MailCampaignStepRow)),
    contacts: (contactsRes.data || []).map((row) => rowToContact(row as MailCampaignContactRow)),
    tracking: (trackingRes.data || []).map((row) => rowToTracking(row as MailCampaignSendTrackingRow)),
  };
}

export async function persistMailCampaigns(
  db: SupabaseClient,
  campaigns: MailCampaign[],
): Promise<void> {
  if (campaigns.length === 0) return;
  const includeOwnerColumn = mailCampaignOwnerColumnAvailable !== false;
  let rows = buildMailCampaignRows(campaigns, includeOwnerColumn);
  let result = await db.from('mail_campaigns').upsert(rows, { onConflict: 'id' });
  if (result.error && includeOwnerColumn && isMissingOwnerColumnError(result.error)) {
    mailCampaignOwnerColumnAvailable = false;
    rows = buildMailCampaignRows(campaigns, false);
    result = await db.from('mail_campaigns').upsert(rows, { onConflict: 'id' });
  }
  if (result.error) throw result.error;
}

export async function persistSingleMailCampaign(
  db: SupabaseClient,
  campaign: MailCampaign,
): Promise<void> {
  await persistMailCampaigns(db, [campaign]);
}

export async function deleteMailCampaignContact(
  db: SupabaseClient,
  campaignContactId: string,
): Promise<void> {
  const { error } = await db.from('mail_campaign_contacts').delete().eq('id', campaignContactId);
  if (error) throw error;
}

export async function deleteMailCampaign(
  db: SupabaseClient,
  campaignId: string,
): Promise<void> {
  const { error } = await db.from('mail_campaigns').delete().eq('id', campaignId);
  if (error) throw error;
}

export async function persistMailCampaignSteps(
  db: SupabaseClient,
  campaignId: string,
  steps: MailCampaignStep[],
): Promise<void> {
  if (steps.length === 0) return;
  const rows = steps.map((step) => ({
    id: step.id,
    campaign_id: campaignId,
    order_number: step.orderNumber,
    title: step.title,
    template_text: step.templateText || '',
    wait_days_from_previous: step.waitDaysFromPrevious,
  }));
  const { error } = await db.from('mail_campaign_steps').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function persistMailCampaignContacts(
  db: SupabaseClient,
  contacts: MailCampaignContact[],
): Promise<void> {
  if (contacts.length === 0) return;
  const rows = contacts.map((contact) => ({
    id: contact.id,
    campaign_id: contact.campaignId,
    client_id: contact.clientId,
    contact_id: contact.contactId,
    status: contact.status,
    outcome_notes: contact.outcomeNotes || '',
    updated_at: new Date().toISOString(),
  }));
  const { error } = await db.from('mail_campaign_contacts').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function persistMailCampaignTracking(
  db: SupabaseClient,
  tracking: MailCampaignSendTracking[],
): Promise<void> {
  if (tracking.length === 0) return;
  const rows = tracking.map((item) => ({
    id: item.id,
    campaign_contact_id: item.campaignContactId,
    step_id: item.stepId,
    send_status: item.sendStatus,
    sent_at: item.sentAt || null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await db.from('mail_campaign_send_tracking').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function clearMailCampaignData(db: SupabaseClient): Promise<void> {
  await db.from('mail_campaign_send_tracking').delete().neq('id', '');
  await db.from('mail_campaign_contacts').delete().neq('id', '');
  await db.from('mail_campaign_steps').delete().neq('id', '');
  await db.from('mail_campaigns').delete().neq('id', '');
}
