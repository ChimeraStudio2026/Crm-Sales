import type { OkrRecord } from '@/lib/types/crm';
import { filterOkrByClientName, normalizeOkrClientName } from '@/lib/analysis/okr-timeline';
import { parseOkrMonthNumber } from '@/lib/analysis/index';

export interface ClientSoldProductStat {
  productType: string;
  totalAmount: number;
  count: number;
}

function resolveMonthNumber(record: OkrRecord): number {
  if (record.monthNumber && record.monthNumber > 0) return record.monthNumber;
  return parseOkrMonthNumber(record.monthLabel);
}

export function buildClientSoldProducts(
  records: OkrRecord[],
  clientName: string,
): ClientSoldProductStat[] {
  const stats = new Map<string, ClientSoldProductStat>();
  filterOkrByClientName(records, clientName).forEach((record) => {
    const productType = record.productType.trim() || 'Content';
    const current = stats.get(productType) || {
      productType,
      totalAmount: 0,
      count: 0,
    };
    current.totalAmount += Number(record.amount) || 0;
    current.count += 1;
    stats.set(productType, current);
  });
  return Array.from(stats.values()).sort((left, right) => right.totalAmount - left.totalAmount);
}

export function filterOkrByClientYearMonth(
  records: OkrRecord[],
  clientName: string,
  year: number,
  monthNumber: number,
): OkrRecord[] {
  return filterOkrByClientName(records, clientName).filter((record) => {
    if (record.year !== year) return false;
    return resolveMonthNumber(record) === monthNumber;
  });
}

export function getOkrDisplayName(record: OkrRecord): string {
  if (record.projectCode.trim()) return record.projectCode.trim();
  const monthLabel = record.monthLabel.trim();
  if (monthLabel) return `${record.productType} · ${monthLabel}`;
  return record.productType || 'OKR';
}

export function matchesClientOkrRecord(record: OkrRecord, client: { id: string; name: string }): boolean {
  if (record.clientId && record.clientId === client.id) return true;
  return normalizeOkrClientName(record.clientName) === normalizeOkrClientName(client.name);
}
