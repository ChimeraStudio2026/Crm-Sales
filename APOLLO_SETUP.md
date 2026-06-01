# Apollo.io — arricchimento clienti

Integrazione opzionale per compilare email, sito web, settore e note descrittive dei clienti tramite [Apollo.io](https://www.apollo.io/).

La **API key resta solo su Supabase** (Edge Function). Non va mai inserita nel frontend o in `config.js`.

## 1. Ottieni la API key Apollo

1. Accedi ad [Apollo.io](https://app.apollo.io/) con il tuo account.
2. Vai in **Settings → Integrations → API** (o **API Keys**).
3. Crea o copia una **API key** con permessi di lettura (organization enrich, people match).

## 2. Aggiungi il secret su Supabase

1. Apri il [dashboard Supabase](https://supabase.com/dashboard) del progetto CRM.
2. **Edge Functions** → **Secrets** (o **Project Settings → Edge Functions**).
3. Aggiungi:
   - Nome: `APOLLO_API_KEY`
   - Valore: la tua chiave Apollo

## 3. Deploy della Edge Function

Dalla root del progetto, con [Supabase CLI](https://supabase.com/docs/guides/cli) collegato al progetto:

```bash
supabase functions deploy apollo-enrich --no-verify-jwt
```

Oppure usa il deploy da dashboard: carica il contenuto di `supabase/functions/apollo-enrich/index.ts`.

> `--no-verify-jwt` è necessario perché il CRM invoca la function con la **anon key** pubblica, senza login utente.

## 4. Verifica in Impostazioni

1. Avvia il CRM (`python3 -m http.server 3000` in locale).
2. Vai in **Impostazioni**.
3. Il badge **Apollo** deve mostrare **connesso** (verde) se il secret è configurato e la function è deployata.

Se vedi **configura API key** (arancione), controlla secret e deploy.

## 5. Usa l’arricchimento

- **Lista Clienti** o **Clienti Freddi**: pulsante ✨ (sparkles) nella colonna Azioni.
- **Drawer modifica cliente**: pulsante **Apollo** nel footer (solo in modifica).

Apollo cerca per **nome azienda**, **email** o **dominio** e aggiorna:

| Campo CRM        | Fonte Apollo                          |
|------------------|---------------------------------------|
| Email            | contatto trovato (se vuota)           |
| Descrizione      | settore, sede, dipendenti, LinkedIn…  |
| Prossima azione  | URL sito (se azione vuota o `-`)      |

I dati Apollo in descrizione sono delimitati da `--- Apollo ---`.

## Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| `Apollo richiede Supabase connesso` | Configura `config.js` / `supabase.config.js` e verifica connessione |
| `APOLLO_API_KEY non configurata` | Aggiungi il secret in Supabase |
| `Failed to send a request to the Edge Function` | Deploy `apollo-enrich` e abilita `--no-verify-jwt` |
| `Nessun dato trovato` | Prova con email aziendale o nome più preciso |
| Rate limit Apollo | Attendi o riduci le richieste (piano Apollo) |

Documentazione API: [docs.apollo.io](https://docs.apollo.io/)
