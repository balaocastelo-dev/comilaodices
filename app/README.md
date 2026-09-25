# Doces Komilão — Loja + Painel (Next.js)

Loja virtual (varejo e atacado) e painel de gestão (pedidos, estoque, CRM, leads, WhatsApp, compras e financeiro) da **Doces Komilão**, distribuidora de doces e salgadinhos em Campinas-SP.

- **Loja**: `https://komilaodoces.com.br/`
- **Painel**: `https://komilaodoces.com.br/admin`

Stack: Next.js 15 (App Router, TypeScript, `output: 'standalone'`), Tailwind CSS 4, Supabase (`@supabase/supabase-js` + `@supabase/ssr`), lucide-react. A fonte arredondada (Fredoka) vem empacotada pelo npm (`@fontsource-variable/fredoka`), então o build **não depende do Google Fonts** e funciona offline.

O banco está em `../supabase/migrations/0001_schema.sql` e `0002_seed.sql`. O app usa exatamente essas tabelas, views e funções, e **não precisou de nenhuma migração nova**.

---

## Áreas

### Loja (pública)
| Rota | O que faz |
|---|---|
| `/` | Destaque com o logo, categorias, produtos em destaque e a chamada “Compre no atacado” (B2B para padarias, lanchonetes, bares e mercearias de Campinas e região). |
| `/produtos` | Catálogo com filtro por categoria (`?categoria=slug`) e busca (`?q=`). |
| `/produto/[id]` | Detalhe do produto: preço de varejo, preço de atacado com pedido mínimo, qtd por caixa e produtos relacionados. |
| `/carrinho` | Carrinho (salvo no navegador) e fechamento do pedido: nome/estabelecimento, WhatsApp, CNPJ opcional (**com CNPJ vale a tabela de atacado**), endereço e observação. Chama a função `criar_pedido_site`, e **os preços são recalculados no banco**. |
| `/pedido/sucesso` | Mostra o número do pedido e um botão para abrir o WhatsApp da loja com o resumo já preenchido. |

Produto sem foto aparece com um placeholder colorido (emoji + iniciais). A loja nunca usa imagens de sites externos: as fotos são enviadas pelo painel para o Storage do Supabase. Há também um botão flutuante de WhatsApp, `robots.txt` e `sitemap.xml`.

### Painel (`/admin`, só para a equipe)
Para entrar é preciso fazer login com e-mail e senha do Supabase **e** estar ativo na tabela `equipe`. Quem faz login sem estar na equipe vê a tela “Sem acesso”. O RLS do banco protege os dados de qualquer forma.

