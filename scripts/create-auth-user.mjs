import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

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

async function main() {
  const email = process.argv[2] || 'vittorio@italianscodeitbetter.com';
  const password = process.argv[3] || '0987654321';
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '../.env.local');
  const env = loadEnvFile(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) {
    throw new Error('Configura NEXT_PUBLIC_SUPABASE_URL in .env.local');
  }
  if (!serviceRoleKey) {
    throw new Error(
      'Aggiungi SUPABASE_SERVICE_ROLE_KEY in .env.local (Project Settings → API → service_role) e riesegui.',
    );
  }
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const existing = listData.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password,
    });
    if (updateError) throw updateError;
    console.log(`Utente aggiornato e confermato: ${email}`);
    return;
  }
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  console.log(`Utente creato e confermato: ${email}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
