import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(
  __dirname,
  '../supabase/migrations/20260610140000_mail_campaign_owner.sql',
);
const sql = readFileSync(migrationPath, 'utf8').trim();

console.log('Esegui questo SQL nel Supabase SQL Editor:');
console.log('https://supabase.com/dashboard/project/ftkqrtzovyezlhlabmpn/sql/new\n');
console.log(sql);
console.log('\nDopo l\'esecuzione, ricarica il CRM e riprova a cambiare Owner.');