| Menu | O que faz |
|---|---|
| **Dashboard** | Vendas do mês, pedidos novos, contas a receber vencidas, contas a pagar nos próximos 7 dias, estoque baixo, leads novos, últimos pedidos e próximas ações. |
| **Pedidos** | Lista com filtro por status e busca. No detalhe: **confirmar** (forma de pagamento, parcelas e 1º vencimento, via `confirmar_pedido`: baixa o estoque em FEFO e gera as contas a receber), marcar como separado e depois entregue, e **cancelar** (um pedido já confirmado devolve os itens ao estoque num lote `DEV-<nº>` e exclui as parcelas ainda não recebidas). Também dá para **criar um pedido manual** (vendedor, WhatsApp ou balcão), escolhendo o cliente e os produtos com preço de varejo ou atacado editável. |
| **Produtos** | Cadastro de produtos com preço de varejo e de atacado, pedido mínimo de atacado, qtd por caixa, estoque mínimo, ativo/destaque e **upload de imagem** para o bucket `produtos`. Também cria categorias. |
| **Estoque** | Saldo por produto (`v_estoque`), alerta de estoque abaixo do mínimo e lotes que vencem em até 30 dias. |
| **Clientes** | Lista, busca, cadastro, edição e exclusão. No detalhe: pedidos, contas a receber, totais e **linha do tempo de atividades** (nota, ligação, visita e tarefa, com data agendada e marcação de concluída). |
| **CRM** | Kanban com as etapas de `crm_etapas`. Arrastar e soltar (HTML5 nativo) muda o `etapa_id`; no celular há um seletor de etapa em cada cartão. O cartão mostra categoria, cidade e um atalho para o WhatsApp. Abaixo fica a lista “Próximas ações”. |
| **Leads** | Tabela com filtros (cidade, categoria, status, tem WhatsApp, score mínimo e busca). Ações em lote: qualificar, descartar (com motivo), **converter em cliente** (`converter_lead`) e **gerar mensagens**: escolhe um template, substitui `{{nome}}`, `{{cidade}}` e `{{link_loja}}` e grava em `whatsapp_mensagens` como `pendente_aprovacao`. **Nada é enviado direto**; números em opt-out ou que já estão na fila são ignorados. Também **importa `leads.json`** (upsert por `fonte, fonte_id` em lotes de 500, **sem alterar o status** dos leads que já existem). |
| **WhatsApp** | **Fila**: pendentes com checkbox, texto editável, “Aprovar selecionadas” (`aprovar_mensagens`, que espalha os envios com intervalos aleatórios) e “Cancelar”, além do histórico de aprovadas, enviadas e com erro. **Conexão**: estado da instância na Evolution, QR code, criar instância, desconectar e regras de envio (limite diário, horário e dias, só admin). **Templates**: cadastro com prévia. **Opt-outs**: lista, inclusão e remoção. **Recebidas**: mensagens que chegaram pelo webhook. Um aviso fixo explica o risco de banimento e o limite diário. |
| **Compras** | Nova compra com fornecedor e itens (produto, qtd, custo, lote e validade), frete, parcelas e 1º vencimento. **Receber mercadoria** (`receber_compra`) dá entrada no estoque em lotes, atualiza o custo médio e gera as contas a pagar. |
| **Fornecedores** | Cadastro de fornecedores. |
| **Financeiro** | Contas a receber e a pagar (views `v_contas_*`) com filtros (em aberto, vencidas, pagas, todas e período), totais, **dar baixa** (data, valor e forma), estornar e **despesa avulsa** (aluguel, salário etc., com repetição mensal opcional). Inclui um **fluxo de caixa dos próximos 30 dias** (entradas × saídas por dia em barras e saldo acumulado). |

### Rotas de servidor
| Rota | Descrição |
|---|---|
| `POST /api/whatsapp/processar` | Envia a fila. Exige `Authorization: Bearer $CRON_SECRET` e usa a service role. Respeita `whatsapp_horario` e `whatsapp_limite_diario` (fuso America/Sao_Paulo) e envia **no máximo 5 mensagens por chamada**, só as `aprovada` com `enviar_apos <= agora`. Antes de cada envio confere o opt-out de novo, depois marca `enviando`, chama a Evolution `sendText` e marca `enviada` (com `evolution_id`) ou `erro` (tentativas++, com nova tentativa depois de 5 e 10 minutos, e desiste na 3ª). Registra uma `crm_atividades` do tipo whatsapp e marca o lead como `contatado`. Devolve um resumo em JSON. |
| `POST /api/whatsapp/webhook?token=...` | Webhook da Evolution (`messages.upsert`). Recusa token errado com 401 e ignora mensagens `fromMe` e de grupos. Grava a mensagem em `whatsapp_recebidas`. Se a resposta for **SAIR/PARAR/STOP/CANCELAR**: registra o opt-out, marca `clientes.opt_out = true` e cancela as mensagens pendentes daquele número. Se o número for de um lead `novo` ou `qualificado`, o lead passa a `contatado`. Em todos os casos registra uma atividade no CRM. Trata o 9º dígito dos celulares brasileiros. |
| `GET/POST /api/admin/evolution` | Usada pelo painel (usuário da equipe) para ver o estado e o QR code e para criar ou desconectar a instância. A apikey da Evolution fica só no servidor. |
| `GET /api/health` | Healthcheck do Docker/Coolify. |

A service role é usada **somente** em `processar` e `webhook` (`lib/supabase/admin.ts`, com `server-only`). Todas as outras operações usam a sessão do usuário logado, com RLS.

---

## Variáveis de ambiente

Veja `.env.example` (comentado).

