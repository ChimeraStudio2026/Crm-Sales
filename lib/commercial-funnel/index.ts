import { getTodayString } from '@/lib/crm/utils';
import type {
  CommercialFunnelEntry,
  FunnelActionSlot,
  FunnelActionType,
  FunnelRowStatus,
  FunnelSemaforoState,
} from '@/lib/types/commercial-funnel';
import { FUNNEL_ACTION_TYPES } from '@/lib/types/commercial-funnel';

export const FUNNEL_SLOT_COUNT = 5;

export const FUNNEL_GAP_THRESHOLDS_DAYS = [7, 10, 14, 20] as const;

export function createEmptyFunnelActions(): FunnelActionSlot[] {
  return Array.from({ length: FUNNEL_SLOT_COUNT }, () => ({
    type: '',
    date: '',
    note: '',
    taskIds: [],
  }));
}

export function normalizeFunnelActions(value: unknown): FunnelActionSlot[] {
  const empty = createEmptyFunnelActions();
  if (!Array.isArray(value)) return empty;
  return empty.map((slot, index) => {
    const item = value[index];
    if (!item || typeof item !== 'object') return slot;
    const record = item as Partial<FunnelActionSlot>;
    const type = typeof record.type === 'string' ? record.type : '';
    const date = typeof record.date === 'string' ? record.date : '';
    const note = typeof record.note === 'string' ? record.note : '';
    const taskIds = Array.isArray(record.taskIds)
      ? record.taskIds.filter((id): id is string => typeof id === 'string')
      : [];
    return {
      type: isFunnelActionType(type) ? type : '',
      date,
      note,
      taskIds,
    };
  });
}

export function isFunnelActionType(value: string): value is FunnelActionType {
  return (FUNNEL_ACTION_TYPES as readonly string[]).includes(value);
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function getLastFilledActionIndex(actions: FunnelActionSlot[]): number {
  let lastIndex = -1;
  actions.forEach((action, index) => {
    if (action.type && action.date) lastIndex = index;
  });
  return lastIndex;
}

export function resolveFunnelStatus(actions: FunnelActionSlot[]): FunnelRowStatus {
  const lastIndex = getLastFilledActionIndex(actions);
  if (lastIndex < 0) {
    return { label: 'In attesa Azione 1', date: '' };
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
  if (lastIndex >= FUNNEL_SLOT_COUNT - 1) return 'green';
  const next = actions[lastIndex + 1];
  if (next.type && next.date) return 'green';
  const threshold = FUNNEL_GAP_THRESHOLDS_DAYS[lastIndex] ?? 20;
  const elapsed = daysBetween(last.date, today);
  return elapsed > threshold ? 'red' : 'green';
}

export function isFunnelTerminalLost(entry: CommercialFunnelEntry): boolean {
  return entry.actions.some((action) => action.type === 'Perso');
}

export function isFunnelTerminalConverted(actions: FunnelActionSlot[]): boolean {
  return actions.some((action) => action.type === 'Convertito');
}

export function isFunnelTerminalConvertedEntry(entry: CommercialFunnelEntry): boolean {
  return isFunnelTerminalConverted(entry.actions);
}

export function isFunnelActionLocked(entry: CommercialFunnelEntry): boolean {
  return isFunnelTerminalLost(entry) || isFunnelTerminalConvertedEntry(entry);
}
