ALTER TABLE public.commercial_funnel_entries
  ADD COLUMN IF NOT EXISTS client_source text NOT NULL DEFAULT 'cold'
  CHECK (client_source IN ('cold', 'main'));
