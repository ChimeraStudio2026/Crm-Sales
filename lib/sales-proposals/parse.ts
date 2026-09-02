import * as XLSX from 'xlsx';
import type {
  SalesProposalImportRow,
  SalesProposalParseIssue,
  SalesProposalParseResult,
} from '@/lib/types/sales-proposals';

const HEADER_ALIASES: Record<keyof SalesProposalImportRow, string[]> = {
  code: [],
  nome: ['nome'],
  stato: ['stato'],
  ultimoPrezzo: ['ultimo prezzo'],
  descrizione: ['descrizione'],
  categoria: ['categoria'],
  cliente: ['cliente'],
  motivoRifiuto: ['motivo rifiuto'],
  dataRifiuto: ['data rifiuto'],
  dataAccettazione: ['data accettazione'],
  ultimoAggiornamento: ['ultimo aggiornamento'],
  creatoIl: ['creato il'],
  contattatoDa: ['contattato da'],
  tipo: ['tipo'],
  budgetFinale: ['budget finale'],
};

const ITALIAN_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
const EMPTY_PRICE_PATTERN = /^nessun\s*prezzo$/i;

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ');
}

function readCellString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

function buildUtcIso(year: number, month: number, day: number, hour: number, minute: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString();
}

function parseDatePartsFromMatch(
  match: RegExpMatchArray,
  yearIndex: number,
  monthIndex: number,
  dayIndex: number,
  hourIndex: number,
  minuteIndex: number,
): string | null {
  let year = Number.parseInt(match[yearIndex], 10);
  if (match[yearIndex].length === 2) {
    year += year >= 70 ? 1900 : 2000;
  }
  const month = Number.parseInt(match[monthIndex], 10);
  const day = Number.parseInt(match[dayIndex], 10);
  const hour = match[hourIndex] ? Number.parseInt(match[hourIndex], 10) : 0;
  const minute = match[minuteIndex] ? Number.parseInt(match[minuteIndex], 10) : 0;
  return buildUtcIso(year, month, day, hour, minute);
}

export function parseProposalDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return buildUtcIso(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
    );
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return buildUtcIso(parsed.y, parsed.m, parsed.d, parsed.H, parsed.M);
  }
  const raw = readCellString(value);
  if (!raw) return null;
  const italianMatch = raw.match(ITALIAN_DATE_PATTERN);
  if (italianMatch) {
    return parseDatePartsFromMatch(italianMatch, 3, 2, 1, 4, 5);
  }
  const isoMatch = raw.match(ISO_DATE_PATTERN);
  if (isoMatch) {
    return parseDatePartsFromMatch(isoMatch, 1, 2, 3, 4, 5);
  }
  return null;
}

export function parseProposalPrice(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  }
  const raw = readCellString(value);
  if (!raw || EMPTY_PRICE_PATTERN.test(raw)) return null;
  let str = raw.replace(/[\u00A0\s]/g, '').replace(/[€$£]/g, '');
  if (!str) return null;
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1);
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1);
  }
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  if (hasComma && hasDot) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    str = str.replace(',', '.');
  } else if (hasDot) {
    const parts = str.split('.');
    const lastPart = parts[parts.length - 1];
    if (parts.length > 2 || (parts.length === 2 && lastPart.length === 3)) {
      str = str.replace(/\./g, '');
    }
  }
  const parsed = Number.parseFloat(str);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed * 100) / 100;
  return isNegative ? -rounded : rounded;
}

export function extractProposalCode(nome: string): string {
  const separatorIndex = nome.indexOf('||');
  if (separatorIndex === -1) return nome.trim();
  return nome.slice(0, separatorIndex).trim();
}

export function buildProposalDedupKey(nome: string, creatoIl: string): string {
  const date = new Date(creatoIl);
  if (Number.isNaN(date.getTime())) return `${nome}|${creatoIl}`;
  const normalized = `${date.getUTCFullYear()}-${padTwo(date.getUTCMonth() + 1)}-${padTwo(date.getUTCDate())}T${padTwo(date.getUTCHours())}:${padTwo(date.getUTCMinutes())}:00.000Z`;
  return `${nome}|${normalized}`;
}

function resolveColumnIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

function isZipWorkbook(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 2));
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function detectCsvDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function readCsvWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  const text = new TextDecoder('utf-8').decode(buffer);
  return XLSX.read(text, { type: 'string', FS: detectCsvDelimiter(text), cellDates: false, raw: true });
}

