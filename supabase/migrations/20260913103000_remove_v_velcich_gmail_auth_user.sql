-- Remove duplicate Virginia personal Gmail auth account
DELETE FROM auth.sessions
WHERE user_id = 'fbcded36-dab6-49f6-8c80-064004a4a048';

DELETE FROM auth.refresh_tokens
WHERE user_id = 'fbcded36-dab6-49f6-8c80-064004a4a048'::varchar;

DELETE FROM public.user_gmail_connections
WHERE user_id = 'fbcded36-dab6-49f6-8c80-064004a4a048';

DELETE FROM auth.users
WHERE id = 'fbcded36-dab6-49f6-8c80-064004a4a048';
