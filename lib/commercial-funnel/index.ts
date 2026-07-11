import type {
  CommercialFunnelEntry,
  FunnelActionSlot,
  FunnelActionType,
  FunnelRowStatus,
  FunnelSemaforoState,
  FunnelStage,
} from '@/lib/types/commercial-funnel';
import { FUNNEL_ACTION_TYPES } from '@/lib/types/commercial-funnel';
import { getTodayString } from '@/lib/crm/utils';
import {
  computeFunnelStage,
  getLastFilledActionIndex,
  isFunnelActionType,
  resolveFunnelStageDisplay,
  sanitizeFunnelActionSlot,
} from '@/lib/commercial-funnel/stage';

export const FUNNEL_SEMAFORO_THRESHOLD_DAYS = 5;

export {
  advanceFunnelStage,
  computeFunnelStage,
  isFunnelActionType,
  isTerminalFunnelStage,
  normalizeFunnelStage,
  resolveFunnelStageDisplay,
  resolveStageFromActionType,
  withComputedStage,
} from '@/lib/commercial-funnel/stage';

export function createEmptyFunnelActionSlot(): FunnelActionSlot {
  return {
    type: '',
    date: '',
    note: '',
    taskIds: [],
  };
}

export function isEmptyFunnelActionSlot(slot: FunnelActionSlot): boolean {
  return !slot.type && !slot.date && !slot.note && slot.taskIds.length === 0;
}

export function compactFunnelActions(actions: FunnelActionSlot[]): FunnelActionSlot[] {
  return actions.filter((slot) => !isEmptyFunnelActionSlot(slot));
}

export function getDisplayFunnelActions(
  actions: FunnelActionSlot[],
  canAppendEmptySlot = true,
): FunnelActionSlot[] {
  const compact = compactFunnelActions(actions);
  if (compact.length === 0) return [createEmptyFunnelActionSlot()];
  if (!canAppendEmptySlot) return compact;
  const last = compact[compact.length - 1];
  if (last.type) return [...compact, createEmptyFunnelActionSlot()];
  return compact;
}

export function normalizeFunnelActions(value: unknown): FunnelActionSlot[] {
  if (!Array.isArray(value)) return [];
  return compactFunnelActions(
    value
      .filter((item): item is Partial<FunnelActionSlot> => Boolean(item) && typeof item === 'object')
      .map((item) => sanitizeFunnelActionSlot(item)),
  );
}

export function ensureActionSlot(actions: FunnelActionSlot[], slotIndex: number): FunnelActionSlot[] {
  const next = [...actions];
  while (next.length <= slotIndex) {
    next.push(createEmptyFunnelActionSlot());
  }
  return next;
}

export function finalizeFunnelActions(
  actions: FunnelActionSlot[],
  canAppendEmptySlot = true,
): FunnelActionSlot[] {
  const compact = compactFunnelActions(actions);
  if (!canAppendEmptySlot) return compact;
  return getDisplayFunnelActions(compact, true);
}

/** @deprecated Use resolveFunnelStageDisplay(entry) with persisted stage instead. */
export function resolveFunnelStatus(actions: FunnelActionSlot[]): FunnelRowStatus {
  const lastIndex = getLastFilledActionIndex(actions);
  if (lastIndex < 0) {
    return { label: 'In contatto', date: '' };
  }
  const last = actions[lastIndex];
  return {
    label: last.type || `Azione ${lastIndex + 1}`,
    date: last.date,
  };
}

export function resolveFunnelSemaforo(actions: FunnelActionSlot[], today = getTodayString()): FunnelSemaforoState {
  const lastIndex = getLastFilledActionIndex(actions);
  if (lastIndex < 0) return 'green';
  const last = actions[lastIndex];
  if (last.type === 'Convertito' || last.type === 'Perso') return 'green';
  const elapsed = daysBetween(last.date, today);
  return elapsed >= FUNNEL_SEMAFORO_THRESHOLD_DAYS ? 'red' : 'green';
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function isFunnelTerminalLost(entry: CommercialFunnelEntry): boolean {
  return entry.stage === 'Perso';
}

export function isFunnelTerminalConvertedEntry(entry: CommercialFunnelEntry): boolean {
  return entry.stage === 'Convertito';
}

export function isFunnelActionLocked(entry: CommercialFunnelEntry): boolean {
  return isFunnelTerminalLost(entry) || isFunnelTerminalConvertedEntry(entry);
}

export function getMaxDisplayActionColumns(entries: CommercialFunnelEntry[]): number {
  if (entries.length === 0) return 1;
  return entries.reduce((maxColumns, entry) => {
    const canAppend = !isFunnelActionLocked(entry);
    const columnCount = getDisplayFunnelActions(entry.actions, canAppend).length;
    return Math.max(maxColumns, columnCount);
  }, 1);
}

export function padDisplayActions(
  actions: FunnelActionSlot[],
  columnCount: number,
  canAppendEmptySlot = true,
): FunnelActionSlot[] {
  const display = getDisplayFunnelActions(actions, canAppendEmptySlot);
  const padded = [...display];
  while (padded.length < columnCount) {
    padded.push(createEmptyFunnelActionSlot());
  }
  return padded;
}

export function buildPersistedFunnelEntry(entry: CommercialFunnelEntry): CommercialFunnelEntry {
  const canAppend = !isFunnelActionLocked(entry);
  const actions = compactFunnelActions(entry.actions);
  const stage = computeFunnelStage({ actions, lostReason: entry.lostReason });
  return {
    ...entry,
    actions,
    stage,
  };
}

export type { FunnelActionType, FunnelStage };

export { FUNNEL_ACTION_TYPES };
