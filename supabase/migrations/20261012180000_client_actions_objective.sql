-- Obiettivo opzionale di un'azione (es. azioni Accounting: cosa si vuole ottenere dal cliente).
alter table public.client_actions add column if not exists objective text;
