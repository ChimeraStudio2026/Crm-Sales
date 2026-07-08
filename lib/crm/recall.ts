import type { Client, RecallItem, Relationship } from '@/lib/types/crm';
import {
  RECALL_QUOTAS,
  RECALL_STATUS_DONE,
  RECALL_STATUS_TODO,
  RECALL_TOTAL_COUNT,
} from '@/lib/constants/crm';
import { isClientInActiveSection, shuffleArray } from '@/lib/crm/utils';

export const RECALL_SELECTION_VERSION = 2;

function getRecallSlotMetaForRelationship(relationship: Relationship) {
  const match = RECALL_QUOTAS.find((q) => q.relationship === relationship);
  if (match) {
    return { slotLabel: match.slotLabel, slotClass: match.slotClass };
  }
  return { slotLabel: relationship, slotClass: 'recall-slot-default' };
}

export function normalizeRecallItem(item: RecallItem): RecallItem {
  const relationship = item.relationship;
  const meta = getRecallSlotMetaForRelationship(relationship);
  return {
    clientId: item.clientId,
    relationship,
    slotLabel: item.slotLabel || meta.slotLabel,
    slotClass: item.slotClass || meta.slotClass,
    status: item.status === RECALL_STATUS_DONE ? RECALL_STATUS_DONE : RECALL_STATUS_TODO,
  };
}

function createRecallItem(client: Client): RecallItem {
  const meta = getRecallSlotMetaForRelationship(client.relationship);
  return {
    clientId: client.id,
    relationship: client.relationship,
    slotLabel: meta.slotLabel,
    slotClass: meta.slotClass,
    status: RECALL_STATUS_TODO,
  };
}

function getEligibleRecallClientsByRelationship(
  clients: Client[],
  relationship: Relationship,
  excludeIds: Set<string>,
): Client[] {
  return clients.filter(
    (c) =>
      isClientInActiveSection(c) &&
      c.relationship === relationship &&
      c.relationship !== 'Da recuperare' &&
      c.relationship !== 'Eliminato' &&
      !excludeIds.has(c.id),
  );
}

function pickRandomRecallClientsForQuota(
  clients: Client[],
  quota: (typeof RECALL_QUOTAS)[number],
  excludeIds: Set<string>,
): Client[] {
  const pool = getEligibleRecallClientsByRelationship(
    clients,
    quota.relationship,
    excludeIds,
  );
  return shuffleArray(pool).slice(0, quota.count);
}

export function refreshRecallSelectionPreservingDone(
  clients: Client[],
  currentItems: RecallItem[],
): RecallItem[] {
  const doneItems = currentItems
    .filter((item) => item.status === RECALL_STATUS_DONE)
    .map(normalizeRecallItem);
  const lockedIds = new Set(doneItems.map((item) => item.clientId));
  const result: RecallItem[] = [...doneItems];
  RECALL_QUOTAS.forEach((quota) => {
    const doneForRelationship = doneItems.filter(
      (item) => item.relationship === quota.relationship,
    ).length;
    const slotsToFill = Math.max(0, quota.count - doneForRelationship);
    if (slotsToFill === 0) return;
    const pool = getEligibleRecallClientsByRelationship(
      clients,
      quota.relationship,
      lockedIds,
    );
    shuffleArray(pool).slice(0, slotsToFill).forEach((client) => {
      lockedIds.add(client.id);
      result.push(createRecallItem(client));
    });
  });
  return shuffleArray(result);
}

export function generateRandomRecallSelection(
  clients: Client[],
  excludeIds: Set<string> = new Set(),
): RecallItem[] {
  const usedIds = new Set(excludeIds);
  const result: RecallItem[] = [];
  RECALL_QUOTAS.forEach((quota) => {
    pickRandomRecallClientsForQuota(clients, quota, usedIds).forEach((client) => {
      usedIds.add(client.id);
      result.push(createRecallItem(client));
    });
  });
  return shuffleArray(result);
}

export function isRecallSelectionValid(items: RecallItem[]): boolean {
  if (!Array.isArray(items) || items.length !== RECALL_TOTAL_COUNT) {
    return false;
  }
  const counts: Record<string, number> = {};
  RECALL_QUOTAS.forEach((quota) => {
    counts[quota.relationship] = 0;
  });
  items.forEach((item) => {
    const relationship = normalizeRecallItem(item).relationship;
    if (Object.prototype.hasOwnProperty.call(counts, relationship)) {
      counts[relationship] += 1;
    }
  });
  return RECALL_QUOTAS.every((quota) => counts[quota.relationship] === quota.count);
}

export function normalizeStoredRecallItems(items: RecallItem[]): RecallItem[] {
  return items.map(normalizeRecallItem);
}

export function filterValidRecallItems(
  items: RecallItem[],
  clients: Client[],
): RecallItem[] {
  return items.filter((item) => clients.some((c) => c.id === item.clientId));
}
