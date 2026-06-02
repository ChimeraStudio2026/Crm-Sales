import type { OkrRecord } from '@/lib/types/crm';
import { parseOkrMonthNumber } from '@/lib/analysis/index';

export const OKR_TIMELINE_MONTH_LABELS = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
] as const;

export const OKR_COMPARISON_YEARS = [2025, 2026] as const;

export const OKR_TIMELINE_MAX_DAY = 365;

export interface OkrTimelineSnapshot {
  year: number;
  count: number;
  amount: number;
  throughMonth: number;
  throughDay: number;
}

export interface OkrMonthlySeries {
  year: number;
  monthlyAmounts: number[];
  monthlyCounts: number[];
  maxAmount: number;
}

function resolveMonthNumber(record: OkrRecord): number {
  if (record.monthNumber && record.monthNumber > 0) return record.monthNumber;
  return parseOkrMonthNumber(record.monthLabel);
}

export function getTimelineDateParts(year: number, dayOfYear: number): {
  throughMonth: number;
  throughDay: number;
} {
  const safeDay = Math.min(Math.max(dayOfYear, 1), OKR_TIMELINE_MAX_DAY);
  const date = new Date(year, 0, safeDay);
  return {
    throughMonth: date.getMonth() + 1,
    throughDay: date.getDate(),
  };
}

export function formatTimelineDateLabel(dayOfYear: number, year = 2026): string {
  const { throughMonth, throughDay } = getTimelineDateParts(year, dayOfYear);
  const monthName = new Date(year, throughMonth - 1, 1).toLocaleDateString('it-IT', { month: 'long' });
  return `${throughDay} ${monthName} ${year}`;
}

export function computeOkrTimelineSnapshot(
  records: OkrRecord[],
  year: number,
  dayOfYear: number,
): OkrTimelineSnapshot {
  const { throughMonth, throughDay } = getTimelineDateParts(year, dayOfYear);
  const matched = records.filter((record) => {
    if (record.year !== year) return false;
    const monthNumber = resolveMonthNumber(record);
    return monthNumber > 0 && monthNumber <= throughMonth;
  });
  return {
    year,
    count: matched.length,
    amount: matched.reduce((sum, record) => sum + (Number(record.amount) || 0), 0),
    throughMonth,
    throughDay,
  };
}

export function buildOkrMonthlySeries(records: OkrRecord[], year: number): OkrMonthlySeries {
  const monthlyAmounts = Array.from({ length: 12 }, () => 0);
  const monthlyCounts = Array.from({ length: 12 }, () => 0);
  records.forEach((record) => {
    if (record.year !== year) return;
    const monthNumber = resolveMonthNumber(record);
    if (monthNumber < 1 || monthNumber > 12) return;
    const index = monthNumber - 1;
    monthlyAmounts[index] += Number(record.amount) || 0;
    monthlyCounts[index] += 1;
  });
  return {
    year,
    monthlyAmounts,
    monthlyCounts,
    maxAmount: Math.max(...monthlyAmounts, 1),
  };
}

export function getDefaultTimelineDayOfYear(): number {
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(Math.max(dayOfYear, 1), OKR_TIMELINE_MAX_DAY);
}

export function normalizeOkrClientName(name: string): string {
  return name.trim().toLowerCase();
}

export function filterOkrByClientName(records: OkrRecord[], clientName: string): OkrRecord[] {
  const normalized = normalizeOkrClientName(clientName);
  if (!normalized) return [];
  return records.filter((record) => normalizeOkrClientName(record.clientName) === normalized);
}

export function getOkrClientNames(
  records: OkrRecord[],
  years: readonly number[] = OKR_COMPARISON_YEARS,
): string[] {
  const names = new Set<string>();
  records.forEach((record) => {
    if (!years.includes(record.year) || !record.clientName.trim()) return;
    names.add(record.clientName.trim());
  });
  return Array.from(names).sort((left, right) => left.localeCompare(right, 'it'));
}

export function getTimelineMonthLabel(monthNumber: number): string {
  if (monthNumber < 1 || monthNumber > 12) return '—';
  return OKR_TIMELINE_MONTH_LABELS[monthNumber - 1];
}

export function getMonthlyAmountAtMonth(series: OkrMonthlySeries, monthNumber: number): number {
  if (monthNumber < 1 || monthNumber > 12) return 0;
  return series.monthlyAmounts[monthNumber - 1] || 0;
}

export function getMonthlyCountAtMonth(series: OkrMonthlySeries, monthNumber: number): number {
  if (monthNumber < 1 || monthNumber > 12) return 0;
  return series.monthlyCounts[monthNumber - 1] || 0;
}
