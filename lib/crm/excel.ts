import * as XLSX from 'xlsx';
import type { OkrRecord, ParsedExcelClient } from '@/lib/types/crm';
import { normalizeProductType, parseOkrMonthNumber, parseQuarterFromMonth } from '@/lib/analysis/index';
import {
  ANALYSIS_YEAR,
  PREVIOUS_ANALYSIS_YEAR,
  SUPPORTED_IMPORT_YEARS,
} from '@/lib/constants/crm';
import { createUniqueId } from '@/lib/crm/utils';
import { getOkrRecordMergeKey } from '@/lib/crm/import-merge';

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
  yearCol: number;
  productCol: number;
  monthCol: number;
  projectCol: number;
  ownerCol: number;
  headerRowIndex: number;
  sheetName: string;
}

export type ExcelImportFormat = 'okr' | 'invoice' | 'legacy-line';

function findInvoiceHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const lower = row.map((cell) => String(cell).trim().toLowerCase());
    const clientCol = lower.findIndex((cell) => cell === 'cliente');
    const importoCol = lower.findIndex((cell) => cell.startsWith('imponib'));
    if (clientCol >= 0 && importoCol >= 0) return i;
  }
  return -1;
}

function isLegacyLineRevenueSheet(rows: unknown[][]): boolean {
  const sample = rows.slice(0, Math.min(rows.length, 8));
  if (sample.length === 0) return false;
  return sample.every((row) => (
    Array.isArray(row) &&
    typeof row[0] === 'string' &&
    row[0].trim().length > 0 &&
    typeof row[2] === 'number'
  ));
}

function detectColumnsFromInvoiceHeader(headers: unknown[]): DetectedExcelColumns {
  const lower = headers.map((cell) => String(cell).trim().toLowerCase());
  return {
    clientCol: lower.findIndex((cell) => cell === 'cliente'),
    importoCol: lower.findIndex((cell) => cell.startsWith('imponib')),
    yearCol: lower.findIndex((cell) => cell === 'anno ft' || cell === 'anno'),
    productCol: -1,
    monthCol: lower.findIndex((cell) => cell === 'mese ft' || cell === 'mese'),
    projectCol: -1,
    ownerCol: -1,
    headerRowIndex: 0,
    sheetName: '',
  };
}

function detectLegacyLineColumns(): DetectedExcelColumns {
  return {
    clientCol: 0,
    importoCol: 2,
    yearCol: -1,
    productCol: -1,
    monthCol: -1,
    projectCol: -1,
    ownerCol: -1,
    headerRowIndex: -1,
    sheetName: '',
  };
}

export function detectExcelImportFormat(
  headers: unknown[],
  rows: unknown[][],
): ExcelImportFormat {
  if (findInvoiceHeaderRow(rows) >= 0) return 'invoice';
  const detected = detectExcelColumns(headers);
  if (detected.clientCol >= 0 && detected.importoCol >= 0) return 'okr';
  if (isLegacyLineRevenueSheet(rows)) return 'legacy-line';
  return 'okr';
}
export function detectExcelColumns(headers: unknown[]): DetectedExcelColumns {
  const yearCol = findExcelColumnIndex(headers, 'anno');
  return {
    clientCol: findExcelColumnIndex(headers, 'cliente'),
    importoCol: findExcelColumnIndex(headers, 'importo'),
    yearCol: yearCol >= 0 ? yearCol : findExcelColumnIndex(headers, 'year'),
    productCol: findExcelColumnIndex(headers, 'prodotto'),
    monthCol: findExcelColumnIndex(headers, 'mese'),
    projectCol: findExcelColumnIndex(headers, 'codice progetto'),
    ownerCol: findExcelColumnIndex(headers, 'documento owner'),
    headerRowIndex: 0,
    sheetName: '',
  };
}

export function isSupportedImportYear(year: number): boolean {
  return SUPPORTED_IMPORT_YEARS.includes(year as (typeof SUPPORTED_IMPORT_YEARS)[number]);
}

export type ClientRevenueField = 'rev2023' | 'rev2024' | 'rev2025' | 'rev2026';

const REVENUE_FIELD_BY_YEAR: Record<number, ClientRevenueField> = {
  2023: 'rev2023',
  2024: 'rev2024',
  2025: 'rev2025',
  2026: 'rev2026',
};

export function getRevenueFieldForImportYear(year: number): ClientRevenueField {
  return REVENUE_FIELD_BY_YEAR[year] ?? 'rev2026';
}

function parseRowYearValue(raw: unknown): number | null {
  const parsed = parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || !isSupportedImportYear(parsed)) return null;
  return parsed;
}

