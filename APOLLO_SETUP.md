# Apollo.io — arricchimento clienti

Integrazione opzionale per compilare email, sito web, settore e note descrittive dei clienti tramite [Apollo.io](https://www.apollo.io/).

La **API key resta solo su Supabase** (Edge Function). Non va in `.env.local`, Vercel o nel codice frontend.

## 1. Ottieni la API key Apollo

1. Accedi ad [Apollo.io](https://app.apollo.io/) con il tuo account.
2. Vai in **Settings → Integrations → API** (o **API Keys**).
3. Crea o copia una **API key** con permessi di lettura (organization enrich, people match).

## 2. Aggiungi il secret su Supabase

1. Apri il [dashboard Supabase](https://supabase.com/dashboard/project/tdlsyjnzqmnubghszlht/functions/secrets) del progetto CRM.
2. **Edge Functions → Secrets**.
3. Aggiungi:
   - **Name:** `APOLLO_API_KEY`
   - **Value:** la tua chiave Apollo

## 3. Deploy della Edge Function

La function `apollo-enrich` deve essere deployata sul progetto Supabase.

Con Supabase CLI (dalla root del repo):

```bash
supabase link --project-ref tdlsyjnzqmnubghszlht
supabase secrets set APOLLO_API_KEY=la-tua-chiave-apollo
supabase functions deploy apollo-enrich
```

Il codice sorgente è in `supabase/functions/apollo-enrich/index.ts`.

> Con login obbligatorio nel CRM, la function può usare JWT verification. Se vedi errori 401, verifica di essere autenticato nel CRM.

## 4. Verifica in Impostazioni

1. Avvia il CRM: `npm run dev`
2. Vai in **Impostazioni**
3. Clicca **Verifica connessione**
4. Il badge Apollo deve mostrare **Apollo configurato** se secret e deploy sono ok

## 5. Usa l’arricchimento

- **Lista Clienti** o **Clienti Freddi**: pulsante ✨ nella colonna Azioni
- **Drawer modifica cliente**: pulsante **Apollo** nel footer

Apollo cerca per **nome azienda**, **email** o **dominio** e aggiorna:

| Campo CRM   | Fonte Apollo                          |
|-------------|---------------------------------------|
| Email       | contatto trovato (se vuota)           |
| Descrizione | settore, sede, dipendenti, LinkedIn… |
| Azione      | URL sito (se azione vuota o `-`)      |

I dati Apollo in descrizione sono delimitati da `--- Apollo ---`.

## Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| `Supabase non configurato` | Configura `.env.local` e verifica login |
| `APOLLO_API_KEY non configurata` | Aggiungi il secret in Supabase |
| `Failed to send a request to the Edge Function` | Deploy `apollo-enrich` |
| `Nessun dato trovato` | Prova con email aziendale o nome più preciso |
| Rate limit Apollo | Attendi o riduci le richieste (piano Apollo) |

Documentazione API: [docs.apollo.io](https://docs.apollo.io/)
