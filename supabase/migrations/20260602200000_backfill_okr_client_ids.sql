-- Collega okr_records ai clienti esistenti per nome (case-insensitive)
update public.okr_records as o
set client_id = c.id
from public.clients as c
where o.client_id is null
  and lower(trim(c.name)) = lower(trim(o.client_name));
