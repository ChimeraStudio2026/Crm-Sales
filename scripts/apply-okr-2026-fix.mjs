import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(
  __dirname,
  '../supabase/migrations/20260610120000_fix_okr_2026_import_amounts.sql',
);
const sql = readFileSync(migrationPath, 'utf8').trim();

console.log('Esegui questo SQL nel Supabase SQL Editor (oppure: npm run db:fix:okr-2026):\n');
console.log(sql);
console.log('\nDopo l\'esecuzione, ricarica il CRM.');
console.log('In alternativa re-importa OKR_Sales_Anno_2026.csv dall’app (sostituisce gli OKR 2026).');
