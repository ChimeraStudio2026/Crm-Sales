import * as XLSX from 'xlsx';
import type { OkrRecord, ParsedExcelClient } from '@/lib/types/crm';
import { normalizeProductType, parseOkrMonthNumber, parseQuarterFromMonth } from '@/lib/analysis/index';
import {
  ANALYSIS_YEAR,
  PREVIOUS_ANALYSIS_YEAR,
  SUPPORTED_IMPORT_YEARS,
} from '@/lib/constants/crm';
import { createUniqueId } from '@/lib/crm/utils';
import { resolveCanonicalClientBrandName } from '@/lib/crm/client-brand-aliases';
import { getOkrRecordMergeKey } from '@/lib/crm/import-merge';

function sanitizeImportedClientName(rawName: unknown): string {
  const cleanedName = String(rawName ?? '').trim().replace(/\s+/g, ' ');
  if (!cleanedName) return cleanedName;
  return resolveCanonicalClientBrandName(cleanedName);
}

/**
 * Parses revenue amounts from Excel in Italian/European format.
 * Dot = thousands separator, comma = decimals. OKR imports use whole euros (cents ignored).
 */
export function parseExcelImporto(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value);
  }
  let str = String(value).trim().replace(/[\u00A0\s]/g, '').replace(/[€$£]/g, '');
  if (!str) return 0;
  let negative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    negative = true;
    str = str.slice(1, -1);
  } else if (str.startsWith('-')) {
    negative = true;
    str = str.slice(1);
  }
  if (/^\d+$/.test(str)) {
    const parsedInteger = Number.parseInt(str, 10);
    return negative ? -parsedInteger : parsedInteger;
  }
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  let parsed = 0;
  if (hasComma && hasDot) {
    const commaPos = str.lastIndexOf(',');
    const integerPart = str.slice(0, commaPos).replace(/\./g, '');
    parsed = Number.parseInt(integerPart, 10);
  } else if (hasComma) {
    const commaPos = str.indexOf(',');
    const afterComma = str.slice(commaPos + 1);
    const beforeComma = str.slice(0, commaPos);
    if (/^\d{1,2}$/.test(afterComma)) {
      parsed = Number.parseInt(beforeComma.replace(/\./g, ''), 10);
    } else {
      parsed = Number.parseInt(str.replace(/,/g, ''), 10);
    }
  } else if (hasDot) {
    const parts = str.split('.');
    if (parts.length > 2) {
      const lastPart = parts[parts.length - 1];
      if (/^\d{1,2}$/.test(lastPart)) {
        parsed = Number.parseInt(parts.slice(0, -1).join(''), 10);
      } else {
        parsed = Number.parseInt(str.replace(/\./g, ''), 10);
      }
    } else if (parts.length === 2 && parts[1].length <= 2) {
      parsed = Number.parseInt(parts[0], 10);
    } else if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      parsed = Number.parseInt(parts.join(''), 10);
    } else if (parts.length === 2 && parts[1].length === 3) {
      parsed = Number.parseInt(parts[0], 10);
    } else {
      parsed = Number.parseInt(str.replace(/\./g, ''), 10);
    }
  } else {
    parsed = Number.parseInt(str, 10);
  }
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
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

function findExcelUpdatedAtColumn(headers: unknown[]): number {
  return headers.findIndex((header) => {
    if (isExcludedExcelColumn(String(header))) return false;
    const normalized = normalizeExcelHeader(header);
    return normalized === 'updated at'
      || normalized === 'updated_at'
      || normalized.startsWith('updated')
      || normalized.includes('uptadet');
  });
}

export function parseExcelDateTime(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value) && value >= 30000 && value <= 60000) {
    return parseExcelSerialDate(value).toISOString();
  }
  const text = String(value).trim();
  if (!text) return '';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

export interface DetectedExcelColumns {
  clientCol: number;
  importoCol: number;
  yearCol: number;
  productCol: number;
  monthCol: number;
  dateCol: number;
  projectCol: number;
  ownerCol: number;
  updatedAtCol: number;
  headerRowIndex: number;
  sheetName: string;
}