function readSheetMatrix(buffer: ArrayBuffer): unknown[][] {
  const workbook = isZipWorkbook(buffer)
    ? XLSX.read(buffer, { type: 'array', cellDates: false, raw: true })
    : readCsvWorkbook(buffer);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
}

function buildRowFromCells(
  cells: unknown[],
  indexes: Record<keyof Omit<SalesProposalImportRow, 'code'>, number>,
): Omit<SalesProposalImportRow, 'code'> {
  const read = (key: keyof typeof indexes): unknown => {
    const index = indexes[key];
    return index >= 0 ? cells[index] : '';
  };
  return {
    nome: readCellString(read('nome')),
    stato: readCellString(read('stato')),
    ultimoPrezzo: parseProposalPrice(read('ultimoPrezzo')),
    descrizione: readCellString(read('descrizione')),
    categoria: readCellString(read('categoria')),
    cliente: readCellString(read('cliente')),
    motivoRifiuto: readCellString(read('motivoRifiuto')),
    dataRifiuto: parseProposalDate(read('dataRifiuto')),
    dataAccettazione: parseProposalDate(read('dataAccettazione')),
    ultimoAggiornamento: parseProposalDate(read('ultimoAggiornamento')),
    creatoIl: parseProposalDate(read('creatoIl')) || '',
    contattatoDa: readCellString(read('contattatoDa')),
    tipo: readCellString(read('tipo')),
    budgetFinale: parseProposalPrice(read('budgetFinale')),
  };
}

export function parseSalesProposalsBuffer(buffer: ArrayBuffer): SalesProposalParseResult {
  const matrix = readSheetMatrix(buffer);
  if (matrix.length === 0) {
    return { rows: [], skipped: [], duplicateInFile: 0 };
  }
  const headerRow = (matrix[0] || []).map((cell) => normalizeHeader(String(cell ?? '')));
  const indexes = {
    nome: resolveColumnIndex(headerRow, HEADER_ALIASES.nome),
    stato: resolveColumnIndex(headerRow, HEADER_ALIASES.stato),
    ultimoPrezzo: resolveColumnIndex(headerRow, HEADER_ALIASES.ultimoPrezzo),
    descrizione: resolveColumnIndex(headerRow, HEADER_ALIASES.descrizione),
    categoria: resolveColumnIndex(headerRow, HEADER_ALIASES.categoria),
    cliente: resolveColumnIndex(headerRow, HEADER_ALIASES.cliente),
    motivoRifiuto: resolveColumnIndex(headerRow, HEADER_ALIASES.motivoRifiuto),
    dataRifiuto: resolveColumnIndex(headerRow, HEADER_ALIASES.dataRifiuto),
    dataAccettazione: resolveColumnIndex(headerRow, HEADER_ALIASES.dataAccettazione),
    ultimoAggiornamento: resolveColumnIndex(headerRow, HEADER_ALIASES.ultimoAggiornamento),
    creatoIl: resolveColumnIndex(headerRow, HEADER_ALIASES.creatoIl),
    contattatoDa: resolveColumnIndex(headerRow, HEADER_ALIASES.contattatoDa),
    tipo: resolveColumnIndex(headerRow, HEADER_ALIASES.tipo),
    budgetFinale: resolveColumnIndex(headerRow, HEADER_ALIASES.budgetFinale),
  };
  if (indexes.nome < 0 || indexes.creatoIl < 0) {
    throw new Error('Colonne obbligatorie "Nome" e "Creato il" non trovate nel file.');
  }
  const rows: SalesProposalImportRow[] = [];
  const skipped: SalesProposalParseIssue[] = [];
  const seenKeys = new Set<string>();
  let duplicateInFile = 0;
  matrix.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const parsed = buildRowFromCells(cells, indexes);
    if (!parsed.nome && !parsed.creatoIl && !parsed.cliente && !parsed.stato) {
      return;
    }
    if (!parsed.nome) {
      skipped.push({ rowNumber, nome: '', reason: 'Nome mancante' });
      return;
    }
    if (!parsed.creatoIl) {
      skipped.push({ rowNumber, nome: parsed.nome, reason: 'Data "Creato il" mancante o non valida' });
      return;
    }
    const key = buildProposalDedupKey(parsed.nome, parsed.creatoIl);
    if (seenKeys.has(key)) {
      duplicateInFile += 1;
      skipped.push({ rowNumber, nome: parsed.nome, reason: 'Duplicato nello stesso file' });
      return;
    }
    seenKeys.add(key);
    rows.push({
      ...parsed,
      code: extractProposalCode(parsed.nome),
    });
  });
  return { rows, skipped, duplicateInFile };
}
