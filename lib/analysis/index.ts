import type { AnalysisForecasts, Client, OkrRecord } from '@/lib/types/crm';

export const ANALYSIS_SCOPES = [
  { id: 'total', label: 'Totale Anno', isQuarter: false, alwaysOpen: true },
  { id: 'q1', label: 'Q1 — Gen · Feb · Mar', isQuarter: true, quarter: 1 },
  { id: 'q2', label: 'Q2 — Apr · Mag · Giu', isQuarter: true, quarter: 2 },
  { id: 'q3', label: 'Q3 — Lug · Ago · Set', isQuarter: true, quarter: 3 },
  { id: 'q4', label: 'Q4 — Ott · Nov · Dic', isQuarter: true, quarter: 4 },
] as const;

export const PRODUCT_CATEGORIES = ['Prod', 'Mini Prod', 'Content', 'Evento'] as const;

export const RELATIONSHIP_ROWS = [
  { key: 'Nuovo Cliente', label: 'New' },
  { key: 'Ricorrente', label: 'Ricorrente' },
  { key: 'Top 20%', label: 'Top 20%' },
] as const;

export const CLIENT_TYPE_ROWS = [
  'Cliente Diretto',
  'Agenzia',
  'Agenzia PR',
  'CDP',
  'Agenzia Eventi',
] as const;

export function createDefaultForecasts(): AnalysisForecasts {
  const forecasts: AnalysisForecasts = {};
  ANALYSIS_SCOPES.forEach((scope) => {
    forecasts[scope.id] = { totalForecast: 0, productPct: {} };
    PRODUCT_CATEGORIES.forEach((cat) => {
      forecasts[scope.id].productPct[cat] = 0;
    });
  });
  return forecasts;
}

export function normalizeProductType(raw: string): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 'Content';
  if (value.includes('big') || value.includes('motion') || value === 'prod') return 'Prod';
  if (value.includes('mini')) return 'Mini Prod';
  if (value.includes('event')) return 'Evento';
  if (value.includes('content')) return 'Content';
  return 'Content';
}

export function parseQuarterFromMonth(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  const text = String(raw).trim().toLowerCase();
  if (!text) return 0;
  if (text.includes('q1') || text === '1') return 1;
  if (text.includes('q2') || text === '2') return 2;
  if (text.includes('q3') || text === '3') return 3;
  if (text.includes('q4') || text === '4') return 4;
  const monthMap: Record<string, number> = {
    gennaio: 1, gen: 1, febbraio: 2, feb: 2, marzo: 3, mar: 3,
    aprile: 4, apr: 4, maggio: 5, mag: 5, giugno: 6, giu: 6,
    luglio: 7, lug: 7, agosto: 8, ago: 8, settembre: 9, set: 9,
    ottobre: 10, ott: 10, novembre: 11, nov: 11, dicembre: 12, dic: 12,
  };
  if (monthMap[text]) return Math.ceil(monthMap[text] / 3);
  const numeric = parseInt(text, 10);
  if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= 12) {
    return Math.ceil(numeric / 3);
  }
  return 0;
}

export function filterOkrByScope(
  records: OkrRecord[],
  scopeId: string,
  year: number,
  quarter?: number,
): OkrRecord[] {
  if (scopeId === 'total') return records.filter((r) => r.year === year);
  return records.filter(
    (r) => r.year === year && r.quarter === quarter,
  );
}

export function filterOkrByYear(records: OkrRecord[], year: number): OkrRecord[] {
  return records.filter((record) => record.year === year);
}

function findClientForOkr(clientName: string, clients: Client[]): Client | null {
  const normalized = clientName.trim().toLowerCase();
  return clients.find((c) => c.name.trim().toLowerCase() === normalized) || null;
}

function sumAmount(records: OkrRecord[]): number {
  return records.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
}

export interface ProductStat {
  category: string;
  revenue: number;
  revenuePct: number;
  forecastPct: number;
  deltaPct: number;
  ticketMedio: number;
  count: number;
}

export interface GroupStat {
  label: string;
  revenue: number;
  revenuePct: number;
}

export interface ScopeMetrics {
  total: number;
  forecast: number;
  delta: number;
}

export function buildProductStats(
  records: OkrRecord[],
  forecastScope: AnalysisForecasts[string],
): ProductStat[] {
  const total = sumAmount(records);
  return PRODUCT_CATEGORIES.map((category) => {
    const categoryRecords = records.filter((r) => r.productType === category);
    const revenue = sumAmount(categoryRecords);
    const count = categoryRecords.length;
    const revenuePct = total > 0 ? (revenue / total) * 100 : 0;
    const forecastPct = Number(forecastScope.productPct[category]) || 0;
    const deltaPct = revenuePct - forecastPct;
    const ticketMedio = count > 0 ? revenue / count : 0;
    return { category, revenue, revenuePct, forecastPct, deltaPct, ticketMedio, count };
  });
}

export function buildGroupedStats(
  records: OkrRecord[],
  clients: Client[],
  groupKeyFn: (client: Client) => string,
  rows: readonly ({ key: string; label: string } | string)[],
): GroupStat[] {
  const total = sumAmount(records);
  return rows.map((row) => {
    const key = typeof row === 'string' ? row : row.key;
    const label = typeof row === 'string' ? row : row.label;
    const scoped = records.filter((r) => {
      const client = findClientForOkr(r.clientName, clients);
      if (!client) return false;
      return groupKeyFn(client) === key;
    });
    const revenue = sumAmount(scoped);
    return {
      label,
      revenue,
      revenuePct: total > 0 ? (revenue / total) * 100 : 0,
    };
  });
}

export function buildScopeMetrics(
  records: OkrRecord[],
  forecastScope: AnalysisForecasts[string],
): ScopeMetrics {
  const total = sumAmount(records);
  const forecast = Number(forecastScope.totalForecast) || 0;
  return { total, forecast, delta: total - forecast };
}

export function formatPct(value: number): string {
  const num = Number(value) || 0;
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

export function formatPctPlain(value: number): string {
  return `${(Number(value) || 0).toFixed(2)}%`;
}
