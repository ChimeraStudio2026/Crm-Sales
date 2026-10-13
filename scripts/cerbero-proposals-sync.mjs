// Sync Cerbero proposals (CSV export) into public.sales_proposals.
//
// Used by the scheduled Claude routine, which reads Cerbero and writes Supabase
// through their MCP connectors (no Cerbero API key is available to the app).
// The CSV is parsed with the same parser as the manual import, and only the
// proposals touched since the last synced "Ultimo aggiornamento" (minus a safety
// margin) are written, with the same upsert semantics as the manual import.
// Cerbero bumps "Ultimo aggiornamento" on every change, so this catches new
// proposals as well as status / price / refusal updates.
//
// Run with: node --experimental-strip-types scripts/cerbero-proposals-sync.mjs <command>
//
//   cutoff-sql [--workspace chimera]
//       Prints the SELECT returning the latest synced "ultimo_aggiornamento".
//
//   plan --csv <export.csv> [--cutoff <iso timestamp>] [--margin-hours 48]
//        [--workspace chimera] [--out <dir>]
//       Writes <dir>/summary.json, <dir>/preview.sql (read-only: classifies each
//       candidate as new / changed / same), <dir>/upsert-001.sql, ... and
//       <dir>/reconcile.sql (run last: removes the old version of a proposal
//       renamed in Cerbero, since the upsert key includes the name; needs the
//       public.reconcile_sales_proposals function).
//       Without --cutoff every proposal in the CSV is a candidate.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const { parseSalesProposalsBuffer } = await import(
  join(ROOT_DIR, 'lib', 'sales-proposals', 'parse.ts')
);

const DEFAULT_WORKSPACE_ID = 'chimera';
const DEFAULT_MARGIN_HOURS = 48;
const ROWS_PER_SQL_FILE = 60;

const COLUMNS = [
  'code', 'nome', 'stato', 'ultimo_prezzo', 'descrizione', 'categoria', 'cliente',
  'motivo_rifiuto', 'data_rifiuto', 'data_accettazione', 'ultimo_aggiornamento',
  'creato_il', 'contattato_da', 'tipo', 'budget_finale', 'workspace_id', 'import_batch',
];

// Columns compared by the preview to tell "changed" from "same".
const COMPARED_COLUMNS = [
  'stato', 'ultimo_prezzo', 'descrizione', 'categoria', 'cliente', 'motivo_rifiuto',
  'data_rifiuto', 'data_accettazione', 'ultimo_aggiornamento', 'contattato_da', 'tipo',
  'budget_finale', 'workspace_id',
];

function sqlText(value) {
  if (value === null || value === undefined || value === '') return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  return value === null || value === undefined ? 'null::numeric' : `${value}::numeric`;
}

function sqlTimestamp(value) {
  return value ? `'${value}'::timestamptz` : 'null::timestamptz';
}

function rowValuesSql(row, workspaceId, importBatch) {
  return `(${[
    sqlText(row.code),
    sqlText(row.nome),
    sqlText(row.stato),
    sqlNumber(row.ultimoPrezzo),
    sqlText(row.descrizione),
    sqlText(row.categoria),
    sqlText(row.cliente),
    sqlText(row.motivoRifiuto),
    sqlTimestamp(row.dataRifiuto),
    sqlTimestamp(row.dataAccettazione),
    sqlTimestamp(row.ultimoAggiornamento),
    sqlTimestamp(row.creatoIl),
    sqlText(row.contattatoDa),
    sqlText(row.tipo),
    sqlNumber(row.budgetFinale),
    sqlText(workspaceId),
    `'${importBatch}'::date`,
  ].join(', ')})`;
}

function buildUpsertSql(rows, workspaceId, importBatch) {
  const updates = COLUMNS
    .filter((column) => column !== 'nome' && column !== 'creato_il')
    .map((column) => `${column} = excluded.${column}`)
    .join(',\n  ');
  // Rows identical to the DB are left untouched, so RETURNING lists only real changes.
  const changed = COMPARED_COLUMNS
    .map((column) => `sales_proposals.${column} is distinct from excluded.${column}`)
    .join('\n  or ');
  return `insert into public.sales_proposals (${COLUMNS.join(', ')}) values\n${rows
    .map((row) => rowValuesSql(row, workspaceId, importBatch))
    .join(',\n')}\non conflict (nome, creato_il) do update set\n  ${updates}\nwhere ${changed}\n`
    + 'returning (xmax = 0) as inserted, nome, stato;\n';
}

