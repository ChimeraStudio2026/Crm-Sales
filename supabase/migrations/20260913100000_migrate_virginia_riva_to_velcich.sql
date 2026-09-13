-- Reassign Supabase rows keyed by auth user id (Riva → Velcich) and remove Riva account
DO $$
DECLARE
  riva_id uuid := '93c1cbf5-ad7f-4d80-b9d0-36b896d3ba32';
  velcich_id uuid := 'f691918f-5cf0-4d7f-a7d1-d5c09daf6eed';
BEGIN
  UPDATE public.user_gmail_connections
  SET user_id = velcich_id,
      updated_at = now()
  WHERE user_id = riva_id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_gmail_connections existing
      WHERE existing.user_id = velcich_id
    );

  DELETE FROM public.user_gmail_connections WHERE user_id = riva_id;

  UPDATE storage.objects
  SET owner = velcich_id
  WHERE owner = riva_id;
END $$;

UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE lower(email) = lower('virginia.velcich@chimerastudioss.com');

DELETE FROM auth.sessions
WHERE user_id = '93c1cbf5-ad7f-4d80-b9d0-36b896d3ba32';

DELETE FROM auth.refresh_tokens
WHERE user_id = '93c1cbf5-ad7f-4d80-b9d0-36b896d3ba32'::varchar;

DELETE FROM auth.users
WHERE id = '93c1cbf5-ad7f-4d80-b9d0-36b896d3ba32';
