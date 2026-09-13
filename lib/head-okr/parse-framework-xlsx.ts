import * as XLSX from 'xlsx';
import { createUniqueId } from '@/lib/crm/utils';
import type { HeadOkrProgramDraft, HeadOkrProgramContent } from '@/lib/types/head-okr';

function parseRoleFromSheetTitle(sheetTitle: string): { headName: string; roleTitle: string } {
  const match = sheetTitle.match(/^OKR\s*[—–-]\s*(.+?)\s*\((.+)\)\s*$/i);
  if (match) {
    return { headName: match[1].trim(), roleTitle: match[2].trim() };
  }
  return { headName: sheetTitle.replace(/^OKR\s*[—–-]\s*/i, '').trim(), roleTitle: '' };
}

function parseFrameworkStartDate(introText: string): string | null {
  const match = introText.match(/(\d{1,2})\s+([a-zà]+)\s+(\d{4})/i);
  if (!match) return null;
  const monthMap: Record<string, string> = {
    gennaio: '01', febbraio: '02', marzo: '03', aprile: '04', maggio: '05', giugno: '06',
    luglio: '07', agosto: '08', settembre: '09', ottobre: '10', novembre: '11', dicembre: '12',
  };
  const month = monthMap[match[2].toLowerCase()];
  if (!month) return null;
  const day = match[1].padStart(2, '0');
  return `${match[3]}-${month}-${day}`;
}

function parseFrameworkLabel(introText: string): string {
  const match = introText.match(/Framework\s+([^\n]+)/i);
  if (match) return match[1].replace(/\sdal\s+.*/i, '').trim();
  return '';
}

function isKeyResultHeaderRow(row: unknown[]): boolean {
  return String(row[0] ?? '').trim().toLowerCase() === 'key result';
}

export function parseHeadOkrFrameworkBuffer(buffer: ArrayBuffer): HeadOkrProgramDraft {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Il file non contiene fogli Excel.');
  }
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
  }) as unknown[][];
  const sheetTitle = String(rows[0]?.[0] ?? '').split('\n')[0].trim();
  const introText = String(rows[1]?.[0] ?? '').trim();
  const { headName, roleTitle } = parseRoleFromSheetTitle(sheetTitle);
  const content = parseHeadOkrFrameworkRows(rows);
  return {
    headName,
    roleTitle,
    sheetTitle,
    frameworkLabel: parseFrameworkLabel(introText),
    frameworkStartDate: parseFrameworkStartDate(introText),
    introText,
    content,
  };
}

export function parseHeadOkrFrameworkRows(rows: unknown[][]): HeadOkrProgramContent {
  const checkpoints: HeadOkrProgramContent['checkpoints'] = [];
  let currentCheckpoint: HeadOkrProgramContent['checkpoints'][number] | null = null;
  let currentObjective: HeadOkrProgramContent['checkpoints'][number]['objectives'][number] | null = null;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const titleCell = String(row[0] ?? '').trim();
    if (titleCell.startsWith('Checkpoint')) {
      currentCheckpoint = {
        id: createUniqueId('head-okr-cp'),
        title: titleCell.split('\n')[0].trim(),
        sortOrder: checkpoints.length,
        objectives: [],
      };
      checkpoints.push(currentCheckpoint);
      currentObjective = null;
      continue;
    }
    if (titleCell.startsWith('Obiettivo') && currentCheckpoint) {
      const descriptionCell = String(rows[rowIndex + 1]?.[0] ?? '').trim();
      currentObjective = {
        id: createUniqueId('head-okr-cp'),
        title: titleCell,
        description: descriptionCell.startsWith('Obiettivo') ? '' : descriptionCell,
        sortOrder: currentCheckpoint.objectives.length,
        keyResults: [],
      };
      currentCheckpoint.objectives.push(currentObjective);
      continue;
    }
    if (isKeyResultHeaderRow(row) || !currentObjective || !titleCell) continue;
    if (titleCell.startsWith('Obiettivo') || titleCell.startsWith('Checkpoint')) continue;
    if (currentObjective.description === titleCell) continue;
    const statusCell = String(row[1] ?? '').trim();
    const metricCell = String(row[2] ?? '').trim();
    if (!statusCell && !metricCell) continue;
    currentObjective.keyResults.push({
      id: createUniqueId('head-okr-kr'),
      title: titleCell,
      status: statusCell || 'Not Started',
      evaluationMetric: metricCell,
      valueLabel: String(row[3] ?? '').trim(),
      adminNote: String(row[4] ?? '').trim(),
      sortOrder: currentObjective.keyResults.length,
    });
  }
  return { checkpoints };
}
