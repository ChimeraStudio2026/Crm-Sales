import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const FIX_YEAR = 2026;
const INFLATED_TOTAL_THRESHOLD = 3_000_000;

function loadEnvFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const env = {};
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });
  return env;
}

async function sumOkrYear(db, year) {
  const { data, error } = await db
    .from('okr_records')
    .select('amount')
    .eq('year', year);
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

async function main() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '../.env.local');
  const env = loadEnvFile(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY
    || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Configura NEXT_PUBLIC_SUPABASE_URL e una chiave Supabase in .env.local');
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const totalBefore = await sumOkrYear(db, FIX_YEAR);
  console.log(`OKR ${FIX_YEAR} — totale attuale: € ${Math.round(totalBefore).toLocaleString('it-IT')}`);

  if (totalBefore <= INFLATED_TOTAL_THRESHOLD) {
    console.log('Totale non gonfiato: nessuna correzione applicata.');
    console.log('Se i dati sono ancora errati, re-importa OKR_Sales_Anno_2026.csv dall’app.');
    return;
  }

  const { data: rows, error: fetchError } = await db
    .from('okr_records')
    .select('id, amount')
    .eq('year', FIX_YEAR);
  if (fetchError) throw fetchError;

  const updates = (rows || [])
    .filter((row) => {
      const amount = Number(row.amount) || 0;
      return amount >= 1000 && amount % 100 === 0;
    })
    .map((row) => ({
      id: row.id,
      amount: Math.round((Number(row.amount) || 0) / 100),
    }));

  console.log(`Correzione ${updates.length} OKR (÷100)...`);

  const chunkSize = 100;
  for (let index = 0; index < updates.length; index += chunkSize) {
    const chunk = updates.slice(index, index + chunkSize);
    const { error } = await db.from('okr_records').upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }

  const { data: okrRows, error: okrError } = await db
    .from('okr_records')
    .select('client_id, client_name, amount')
    .eq('year', FIX_YEAR);
  if (okrError) throw okrError;

  const totalsByClientId = new Map();
  const totalsByName = new Map();
  (okrRows || []).forEach((row) => {
    const amount = Number(row.amount) || 0;
    if (row.client_id) {
      totalsByClientId.set(row.client_id, (totalsByClientId.get(row.client_id) || 0) + amount);
    }
    const nameKey = String(row.client_name || '').trim().toLowerCase();
    if (nameKey) {
      totalsByName.set(nameKey, (totalsByName.get(nameKey) || 0) + amount);
    }
  });

  const { data: clients, error: clientsError } = await db.from('clients').select('id, name');
  if (clientsError) throw clientsError;

  let updatedClients = 0;
  for (const client of clients || []) {
    const byId = totalsByClientId.get(client.id);
    const byName = totalsByName.get(String(client.name || '').trim().toLowerCase());
    const nextRev = byId ?? byName;
    if (nextRev === undefined) continue;
    const { error } = await db.from('clients').update({ rev_2026: nextRev }).eq('id', client.id);
    if (error) throw error;
    updatedClients += 1;
  }

  const totalAfter = await sumOkrYear(db, FIX_YEAR);
  console.log(`OKR corretti. Nuovo totale ${FIX_YEAR}: € ${Math.round(totalAfter).toLocaleString('it-IT')}`);
  console.log(`Clienti aggiornati (rev_2026): ${updatedClients}`);
}

main().catch((error) => {
  console.error('Fix fallito:', error.message);
  process.exit(1);
});
