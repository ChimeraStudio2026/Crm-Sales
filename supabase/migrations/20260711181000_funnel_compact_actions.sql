-- Compact funnel actions: drop empty trailing slots left from the old 5-slot model.

UPDATE public.commercial_funnel_entries AS entry
SET actions = COALESCE(compacted.actions, '[]'::jsonb)
FROM (
  SELECT
    source.id,
    jsonb_agg(source.action ORDER BY source.position) AS actions
  FROM (
    SELECT
      entry.id,
      action.value AS action,
      action.ordinality AS position
    FROM public.commercial_funnel_entries AS entry
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(entry.actions, '[]'::jsonb))
      WITH ORDINALITY AS action(value, ordinality)
  ) AS source
  WHERE COALESCE(source.action->>'type', '') <> ''
     OR COALESCE(source.action->>'note', '') <> ''
     OR COALESCE(source.action->>'date', '') <> ''
     OR jsonb_array_length(COALESCE(source.action->'taskIds', '[]'::jsonb)) > 0
  GROUP BY source.id
) AS compacted
WHERE entry.id = compacted.id;

UPDATE public.commercial_funnel_entries
SET actions = '[]'::jsonb
WHERE actions IS NULL
   OR jsonb_array_length(actions) = 0
   OR NOT EXISTS (
     SELECT 1
     FROM jsonb_array_elements(actions) AS action(value)
     WHERE COALESCE(action.value->>'type', '') <> ''
        OR COALESCE(action.value->>'note', '') <> ''
        OR COALESCE(action.value->>'date', '') <> ''
        OR jsonb_array_length(COALESCE(action.value->'taskIds', '[]'::jsonb)) > 0
   );

-- Normalize legacy action labels that would break stage mapping.
UPDATE public.commercial_funnel_entries AS entry
SET actions = normalized.actions
FROM (
  SELECT
    entry.id,
    jsonb_agg(
      jsonb_build_object(
        'type',
        CASE COALESCE(action.value->>'type', '')
          WHEN 'Riscrivere' THEN 'Mail Di contatto'
          ELSE COALESCE(action.value->>'type', '')
        END,
        'date', COALESCE(action.value->>'date', ''),
        'note', COALESCE(action.value->>'note', ''),
        'taskIds', COALESCE(action.value->'taskIds', '[]'::jsonb)
      )
      ORDER BY action.ordinality
    ) AS actions
  FROM public.commercial_funnel_entries AS entry
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(entry.actions, '[]'::jsonb))
    WITH ORDINALITY AS action(value, ordinality)
  GROUP BY entry.id
) AS normalized
WHERE entry.id = normalized.id;