export type ExcelImportFormat = 'okr' | 'invoice' | 'legacy-line';

export function isOkrYearExportFormat(
  detected: DetectedExcelColumns,
  filename?: string,
): boolean {
  if (detected.clientCol < 0 || detected.importoCol < 0 || detected.monthCol < 0) return false;
  if (detected.yearCol >= 0) return false;
  if (filename && /\bokr\b/i.test(filename)) return true;
  return detected.projectCol >= 0 && detected.productCol >= 0;
}

export function shouldReplaceYearOkrOnImport(
  format: ExcelImportFormat,
  detected: DetectedExcelColumns,
  filename?: string,
): boolean {
  return isRowPerOkrImportFormat(format) || isOkrYearExportFormat(detected, filename);
}

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
    (typeof row[2] === 'number' || (typeof row[2] === 'string' && String(row[2]).trim() !== ''))
  ));
}

function detectColumnsFromInvoiceHeader(headers: unknown[]): DetectedExcelColumns {
  const lower = headers.map((cell) => String(cell).trim().toLowerCase());
  const dateCol = lower.findIndex((cell) => (
    cell === 'data ft'
    || cell === 'data doc'
    || cell === 'data documento'
    || cell === 'data fattura'
    || cell.startsWith('data f')
    || cell === 'data'
  ));
  return {
    clientCol: lower.findIndex((cell) => cell === 'cliente'),
    importoCol: lower.findIndex((cell) => cell.startsWith('imponib')),
    yearCol: lower.findIndex((cell) => cell === 'anno ft' || cell === 'anno'),
    productCol: -1,
    monthCol: lower.findIndex((cell) => cell === 'mese ft' || cell === 'mese'),
    dateCol,
    projectCol: -1,
    ownerCol: -1,
    updatedAtCol: -1,
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
    dateCol: 1,
    projectCol: -1,
    ownerCol: -1,
    updatedAtCol: -1,
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
  const documentOwnerCol = findExcelColumnIndex(headers, 'documento owner');
  return {
    clientCol: findExcelColumnIndex(headers, 'cliente'),
    importoCol: findExcelColumnIndex(headers, 'importo'),
    yearCol: yearCol >= 0 ? yearCol : findExcelColumnIndex(headers, 'year'),
    productCol: findExcelColumnIndex(headers, 'prodotto'),
    monthCol: findExcelColumnIndex(headers, 'mese'),
    dateCol: findExcelColumnIndex(headers, 'data'),
    projectCol: findExcelColumnIndex(headers, 'codice progetto'),
    ownerCol: documentOwnerCol >= 0 ? documentOwnerCol : findExcelColumnIndex(headers, 'owner'),
    updatedAtCol: findExcelUpdatedAtColumn(headers),
    headerRowIndex: 0,
    sheetName: '',
  };
}

export function isRowPerOkrImportFormat(format: ExcelImportFormat): boolean {
  return format === 'legacy-line' || format === 'invoice';
}

const ITALIAN_MONTH_LABELS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
] as const;

export interface ExcelOkrDateParts {
  year: number;
  monthNumber: number;
  monthLabel: string;
  quarter: number;
}

export function parseExcelSerialDate(serial: number): Date {
  const utcMs = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(utcMs);
}

function buildExcelOkrDateParts(year: number, monthNumber: number): ExcelOkrDateParts {
  const safeMonth = Math.min(Math.max(monthNumber, 1), 12);
  return {
    year,
    monthNumber: safeMonth,
    monthLabel: ITALIAN_MONTH_LABELS[safeMonth - 1],
    quarter: Math.ceil(safeMonth / 3),
  };
}