export function detectExcelImportYear(
  headers: unknown[],
  rows: unknown[][],
  detected: DetectedExcelColumns,
  filename?: string,
): number {
  if (filename) {
    const filenameMatch = filename.match(/\b(202[0-9])\b/);
    if (filenameMatch) {
      const yearFromFilename = parseInt(filenameMatch[1], 10);
      if (isSupportedImportYear(yearFromFilename)) return yearFromFilename;
    }
  }
  if (detected.yearCol >= 0) {
    const yearCounts = new Map<number, number>();
    for (let i = 1; i < rows.length; i += 1) {
      const rowYear = parseRowYearValue(rows[i]?.[detected.yearCol]);
      if (rowYear === null) continue;
      yearCounts.set(rowYear, (yearCounts.get(rowYear) || 0) + 1);
    }
    let dominantYear = ANALYSIS_YEAR;
    let dominantCount = 0;
    yearCounts.forEach((count, year) => {
      if (count > dominantCount) {
        dominantCount = count;
        dominantYear = year;
      }
    });
    if (dominantCount > 0) return dominantYear;
  }
  return ANALYSIS_YEAR;
}

function resolveRowImportYear(
  row: unknown[],
  detected: DetectedExcelColumns,
  fallbackYear: number,
): number {
  if (detected.yearCol >= 0) {
    const rowYear = parseRowYearValue(row[detected.yearCol]);
    if (rowYear !== null) return rowYear;
  }
  return fallbackYear;
}

export interface ExcelFileParseResult {
  headers: unknown[];
  rows: unknown[][];
  worksheet: XLSX.WorkSheet;
  sheetName: string;
  format: ExcelImportFormat;
  detected: DetectedExcelColumns;
  creditNoteCount: number;
}

function getDataStartRowIndex(format: ExcelImportFormat, detected: DetectedExcelColumns): number {
  if (format === 'legacy-line') return 0;
  if (format === 'invoice') return Math.max(detected.headerRowIndex + 1, 1);
  return 1;
}

function resolveWorkbookSheet(
  workbook: XLSX.WorkBook,
  importYear: number,
): ExcelFileParseResult {
  const preferredSheetNames = [
    'Fatture e NC',
    'Copia di Fatture e NC',
    String(importYear),
    ...workbook.SheetNames,
  ];
  const visited = new Set<string>();
  for (const sheetName of preferredSheetNames) {
    if (!sheetName || visited.has(sheetName) || !workbook.SheetNames.includes(sheetName)) continue;
    visited.add(sheetName);
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: true,
      defval: '',
    }) as unknown[][];
    const format = detectExcelImportFormat(rows[0] || [], rows);
    if (format === 'invoice') {
      const headerRowIndex = findInvoiceHeaderRow(rows);
      const headers = rows[headerRowIndex] || [];
      const detected = detectColumnsFromInvoiceHeader(headers);
      detected.headerRowIndex = headerRowIndex;
      detected.sheetName = sheetName;
      return {
        headers,
        rows,
        worksheet,
        sheetName,
        format,
        detected,
        creditNoteCount: 0,
      };
    }
    if (format === 'legacy-line') {
      const detected = detectLegacyLineColumns();
      detected.sheetName = sheetName;
      return {
        headers: [],
        rows,
        worksheet,
        sheetName,
        format,
        detected,
        creditNoteCount: 0,
      };
    }
    const detected = detectExcelColumns(rows[0] || []);
    detected.sheetName = sheetName;
    if (detected.clientCol >= 0 && detected.importoCol >= 0) {
      return {
        headers: rows[0] || [],
        rows,
        worksheet,
        sheetName,
        format: 'okr',
        detected,
        creditNoteCount: 0,
      };
    }
  }
  const fallbackSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[fallbackSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: '',
  }) as unknown[][];
  const detected = detectExcelColumns(rows[0] || []);
  detected.sheetName = fallbackSheetName;
  return {
    headers: rows[0] || [],
    rows,
    worksheet,
    sheetName: fallbackSheetName,
    format: 'okr',
    detected,
    creditNoteCount: 0,
  };
}

