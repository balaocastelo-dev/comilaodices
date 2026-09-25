# Doces Komilão — sistema completo

Distribuidora de doces e salgadinhos industrializados em **Campinas e região**.
Loja virtual (varejo + atacado), captação de leads, CRM, WhatsApp com aprovação humana e ERP (compras, estoque por lote/validade, contas a pagar e a receber). Hospedagem: **Vercel** (app) ou **Coolify** (tudo auto-hospedado). Domínio **komilaodoces.com.br**.

> Comece por **`iniciar.ps1`** (botão direito → Executar com o PowerShell).

## O que tem em cada pasta

| Pasta | O que é |
|---|---|
| `app/` | Loja + painel admin (Next.js). Ver `app/README.md`. |
| `supabase/migrations/` | Banco de dados: `0001_schema.sql` (tabelas, regras, segurança) e `0002_seed.sql` (7 produtos, etapas do CRM, templates de mensagem) e `0003_agendador_opcional.sql` (fila de WhatsApp a cada minuto via pg_cron). |
| `leads/` | Captação de leads no OpenStreetMap + painel HTML com mapa. Saída em `leads/saida/`. |
| `whatsapp-local/` | **Conector do WhatsApp por QR code** que roda no computador da loja (atalho “WhatsApp Komilão”). Envia a fila aprovada no painel e registra respostas/SAIR. Não precisa de servidor. |
| `deploy/` | `GUIA_VERCEL.md`, `GUIA_COOLIFY.md` e o compose da Evolution API (WhatsApp). |
| `docs/` | Logo e documentos. |

## Arquitetura

```
Coolify (VPS)
├── komilaodoces.com.br        → app (loja + /admin)            [app/Dockerfile]
├── db.komilaodoces.com.br     → Supabase (Postgres, login, fotos) [serviço 1-clique do Coolify]
├── wa.komilaodoces.com.br     → Evolution API (WhatsApp QR)      [deploy/evolution]
└── Scheduled Task (1/min)     → /api/whatsapp/processar (envia a fila aprovada)
```

## Fluxo de vendas
1. **Leads**: `captar_leads.py` busca padarias, lanchonetes, bares, mercearias, bombonieres, bancas e cafeterias nas 20 cidades da RMC, **exclui supermercados e redes/franquias**, pontua (0–100) e gera `leads.json` + painel com mapa.
2. **Importar** no painel → Leads → filtrar por cidade/score → **Gerar mensagens** (template com `{{nome}}`).
3. **WhatsApp → Fila**: você revisa e **aprova**. O sistema espaça os envios (45–180 s), respeita horário, limite diário e quem respondeu **SAIR**.
4. Quem responde vira **contatado** → converte em **cliente** → **CRM Kanban** (Novo → Contato feito → Interessado → Pedido teste → Cliente ativo).
5. **Pedido** (site, WhatsApp ou vendedor) → **confirmar** → baixa estoque (lote que vence primeiro) e gera **contas a receber** parceladas.
6. **Compras** do fornecedor → **receber mercadoria** → entra estoque com lote/validade, atualiza custo médio e gera **contas a pagar**.
7. **Financeiro**: baixa de pagamentos, vencidos e fluxo de caixa dos próximos 30 dias.

## Decisões e pendências
- **Módulo fiscal (NF-e)**: fica para depois, conforme combinado.
- **Fotos dos produtos**: subir fotos próprias ou oficiais dos fabricantes pelo painel. Não usar as imagens da loja Manos Doces.
- **Preço de atacado**: os 7 produtos entraram só com o preço de varejo informado. Falta definir o preço de atacado, o pedido mínimo e a quantidade por caixa (Painel → Produtos).
- **Dados de leads**: vêm do OpenStreetMap, que é gratuito e aberto, mas não cobre tudo. Para ampliar, é possível somar a Google Places API oficial (paga por consulta). Não fazer scraping do Google Maps.
