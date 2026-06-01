# Supabase — guida completa per CRM Sales

## 1. Crea il progetto Supabase

1. Vai su [https://supabase.com](https://supabase.com) e accedi.
2. **New project** → scegli nome, password database e regione (es. `eu-central-1`).
3. Attendi che il progetto sia pronto (~2 minuti).

## 2. Crea le tabelle

1. Apri **SQL Editor** nel dashboard Supabase.
2. Esegui **tutte** le migration in ordine da `supabase/migrations/`:
   - `20260524120000_crm_schema.sql`
   - `20260524130000_cold_clients.sql`
   - `20260524140000_client_contacts.sql`
   - `20260524150000_analysis_okr.sql`
   - `20260524160000_client_tasks.sql`

Vengono create le tabelle: `clients`, `ideas`, `daily_recall`, `okr_records`, `analysis_forecasts`, `client_tasks`.

## 3. Prendi le credenziali API

1. **Project Settings** → **API**
2. Copia:
   - **Project URL** (es. `https://abcdefgh.supabase.co`)
   - **anon public** key (chiave pubblica, sicura per il frontend)

> Non usare mai la `service_role` key nel browser.

## 4. Configura il CRM in locale (Next.js)

```bash
cp .env.example .env.local
```

Apri `.env.local` e incolla URL + anon key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TUO-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Avvia il CRM:

```bash
npm install
npm run dev
```

Apri [http://localhost:3000/settings](http://localhost:3000/settings) — dovresti vedere **Supabase: connesso**.

## 5. Migrazione da localStorage

Se usavi la versione statica legacy (`legacy/`), i dati erano in `localStorage`. Con Supabase configurato, importa un backup JSON da **Impostazioni** oppure reinserisci i dati.

## 6. Deploy su Vercel

1. Importa il repo su Vercel (framework: **Next.js**, auto-detect)
2. **Settings** → **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key
3. Deploy — nessuno script di build custom necessario.

## 7. Autenticazione

Il CRM richiede login Supabase. Le policy RLS bloccano l'accesso anonimo.

1. **Authentication → Providers → Email** — abilitato
2. **Authentication → Settings** — disabilita **Enable sign ups**
3. Crea gli account da **Authentication → Users → Add user** (es. Jeck e Virgi)
4. Utenti autenticati condividono accesso completo ai dati CRM

## 8. Comportamento

| Azione | Con Supabase | Senza config |
|--------|--------------|--------------|
| Salva cliente | Postgres | Solo in-memory (perso al refresh) |
| Import Excel | Postgres | Solo in-memory |
| Random Recall | Postgres | Solo in-memory |
| Svuota tutto | Cancella tabelle | Reset stato locale |

## 9. Sicurezza (importante)

Le policy attuali permettono accesso completo con la anon key (ok per uso personale).

Per un CRM con più utenti:
1. Attiva **Supabase Auth**
2. Sostituisci le policy RLS con regole `auth.uid()`
3. Vedi [Supabase RLS docs](https://supabase.com/docs/guides/auth/row-level-security)

## 10. Supabase CLI (opzionale)

```bash
npm install -g supabase
supabase login
supabase link --project-ref TUO-PROJECT-REF
supabase db push
```

## 11. Cursor MCP Supabase

In `.cursor/mcp.json` puoi aggiungere il server Supabase MCP per gestire il database da Cursor:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

Poi autentica il server MCP da Cursor quando richiesto.
