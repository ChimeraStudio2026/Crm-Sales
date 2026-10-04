// Sync Cerbero price divisions (OKR) into public.okr_records and the clients' yearly revenue.
//
// Used by the scheduled Claude routine, which reads Cerbero and writes Supabase through
// their MCP connectors (no Cerbero API key is available to the app). It replaces the manual
// "Importa Excel" of the yearly OKR export: same rows, same client matching and the same
// revenue update, done by public.sync_okr_year() in a single transaction.
// The rows travel in small chunks through public.okr_sync_staging (plain INSERTs), so each
// SQL statement stays small; the final call reads the batch and applies it.
//
// Every OKR row is a Cerbero proposal price division: amount, payment month, client and the
// seller who contacted the client. The product comes from the proposal category already
// synced into public.sales_proposals.
//
// Run with: node --experimental-strip-types scripts/cerbero-okr-sync.mjs plan \
//   --divisions <file.json> [--year 2026] [--out <dir>]
//
//   <file.json> is the output of cerbero_get ProposalController_findProposalPriceDivisionByDate
//   for the whole year (raw JSON array, or the MCP text wrapper saved by the client).
//   Writes <dir>/summary.json, <dir>/stage-001.sql ... (one INSERT per chunk),
//   <dir>/preview.sql (dry run: returns the summary, writes nothing) and <dir>/sync.sql.
//   Run the stage files, then preview.sql (optional) and sync.sql, all with execute_sql.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const { resolveCanonicalClientBrandName } = await import(
  join(ROOT_DIR, 'lib', 'crm', 'client-brand-aliases.ts')
);
const { normalizeOwnerDisplay } = await import(join(ROOT_DIR, 'lib', 'crm', 'owners.ts'));

const BUSINESS_TIME_ZONE = 'Europe/Rome';
const ROWS_PER_CHUNK = 60;

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith('--')) continue;
    options[key.slice(2)] = rest[index + 1];
    index += 1;
  }
  return { command, options };
}

function readDivisions(filePath) {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  // The MCP client may save the tool result as [{ type: 'text', text: '<json>' }].
  if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.type === 'text' && typeof parsed[0].text === 'string') {
    return JSON.parse(parsed.map((part) => part.text).join(''));
  }
  if (Array.isArray(parsed)) return parsed;
  throw new Error('Formato divisions non riconosciuto: atteso un array JSON.');
}

function resolveLocalDateParts(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return year && month ? { year, month } : null;
}

function cleanText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function buildRows(divisions, year) {
  const rows = [];
  const skipped = [];
  for (const division of divisions) {
    const proposal = division?.proposal || {};
    const dateParts = division?.paymentDate ? resolveLocalDateParts(division.paymentDate) : null;
    if (!dateParts || dateParts.year !== year) continue;
    const rawClientName = cleanText(proposal.client?.name);
    const amount = Math.round(Number(division.value) || 0);
    if (!rawClientName || !amount) {
      skipped.push({ id: division?.id, proposal: proposal.name || '', reason: !rawClientName ? 'cliente mancante' : 'importo zero' });
      continue;
    }
    const projectName = cleanText(proposal.project?.name) || cleanText(proposal.name);
    // Chiavi corte per tenere piccolo il payload SQL (vedi jsonb_to_recordset in sync_okr_year).
    rows.push({
      c: proposal.incrementalNumber ? `CS${proposal.incrementalNumber}` : '',
      n: resolveCanonicalClientBrandName(rawClientName),
      a: amount,
      m: dateParts.month,
      o: normalizeOwnerDisplay(cleanText(proposal.contactedBy?.name)),
      p: projectName,
      u: division.updatedAt || null,
    });
  }
  return { rows, skipped };
}

function sqlJson(value) {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

function plan(options) {
  if (!options.divisions) throw new Error('Manca --divisions <file.json>.');
  const year = Number(options.year) || new Date().getFullYear();
  const outDir = options.out || '/tmp/cerbero-okr-sync';
  const divisions = readDivisions(options.divisions);
  const { rows, skipped } = buildRows(divisions, year);
  if (rows.length === 0) throw new Error(`Nessuna riga OKR per il ${year}: controlla l'export Cerbero.`);
  mkdirSync(outDir, { recursive: true });
  const batchId = `okr-${year}-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
  const stageFiles = [];
  for (let start = 0; start < rows.length; start += ROWS_PER_CHUNK) {
    const chunk = start / ROWS_PER_CHUNK + 1;
    const filePath = join(outDir, `stage-${String(chunk).padStart(3, '0')}.sql`);
    writeFileSync(
      filePath,
      `insert into public.okr_sync_staging (batch_id, chunk, rows) values ('${batchId}', ${chunk}, ${sqlJson(rows.slice(start, start + ROWS_PER_CHUNK))});\n`,
    );
    stageFiles.push(filePath);
  }
  writeFileSync(join(outDir, 'preview.sql'), `select public.sync_okr_year(${year}, '${batchId}', true) as result;\n`);
  writeFileSync(join(outDir, 'sync.sql'), `select public.sync_okr_year(${year}, '${batchId}', false) as result;\n`);
  const summary = {
    year,
    batchId,
    divisionsInFile: divisions.length,
    okrRows: rows.length,
    total: rows.reduce((sum, row) => sum + row.a, 0),
    skipped,
    stageFiles,
    previewFile: join(outDir, 'preview.sql'),
    syncFile: join(outDir, 'sync.sql'),
  };
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

const { command, options } = parseArgs(process.argv.slice(2));
if (command === 'plan') {
  plan(options);
} else {
  console.error('Uso: node --experimental-strip-types scripts/cerbero-okr-sync.mjs plan --divisions <file.json> [--year 2026] [--out <dir>]');
  process.exit(1);
}
