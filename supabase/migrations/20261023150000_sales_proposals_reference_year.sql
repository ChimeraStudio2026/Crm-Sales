-- Anno in cui contare una proposta nelle Proposte del CRM. Vuoto = anno di creazione.
-- Si può solo spostare in avanti (es. una proposta creata a fine 2026 che conta per il 2027).
-- La sync da Cerbero non scrive questa colonna, quindi lo spostamento resta.

ALTER TABLE public.sales_proposals
  ADD COLUMN IF NOT EXISTS anno_riferimento integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_proposals_anno_riferimento_successivo'
  ) THEN
    ALTER TABLE public.sales_proposals
      ADD CONSTRAINT sales_proposals_anno_riferimento_successivo
      CHECK (anno_riferimento IS NULL OR anno_riferimento > EXTRACT(YEAR FROM creato_il AT TIME ZONE 'UTC'));
  END IF;
END;
$$;

-- Una proposta rinominata in Cerbero arriva come riga nuova con lo stesso codice:
-- eredita l'anno di riferimento della riga che sostituisce.
CREATE OR REPLACE FUNCTION public.sales_proposals_keep_reference_year()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.anno_riferimento IS NULL AND COALESCE(NEW.code, '') <> '' THEN
    SELECT p.anno_riferimento INTO NEW.anno_riferimento
    FROM public.sales_proposals AS p
    WHERE p.workspace_id = NEW.workspace_id
      AND p.code = NEW.code
      AND p.anno_riferimento > EXTRACT(YEAR FROM NEW.creato_il AT TIME ZONE 'UTC')
    ORDER BY p.creato_il DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER sales_proposals_keep_reference_year
  BEFORE INSERT ON public.sales_proposals
  FOR EACH ROW EXECUTE FUNCTION public.sales_proposals_keep_reference_year();
