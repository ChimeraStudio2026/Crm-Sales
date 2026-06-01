import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}

export function createBrowserSupabaseClient(): SupabaseClient | null {
  const env = getSupabaseEnv();
  if (!env) return null;
  return createBrowserClient(env.url, env.key);
}

export function getSupabaseClient(): SupabaseClient | null {
  return createBrowserSupabaseClient();
}
