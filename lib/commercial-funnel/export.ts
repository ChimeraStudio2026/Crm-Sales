import * as XLSX from 'xlsx';
import { MAIL_CAMPAIGN_STATUS_LABELS } from '@/lib/constants/mail-campaigns';
import { resolveFunnelContact } from '@/lib/commercial-funnel/contacts';
import {
  compactFunnelActions,
  getMaxDisplayActionColumns,
  resolveFunnelSemaforo,
  resolveFunnelStageDisplay,
} from '@/lib/commercial-funnel/index';
import { REVENUE_YEARS } from '@/lib/constants/crm';
import { getClientRevenue } from '@/lib/crm/revenue';
import { getTodayString } from '@/lib/crm/utils';
import type { CommercialFunnelEntry } from '@/lib/types/commercial-funnel';
import type { Client } from '@/lib/types/crm';
import type { MailCampaign } from '@/lib/types/mail-campaigns';

export interface FunnelExcelExportInput {
  entries: CommercialFunnelEntry[];
  clients: Client[];
  mailCampaigns: MailCampaign[];
  workspaceLabel?: string;
}

type FunnelExportRow = Record<string, string | number>;

export function buildFunnelExportRows(input: FunnelExcelExportInput): FunnelExportRow[] {
  const clientById = new Map(input.clients.map((client) => [client.id, client]));
  const campaignById = new Map(input.mailCampaigns.map((campaign) => [campaign.id, campaign]));
  const maxActionColumns = getMaxDisplayActionColumns(input.entries);
  return input.entries
    .map((entry) => {
      const client = clientById.get(entry.clientId);
      const campaign = campaignById.get(entry.campaignId);
      const contact = resolveFunnelContact(client, entry.contactId);
      const stageDisplay = resolveFunnelStageDisplay(entry);
      const semaforo = resolveFunnelSemaforo(entry.actions);
      const filledActions = compactFunnelActions(entry.actions);
      const row: FunnelExportRow = {
        Campagna: campaign?.name || '',
        'Stato campagna': campaign?.status
          ? MAIL_CAMPAIGN_STATUS_LABELS[campaign.status]
          : '',
        'Owner campagna': campaign?.owner || '',
        'Inizio campagna': campaign?.startDate || '',
        'Fine campagna': campaign?.endDate || '',
        Cliente: client?.name || '',
        'Tipo cliente': client?.type || '',
        'Owner cliente': client?.owner || '',
        Email: client?.email || contact?.email || '',
        Relazione: client?.relationship || '',
        'Origine cliente': client?.clientOrigin || '',
        'Cliente cold': client?.isColdClient ? 'Sì' : 'No',
        ...Object.fromEntries(REVENUE_YEARS.map((year) => [`Rev ${year}`, client ? getClientRevenue(client, year) : ''])),
        Contatto: contact?.name || '',
        'Email contatto': contact?.email || '',
        'Ruolo contatto': contact?.role || '',
        'Telefono contatto': contact?.phone || '',
        'Stage funnel': entry.stage,
        'Data stage': stageDisplay.date || '',
        Semaforo: semaforo === 'red' ? 'Rosso' : 'Verde',
        'Fonte lista': entry.clientSource === 'cold' ? 'Lista cold' : 'Lista principale',
        'Owner funnel': entry.owner || client?.owner || '',
        'Motivo perdita': entry.lostReason || '',
        'Data creazione': entry.createdAt.slice(0, 10),
      };
      for (let index = 0; index < maxActionColumns; index += 1) {
        const action = filledActions[index];
        const columnNumber = index + 1;
        row[`Azione ${columnNumber} tipo`] = action?.type || '';
        row[`Azione ${columnNumber} data`] = action?.date || '';
        row[`Azione ${columnNumber} nota`] = action?.note || '';
      }
      return row;
    })
    .sort((left, right) => {
      const campaignCompare = String(left.Campagna).localeCompare(String(right.Campagna), 'it');
      if (campaignCompare !== 0) return campaignCompare;
      return String(left.Cliente).localeCompare(String(right.Cliente), 'it');
    });
}

export function downloadCommercialFunnelExcel(input: FunnelExcelExportInput): void {
  if (input.entries.length === 0) {
    window.alert('Nessun dato da esportare nel funnel.');
    return;
  }
  const rows = buildFunnelExportRows(input);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Funnel commerciale');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const date = getTodayString();
  const workspaceSuffix = input.workspaceLabel
    ? `-${input.workspaceLabel.toLowerCase().replace(/\s+/g, '-')}`
    : '';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `funnel-commerciale${workspaceSuffix}-${date}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
