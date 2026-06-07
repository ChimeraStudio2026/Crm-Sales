ALTER TABLE public.ideas
ADD COLUMN IF NOT EXISTS subtasks jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ideas.subtasks IS 'Subtasks for task items: [{id, title, completed}]';
