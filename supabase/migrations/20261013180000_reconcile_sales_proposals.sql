-- Una proposta rinominata in Cerbero mantiene il codice ma cambia nome: l'upsert della
-- sync (chiave nome + creato_il) inserisce una riga nuova e lascia la vecchia. Questa
-- funzione, chiamata dalla sync dopo gli upsert, elimina per i codici indicati le righe
-- che non sono più nell'export Cerbero. p_current = tutte le proposte dell'export con quei
-- codici, come [{"nome": ..., "creato_il": ...}] (le legacy condividono il codice).

CREATE OR REPLACE FUNCTION public.reconcile_sales_proposals(
  p_workspace text,
  p_codes text[],
  p_current jsonb
)
RETURNS TABLE (id bigint, code text, nome text)
LANGUAGE sql
SET search_path = public
AS $$
  DELETE FROM public.sales_proposals AS p
  WHERE p.workspace_id = p_workspace
    AND p.code = ANY (p_codes)
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_current) AS item
      WHERE item ->> 'nome' = p.nome
        AND (item ->> 'creato_il')::timestamptz = p.creato_il
    )
  RETURNING p.id, p.code, p.nome;
$$;

REVOKE ALL ON FUNCTION public.reconcile_sales_proposals(text, text[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_sales_proposals(text, text[], jsonb) FROM anon, authenticated;
