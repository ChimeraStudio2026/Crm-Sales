import type { OkrRecord } from '@/lib/types/crm';
import { ANALYSIS_YEARS } from '@/lib/constants/crm';
import { OKR_TIMELINE_MONTH_LABELS, resolveOkrRecordCalendarPeriod } from '@/lib/analysis/okr-timeline';

const ROLLING_WINDOW_MONTHS = 12;

export interface MonthlyRevenuePoint {
  year: number;
  month: number;
  amount: number;
  count: number;
}

export interface RollingRevenuePoint {
  year: number;
  month: number;
  amount: number;
  count: number;
  rollingAmount: number;
  windowStartYear: number;
  windowStartMonth: number;
}

export interface RollingRevenueBuildResult {
  points: RollingRevenuePoint[];
  totalOkrCount: number;
  usedOkrCount: number;
  skippedOkrCount: number;
  skippedOkrAmount: number;
}

function buildMonthKey(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, '0')}`;
}

function shiftMonth(year: number, month: number, deltaMonths: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + deltaMonths, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function isAnalysisYearValue(year: number): boolean {
  return ANALYSIS_YEARS.includes(year as (typeof ANALYSIS_YEARS)[number]);
}

export function aggregateOkrMonthlyRevenue(records: OkrRecord[]): MonthlyRevenuePoint[] {
  const map = new Map<string, MonthlyRevenuePoint>();
  records.forEach((record) => {
    const period = resolveOkrRecordCalendarPeriod(record);
    if (!period || !isAnalysisYearValue(period.year)) return;
    const key = buildMonthKey(period.year, period.month);
    const existing = map.get(key) ?? {
      year: period.year,
      month: period.month,
      amount: 0,
      count: 0,
    };
    existing.amount += Number(record.amount) || 0;
    existing.count += 1;
    map.set(key, existing);
  });
  return Array.from(map.values()).sort((left, right) => {
    if (left.year !== right.year) return left.year - right.year;
    return left.month - right.month;
  });
}

export function fillContinuousMonthlyTimeline(points: MonthlyRevenuePoint[]): MonthlyRevenuePoint[] {
  if (points.length === 0) return [];
  const map = new Map(points.map((point) => [buildMonthKey(point.year, point.month), point]));
  const minYear = Math.min(...points.map((point) => point.year));
  const last = points[points.length - 1];
  const filled: MonthlyRevenuePoint[] = [];
  let year = minYear;
  let month = 1;
  while (year < last.year || (year === last.year && month <= last.month)) {
    const key = buildMonthKey(year, month);
    filled.push(map.get(key) ?? { year, month, amount: 0, count: 0 });
    const next = shiftMonth(year, month, 1);
    year = next.year;
    month = next.month;
  }
  return filled;
}

export function buildRollingTwelveMonthRevenueWithStats(records: OkrRecord[]): RollingRevenueBuildResult {
  const eligibleRecords = records.filter((record) => isAnalysisYearValue(Number(record.year)));
  let usedOkrCount = 0;
  let skippedOkrCount = 0;
  let skippedOkrAmount = 0;
  eligibleRecords.forEach((record) => {
    const period = resolveOkrRecordCalendarPeriod(record);
    const amount = Number(record.amount) || 0;
    if (!period) {
      skippedOkrCount += 1;
      skippedOkrAmount += amount;
      return;
    }
    usedOkrCount += 1;
  });
  const timeline = fillContinuousMonthlyTimeline(aggregateOkrMonthlyRevenue(eligibleRecords));
  if (timeline.length < ROLLING_WINDOW_MONTHS) {
    return {
      points: [],
      totalOkrCount: eligibleRecords.length,
      usedOkrCount,
      skippedOkrCount,
      skippedOkrAmount,
    };
  }
  const points = timeline
    .map((point, index) => {
      if (index < ROLLING_WINDOW_MONTHS - 1) return null;
      const window = timeline.slice(index - ROLLING_WINDOW_MONTHS + 1, index + 1);
      const windowStart = window[0];
      const rollingAmount = window.reduce((sum, item) => sum + item.amount, 0);
      return {
        year: point.year,
        month: point.month,
        amount: point.amount,
        count: point.count,
        rollingAmount,
        windowStartYear: windowStart.year,
        windowStartMonth: windowStart.month,
      };
    })
    .filter((point): point is RollingRevenuePoint => point !== null);
  return {
    points,
    totalOkrCount: eligibleRecords.length,
    usedOkrCount,
    skippedOkrCount,
    skippedOkrAmount,
  };
}

export function buildRollingTwelveMonthRevenue(records: OkrRecord[]): RollingRevenuePoint[] {
  return buildRollingTwelveMonthRevenueWithStats(records).points;
}

export function formatRollingMonthShortLabel(year: number, month: number): string {
  if (month < 1 || month > 12) return '—';
  return `${OKR_TIMELINE_MONTH_LABELS[month - 1]} ${String(year).slice(-2)}`;
}

export function formatRollingMonthLabel(year: number, month: number): string {
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('it-IT', { month: 'long' });
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}

export function formatRollingWindowLabel(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): string {
  return `${OKR_TIMELINE_MONTH_LABELS[startMonth - 1]} ${startYear} – ${OKR_TIMELINE_MONTH_LABELS[endMonth - 1]} ${endYear}`;
}
