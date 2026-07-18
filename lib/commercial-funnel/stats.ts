import type { CommercialFunnelEntry, FunnelActionSlot, FunnelActionType } from '@/lib/types/commercial-funnel';
import { isFunnelTerminalConvertedEntry, isFunnelTerminalLost } from '@/lib/commercial-funnel/index';

export const FUNNEL_QUOTATION_ACTION_TYPES = ['Quotazione richiesta'] as const satisfies readonly FunnelActionType[];

export const FUNNEL_MEETING_ACTION_TYPES = [
  'Incontro in presenza',
  'Fissato appuntamento',
] as const satisfies readonly FunnelActionType[];

export interface FunnelStatsSummary {
  total: number;
  converted: number;
  lost: number;
  active: number;
  conversionRate: number;
  quotationRequestRate: number;
  quotationRequestCount: number;
  meetingFixedRate: number;
  meetingFixedCount: number;
  averageConversionDays: number | null;
  averageConversionSampleSize: number;
}

function daysBetween(fromDate: string, toDate: string): number | null {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function resolveFirstActionDate(entry: CommercialFunnelEntry): string {
  const datedActions = entry.actions
    .filter((action) => action.type && action.date)
    .sort((left, right) => left.date.localeCompare(right.date));
  if (datedActions.length > 0) return datedActions[0].date;
  if (entry.createdAt) return entry.createdAt.slice(0, 10);
  return '';
}

function resolveConvertAction(entry: CommercialFunnelEntry): FunnelActionSlot | null {
  const convertActions = entry.actions
    .filter((action) => action.type === 'Convertito' && action.date)
    .sort((left, right) => right.date.localeCompare(left.date));
  return convertActions[0] || null;
}

export function getEntryConversionDays(entry: CommercialFunnelEntry): number | null {
  if (!isFunnelTerminalConvertedEntry(entry)) return null;
  const convertAction = resolveConvertAction(entry);
  if (!convertAction?.date) return null;
  const startDate = resolveFirstActionDate(entry);
  if (!startDate) return null;
  const elapsedDays = daysBetween(startDate, convertAction.date);
  if (elapsedDays === null) return null;
  return Math.max(elapsedDays, 0);
}

function entryHasAnyActionType(
  entry: CommercialFunnelEntry,
  actionTypes: readonly FunnelActionType[],
): boolean {
  const allowedTypes = new Set<string>(actionTypes);
  return entry.actions.some((action) => action.type && allowedTypes.has(action.type));
}

export function buildFunnelStatsSummary(entries: CommercialFunnelEntry[]): FunnelStatsSummary {
  const converted = entries.filter(isFunnelTerminalConvertedEntry).length;
  const lost = entries.filter(isFunnelTerminalLost).length;
  const total = entries.length;
  const active = Math.max(total - converted - lost, 0);
  const conversionRate = total > 0 ? (converted / total) * 100 : 0;
  const quotationRequestCount = entries.filter(
    (entry) => entryHasAnyActionType(entry, FUNNEL_QUOTATION_ACTION_TYPES),
  ).length;
  const meetingFixedCount = entries.filter(
    (entry) => entryHasAnyActionType(entry, FUNNEL_MEETING_ACTION_TYPES),
  ).length;
  const quotationRequestRate = total > 0 ? (quotationRequestCount / total) * 100 : 0;
  const meetingFixedRate = total > 0 ? (meetingFixedCount / total) * 100 : 0;
  const conversionDays = entries
    .map(getEntryConversionDays)
    .filter((value): value is number => value !== null);
  const averageConversionDays = conversionDays.length > 0
    ? conversionDays.reduce((sum, value) => sum + value, 0) / conversionDays.length
    : null;
  return {
    total,
    converted,
    lost,
    active,
    conversionRate,
    quotationRequestRate,
    quotationRequestCount,
    meetingFixedRate,
    meetingFixedCount,
    averageConversionDays,
    averageConversionSampleSize: conversionDays.length,
  };
}

export function formatAverageConversionDays(days: number | null): string {
  if (days === null) return '—';
  const rounded = Math.round(days);
  return `${rounded} ${rounded === 1 ? 'giorno' : 'giorni'}`;
}

export function getFunnelCompositionPercentages(stats: FunnelStatsSummary): {
  activePct: number;
  convertedPct: number;
  lostPct: number;
} {
  if (stats.total <= 0) {
    return { activePct: 0, convertedPct: 0, lostPct: 0 };
  }
  return {
    activePct: (stats.active / stats.total) * 100,
    convertedPct: (stats.converted / stats.total) * 100,
    lostPct: (stats.lost / stats.total) * 100,
  };
}
