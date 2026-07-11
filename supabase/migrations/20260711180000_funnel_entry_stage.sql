-- Persisted funnel stage (aggregated progress, never regresses on follow-up actions)

ALTER TABLE public.commercial_funnel_entries
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'In contatto';

ALTER TABLE public.commercial_funnel_entries
  DROP CONSTRAINT IF EXISTS commercial_funnel_entries_stage_check;

ALTER TABLE public.commercial_funnel_entries
  ADD CONSTRAINT commercial_funnel_entries_stage_check
  CHECK (stage IN ('In contatto', 'Incontro fissato', 'Preventivo richiesto', 'Convertito', 'Perso'));

CREATE INDEX IF NOT EXISTS commercial_funnel_entries_stage_idx
  ON public.commercial_funnel_entries (stage);

-- Backfill: highest progression ever reached; Convertito vs Perso resolved by latest action date.
-- lost_reason always forces Perso. "Fissato appuntamento" maps to Incontro fissato (legacy data).
WITH entry_action_rows AS (
  SELECT
    entry.id,
    entry.lost_reason,
    action.value AS action
  FROM public.commercial_funnel_entries AS entry
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(entry.actions, '[]'::jsonb)) AS action(value)
),
action_analysis AS (
  SELECT
    id,
    MAX(
      CASE COALESCE(action->>'type', '')
        WHEN 'Quotazione richiesta' THEN 2
        WHEN 'Incontro in presenza' THEN 1
        WHEN 'Fissato appuntamento' THEN 1
        WHEN 'Mail Di contatto' THEN 0
        WHEN 'Instagram' THEN 0
        WHEN 'Call' THEN 0
        WHEN 'Messaggio' THEN 0
        ELSE NULL
      END
    ) AS max_progression,
    MAX(
      CASE
        WHEN action->>'type' = 'Convertito' AND NULLIF(action->>'date', '') IS NOT NULL
          THEN action->>'date'
      END
    ) AS latest_convertito_date,
    MAX(
      CASE
        WHEN action->>'type' = 'Perso' AND NULLIF(action->>'date', '') IS NOT NULL
          THEN action->>'date'
      END
    ) AS latest_perso_date
  FROM entry_action_rows
  WHERE COALESCE(action->>'type', '') <> ''
  GROUP BY id
),
computed_stage AS (
  SELECT
    entry.id,
    CASE
      WHEN COALESCE(BTRIM(entry.lost_reason), '') <> '' THEN 'Perso'
      WHEN analysis.latest_convertito_date IS NOT NULL
        AND (
          analysis.latest_perso_date IS NULL
          OR analysis.latest_convertito_date >= analysis.latest_perso_date
        )
        THEN 'Convertito'
      WHEN analysis.latest_perso_date IS NOT NULL THEN 'Perso'
      WHEN COALESCE(analysis.max_progression, -1) >= 2 THEN 'Preventivo richiesto'
      WHEN COALESCE(analysis.max_progression, -1) >= 1 THEN 'Incontro fissato'
      ELSE 'In contatto'
    END AS stage
  FROM public.commercial_funnel_entries AS entry
  LEFT JOIN action_analysis AS analysis ON analysis.id = entry.id
)
UPDATE public.commercial_funnel_entries AS entry
SET stage = computed.stage
FROM computed_stage AS computed
WHERE entry.id = computed.id;
