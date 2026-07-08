-- Allow Martino as client origin for Tinytoast workspace

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_client_origin_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_client_origin_check
  CHECK (client_origin IN ('', 'Jeck', 'Inbound', 'Instagram', 'Community', 'Outbound', 'Martino'));