export function parseExcelOkrDateParts(value: unknown): ExcelOkrDateParts | null {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return buildExcelOkrDateParts(
      value.getFullYear(),
      value.getMonth() + 1,
    );
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 30000 && value <= 60000) {
      const date = parseExcelSerialDate(value);
      return buildExcelOkrDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1);
    }
    const monthNumber = parseOkrMonthNumber(value);
    if (monthNumber > 0) {
      return buildExcelOkrDateParts(ANALYSIS_YEAR, monthNumber);
    }
    return null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const slashMatch = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slashMatch) {
    const first = parseInt(slashMatch[1], 10);
    const second = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;
    const dayFirst = first > 12 && second <= 12;
    const monthNumber = dayFirst ? second : (second <= 12 ? second : first);
    if (monthNumber >= 1 && monthNumber <= 12 && year >= 2000 && year <= 2100) {
      return buildExcelOkrDateParts(year, monthNumber);
    }
  }
  const monthNumber = parseOkrMonthNumber(text);
  if (monthNumber > 0) {
    return buildExcelOkrDateParts(ANALYSIS_YEAR, monthNumber);
  }
  return null;
}

function resolveOkrDatePartsFromRow(
  row: unknown[],
  worksheet: XLSX.WorkSheet,
  rows: unknown[][],
  rowIndex: number,
  detected: DetectedExcelColumns,
  importYear: number,
): ExcelOkrDateParts | null {
  if (detected.dateCol >= 0) {
    const dateRaw = getExcelCellValue(worksheet, rows, rowIndex, detected.dateCol);
    const parsedDate = parseExcelOkrDateParts(dateRaw);
    if (parsedDate) {
      return parsedDate;
    }
  }
  if (detected.monthCol >= 0) {
    const monthRaw = getExcelCellValue(worksheet, rows, rowIndex, detected.monthCol);
    const monthNumber = parseOkrMonthNumber(monthRaw);
    if (monthNumber > 0) {
      return buildExcelOkrDateParts(importYear, monthNumber);
    }
  }
  return null;
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

export function detectYearFromFilename(filename?: string): number | null {
  if (!filename) return null;
  const filenameMatch = filename.match(/\b(202[0-9])\b/);
  if (!filenameMatch) return null;
  const year = parseInt(filenameMatch[1], 10);
  return isSupportedImportYear(year) ? year : null;
}

export function detectExcelImportYear(
  headers: unknown[],
  rows: unknown[][],
  detected: DetectedExcelColumns,
  filename?: string,
): number {
  const yearFromFilename = detectYearFromFilename(filename);
  if (yearFromFilename !== null) return yearFromFilename;
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
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
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
    // Prefer formatted text: SheetJS often misreads EU CSV amounts (4100,00 -> v=410000).
    if (cell.w) return cell.w;
    if (cell.t === 'n' && typeof cell.v === 'number') return cell.v;
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
    const clientName = sanitizeImportedClientName(rawName);
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

export function createOkrImportRowId(year: number, rowIndex: number): string {
  return `okr-${year}-r${rowIndex}`;
}

export interface BuildOkrImportOptions {
  mergeDuplicates: boolean;
  useRowIds: boolean;
}

export function resolveBuildOkrImportOptions(
  format: ExcelImportFormat,
  detected?: DetectedExcelColumns,
  filename?: string,
): BuildOkrImportOptions {
  if (format === 'legacy-line' || format === 'invoice') {
    return { mergeDuplicates: false, useRowIds: true };
  }
  if (detected && isOkrYearExportFormat(detected, filename)) {
    return { mergeDuplicates: true, useRowIds: true };
  }
  return { mergeDuplicates: true, useRowIds: false };
}

export function buildOkrRecordsFromImport(
  rows: unknown[][],
  worksheet: XLSX.WorkSheet,
  detected: DetectedExcelColumns,
  format: ExcelImportFormat,
  importYear: number,
  filename?: string,
): OkrRecord[] {
  const { mergeDuplicates, useRowIds } = resolveBuildOkrImportOptions(format, detected, filename);
  const startRow = getDataStartRowIndex(format, detected);
  const recordMap = mergeDuplicates ? new Map<string, OkrRecord>() : null;
  const records: OkrRecord[] = [];
  for (let i = startRow; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const clientNameRaw = row[detected.clientCol];
    if (!clientNameRaw) continue;
    const clientName = sanitizeImportedClientName(clientNameRaw);
    if (!clientName) continue;
    const rowYear = resolveRowImportYear(row, detected, importYear);
    if (rowYear !== importYear) continue;
    const amountRaw = getExcelCellValue(worksheet, rows, i, detected.importoCol);
    if (amountRaw === null || amountRaw === undefined || amountRaw === '') continue;
    const amount = parseExcelImporto(amountRaw);
    const dateParts = resolveOkrDatePartsFromRow(row, worksheet, rows, i, detected, importYear);
    const productRaw =
      detected.productCol >= 0 ? getExcelCellValue(worksheet, rows, i, detected.productCol) : '';
    const projectRaw =
      detected.projectCol >= 0 ? row[detected.projectCol] : '';
    const ownerRaw =
      detected.ownerCol >= 0 ? row[detected.ownerCol] : '';
    const updatedAtRaw = detected.updatedAtCol >= 0
      ? getExcelCellValue(worksheet, rows, i, detected.updatedAtCol)
      : '';
    const sourceUpdatedAt = parseExcelDateTime(updatedAtRaw);
    const recordYear = dateParts?.year ?? rowYear;
    if (recordYear !== importYear) continue;
    const candidate: OkrRecord = {
      id: useRowIds ? createOkrImportRowId(importYear, i) : createUniqueId('okr'),
      clientName,
      clientId: '',
      productType: normalizeProductType(String(productRaw || '')),
      amount,
      monthLabel: dateParts?.monthLabel ?? '',
      monthNumber: dateParts?.monthNumber ?? 0,
      quarter: dateParts?.quarter ?? 0,
      projectCode: String(projectRaw ?? '').trim(),
      owner: String(ownerRaw || ''),
      year: recordYear,
      sourceUpdatedAt: sourceUpdatedAt || undefined,
    };
    if (mergeDuplicates && recordMap) {
      const mergeKey = getOkrRecordMergeKey(candidate);
      const existing = recordMap.get(mergeKey);
      if (!existing) {
        recordMap.set(mergeKey, candidate);
        continue;
      }
      existing.amount += amount;
      if (
        candidate.sourceUpdatedAt
        && (!existing.sourceUpdatedAt || candidate.sourceUpdatedAt > existing.sourceUpdatedAt)
      ) {
        existing.sourceUpdatedAt = candidate.sourceUpdatedAt;
      }
      continue;
    }
    records.push(candidate);
  }
  if (mergeDuplicates && recordMap) {
    return Array.from(recordMap.values());
  }
  return records;
}

/** @deprecated Usa buildOkrRecordsFromImport */
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
  const scopedDetected: DetectedExcelColumns = {
    ...detected,
    clientCol: clientColIndex,
    importoCol: revColIndex,
    productCol: productColIndex,
    monthCol: monthColIndex,
    projectCol: projectColIndex,
    ownerCol: ownerColIndex,
  };
  return buildOkrRecordsFromImport(rows, worksheet, scopedDetected, 'okr', importYear);
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
  yearHint: number | null;
  replaceYearOkr: boolean;
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
  const okrRecords = buildOkrRecordsFromImport(
    rows,
    worksheet,
    detected,
    format,
    resolvedYear,
    filename,
  );
  return {
    headers,
    parsedClients: aggregated.clients,
    okrRecords,
    importYear: resolvedYear,
    detected,
    format,
    sheetName,
    creditNoteCount: aggregated.creditNoteCount,
    yearHint: detectYearFromFilename(filename),
    replaceYearOkr: shouldReplaceYearOkrOnImport(format, detected, filename),
  };
}

export function parseExcelImportBuffer(
  buffer: ArrayBuffer,
  filename?: string,
): ExcelImportParseResult {
  const importYear = detectYearFromFilename(filename) ?? ANALYSIS_YEAR;
  return parseExcelImportBufferWithYear(buffer, importYear, filename);
}