| Variável | Onde | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | build + runtime | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build + runtime | Chave anon (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime (secreta) | Só para as rotas de WhatsApp |
| `NEXT_PUBLIC_SITE_URL` | build + runtime | `https://komilaodoces.com.br` |
| `NEXT_PUBLIC_WHATSAPP_LOJA` | build + runtime | WhatsApp da loja, ex. `5519999999999` |
| `EVOLUTION_API_URL` | runtime (secreta) | URL da Evolution API |
| `EVOLUTION_API_KEY` | runtime (secreta) | API key da Evolution |
| `EVOLUTION_INSTANCE` | runtime | Nome da instância (ex. `komilao`) |
| `CRON_SECRET` | runtime (secreta) | Token do agendador |
| `WHATSAPP_WEBHOOK_SECRET` | runtime (secreta) | Token do webhook |

> As variáveis `NEXT_PUBLIC_*` são **embutidas no build**. No Coolify, marque-as como *Build Variable*. Se mudar alguma delas, é preciso fazer um novo deploy.

---

## Rodar localmente

```bash
cd app
cp .env.example .env.local   # preencha com os dados do seu projeto Supabase
npm install
npm run dev                  # http://localhost:3000  (painel em /admin)
```

Outros comandos:
```bash
npm run build   # build de produção
npm run lint    # eslint + checagem de tipos (tsc --noEmit)
npm start       # servir o build
```

Pré-requisito: rode `supabase/migrations/0001_schema.sql` e `0002_seed.sql` no SQL Editor do Supabase (ou `supabase db push`).

---

## Criar o primeiro usuário admin

1. No Supabase: **Authentication → Users → Add user → Create new user**. Informe e-mail e senha e marque *Auto Confirm User*.
2. No **SQL Editor**, rode (trocando o e-mail e o nome):

```sql
insert into public.equipe (user_id, nome, papel)
select id, 'Seu Nome', 'admin'
from auth.users
where email = 'voce@komilaodoces.com.br'
on conflict (user_id) do update set papel = 'admin', ativo = true;
```

3. Entre em `/admin/login`.

Os demais membros são criados do mesmo jeito, com papel `vendedor` ou `financeiro`. Só o `admin` altera a tabela `config` (regras de envio do WhatsApp) e cria ou desconecta a instância.

> Recomendado: em **Authentication → Providers → Email**, desative *Allow new users to sign up*. A equipe é cadastrada só pelo painel do Supabase.

---

## Deploy no Coolify (Docker)

1. Crie um recurso **Dockerfile** apontando para a pasta `app/` do repositório.
2. Cadastre as variáveis de ambiente, com as `NEXT_PUBLIC_*` como *Build Variable*.
3. Porta **3000**, domínio `komilaodoces.com.br` (o painel fica em `/admin` no mesmo app).
4. A imagem é multi-stage `node:22-alpine`, roda como usuário não-root, usa `output: standalone`, `TZ=America/Sao_Paulo` e tem healthcheck em `/api/health`.

### Agendador da fila de WhatsApp (a cada minuto)
Em **Scheduled Tasks** do Coolify (ou num cron em outro container), com a frequência `* * * * *`:

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://komilaodoces.com.br/api/whatsapp/processar
```

### Webhook da Evolution
Ao clicar em “Criar instância” no painel, o webhook já é configurado automaticamente (se `NEXT_PUBLIC_SITE_URL` e `WHATSAPP_WEBHOOK_SECRET` estiverem definidos). Para configurar à mão na Evolution, use:

```
URL:     https://komilaodoces.com.br/api/whatsapp/webhook?token=<WHATSAPP_WEBHOOK_SECRET>
Eventos: MESSAGES_UPSERT
```

---

## Estrutura

```
app/                 rotas (App Router)
  (loja)/            loja pública (layout com carrinho, header, footer)
  admin/login/       login
  admin/(painel)/    painel protegido (layout com sidebar + checagem da equipe)
  api/               rotas de servidor (whatsapp, admin/evolution, health)
components/loja/     componentes da loja (carrinho, cards, checkout...)
components/admin/    componentes do painel (tabelas, modais, kanban...)
lib/supabase/        client.ts (navegador), server.ts (SSR/cookies), admin.ts (service role), middleware.ts
lib/format.ts        formatação BRL, datas (fuso SP), telefone, templates
lib/types.ts         tipos das tabelas
middleware.ts        protege /admin/*
```

## Observações
- **Cuidado com o WhatsApp**: toda mensagem passa por aprovação humana, e os envios são espaçados (45 a 180 s entre mensagens, mais uma pausa aleatória de 2 a 6 s dentro de cada lote), com limite diário e respeito à janela de horário. Mesmo assim, contato em massa com quem não conhece a empresa pode levar ao banimento do número. Use um chip dedicado.
- Cancelar um pedido confirmado devolve os itens ao estoque num lote novo, sem validade, com o custo médio atual.
- O módulo fiscal (NF-e) não faz parte desta fase.
