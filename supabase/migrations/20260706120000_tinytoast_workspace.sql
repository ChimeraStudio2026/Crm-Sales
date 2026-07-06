-- Tinytoast company workspace

INSERT INTO public.crm_workspaces (id, name)
VALUES ('tinytoast', 'Tinytoast')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
