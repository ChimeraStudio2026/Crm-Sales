-- Security: pin search_path on public functions flagged by Supabase advisors
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.parse_okr_month_number(text) SET search_path = public;
ALTER FUNCTION public.get_okr_year_comparison_at_day(integer, integer[]) SET search_path = public;

-- Performance: speed up task list filtering by status and Today section
CREATE INDEX IF NOT EXISTS idx_ideas_task_status
  ON public.ideas (status)
  WHERE item_type = 'task';

CREATE INDEX IF NOT EXISTS idx_ideas_task_due_date
  ON public.ideas (due_date)
  WHERE item_type = 'task' AND due_date IS NOT NULL;

-- Ensure mail campaign contact removal cascades tracking rows
ALTER TABLE public.mail_campaign_send_tracking
  DROP CONSTRAINT IF EXISTS mail_campaign_send_tracking_campaign_contact_id_fkey;

ALTER TABLE public.mail_campaign_send_tracking
  ADD CONSTRAINT mail_campaign_send_tracking_campaign_contact_id_fkey
  FOREIGN KEY (campaign_contact_id)
  REFERENCES public.mail_campaign_contacts(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.mail_campaign_send_tracking
  VALIDATE CONSTRAINT mail_campaign_send_tracking_campaign_contact_id_fkey;
