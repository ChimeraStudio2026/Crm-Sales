# Supabase — guida completa per CRM Sales

## 1. Crea il progetto Supabase

1. Vai su [https://supabase.com](https://supabase.com) e accedi.
2. **New project** → scegli nome, password database e regione (es. `eu-central-1`).
3. Attendi che il progetto sia pronto (~2 minuti).

## 2. Crea le tabelle

1. Apri **SQL Editor** nel dashboard Supabase.
2. Copia e incolla tutto il contenuto di:
   `supabase/migrations/20260524120000_crm_schema.sql`
3. Clicca **Run**.

Vengono create 3 tabelle:
- `clients` — lista clienti (Sezione 1)
- `ideas` — idee kanban
- `daily_recall` — selezione Random Recall giornaliera

## 3. Prendi le credenziali API

1. **Project Settings** → **API**
2. Copia:
   - **Project URL** (es. `https://abcdefgh.supabase.co`)
   - **anon public** key (chiave pubblica, sicura per il frontend)

> Non usare mai la `service_role` key nel browser.

## 4. Configura il CRM in locale

```bash
cp config.example.js config.js
```

Apri `config.js` e incolla URL + anon key:

```javascript
window.CRM_SUPABASE_CONFIG = {
    url: 'https://TUO-PROJECT.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

Avvia il CRM (es. con Live Server o `npx serve .`) e apri **Impostazioni**:  
dovresti vedere **Supabase: connesso**.

## 5. Migrazione da localStorage

Se avevi già dati nel browser e Supabase è vuoto, al primo avvio il CRM **copia automaticamente** clienti e idee da `localStorage` su Supabase.

## 6. Deploy su Vercel

1. Nel progetto Vercel → **Settings** → **Environment Variables**:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_ANON_KEY` = anon public key
2. Rideploy: il build genera `config.js` da `scripts/generate-config.js`.

## 7. Comportamento

| Azione | Con Supabase | Senza config |
|--------|--------------|--------------|
| Salva cliente | Postgres | localStorage |
| Import Excel | Postgres | localStorage |
| Random Recall | Postgres | localStorage |
| Svuota tutto | Cancella tabelle | Cancella localStorage |

## 8. Sicurezza (importante)

Le policy attuali permettono accesso completo con la anon key (ok per uso personale).

Per un CRM con più utenti:
1. Attiva **Supabase Auth**
2. Sostituisci le policy RLS con regole `auth.uid()`
3. Vedi [Supabase RLS docs](https://supabase.com/docs/guides/auth/row-level-security)

## 9. Supabase CLI (opzionale)

```bash
npm install -g supabase
supabase login
supabase link --project-ref TUO-PROJECT-REF
supabase db push
```

## 10. Cursor MCP Supabase

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
