-- Product offer tags per client (prod, content, eventi, mini)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS product_offers jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.clients.product_offers IS 'Product offer ids enabled for the client (prod, content, eventi, mini)';
