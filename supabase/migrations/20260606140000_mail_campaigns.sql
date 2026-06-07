-- Mail campaign registry (manual tracking, no auto-send)

CREATE TABLE IF NOT EXISTS public.mail_campaigns (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Bozza'
    CHECK (status IN ('Bozza', 'Attiva', 'Conclusa')),
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mail_campaign_steps (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.mail_campaigns(id) ON DELETE CASCADE,
  order_number integer NOT NULL CHECK (order_number >= 1),
  title text NOT NULL,
  template_text text NOT NULL DEFAULT '',
  wait_days_from_previous integer NOT NULL DEFAULT 0 CHECK (wait_days_from_previous >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, order_number)
);

CREATE INDEX IF NOT EXISTS mail_campaign_steps_campaign_id_idx
  ON public.mail_campaign_steps(campaign_id);

CREATE TABLE IF NOT EXISTS public.mail_campaign_contacts (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.mail_campaigns(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id text NOT NULL,
  status text NOT NULL DEFAULT 'In Corso'
    CHECK (status IN ('In Corso', 'Convertito', 'Perso')),
  outcome_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, client_id, contact_id)
);

CREATE INDEX IF NOT EXISTS mail_campaign_contacts_campaign_id_idx
  ON public.mail_campaign_contacts(campaign_id);

CREATE INDEX IF NOT EXISTS mail_campaign_contacts_client_id_idx
  ON public.mail_campaign_contacts(client_id);

CREATE TABLE IF NOT EXISTS public.mail_campaign_send_tracking (
  id text PRIMARY KEY,
  campaign_contact_id text NOT NULL REFERENCES public.mail_campaign_contacts(id) ON DELETE CASCADE,
  step_id text NOT NULL REFERENCES public.mail_campaign_steps(id) ON DELETE CASCADE,
  send_status text NOT NULL DEFAULT 'Da Inviare'
    CHECK (send_status IN ('Da Inviare', 'Inviata', 'Non Necessaria')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_contact_id, step_id)
);

CREATE INDEX IF NOT EXISTS mail_campaign_send_tracking_contact_id_idx
  ON public.mail_campaign_send_tracking(campaign_contact_id);

ALTER TABLE public.mail_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_campaign_send_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_mail_campaigns_select" ON public.mail_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_mail_campaigns_insert" ON public.mail_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_mail_campaigns_update" ON public.mail_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_mail_campaigns_delete" ON public.mail_campaigns FOR DELETE TO authenticated USING (true);

CREATE POLICY "crm_mail_campaign_steps_select" ON public.mail_campaign_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_mail_campaign_steps_insert" ON public.mail_campaign_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_mail_campaign_steps_update" ON public.mail_campaign_steps FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_mail_campaign_steps_delete" ON public.mail_campaign_steps FOR DELETE TO authenticated USING (true);

CREATE POLICY "crm_mail_campaign_contacts_select" ON public.mail_campaign_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_mail_campaign_contacts_insert" ON public.mail_campaign_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_mail_campaign_contacts_update" ON public.mail_campaign_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_mail_campaign_contacts_delete" ON public.mail_campaign_contacts FOR DELETE TO authenticated USING (true);

CREATE POLICY "crm_mail_campaign_send_tracking_select" ON public.mail_campaign_send_tracking FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_mail_campaign_send_tracking_insert" ON public.mail_campaign_send_tracking FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_mail_campaign_send_tracking_update" ON public.mail_campaign_send_tracking FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_mail_campaign_send_tracking_delete" ON public.mail_campaign_send_tracking FOR DELETE TO authenticated USING (true);
