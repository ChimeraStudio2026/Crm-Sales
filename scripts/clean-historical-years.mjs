import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const HISTORICAL_YEARS = [2023, 2024];

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

async function countRows(db, table, yearColumn, year) {
  const { count, error } = await db
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(yearColumn, year);
  if (error) throw error;
  return count ?? 0;
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

  console.log('Pulizia dati storici Supabase:', HISTORICAL_YEARS.join(', '));

  for (const year of HISTORICAL_YEARS) {
    const beforeCount = await countRows(db, 'okr_records', 'year', year);
    const { error } = await db.from('okr_records').delete().eq('year', year);
    if (error) throw error;
    console.log(`- okr_records ${year}: eliminati ${beforeCount} record`);
  }

  const { count: clientsWithRev, error: clientsCountError } = await db
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .or('rev_2023.neq.0,rev_2024.neq.0');
  if (clientsCountError) throw clientsCountError;

  const { error: clientsUpdateError } = await db
    .from('clients')
    .update({ rev_2023: 0, rev_2024: 0 })
    .or('rev_2023.neq.0,rev_2024.neq.0');
  if (clientsUpdateError) throw clientsUpdateError;
  console.log(`- clients: azzerati rev_2023/rev_2024 su ${clientsWithRev ?? 0} clienti`);

  for (const year of HISTORICAL_YEARS) {
    const beforeCount = await countRows(db, 'analysis_forecasts', 'year', year);
    const { error } = await db.from('analysis_forecasts').delete().eq('year', year);
    if (error) throw error;
    console.log(`- analysis_forecasts ${year}: eliminati ${beforeCount} record`);
  }

  console.log('Pulizia completata.');
}

main().catch((error) => {
  console.error('Pulizia fallita:', error.message);
  process.exit(1);
});
