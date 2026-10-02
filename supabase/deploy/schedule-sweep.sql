-- Run ONCE in the Supabase SQL editor after deploying (Task 19). Not a migration: it needs the live URL and secret.
-- Replace <APP_URL> (e.g. https://qaid.vercel.app) and <CRON_SECRET> (same value as the CRON_SECRET env var). Do not commit real values.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'qaid-sweep',
  '* * * * *',
  $$ select net.http_get(
       url := '<APP_URL>/api/jobs/sweep',
       headers := jsonb_build_object('authorization', 'Bearer <CRON_SECRET>')
     ) $$
);
-- Remove later: select cron.unschedule('qaid-sweep');
