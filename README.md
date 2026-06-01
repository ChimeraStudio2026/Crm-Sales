# CRM Sales — Next.js

Sales CRM built with **Next.js 15**, **React 19**, and **Supabase**.

## Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL + anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |

Set these in `.env.local` for local dev and in **Vercel → Project → Settings → Environment Variables** for production.

## Authentication

The CRM requires Supabase Auth. Unauthenticated requests are blocked by RLS.

1. Open **Supabase Dashboard → Authentication → Providers** and ensure **Email** is enabled.
2. In **Authentication → Settings**, disable **Enable sign ups** so only pre-created accounts can access the CRM.
3. Create user accounts from the Supabase Dashboard (**Authentication → Users → Add user**).
4. All authenticated team members share full access to CRM data (internal tool model).

Middleware redirects unauthenticated users to `/login`. Sessions are stored in HTTP-only cookies via `@supabase/ssr`.

## Deploy on Vercel

1. Push this repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Framework preset: **Next.js** (auto-detected)
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy

No custom build script needed — Vercel runs `next build` automatically.

## Supabase setup

1. Create a Supabase project
2. Run migrations from `supabase/migrations/` (SQL Editor or `supabase db push`)
3. Deploy edge function: `supabase functions deploy apollo-enrich`
4. See `SUPABASE_SETUP.md` and `APOLLO_SETUP.md`

## Project structure

```
app/                  Next.js App Router pages
  (crm)/analysis/     OKR dashboard
  (crm)/clients/      Client list
  (crm)/tasks/        Per-client tasks
  ...
components/           React UI components
lib/                  Types, Supabase, business logic
providers/            CrmProvider (global state)
supabase/             Migrations + edge functions
legacy/               Original static HTML app (archived)
```

## Legacy static app

The original vanilla HTML/JS version is preserved in `legacy/` for reference. The active app is the Next.js project in `app/`.
