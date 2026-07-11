-- Rename Conclusa campaign status to Chiusa

UPDATE public.mail_campaigns
SET status = 'Chiusa'
WHERE status = 'Conclusa';

ALTER TABLE public.mail_campaigns
  DROP CONSTRAINT IF EXISTS mail_campaigns_status_check;

ALTER TABLE public.mail_campaigns
  ADD CONSTRAINT mail_campaigns_status_check
  CHECK (status IN ('Bozza', 'Attiva', 'Chiusa'));
