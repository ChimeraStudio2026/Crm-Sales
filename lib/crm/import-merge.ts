import type { Client, OkrRecord, ParsedExcelClient } from '@/lib/types/crm';
import {
  DEFAULT_ACTION_DATE,
  EXCEL_IMPORT_ACTION_PREFIX,
  EXCEL_IMPORT_DESC_PREFIX,
} from '@/lib/constants/crm';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';
import { resolveCanonicalClientBrandName } from '@/lib/crm/client-brand-aliases';
import { getRevenueFieldForImportYear } from '@/lib/crm/excel';
import { resolveClientProductOffers } from '@/lib/crm/product-offers';
import {
  createUniqueId,
  hasExcelRevenueDifference,
} from '@/lib/crm/utils';

export interface OkrMergeResult {
  merged: OkrRecord[];
  upserted: OkrRecord[];
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
}

export interface ClientImportMergeResult {
  merged: Client[];
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
}

export function getOkrRecordMergeKey(record: OkrRecord): string {
  return [
    record.year,
    record.clientName.trim().toLowerCase(),
    record.monthLabel.trim().toLowerCase(),
    record.productType.trim().toLowerCase(),
    record.projectCode.trim().toLowerCase(),
    record.owner.trim().toLowerCase(),
  ].join('|');
}

function linkOkrClientId(record: OkrRecord, clients: Client[]): OkrRecord {
  const canonicalName = resolveCanonicalClientBrandName(record.clientName);
  const matchedClient = clients.find((client) => {
    const clientKey = client.name.trim().toLowerCase();
    return clientKey === canonicalName.toLowerCase()
      || clientKey === record.clientName.trim().toLowerCase();
  });
  if (!matchedClient) return record;
  if (record.clientId === matchedClient.id && record.clientName === matchedClient.name) return record;
  return {
    ...record,
    clientName: matchedClient.name,
    clientId: matchedClient.id,
  };
}

export function linkOkrRecordsToClients(records: OkrRecord[], clients: Client[]): OkrRecord[] {
  return records.map((record) => linkOkrClientId(record, clients));
}

export function mergeClientsWithExcelImport(
  existingClients: Client[],
  parsedClients: ParsedExcelClient[],
  importYear: number,
): ClientImportMergeResult {
  const revField = getRevenueFieldForImportYear(importYear);
  const merged = [...existingClients];
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  parsedClients.forEach((imported) => {
    const existingIndex = merged.findIndex(
      (client) => client.name.toLowerCase() === imported.name.toLowerCase(),
    );
    if (existingIndex === -1) {
      merged.push({
        id: createUniqueId('client'),
        workspaceId: DEFAULT_WORKSPACE_ID,
        name: imported.name,
        type: 'Cliente Diretto',
        owner: 'Jeck',
        clientOrigin: '',
        relationship: 'Nuovo Cliente',
        manualRelationship: false,
        rev2023: revField === 'rev2023' ? imported.revenue : 0,
        rev2024: revField === 'rev2024' ? imported.revenue : 0,
        rev2025: revField === 'rev2025' ? imported.revenue : 0,
        rev2026: revField === 'rev2026' ? imported.revenue : 0,
        action: `${EXCEL_IMPORT_ACTION_PREFIX} (${imported.recordCount} record uniti)`,
        actionDate: DEFAULT_ACTION_DATE,
        email: '',
        description: `${EXCEL_IMPORT_DESC_PREFIX}. Completa contatti, azione e note.`,
        contacts: [],
        productOffers: resolveClientProductOffers('Cliente Diretto', []),
        needsProfileCompletion: true,
        isColdClient: false,
      });
      addedCount += 1;
      return;
    }
    const existing = { ...merged[existingIndex] };
    const currentRevenue = existing[revField];
    if (!hasExcelRevenueDifference(currentRevenue, imported.revenue)) {
      skippedCount += 1;
      return;
    }
    existing[revField] = imported.revenue;
    existing.isColdClient = false;
    if (existing.relationship === 'Freddo') {
      existing.relationship = 'Nuovo Cliente';
    }
    if (
      existing.relationship !== 'Da recuperare'
      && existing.relationship !== 'Eliminato'
    ) {
      existing.manualRelationship = false;
    }
    merged[existingIndex] = existing;
    updatedCount += 1;
  });
  return {
    merged,
    addedCount,
    updatedCount,
    skippedCount,
  };
}

/** Aggiunge solo OKR nuovi; non sovrascrive importi già presenti (anche anni passati). */
export function mergeOkrRecordsWithImport(
  existingRecords: OkrRecord[],
  importedRecords: OkrRecord[],
  clients: Client[],
): OkrMergeResult {
  const merged = [...existingRecords];
  const upsertedById = new Map<string, OkrRecord>();
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const trackUpsert = (record: OkrRecord): void => {
    upsertedById.set(record.id, record);
  };
  importedRecords.forEach((importedRecord) => {
    const incoming = linkOkrClientId(importedRecord, clients);
    const mergeKey = getOkrRecordMergeKey(incoming);
    let existingIndex = merged.findIndex((record) => record.id === incoming.id);
    if (existingIndex === -1) {
      existingIndex = merged.findIndex((record) => getOkrRecordMergeKey(record) === mergeKey);
    }
    if (existingIndex === -1) {
      merged.push(incoming);
      trackUpsert(incoming);
      addedCount += 1;
      return;
    }
    const existingRecord = merged[existingIndex];
    const amountChanged = hasExcelRevenueDifference(existingRecord.amount, incoming.amount);
    const clientIdChanged = !existingRecord.clientId && Boolean(incoming.clientId);
    const metadataChanged =
      existingRecord.monthLabel !== incoming.monthLabel ||
      existingRecord.projectCode !== incoming.projectCode ||
      existingRecord.productType !== incoming.productType;
    if (amountChanged || clientIdChanged || metadataChanged) {
      merged[existingIndex] = {
        ...existingRecord,
        amount: incoming.amount,
        clientId: incoming.clientId || existingRecord.clientId,
        monthLabel: incoming.monthLabel || existingRecord.monthLabel,
        monthNumber: incoming.monthNumber || existingRecord.monthNumber,
        quarter: incoming.quarter || existingRecord.quarter,
        projectCode: incoming.projectCode || existingRecord.projectCode,
        productType: incoming.productType || existingRecord.productType,
        owner: incoming.owner || existingRecord.owner,
      };
      trackUpsert(merged[existingIndex]);
      updatedCount += 1;
      return;
    }
    skippedCount += 1;
  });
  return {
    merged: linkOkrRecordsToClients(merged, clients),
    upserted: Array.from(upsertedById.values()),
    addedCount,
    updatedCount,
    skippedCount,
  };
}
