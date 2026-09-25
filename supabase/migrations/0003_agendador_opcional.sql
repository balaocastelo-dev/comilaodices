-- =====================================================================
-- OPCIONAL — agendador da fila de WhatsApp dentro do próprio Supabase.
-- Use quando o app estiver na Vercel (plano Hobby só permite cron diário)
-- ou para não depender do Scheduled Task do Coolify.
-- Chama /api/whatsapp/processar a cada minuto via pg_cron + pg_net.
--
-- ANTES de rodar, troque os 2 valores abaixo (não faça commit deles):
--   <URL_DO_SITE>   ex.: https://komilaodoces.com.br  (ou https://comilaodices.vercel.app)
--   <CRON_SECRET>   o mesmo valor da variável CRON_SECRET do app
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Guarda o segredo no Vault (criptografado), não em texto no job
select vault.create_secret('<CRON_SECRET>', 'komilao_cron_secret');
select vault.create_secret('<URL_DO_SITE>', 'komilao_site_url');

select cron.unschedule('komilao-whatsapp-fila') where exists (select 1 from cron.job where jobname = 'komilao-whatsapp-fila');
select cron.schedule(
  'komilao-whatsapp-fila',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'komilao_site_url') || '/api/whatsapp/processar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'komilao_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- Conferir execuções:  select * from cron.job_run_details order by start_time desc limit 10;
-- Desligar:            select cron.unschedule('komilao-whatsapp-fila');
