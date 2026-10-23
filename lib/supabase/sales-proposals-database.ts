import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants/workspaces';
import type { SalesProposal, SalesProposalImportRow } from '@/lib/types/sales-proposals';

const FETCH_PAGE_SIZE = 1000;
const INSERT_CHUNK_SIZE = 200;

interface SalesProposalRow {
  id: number;
  code: string | null;
  nome: string;
  stato: string | null;
  ultimo_prezzo: number | string | null;
  descrizione: string | null;
  categoria: string | null;
  cliente: string | null;
  motivo_rifiuto: string | null;
  data_rifiuto: string | null;
  data_accettazione: string | null;
  ultimo_aggiornamento: string | null;
  creato_il: string;
  contattato_da: string | null;
  tipo: string | null;
  budget_finale: number | string | null;
  workspace_id: string | null;
  import_batch: string;
  created_at: string;
  anno_riferimento: number | null;
}

function parseNullableNumber(value: number | string | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowToProposal(row: SalesProposalRow): SalesProposal {
  return {
    id: Number(row.id),
    code: row.code || '',
    nome: row.nome,
    stato: row.stato || '',
    ultimoPrezzo: parseNullableNumber(row.ultimo_prezzo),
    descrizione: row.descrizione || '',
    categoria: row.categoria || '',
    cliente: row.cliente || '',
    motivoRifiuto: row.motivo_rifiuto || '',
    dataRifiuto: row.data_rifiuto,
    dataAccettazione: row.data_accettazione,
    ultimoAggiornamento: row.ultimo_aggiornamento,
    creatoIl: row.creato_il,
    contattatoDa: row.contattato_da || '',
    tipo: row.tipo || '',
    budgetFinale: parseNullableNumber(row.budget_finale),
    workspaceId: row.workspace_id || DEFAULT_WORKSPACE_ID,
    importBatch: row.import_batch,
    createdAt: row.created_at,
    annoRiferimento: row.anno_riferimento ?? null,
  };
}

function importRowToInsert(
  row: SalesProposalImportRow,
  workspaceId: string,
  importBatch: string,
): Record<string, unknown> {
  return {
    code: row.code || null,
    nome: row.nome,
    stato: row.stato || null,
    ultimo_prezzo: row.ultimoPrezzo,
    descrizione: row.descrizione || null,
    categoria: row.categoria || null,
    cliente: row.cliente || null,
    motivo_rifiuto: row.motivoRifiuto || null,
    data_rifiuto: row.dataRifiuto,
    data_accettazione: row.dataAccettazione,
    ultimo_aggiornamento: row.ultimoAggiornamento,
    creato_il: row.creatoIl,
    contattato_da: row.contattatoDa || null,
    tipo: row.tipo || null,
    budget_finale: row.budgetFinale,
    workspace_id: workspaceId || DEFAULT_WORKSPACE_ID,
    import_batch: importBatch,
  };
}

export async function fetchSalesProposals(
  db: SupabaseClient,
  workspaceId: string,
): Promise<SalesProposal[]> {
  const proposals: SalesProposal[] = [];
  let from = 0;
  while (true) {
    const to = from + FETCH_PAGE_SIZE - 1;
    const { data, error } = await db
      .from('sales_proposals')
      .select('*')
      .eq('workspace_id', workspaceId || DEFAULT_WORKSPACE_ID)
      .order('creato_il', { ascending: false })
      .range(from, to);
    if (error) throw error;
    const page = (data || []) as SalesProposalRow[];
    page.forEach((row) => {
      proposals.push(rowToProposal(row));
    });
    if (page.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }
  return proposals;
}

export async function upsertSalesProposalsFromImport(
  db: SupabaseClient,
  rows: SalesProposalImportRow[],
  workspaceId: string,
  importBatch: string,
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((row) => importRowToInsert(row, workspaceId, importBatch));
  for (let offset = 0; offset < payload.length; offset += INSERT_CHUNK_SIZE) {
    const chunk = payload.slice(offset, offset + INSERT_CHUNK_SIZE);
    const { error } = await db.from('sales_proposals').upsert(chunk, {
      onConflict: 'nome,creato_il',
    });
    if (error) throw error;
  }
}

/** Sposta la proposta in un anno successivo (null = torna all'anno di creazione). */
export async function updateSalesProposalReferenceYear(
  db: SupabaseClient,
  proposalId: number,
  year: number | null,
): Promise<void> {
  const { error } = await db.from('sales_proposals').update({ anno_riferimento: year }).eq('id', proposalId);
  if (error) throw error;
}

/** @deprecated Usa upsertSalesProposalsFromImport */
export async function insertSalesProposalsIgnoringDuplicates(
  db: SupabaseClient,
  rows: SalesProposalImportRow[],
  workspaceId: string,
  importBatch: string,
): Promise<void> {
  return upsertSalesProposalsFromImport(db, rows, workspaceId, importBatch);
}
