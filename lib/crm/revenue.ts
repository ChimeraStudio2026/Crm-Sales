import { REVENUE_YEARS } from '@/lib/constants/crm';
import type { RevenueYear } from '@/lib/constants/crm';
import type { Client } from '@/lib/types/crm';

/** Campo del cliente con il fatturato di un anno (rev2023 … rev2027). */
export type ClientRevenueField = `rev${RevenueYear}`;

export type ClientRevenueByYear = Pick<Client, ClientRevenueField>;

export const REVENUE_FIELD_BY_YEAR = Object.fromEntries(
  REVENUE_YEARS.map((year) => [year, `rev${year}`]),
) as Record<RevenueYear, ClientRevenueField>;

export const REVENUE_FIELDS: readonly ClientRevenueField[] = REVENUE_YEARS.map((year) => REVENUE_FIELD_BY_YEAR[year]);

export function getRevenueField(year: number): ClientRevenueField | null {
  return REVENUE_FIELD_BY_YEAR[year as RevenueYear] ?? null;
}

export function getClientRevenue(client: Partial<ClientRevenueByYear>, year: number): number {
  const field = getRevenueField(year);
  return field ? Number(client[field]) || 0 : 0;
}

export function getClientTotalRevenue(client: Partial<ClientRevenueByYear>): number {
  return REVENUE_FIELDS.reduce((sum, field) => sum + (Number(client[field]) || 0), 0);
}

export function createEmptyRevenueByYear(): ClientRevenueByYear {
  return Object.fromEntries(REVENUE_FIELDS.map((field) => [field, 0])) as ClientRevenueByYear;
}

/** Somma anno per anno (es. il fatturato di un gruppo di ragioni sociali). */
export function addRevenueByYear(
  total: ClientRevenueByYear,
  client: Partial<ClientRevenueByYear>,
): ClientRevenueByYear {
  return Object.fromEntries(
    REVENUE_FIELDS.map((field) => [field, total[field] + (Number(client[field]) || 0)]),
  ) as ClientRevenueByYear;
}
