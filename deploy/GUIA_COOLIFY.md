# Deploy no Coolify — Doces Komilão

Ordem recomendada. Tempo estimado: 1h30 na primeira vez.

## 0. Pré-requisitos
- VPS com o Coolify instalado (Ubuntu 22/24, **mínimo 4 GB de RAM** para Supabase + Evolution + app; 8 GB é o confortável).
- Domínio `komilaodoces.com.br` registrado no Registro.br.
- No DNS do domínio, crie registros **A** apontando para o IP da VPS:

| Nome | Uso |
|---|---|
| `@` e `www` | Loja + painel (`/admin`) |
| `db` | Supabase (API + Studio) |
| `wa` | Evolution API (WhatsApp) |

## 1. Supabase (banco, login e fotos)
1. Coolify → Project **Komilão** → **+ New** → **Services** → busque **Supabase** → Deploy.
2. Em *Domains*, coloque `https://db.komilaodoces.com.br` no serviço **supabase-kong**.
3. Anote as variáveis que o Coolify gera: `SERVICE_SUPABASEANON_KEY` (anon), `SERVICE_SUPABASESERVICE_KEY` (service role) e a senha do Studio (`SERVICE_USER_ADMIN` / `SERVICE_PASSWORD_ADMIN`).
4. Abra o Studio (`https://db.komilaodoces.com.br`) → **SQL Editor** → rode, nesta ordem:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_seed.sql`
5. **Authentication → Users → Add user** (o seu e-mail) → depois rode o SQL de admin do `app/README.md`.
6. Desative o cadastro público: variável `DISABLE_SIGNUP=true` no serviço **supabase-auth** (a equipe é criada só por você).

> Alternativa sem manter servidor de banco: usar o Supabase Cloud (plano gratuito). O app funciona igual; só troca a URL e as chaves.

## 2. Evolution API (WhatsApp)
1. **+ New** → **Docker Compose (Empty)** → cole `deploy/evolution/docker-compose.yml`.
2. Variáveis: `EVOLUTION_SERVER_URL=https://wa.komilaodoces.com.br`, `EVOLUTION_API_KEY` (gere com `openssl rand -hex 32`), `EVOLUTION_DB_PASSWORD` (outra senha forte).
3. Domínio do serviço `evolution-api`: `https://wa.komilaodoces.com.br:8080`.
4. Deploy. Teste: abrir `https://wa.komilaodoces.com.br` deve mostrar a mensagem de boas-vindas da API.

## 3. App (loja + painel)
1. Suba a pasta do projeto para um repositório **privado** no GitHub (ex.: `balaocastelo-dev/komilao-doces`).
2. **+ New** → **Private Repository (GitHub App)** → Build Pack **Dockerfile** → Base Directory `/app`.
3. Domínio: `https://komilaodoces.com.br,https://www.komilaodoces.com.br` — porta **3000**.
4. Variáveis (as `NEXT_PUBLIC_*` marcadas como **Build Variable**):

```
NEXT_PUBLIC_SUPABASE_URL=https://db.komilaodoces.com.br
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon do passo 1>
NEXT_PUBLIC_SITE_URL=https://komilaodoces.com.br
NEXT_PUBLIC_WHATSAPP_LOJA=5519XXXXXXXXX
SUPABASE_SERVICE_ROLE_KEY=<service role do passo 1>
EVOLUTION_API_URL=https://wa.komilaodoces.com.br
EVOLUTION_API_KEY=<a mesma do passo 2>
EVOLUTION_INSTANCE=komilao
CRON_SECRET=<openssl rand -hex 32>
WHATSAPP_WEBHOOK_SECRET=<openssl rand -hex 32>
```

5. Deploy → abra `https://komilaodoces.com.br/admin` e faça login.

## 4. Agendador da fila de WhatsApp
No app, aba **Scheduled Tasks** → novo:
- Frequência: `* * * * *` (a cada minuto)
- Comando: `wget -qO- --header="Authorization: Bearer $CRON_SECRET" --post-data="" http://127.0.0.1:3000/api/whatsapp/processar`

A rota envia no máximo 5 mensagens por chamada, só as **aprovadas**, dentro do horário e do limite diário configurados.

## 5. Conectar o WhatsApp
Painel → **WhatsApp → Conexão** → *Criar instância* → escanear o QR code com o celular da Komilão (WhatsApp Business recomendado). O webhook de respostas (e do "SAIR") já é configurado junto.

## 6. Leads
No Windows: rode `iniciar.ps1` → opção **Captar leads**. Depois, no painel: **Leads → Importar** → escolha `leads/saida/leads.json`.

## Boas práticas para não perder o número
- Aquecer o chip: primeiras 2 semanas com no máximo **20 mensagens/dia**, subindo aos poucos (o limite é ajustável na tela Conexão).
- Mensagem curta, personalizada e sempre com opção **SAIR** (os templates já trazem isso).
- Aprovar em lotes pequenos; nunca mandar a mesma mensagem idêntica para centenas de números.
- Priorizar leads com score alto e responder rápido quem responder.
- Se o volume crescer, migrar a prospecção para a API oficial do WhatsApp (Cloud API) e manter a Evolution para o atendimento.

## Backups
- Coolify → Supabase → **Backups**: agendar backup diário do Postgres (e, se possível, enviar para um S3/Backblaze).
- Volume `evolution-instances` guarda a sessão do WhatsApp; incluir no backup para não precisar reescanear o QR.
