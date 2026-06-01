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