export function parseExcelFile(buffer: ArrayBuffer, importYear = ANALYSIS_YEAR): ExcelFileParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  return resolveWorkbookSheet(workbook, importYear);
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
  importYear: number,
  detected: DetectedExcelColumns,
  format: ExcelImportFormat = 'okr',
): { clients: ParsedExcelClient[]; creditNoteCount: number } {
  const clientMap = new Map<string, ParsedExcelClient>();
  let creditNoteCount = 0;
  const startRow = getDataStartRowIndex(format, detected);
  for (let i = startRow; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const rawName = row[clientColIndex];
    if (!rawName) continue;
    const clientName = String(rawName).trim().replace(/\s+/g, ' ');
    if (!clientName) continue;
    const rowYear = resolveRowImportYear(row, detected, importYear);
    if (rowYear !== importYear) continue;
    const revenueRaw = getExcelCellValue(worksheet, rows, i, revColIndex);
    if (revenueRaw === null || revenueRaw === undefined || revenueRaw === '') continue;
    const revenue = parseExcelImporto(revenueRaw);
    if (revenue < 0) creditNoteCount += 1;
    const key = clientName.toLowerCase();
    if (clientMap.has(key)) {
      const exist = clientMap.get(key)!;
      exist.revenue += revenue;
      exist.recordCount += 1;
    } else {
      clientMap.set(key, {
        name: clientName,
        revenue,
        recordCount: 1,
        year: importYear,
      });
    }
  }
  const clients = Array.from(clientMap.values());
  clients.sort((a, b) => b.revenue - a.revenue);
  return { clients, creditNoteCount };
}

export function buildOkrRecordsFromExcel(
  rows: unknown[][],
  worksheet: XLSX.WorkSheet,
  clientColIndex: number,
  revColIndex: number,
  productColIndex: number,
  monthColIndex: number,
  projectColIndex: number,
  ownerColIndex: number,
  importYear: number,
  detected: DetectedExcelColumns,
): OkrRecord[] {
  const recordMap = new Map<string, OkrRecord>();
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const clientNameRaw = row[clientColIndex];
    if (!clientNameRaw) continue;
    const clientName = clientNameRaw.toString().trim().replace(/\s+/g, ' ');
    const rowYear = resolveRowImportYear(row, detected, importYear);
    if (rowYear !== importYear) continue;
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
    const candidate: OkrRecord = {
      id: createUniqueId('okr'),
      clientName,
      clientId: '',
      productType: normalizeProductType(String(productRaw || '')),
      amount,
      monthLabel: String(monthRaw || ''),
      monthNumber: parseOkrMonthNumber(monthRaw),
      quarter: parseQuarterFromMonth(monthRaw),
      projectCode: String(projectRaw || ''),
      owner: String(ownerRaw || ''),
      year: rowYear,
    };
    const mergeKey = getOkrRecordMergeKey(candidate);
    const existing = recordMap.get(mergeKey);
    if (!existing) {
      recordMap.set(mergeKey, candidate);
      continue;
    }
    existing.amount += amount;
  }
  return Array.from(recordMap.values());
}

export interface ExcelImportParseResult {
  headers: unknown[];
  parsedClients: ParsedExcelClient[];
  okrRecords: OkrRecord[];
  importYear: number;
  detected: DetectedExcelColumns;
  format: ExcelImportFormat;
  sheetName: string;
  creditNoteCount: number;
}

export function parseExcelImportBufferWithYear(
  buffer: ArrayBuffer,
  importYear: number,
  filename?: string,
): ExcelImportParseResult {
  const parsedFile = parseExcelFile(buffer, importYear);
  const { headers, rows, worksheet, detected, format, sheetName } = parsedFile;
  const resolvedYear = isSupportedImportYear(importYear)
    ? importYear
    : detectExcelImportYear(headers, rows, detected, filename);
  const aggregated = aggregateExcelClients(
    rows,
    worksheet,
    detected.clientCol,
    detected.importoCol,
    resolvedYear,
    detected,
    format,
  );
  const okrRecords = format === 'okr'
    ? buildOkrRecordsFromExcel(
      rows,
      worksheet,
      detected.clientCol,
      detected.importoCol,
      detected.productCol,
      detected.monthCol,
      detected.projectCol,
      detected.ownerCol,
      resolvedYear,
      detected,
    )
    : [];
  return {
    headers,
    parsedClients: aggregated.clients,
    okrRecords,
    importYear: resolvedYear,
    detected,
    format,
    sheetName,
    creditNoteCount: aggregated.creditNoteCount,
  };
}

export function parseExcelImportBuffer(
  buffer: ArrayBuffer,
  filename?: string,
): ExcelImportParseResult {
  const { headers, rows, worksheet } = parseExcelFile(buffer);
  const detected = detectExcelColumns(headers);
  const importYear = detectExcelImportYear(headers, rows, detected, filename);
  return parseExcelImportBufferWithYear(buffer, importYear, filename);
}
