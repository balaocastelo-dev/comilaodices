# Deploy na Vercel — Doces Komilão

A Vercel hospeda só o **app** (loja + painel). O banco continua no **Supabase** (Cloud ou no Coolify) e o WhatsApp na **Evolution API** (Coolify/VPS), porque a Evolution precisa ficar ligada 24h e a Vercel não roda serviços permanentes.

```
Vercel      → app (loja + /admin)       repo: balaocastelo-dev/comilaodices, pasta app/
Supabase    → banco, login, fotos        (Cloud gratuito ou Coolify)
Coolify/VPS → Evolution API (WhatsApp)   deploy/evolution/docker-compose.yml
```

## 1. Projeto na Vercel
1. vercel.com → **Add New → Project** → importar `balaocastelo-dev/comilaodices`.
2. **Root Directory: `app`**. O framework é detectado como Next.js.
3. Em **Environment Variables**, cadastre as mesmas do `app/.env.example`:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon/publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role (**secreta**) |
| `NEXT_PUBLIC_SITE_URL` | `https://komilaodoces.com.br` (ou a URL `.vercel.app` enquanto não houver domínio) |
| `NEXT_PUBLIC_WHATSAPP_LOJA` | `5519XXXXXXXXX` |
| `EVOLUTION_API_URL` | `https://wa.komilaodoces.com.br` |
| `EVOLUTION_API_KEY` | API key da Evolution (**secreta**) |
| `EVOLUTION_INSTANCE` | `komilao` |
| `CRON_SECRET` | `openssl rand -hex 32` (**secreta**) |
| `WHATSAPP_WEBHOOK_SECRET` | `openssl rand -hex 32` (**secreta**) |

4. **Deploy**. Se alterar alguma variável `NEXT_PUBLIC_*`, clique em **Redeploy**.

## 2. Domínio
Vercel → Project → **Settings → Domains** → adicionar `komilaodoces.com.br` e `www.komilaodoces.com.br`. No Registro.br, crie os registros DNS que a Vercel mostrar (A `76.76.21.21` e CNAME `cname.vercel-dns.com` para o www).
Se o banco ou a Evolution ficarem no Coolify, os subdomínios `db.` e `wa.` continuam apontando para o IP da VPS.

## 3. Fila de WhatsApp (a cada minuto)
No plano **Hobby** (grátis), o cron da Vercel só roda **1 vez por dia**, o que não serve para a fila. Use o agendador do próprio Supabase:
- Abra `supabase/migrations/0003_agendador_opcional.sql`, troque `<URL_DO_SITE>` e `<CRON_SECRET>` e rode no SQL Editor. Não faça commit do arquivo com esses valores.
- Ele chama `/api/whatsapp/processar` a cada minuto com o token.

No plano **Pro** também dá para usar o Vercel Cron: a rota aceita GET com `Authorization: Bearer $CRON_SECRET`, que é exatamente o que a Vercel envia.

## 4. Webhook da Evolution
Painel → WhatsApp → Conexão → **Criar instância**. O webhook `https://SEU_SITE/api/whatsapp/webhook?token=...` é configurado automaticamente.

## Observações
- Cada envio da fila leva poucos segundos. O limite de duração da função (60 s) é suficiente porque cada chamada envia no máximo 5 mensagens.
- Imagens de produtos vêm do Storage do Supabase, cujo domínio é liberado automaticamente pela `NEXT_PUBLIC_SUPABASE_URL`.
- O `Dockerfile` continua valendo para quem preferir hospedar tudo no Coolify. Os dois caminhos usam o mesmo código.
