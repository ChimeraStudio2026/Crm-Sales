import * as XLSX from 'xlsx';
import type { OkrRecord, ParsedExcelClient } from '@/lib/types/crm';
import { normalizeProductType, parseQuarterFromMonth } from '@/lib/analysis/index';
import { ANALYSIS_YEAR } from '@/lib/constants/crm';
import { createUniqueId } from '@/lib/crm/utils';

export function parseExcelImporto(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  let str = String(value).trim().replace(/[\u00A0\s]/g, '').replace(/[€$£]/g, '');
  if (!str) return 0;
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  if (hasComma && hasDot) {
    const commaPos = str.lastIndexOf(',');
    str = str.substring(0, commaPos).replace(/\./g, '');
    const parsed = parseInt(str, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (hasComma) {
    const commaPos = str.indexOf(',');
    const afterComma = str.substring(commaPos + 1);
    const beforeComma = str.substring(0, commaPos);
    if (/^\d{1,2}$/.test(afterComma)) {
      const parsed = parseInt(beforeComma, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    const parsed = parseInt(str.replace(/,/g, ''), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (hasDot) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length <= 2 && parts[0].length <= 3) {
      const parsed = parseInt(parts[0], 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    const parsed = parseInt(str.replace(/\./g, ''), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const parsed = parseInt(str, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeExcelHeader(header: unknown): string {
  return String(header || '').trim().toLowerCase();
}

function isExcludedExcelColumn(header: string): boolean {
  const normalized = normalizeExcelHeader(header);
  return normalized === 'po cliente' || normalized === 'status';
}

function findExcelColumnIndex(headers: unknown[], targetName: string): number {
  const target = normalizeExcelHeader(targetName);
  return headers.findIndex(
    (h) => !isExcludedExcelColumn(String(h)) && normalizeExcelHeader(h) === target,
  );
}

export interface DetectedExcelColumns {
  clientCol: number;
  importoCol: number;
  productCol: number;
  monthCol: number;
  projectCol: number;
  ownerCol: number;
}

export function detectExcelColumns(headers: unknown[]): DetectedExcelColumns {
  return {
    clientCol: findExcelColumnIndex(headers, 'cliente'),
    importoCol: findExcelColumnIndex(headers, 'importo'),
    productCol: findExcelColumnIndex(headers, 'prodotto'),
    monthCol: findExcelColumnIndex(headers, 'mese'),
    projectCol: findExcelColumnIndex(headers, 'codice progetto'),
    ownerCol: findExcelColumnIndex(headers, 'documento owner'),
  };
}

export interface ExcelParseResult {
  headers: unknown[];
  rows: unknown[][];
  worksheet: XLSX.WorkSheet;
}

export function parseExcelFile(buffer: ArrayBuffer): ExcelParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: '',
  }) as unknown[][];
  const headers = rows[0] || [];
  return { headers, rows, worksheet };
}

function getExcelCellValue(
  worksheet: XLSX.WorkSheet,
  rows: unknown[][],
  rowIndex: number,
  colIndex: number,
): unknown {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: Number(colIndex) });
  const cell = worksheet[address];
  if (cell) {
    if (cell.w) return cell.w;
    if (cell.v !== undefined && cell.v !== null) return cell.v;
  }
  const row = rows[rowIndex];
  if (row && row[colIndex] !== undefined && row[colIndex] !== null && row[colIndex] !== '') {
    return row[colIndex];
  }
  return null;
}

export function aggregateExcelClients(
  rows: unknown[][],
  worksheet: XLSX.WorkSheet,
  clientColIndex: number,
  revColIndex: number,
): ParsedExcelClient[] {
  const clientMap = new Map<string, ParsedExcelClient>();
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    let clientName = row[clientColIndex];
    if (!clientName) continue;
    clientName = clientName.toString().trim().replace(/\s+/g, ' ');
    if (!clientName) continue;
    const revenueRaw = getExcelCellValue(worksheet, rows, i, revColIndex);
    if (revenueRaw === null || revenueRaw === undefined || revenueRaw === '') continue;
    const revenue = parseExcelImporto(revenueRaw);
    const key = clientName.toLowerCase();
    if (clientMap.has(key)) {
      const exist = clientMap.get(key)!;
      exist.revenue += revenue;
      exist.recordCount += 1;
    } else {
      clientMap.set(key, { name: clientName, revenue, recordCount: 1 });
    }
  }
  const result = Array.from(clientMap.values());
  result.sort((a, b) => b.revenue - a.revenue);
  return result;
}

export function buildOkrRecordsFromExcel(
  rows: unknown[][],
  worksheet: XLSX.WorkSheet,
  headers: unknown[],
  clientColIndex: number,
  revColIndex: number,
  productColIndex: number,
  monthColIndex: number,
  projectColIndex: number,
  ownerColIndex: number,
): OkrRecord[] {
  const records: OkrRecord[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const clientNameRaw = row[clientColIndex];
    if (!clientNameRaw) continue;
    const clientName = clientNameRaw.toString().trim().replace(/\s+/g, ' ');
    const amountRaw = getExcelCellValue(worksheet, rows, i, revColIndex);
    if (amountRaw === null || amountRaw === undefined || amountRaw === '') continue;
    const amount = parseExcelImporto(amountRaw);
    const productRaw =
      productColIndex >= 0 ? getExcelCellValue(worksheet, rows, i, productColIndex) : '';
    const monthRaw =
      monthColIndex >= 0 ? getExcelCellValue(worksheet, rows, i, monthColIndex) : '';
    const projectRaw =
      projectColIndex >= 0 ? row[projectColIndex] : '';
    const ownerRaw =
      ownerColIndex >= 0 ? row[ownerColIndex] : '';
    records.push({
      id: createUniqueId('okr'),
      clientName,
      clientId: '',
      productType: normalizeProductType(String(productRaw || '')),
      amount,
      monthLabel: String(monthRaw || ''),
      quarter: parseQuarterFromMonth(monthRaw),
      projectCode: String(projectRaw || ''),
      owner: String(ownerRaw || ''),
      year: ANALYSIS_YEAR,
    });
  }
  return records;
}