// A proposal renamed in Cerbero keeps its code but gets a new name, so the upsert
// inserts a new row: drop the rows with a touched code that are no longer in the
// export. Legacy proposals share a code, so the kept rows come from the whole CSV.
function buildReconcileSql(candidates, allRows, workspaceId) {
  const codes = new Set(candidates.map((row) => row.code).filter(Boolean));
  if (codes.size === 0) return null;
  const current = allRows
    .filter((row) => codes.has(row.code))
    .map((row) => ({ nome: row.nome, creato_il: row.creatoIl }));
  const codeList = [...codes].map(sqlText).join(', ');
  return `select * from public.reconcile_sales_proposals(${sqlText(workspaceId)}, array[${codeList}],\n`
    + `  ${sqlText(JSON.stringify(current))}::jsonb);\n`;
}

function buildPreviewSql(rows, workspaceId, importBatch) {
  const differs = COMPARED_COLUMNS
    .map((column) => `p.${column} is distinct from i.${column}`)
    .join('\n      or ');
  return `with incoming (${COLUMNS.join(', ')}) as (values\n${rows
    .map((row) => rowValuesSql(row, workspaceId, importBatch))
    .join(',\n')}\n)\nselect
  case when p.id is null then 'new'
    when ${differs} then 'changed'
    else 'same' end as esito,
  i.nome, i.stato, p.stato as stato_attuale
from incoming i
left join public.sales_proposals p on p.nome = i.nome and p.creato_il = i.creato_il
order by 1, 2;\n`;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--')) {
      args[token.slice(2)] = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function plan(args) {
  if (!args.csv) {
    throw new Error('Usage: plan --csv <export.csv> [--cutoff <iso>] [--margin-hours 48] [--workspace chimera] [--out <dir>]');
  }
  const workspaceId = args.workspace || DEFAULT_WORKSPACE_ID;
  const outDir = args.out || join(process.cwd(), 'cerbero-sync-out');
  const marginHours = args['margin-hours'] ? Number(args['margin-hours']) : DEFAULT_MARGIN_HOURS;
  const importBatch = new Date().toISOString().slice(0, 10);

  const buffer = readFileSync(args.csv);
  const parsed = parseSalesProposalsBuffer(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
  if (parsed.rows.length === 0) {
    throw new Error('Nessuna proposta letta dal CSV: export vuoto o formato cambiato, sync interrotta.');
  }

  const cutoffMs = args.cutoff ? Date.parse(args.cutoff) : Number.NaN;
  if (args.cutoff && !Number.isFinite(cutoffMs)) {
    throw new Error(`Cutoff non valido: ${args.cutoff}`);
  }
  const sinceMs = Number.isFinite(cutoffMs) ? cutoffMs - marginHours * 3600 * 1000 : null;
  const candidates = sinceMs === null
    ? parsed.rows
    : parsed.rows.filter((row) => {
      const touched = Date.parse(row.ultimoAggiornamento || row.creatoIl);
      return !Number.isFinite(touched) || touched >= sinceMs;
    });

  mkdirSync(outDir, { recursive: true });
  const sqlFiles = [];
  for (let offset = 0; offset < candidates.length; offset += ROWS_PER_SQL_FILE) {
    const fileName = `upsert-${String(sqlFiles.length + 1).padStart(3, '0')}.sql`;
    writeFileSync(
      join(outDir, fileName),
      buildUpsertSql(candidates.slice(offset, offset + ROWS_PER_SQL_FILE), workspaceId, importBatch),
    );
    sqlFiles.push(fileName);
  }
  const reconcileSql = buildReconcileSql(candidates, parsed.rows, workspaceId);
  if (reconcileSql) {
    writeFileSync(join(outDir, 'reconcile.sql'), reconcileSql);
    sqlFiles.push('reconcile.sql');
  }
  if (candidates.length > 0) {
    writeFileSync(join(outDir, 'preview.sql'), buildPreviewSql(candidates, workspaceId, importBatch));
  }

  const summary = {
    workspaceId,
    importBatch,
    csvRows: parsed.rows.length,
    skipped: parsed.skipped,
    since: sinceMs === null ? null : new Date(sinceMs).toISOString(),
    candidates: candidates.length,
    sqlFiles,
  };
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

const [command, ...rest] = process.argv.slice(2);
const options = parseArgs(rest);
if (command === 'cutoff-sql') {
  const workspaceId = options.workspace || DEFAULT_WORKSPACE_ID;
  console.log(
    `select max(ultimo_aggiornamento) as cutoff from public.sales_proposals where workspace_id = ${sqlText(workspaceId)};`,
  );
} else if (command === 'plan') {
  plan(options);
} else {
  console.error('Commands: cutoff-sql | plan --csv <file> [--cutoff <iso>] [--margin-hours 48] [--workspace chimera] [--out <dir>]');
  process.exit(1);
}
