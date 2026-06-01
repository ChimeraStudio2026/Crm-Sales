import type { Client, OkrRecord } from '@/lib/types/crm';
import { EXCEL_REV_EPSILON } from '@/lib/constants/crm';
import { hasExcelRevenueDifference } from '@/lib/crm/utils';

export interface OkrMergeResult {
  merged: OkrRecord[];
  upserted: OkrRecord[];
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
    if (!hasExcelRevenueDifference(existingRecord.amount, incoming.amount, EXCEL_REV_EPSILON)) {
      if (incoming.clientId && existingRecord.clientId !== incoming.clientId) {
        const relinkedRecord: OkrRecord = {
          ...existingRecord,
          clientId: incoming.clientId,
        };
        merged[existingIndex] = relinkedRecord;
        trackUpsert(relinkedRecord);
      }
      skippedCount += 1;
      return;
    }
    const updatedRecord: OkrRecord = {
      ...existingRecord,
      amount: incoming.amount,
      clientId: incoming.clientId || existingRecord.clientId,
      quarter: incoming.quarter || existingRecord.quarter,
    };
    merged[existingIndex] = updatedRecord;
    trackUpsert(updatedRecord);
    updatedCount += 1;
  });
  return {
    merged: linkOkrRecordsToClients(merged, clients),
    upserted: Array.from(upsertedById.values()),
    addedCount,
    updatedCount,
    skippedCount,
  };
}
