import type { OkrRecord } from '@/lib/types/crm';
import type { SalesProposal } from '@/lib/types/sales-proposals';
import { parseOkrMonthNumber } from '@/lib/analysis/index';
import { ANALYSIS_YEARS, ANALYSIS_YEAR, PREVIOUS_ANALYSIS_YEAR } from '@/lib/constants/crm';

export const OKR_COMPARISON_YEARS = ANALYSIS_YEARS;

export const OKR_TIMELINE_MONTH_LABELS = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
] as const;

export const OKR_TIMELINE_MAX_DAY = 365;

export interface OkrTimelineSnapshot {
  year: number;
  count: number;
  amount: number;
  throughMonth: number;
  throughDay: number;
  /** Almeno un OKR dell'anno ha la data di conferma della proposta (stato «Si» su Cerbero). */
  usesConfirmationDates: boolean;
}

/** Codice proposta (es. CS1394) → giorno in cui è stata accettata (YYYY-MM-DD). */
export type OkrConfirmationIndex = ReadonlyMap<string, string>;

const EMPTY_CONFIRMATION_INDEX: OkrConfirmationIndex = new Map();

function resolveProposalCode(value: string): string {
  return value.split('||')[0].trim().toUpperCase();
}

/** Data di conferma di ogni proposta accettata: la prima volta che è passata a «Si». */
export function buildOkrConfirmationIndex(proposals: SalesProposal[]): OkrConfirmationIndex {
  const index = new Map<string, string>();
  proposals.forEach((proposal) => {
    if (proposal.stato !== 'Si' || !proposal.code) return;
    const day = (proposal.dataAccettazione || proposal.ultimoAggiornamento || '').slice(0, 10);
    if (!day) return;
    const code = resolveProposalCode(proposal.code);
    const current = index.get(code);
    if (!current || day < current) index.set(code, day);
  });
  return index;
}

/**
 * Giorno da cui l'OKR conta come confermato. È la data di accettazione della proposta, ma mai
 * dopo l'inizio del mese di lavoro: le proposte caricate in blocco su Cerbero hanno date di
 * accettazione successive al lavoro. Senza proposta vale l'inizio del mese.
 */
export function resolveOkrConfirmedOn(record: OkrRecord, confirmations: OkrConfirmationIndex): string | null {
  const month = resolveOkrRecordMonthNumber(record);
  const monthStart = month >= 1 && month <= 12
    ? `${record.year}-${String(month).padStart(2, '0')}-01`
    : '';
  const acceptedOn = record.projectCode ? confirmations.get(resolveProposalCode(record.projectCode)) || '' : '';
  if (acceptedOn && monthStart) return acceptedOn < monthStart ? acceptedOn : monthStart;
  return acceptedOn || monthStart || null;
}

export interface OkrMonthlySeries {
  year: number;
  monthlyAmounts: number[];
  monthlyCounts: number[];
  maxAmount: number;
}

export interface OkrMonthlyDayChange {
  monthNumber: number;
  monthLabel: string;
  previousCount: number;
  currentCount: number;
  countDelta: number;
  previousAmount: number;
  currentAmount: number;
  amountDelta: number;
}

export interface OkrDailyChangeSummary {
  year: number;
  dayOfYear: number;
  countDelta: number;
  amountDelta: number;
  addedCount: number;
  removedCount: number;
  monthlyChanges: OkrMonthlyDayChange[];
}

function resolveMonthNumber(record: OkrRecord): number {
  return resolveOkrRecordMonthNumber(record);
}

/** Mese OKR: monthNumber, monthLabel, oppure ultimo mese del trimestre. */
export function resolveOkrRecordMonthNumber(record: OkrRecord): number {
  if (record.monthNumber && record.monthNumber > 0) return record.monthNumber;
  const fromLabel = parseOkrMonthNumber(record.monthLabel);
  if (fromLabel > 0) return fromLabel;
  if (record.quarter >= 1 && record.quarter <= 4) return record.quarter * 3;
  return 0;
}

