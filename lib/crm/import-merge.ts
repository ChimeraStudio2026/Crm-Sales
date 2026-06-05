import type { Client, OkrRecord, ParsedExcelClient } from '@/lib/types/crm';
import {
  DEFAULT_ACTION_DATE,
  EXCEL_IMPORT_ACTION_PREFIX,
  EXCEL_IMPORT_DESC_PREFIX,
} from '@/lib/constants/crm';
import { getRevenueFieldForImportYear } from '@/lib/crm/excel';
import { resolveClientProductOffers } from '@/lib/crm/product-offers';
import {
  createUniqueId,
  hasExcelRevenueDifference,
  shouldPreserveClientOnImport,
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
  preservedCount: number;
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
  const matchedClient = clients.find(
    (client) => client.name.trim().toLowerCase() === record.clientName.trim().toLowerCase(),
  );
  if (!matchedClient) return record;
  if (record.clientId === matchedClient.id) return record;
  return { ...record, clientId: matchedClient.id };
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
  let preservedCount = 0;
  parsedClients.forEach((imported) => {
    const existingIndex = merged.findIndex(
      (client) => client.name.toLowerCase() === imported.name.toLowerCase(),
    );
    if (existingIndex === -1) {
      merged.push({
        id: createUniqueId('client'),
        name: imported.name,
        type: 'Cliente Diretto',
        owner: 'Jeck',
        clientOrigin: '',
        relationship: 'Nuovo Cliente',
        manualRelationship: false,
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
    if (shouldPreserveClientOnImport(existing)) {
      preservedCount += 1;
      return;
    }
    const currentRevenue = existing[revField];
    if (!hasExcelRevenueDifference(currentRevenue, imported.revenue)) {
      skippedCount += 1;
      return;
    }
    existing[revField] = imported.revenue;
    existing.isColdClient = false;
    if (existing.relationship !== 'Perso' && existing.relationship !== 'Eliminato') {
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
    preservedCount,
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
    const existingIndex = merged.findIndex(
      (record) => getOkrRecordMergeKey(record) === mergeKey,
    );
    if (existingIndex === -1) {
      merged.push(incoming);
      trackUpsert(incoming);
      addedCount += 1;
      return;
    }
    const existingRecord = merged[existingIndex];
    if (!existingRecord.clientId && incoming.clientId) {
      const relinkedRecord: OkrRecord = {
        ...existingRecord,
        clientId: incoming.clientId,
      };
      merged[existingIndex] = relinkedRecord;
      trackUpsert(relinkedRecord);
      updatedCount += 1;
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
