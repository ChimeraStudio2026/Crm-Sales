import * as XLSX from 'xlsx';
import { REVENUE_YEARS } from '@/lib/constants/crm';
import { getClientRevenue } from '@/lib/crm/revenue';
import type { Client } from '@/lib/types/crm';

function formatContacts(client: Client): string {
  return client.contacts
    .map((contact) => [contact.name, contact.role, contact.email, contact.phone].filter(Boolean).join(' · '))
    .filter(Boolean)
    .join('\n');
}

/** Downloads the given (already filtered and sorted) clients as an .xlsx file. */
export function downloadClientsExcel(clients: Client[], workspaceLabel: string): void {
  if (clients.length === 0) {
    window.alert('Nessun cliente da esportare con i filtri attuali.');
    return;
  }
  const rows = clients.map((client) => ({
    Cliente: client.name,
    Tipologia: client.type,
    Owner: client.owner,
    'Origine cliente': client.clientOrigin,
    Rapporto: client.relationship,
    ...Object.fromEntries(REVENUE_YEARS.map((year) => [`Fatturato ${year}`, getClientRevenue(client, year)])),
    'Ultima azione': client.action,
    'Data azione': client.actionDate,
    Email: client.email,
    Contatti: formatContacts(client),
    Note: client.description,
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clienti');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const date = new Date().toISOString().slice(0, 10);
  const suffix = workspaceLabel ? `-${workspaceLabel.toLowerCase().replace(/\s+/g, '-')}` : '';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clienti${suffix}-${date}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