export function resolveOkrRecordCalendarPeriod(
  record: OkrRecord,
): { year: number; month: number } | null {
  const month = resolveOkrRecordMonthNumber(record);
  if (month < 1 || month > 12) return null;
  const year = Number(record.year);
  if (!Number.isFinite(year) || year < 2000) return null;
  return { year, month };
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

export function getTimelineDayEndDate(year: number, dayOfYear: number): Date {
  const { throughMonth, throughDay } = getTimelineDateParts(year, dayOfYear);
  return new Date(year, throughMonth - 1, throughDay, 23, 59, 59, 999);
}

function toDayString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function hasOkrConfirmationDates(
  records: OkrRecord[],
  year: number,
  confirmations: OkrConfirmationIndex,
): boolean {
  return records.some((record) => record.year === year
    && Boolean(record.projectCode && confirmations.has(resolveProposalCode(record.projectCode))));
}

/**
 * OKR dell'anno già confermati alla data scelta, su tutti i mesi da gennaio a dicembre:
 * alla data X conta anche il lavoro dei mesi successivi se la proposta era già accettata.
 */
export function filterOkrRecordsAtTimelineDay(
  records: OkrRecord[],
  year: number,
  dayOfYear: number,
  confirmations: OkrConfirmationIndex = EMPTY_CONFIRMATION_INDEX,
): OkrRecord[] {
  const endDay = toDayString(getTimelineDayEndDate(year, dayOfYear));
  return records.filter((record) => {
    if (record.year !== year) return false;
    const confirmedOn = resolveOkrConfirmedOn(record, confirmations);
    return !confirmedOn || confirmedOn <= endDay;
  });
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
  confirmations: OkrConfirmationIndex = EMPTY_CONFIRMATION_INDEX,
): OkrTimelineSnapshot {
  const { throughMonth, throughDay } = getTimelineDateParts(year, dayOfYear);
  const matched = filterOkrRecordsAtTimelineDay(records, year, dayOfYear, confirmations);
  return {
    year,
    count: matched.length,
    amount: matched.reduce((sum, record) => sum + (Number(record.amount) || 0), 0),
    throughMonth,
    throughDay,
    usesConfirmationDates: hasOkrConfirmationDates(records, year, confirmations),
  };
}

export function buildOkrMonthlySeries(
  records: OkrRecord[],
  year: number,
  dayOfYear?: number,
  confirmations: OkrConfirmationIndex = EMPTY_CONFIRMATION_INDEX,
): OkrMonthlySeries {
  const scopedRecords = dayOfYear !== undefined
    ? filterOkrRecordsAtTimelineDay(records, year, dayOfYear, confirmations)
    : records.filter((record) => record.year === year);
  const monthlyAmounts = Array.from({ length: 12 }, () => 0);
  const monthlyCounts = Array.from({ length: 12 }, () => 0);
  scopedRecords.forEach((record) => {
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

function buildMonthlyDayChanges(
  previousRecords: OkrRecord[],
  currentRecords: OkrRecord[],
): OkrMonthlyDayChange[] {
  const previousByMonth = Array.from({ length: 12 }, () => ({ count: 0, amount: 0 }));
  const currentByMonth = Array.from({ length: 12 }, () => ({ count: 0, amount: 0 }));
  previousRecords.forEach((record) => {
    const monthNumber = resolveMonthNumber(record);
    if (monthNumber < 1 || monthNumber > 12) return;
    const index = monthNumber - 1;
    previousByMonth[index].count += 1;
    previousByMonth[index].amount += Number(record.amount) || 0;
  });
  currentRecords.forEach((record) => {
    const monthNumber = resolveMonthNumber(record);
    if (monthNumber < 1 || monthNumber > 12) return;
    const index = monthNumber - 1;
    currentByMonth[index].count += 1;
    currentByMonth[index].amount += Number(record.amount) || 0;
  });
  return Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1;
    const previousCount = previousByMonth[index].count;
    const currentCount = currentByMonth[index].count;
    const previousAmount = previousByMonth[index].amount;
    const currentAmount = currentByMonth[index].amount;
    return {
      monthNumber,
      monthLabel: getTimelineMonthLabel(monthNumber),
      previousCount,
      currentCount,
      countDelta: currentCount - previousCount,
      previousAmount,
      currentAmount,
      amountDelta: currentAmount - previousAmount,
    };
  }).filter((change) => (
    change.countDelta !== 0
    || change.amountDelta !== 0
    || change.currentCount > 0
  ));
}

export function computeOkrDailyChangeSummary(
  records: OkrRecord[],
  year: number,
  dayOfYear: number,
  confirmations: OkrConfirmationIndex = EMPTY_CONFIRMATION_INDEX,
): OkrDailyChangeSummary | null {
  if (dayOfYear <= 1) return null;
  const previousRecords = filterOkrRecordsAtTimelineDay(records, year, dayOfYear - 1, confirmations);
  const currentRecords = filterOkrRecordsAtTimelineDay(records, year, dayOfYear, confirmations);
  const previousIds = new Set(previousRecords.map((record) => record.id));
  const currentIds = new Set(currentRecords.map((record) => record.id));
  const addedCount = currentRecords.filter((record) => !previousIds.has(record.id)).length;
  const removedCount = previousRecords.filter((record) => !currentIds.has(record.id)).length;
  const previousAmount = previousRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const currentAmount = currentRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  return {
    year,
    dayOfYear,
    countDelta: currentRecords.length - previousRecords.length,
    amountDelta: currentAmount - previousAmount,
    addedCount,
    removedCount,
    monthlyChanges: buildMonthlyDayChanges(previousRecords, currentRecords),
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

export function getOkrComparisonYearRangeLabel(): string {
  const years = OKR_COMPARISON_YEARS;
  return `${years[0]}–${years[years.length - 1]}`;
}

export function getOkrComparisonDeltaSnapshots(
  snapshots: OkrTimelineSnapshot[],
): { base: OkrTimelineSnapshot; target: OkrTimelineSnapshot } | null {
  const base = snapshots.find((snapshot) => snapshot.year === PREVIOUS_ANALYSIS_YEAR);
  const target = snapshots.find((snapshot) => snapshot.year === ANALYSIS_YEAR);
  if (!base || !target) return null;
  return { base, target };
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

export function formatOkrCountDelta(delta: number): string {
  if (delta === 0) return '0 OKR';
  return `${delta > 0 ? '+' : ''}${delta} OKR`;
}
