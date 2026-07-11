import type {
  CommercialFunnelEntry,
  FunnelActionSlot,
  FunnelActionType,
  FunnelRowStatus,
  FunnelStage,
} from '@/lib/types/commercial-funnel';
import { FUNNEL_ACTION_TYPES, FUNNEL_STAGES } from '@/lib/types/commercial-funnel';

const PROGRESSION_STAGES: readonly FunnelStage[] = [
  'In contatto',
  'Incontro fissato',
  'Preventivo richiesto',
  'Convertito',
];

function getLastFilledActionIndex(actions: FunnelActionSlot[]): number {
  let lastIndex = -1;
  actions.forEach((action, index) => {
    if (action.type && action.date) lastIndex = index;
  });
  return lastIndex;
}

function getActionProgressionLevel(actionType: string): number | null {
  switch (actionType) {
    case 'Quotazione richiesta':
      return 2;
    case 'Incontro in presenza':
    case 'Fissato appuntamento':
      return 1;
    case 'Mail Di contatto':
    case 'Instagram':
    case 'Call':
    case 'Messaggio':
      return 0;
    default:
      return null;
  }
}

function getStageProgressionLevel(stage: FunnelStage): number {
  const index = PROGRESSION_STAGES.indexOf(stage);
  return index >= 0 ? index : -1;
}

export function normalizeFunnelStage(value: unknown): FunnelStage {
  if (typeof value === 'string' && (FUNNEL_STAGES as readonly string[]).includes(value)) {
    return value as FunnelStage;
  }
  return 'In contatto';
}

export function computeFunnelStage(
  entry: Pick<CommercialFunnelEntry, 'actions' | 'lostReason'>,
): FunnelStage {
  if (entry.lostReason.trim()) return 'Perso';
  let maxProgression = -1;
  let latestConvertitoDate = '';
  let latestPersoDate = '';
  entry.actions.forEach((action) => {
    if (!action.type) return;
    const progression = getActionProgressionLevel(action.type);
    if (progression !== null) {
      maxProgression = Math.max(maxProgression, progression);
    }
    if (action.type === 'Convertito' && action.date) {
      if (!latestConvertitoDate || action.date > latestConvertitoDate) {
        latestConvertitoDate = action.date;
      }
    }
    if (action.type === 'Perso' && action.date) {
      if (!latestPersoDate || action.date > latestPersoDate) {
        latestPersoDate = action.date;
      }
    }
  });
  if (latestConvertitoDate && (!latestPersoDate || latestConvertitoDate >= latestPersoDate)) {
    return 'Convertito';
  }
  if (latestPersoDate) return 'Perso';
  if (maxProgression >= 2) return 'Preventivo richiesto';
  if (maxProgression >= 1) return 'Incontro fissato';
  return 'In contatto';
}

export function resolveStageFromActionType(actionType: FunnelActionType | ''): FunnelStage | null {
  if (!actionType) return null;
  if (actionType === 'Perso') return 'Perso';
  if (actionType === 'Convertito') return 'Convertito';
  const level = getActionProgressionLevel(actionType);
  if (level === null) return null;
  return PROGRESSION_STAGES[level];
}

export function advanceFunnelStage(currentStage: FunnelStage, actionType: FunnelActionType): FunnelStage {
  if (actionType === 'Perso') return 'Perso';
  const mappedStage = resolveStageFromActionType(actionType);
  if (!mappedStage) return currentStage;
  if (mappedStage === 'Convertito') return 'Convertito';
  const currentLevel = getStageProgressionLevel(currentStage);
  const nextLevel = getStageProgressionLevel(mappedStage);
  if (currentLevel < 0 || nextLevel < 0) return mappedStage;
  return PROGRESSION_STAGES[Math.max(currentLevel, nextLevel)];
}

export function withComputedStage(entry: CommercialFunnelEntry): CommercialFunnelEntry {
  return {
    ...entry,
    stage: computeFunnelStage(entry),
  };
}

export function resolveFunnelStageDisplay(entry: CommercialFunnelEntry): FunnelRowStatus {
  const lastIndex = getLastFilledActionIndex(entry.actions);
  return {
    label: entry.stage,
    date: lastIndex >= 0 ? entry.actions[lastIndex].date : '',
  };
}

export function isTerminalFunnelStage(stage: FunnelStage): boolean {
  return stage === 'Perso' || stage === 'Convertito';
}

export function mapLegacyActionType(actionType: string): string {
  const normalized = actionType.trim();
  if (!normalized) return '';
  if (normalized === 'Riscrivere') return 'Mail Di contatto';
  return normalized;
}

export function isFunnelActionType(value: string): value is FunnelActionType {
  return (FUNNEL_ACTION_TYPES as readonly string[]).includes(value);
}

export function sanitizeFunnelActionSlot(slot: Partial<FunnelActionSlot>): FunnelActionSlot {
  const mappedType = mapLegacyActionType(typeof slot.type === 'string' ? slot.type : '');
  const type = isFunnelActionType(mappedType) ? mappedType : '';
  return {
    type,
    date: typeof slot.date === 'string' ? slot.date : '',
    note: typeof slot.note === 'string' ? slot.note : '',
    taskIds: Array.isArray(slot.taskIds)
      ? slot.taskIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

export { getLastFilledActionIndex };
