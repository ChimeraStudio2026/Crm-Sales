-- Conferma accesso vittorio@italianscodeitbetter.com (creato via signUp / dashboard)
-- Password impostata in fase di registrazione: 0987654321

UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmed_at = COALESCE(confirmed_at, now()),
  updated_at = now()
WHERE lower(email) = lower('vittorio@italianscodeitbetter.com');
