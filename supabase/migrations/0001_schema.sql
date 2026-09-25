-- =====================================================================
-- Doces Komilão — esquema principal (loja + CRM + leads + ERP + WhatsApp)
-- Postgres / Supabase. Rodar no SQL Editor do Supabase ou via `supabase db push`.
-- Módulo fiscal (NF-e) fica para uma fase posterior.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists unaccent;

-- ---------------------------------------------------------------------
-- Equipe (quem acessa o painel). Vinculada ao auth.users do Supabase.
-- ---------------------------------------------------------------------
create table if not exists equipe (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nome       text not null,
  papel      text not null default 'vendedor' check (papel in ('admin','vendedor','financeiro')),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create or replace function eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from equipe where user_id = auth.uid() and ativo);
$$;

create or replace function eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from equipe where user_id = auth.uid() and ativo and papel = 'admin');
$$;

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create table if not exists categorias (
  id      serial primary key,
  nome    text not null unique,
  slug    text not null unique,
  ordem   int not null default 0
);

create table if not exists produtos (
  id                     uuid primary key default gen_random_uuid(),
  sku                    text unique,
  nome                   text not null,
  marca                  text,
  categoria_id           int references categorias(id),
  descricao              text,
  unidade                text not null default 'un',       -- un, pote, pacote, caixa, fardo
  qtd_por_caixa          int not null default 1,           -- p/ venda no atacado
  preco_varejo           numeric(12,2) not null check (preco_varejo >= 0),
  preco_atacado          numeric(12,2) check (preco_atacado >= 0), -- preço por unidade na tabela atacado
  pedido_minimo_atacado  int not null default 1,           -- em unidades
  custo_medio            numeric(12,2) not null default 0,
  estoque_minimo         int not null default 0,
  imagem_url             text,
  ativo                  boolean not null default true,
  destaque               boolean not null default false,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

-- Lotes com validade (saída FEFO: primeiro que vence, primeiro que sai)
create table if not exists lotes (
  id          uuid primary key default gen_random_uuid(),
  produto_id  uuid not null references produtos(id) on delete cascade,
  lote        text,
  validade    date,
  quantidade  int not null check (quantidade >= 0),
  custo_unit  numeric(12,2) not null default 0,
  compra_id   uuid,
  criado_em   timestamptz not null default now()
);
create index if not exists lotes_produto_validade on lotes(produto_id, validade);

create or replace view v_estoque as
select p.id as produto_id, p.nome, p.sku, p.estoque_minimo,
       coalesce(sum(l.quantidade),0)::int as estoque,
       min(l.validade) filter (where l.quantidade > 0) as proxima_validade
from produtos p left join lotes l on l.produto_id = p.id
group by p.id;

-- ---------------------------------------------------------------------
-- Leads (captação: padarias, lanchonetes, bares, mercearias...)
-- ---------------------------------------------------------------------
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  fonte         text not null default 'manual' check (fonte in ('osm','google_places','manual','site','indicacao')),
  fonte_id      text,                          -- id na fonte (ex: node/123) p/ não duplicar
  nome          text not null,
  categoria     text,                          -- padaria, lanchonete, bar, mercearia, conveniencia, cafeteria, doceria
  endereco      text,
  bairro        text,
  cidade        text,
  cep           text,
  lat           double precision,
  lon           double precision,
  telefone      text,
  whatsapp      text,                          -- E.164 sem '+', ex 5519999999999
  site          text,
  instagram     text,
  horario       text,
  score         int not null default 0,
  status        text not null default 'novo' check (status in ('novo','qualificado','contatado','descartado','convertido')),
  motivo_descarte text,
  cliente_id    uuid,
  dados         jsonb not null default '{}'::jsonb,
  capturado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (fonte, fonte_id)
);
create index if not exists leads_cidade_cat on leads(cidade, categoria);

-- ---------------------------------------------------------------------
-- CRM
-- ---------------------------------------------------------------------
create table if not exists crm_etapas (
  id     serial primary key,
  nome   text not null unique,
  ordem  int not null,
  cor    text not null default '#FFBB12'
);

create table if not exists clientes (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null default 'PJ' check (tipo in ('PJ','PF')),
  nome            text not null,                 -- razão social ou nome
  fantasia        text,
  documento       text,                          -- CNPJ/CPF
  categoria       text,                          -- padaria, bar...
  contato_nome    text,
  whatsapp        text,
  telefone        text,
  email           text,
  endereco        text,
  bairro          text,
  cidade          text,
  cep             text,
  lat             double precision,
  lon             double precision,
  etapa_id        int references crm_etapas(id),
  vendedor_id     uuid references equipe(user_id),
  tabela_preco    text not null default 'atacado' check (tabela_preco in ('varejo','atacado')),
  prazo_dias      int not null default 0,        -- prazo padrão de pagamento
  limite_credito  numeric(12,2) not null default 0,
  opt_out         boolean not null default false, -- pediu p/ não receber mensagens
  origem          text not null default 'manual', -- site, lead, manual
  lead_id         uuid references leads(id),
  auth_user_id    uuid references auth.users(id), -- se o cliente cria conta na loja
  observacoes     text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create unique index if not exists clientes_documento_uk on clientes(documento) where documento is not null and documento <> '';
alter table leads add constraint leads_cliente_fk foreign key (cliente_id) references clientes(id) on delete set null not valid;

create table if not exists crm_atividades (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid references clientes(id) on delete cascade,
  lead_id         uuid references leads(id) on delete cascade,
  tipo            text not null check (tipo in ('nota','whatsapp','ligacao','visita','pedido','tarefa')),
  texto           text not null,
  agendado_para   timestamptz,          -- próxima ação / follow-up
  concluido       boolean not null default false,
  autor_id        uuid references equipe(user_id),
  criado_em       timestamptz not null default now(),
  check (cliente_id is not null or lead_id is not null)
);

-- ---------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------
create table if not exists pedidos (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity unique,
  cliente_id       uuid references clientes(id),
  canal            text not null default 'site' check (canal in ('site','whatsapp','vendedor','balcao')),
  status           text not null default 'novo' check (status in ('novo','confirmado','separado','entregue','cancelado')),
  tabela_preco     text not null default 'varejo' check (tabela_preco in ('varejo','atacado')),
  subtotal         numeric(12,2) not null default 0,
  desconto         numeric(12,2) not null default 0,
  frete            numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  forma_pagamento  text,                          -- pix, boleto, dinheiro, prazo
  parcelas         int not null default 1,
  entrega_nome     text,
  entrega_whatsapp text,
  entrega_endereco text,
  observacao       text,
  confirmado_em    timestamptz,
  criado_em        timestamptz not null default now()
);

create table if not exists pedido_itens (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid not null references pedidos(id) on delete cascade,
  produto_id  uuid not null references produtos(id),
  descricao   text not null,
  quantidade  int not null check (quantidade > 0),
  preco_unit  numeric(12,2) not null,
  total       numeric(12,2) generated always as (quantidade * preco_unit) stored
);

-- ---------------------------------------------------------------------
-- Compras / Fornecedores
-- ---------------------------------------------------------------------
create table if not exists fornecedores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  documento  text,
  contato    text,
  whatsapp   text,
  email      text,
  prazo_dias int not null default 0,
  observacoes text,
  criado_em  timestamptz not null default now()
);

create table if not exists compras (
  id             uuid primary key default gen_random_uuid(),
  fornecedor_id  uuid references fornecedores(id),
  numero_doc     text,                           -- nº da nota/pedido do fornecedor
  data           date not null default current_date,
  status         text not null default 'aberta' check (status in ('aberta','recebida','cancelada')),
  frete          numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  parcelas       int not null default 1,
  primeiro_venc  date,
  observacao     text,
  recebida_em    timestamptz,
  criado_em      timestamptz not null default now()
);
alter table lotes add constraint lotes_compra_fk foreign key (compra_id) references compras(id) on delete set null not valid;

create table if not exists compra_itens (
  id          uuid primary key default gen_random_uuid(),
  compra_id   uuid not null references compras(id) on delete cascade,
  produto_id  uuid not null references produtos(id),
  quantidade  int not null check (quantidade > 0),
  custo_unit  numeric(12,2) not null,
  lote        text,
  validade    date,
  total       numeric(12,2) generated always as (quantidade * custo_unit) stored
);

-- ---------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------
create table if not exists contas_pagar (
  id             uuid primary key default gen_random_uuid(),
  fornecedor_id  uuid references fornecedores(id),
  compra_id      uuid references compras(id) on delete set null,
  descricao      text not null,
  categoria      text not null default 'mercadoria', -- mercadoria, frete, aluguel, salario, imposto, outros
  parcela        int not null default 1,
  vencimento     date not null,
  valor          numeric(12,2) not null check (valor >= 0),
  pago_em        date,
  valor_pago     numeric(12,2),
  forma          text,
  criado_em      timestamptz not null default now()
);

create table if not exists contas_receber (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid references clientes(id),
  pedido_id       uuid references pedidos(id) on delete set null,
  descricao       text not null,
  parcela         int not null default 1,
  vencimento      date not null,
  valor           numeric(12,2) not null check (valor >= 0),
  recebido_em     date,
  valor_recebido  numeric(12,2),
  forma           text,
  criado_em       timestamptz not null default now()
);

create or replace view v_contas_pagar as
select cp.*, f.nome as fornecedor_nome,
  case when pago_em is not null then 'pago'
       when vencimento < current_date then 'vencido'
       else 'aberto' end as situacao
from contas_pagar cp left join fornecedores f on f.id = cp.fornecedor_id;

create or replace view v_contas_receber as
select cr.*, coalesce(c.fantasia, c.nome) as cliente_nome,
  case when recebido_em is not null then 'recebido'
       when vencimento < current_date then 'vencido'
       else 'aberto' end as situacao
from contas_receber cr left join clientes c on c.id = cr.cliente_id;

-- ---------------------------------------------------------------------
-- WhatsApp (Evolution API) — fila com APROVAÇÃO HUMANA obrigatória
-- ---------------------------------------------------------------------
create table if not exists whatsapp_templates (
  id        serial primary key,
  nome      text not null unique,
  texto     text not null,   -- aceita {{nome}}, {{cidade}}, {{link_loja}}
  ativo     boolean not null default true
);

create table if not exists whatsapp_mensagens (
  id              uuid primary key default gen_random_uuid(),
  numero          text not null,                 -- 5519XXXXXXXXX
  cliente_id      uuid references clientes(id) on delete set null,
  lead_id         uuid references leads(id) on delete set null,
  template_id     int references whatsapp_templates(id),
  campanha        text,
  texto           text not null,
  status          text not null default 'pendente_aprovacao'
                  check (status in ('pendente_aprovacao','aprovada','enviando','enviada','erro','cancelada')),
  aprovado_por    uuid references equipe(user_id),
  aprovado_em     timestamptz,
  enviar_apos     timestamptz,                    -- intervalo aleatório calculado na aprovação
  enviado_em      timestamptz,
  evolution_id    text,
  erro            text,
  tentativas      int not null default 0,
  criado_em       timestamptz not null default now()
);
create index if not exists wa_fila on whatsapp_mensagens(status, enviar_apos);

create table if not exists whatsapp_optout (
  numero     text primary key,
  motivo     text,
  criado_em  timestamptz not null default now()
);

create table if not exists whatsapp_recebidas (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null,
  texto       text,
  payload     jsonb,
  recebido_em timestamptz not null default now()
);

create table if not exists config (
  chave  text primary key,
  valor  jsonb not null
);

-- ---------------------------------------------------------------------
-- Regras de negócio
-- ---------------------------------------------------------------------

-- Pedido do site: preço SEMPRE recalculado no servidor (cliente não manda preço).
create or replace function criar_pedido_site(
  p_nome text, p_whatsapp text, p_endereco text, p_documento text,
  p_observacao text, p_itens jsonb        -- [{"produto_id": "...", "quantidade": 2}]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cliente uuid; v_pedido uuid; v_numero bigint; v_sub numeric := 0;
  v_tabela text := 'varejo'; it jsonb; pr produtos; v_qtd int; v_preco numeric;
  v_wa text := regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g');
begin
  if coalesce(trim(p_nome),'') = '' or length(v_wa) < 10 then
    raise exception 'Informe nome e WhatsApp válidos';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 100 then
    raise exception 'Carrinho vazio ou inválido';
  end if;
  if length(v_wa) <= 11 then v_wa := '55' || v_wa; end if;

  select id, tabela_preco into v_cliente, v_tabela from clientes where whatsapp = v_wa limit 1;
  if v_cliente is null then
    insert into clientes (nome, whatsapp, endereco, documento, origem, tabela_preco, etapa_id)
    values (trim(p_nome), v_wa, p_endereco, nullif(regexp_replace(coalesce(p_documento,''),'\D','','g'),''), 'site',
            case when length(regexp_replace(coalesce(p_documento,''),'\D','','g')) = 14 then 'atacado' else 'varejo' end,
            (select id from crm_etapas order by ordem limit 1))
    returning id, tabela_preco into v_cliente, v_tabela;
  end if;

  insert into pedidos (cliente_id, canal, tabela_preco, entrega_nome, entrega_whatsapp, entrega_endereco, observacao)
  values (v_cliente, 'site', v_tabela, trim(p_nome), v_wa, p_endereco, left(p_observacao, 1000))
  returning id, numero into v_pedido, v_numero;

  for it in select * from jsonb_array_elements(p_itens) loop
    select * into pr from produtos where id = (it->>'produto_id')::uuid and ativo;
    if not found then raise exception 'Produto indisponível'; end if;
    v_qtd := greatest(1, least(9999, (it->>'quantidade')::int));
    v_preco := case when v_tabela = 'atacado' and pr.preco_atacado is not null and v_qtd >= pr.pedido_minimo_atacado
                    then pr.preco_atacado else pr.preco_varejo end;
    insert into pedido_itens (pedido_id, produto_id, descricao, quantidade, preco_unit)
    values (v_pedido, pr.id, pr.nome, v_qtd, v_preco);
    v_sub := v_sub + v_qtd * v_preco;
  end loop;

  update pedidos set subtotal = v_sub, total = v_sub where id = v_pedido;
  return jsonb_build_object('pedido_id', v_pedido, 'numero', v_numero, 'total', v_sub);
end $$;

-- Confirmar pedido: baixa estoque (FEFO) e gera contas a receber.
create or replace function confirmar_pedido(p_pedido uuid, p_forma text default 'pix',
                                            p_parcelas int default 1, p_primeiro_venc date default current_date)
returns void language plpgsql security definer set search_path = public as $$
declare ped pedidos; it record; lt record; resta int; i int; v_parc numeric;
begin
  if not eh_equipe() then raise exception 'Sem permissão'; end if;
  select * into ped from pedidos where id = p_pedido for update;
  if ped.status <> 'novo' then raise exception 'Pedido já processado'; end if;

  for it in select * from pedido_itens where pedido_id = p_pedido loop
    resta := it.quantidade;
    for lt in select * from lotes where produto_id = it.produto_id and quantidade > 0
              order by validade nulls last, criado_em for update loop
      exit when resta = 0;
      if lt.quantidade >= resta then
        update lotes set quantidade = quantidade - resta where id = lt.id; resta := 0;
      else
        resta := resta - lt.quantidade; update lotes set quantidade = 0 where id = lt.id;
      end if;
    end loop;
    -- estoque insuficiente não bloqueia (venda sob encomenda), apenas fica negativo no relatório
  end loop;

  p_parcelas := greatest(1, p_parcelas);
  v_parc := round(ped.total / p_parcelas, 2);
  for i in 1..p_parcelas loop
    insert into contas_receber (cliente_id, pedido_id, descricao, parcela, vencimento, valor, forma)
    values (ped.cliente_id, ped.id, 'Pedido #' || ped.numero, i,
            p_primeiro_venc + ((i-1) * 30),
            case when i = p_parcelas then ped.total - v_parc * (p_parcelas-1) else v_parc end, p_forma);
  end loop;

  update pedidos set status = 'confirmado', confirmado_em = now(), forma_pagamento = p_forma, parcelas = p_parcelas
  where id = p_pedido;
  insert into crm_atividades (cliente_id, tipo, texto, autor_id)
  values (ped.cliente_id, 'pedido', 'Pedido #' || ped.numero || ' confirmado — R$ ' || ped.total, auth.uid());
end $$;

-- Receber compra: entra estoque em lotes, atualiza custo médio, gera contas a pagar.
create or replace function receber_compra(p_compra uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c compras; it record; i int; v_parc numeric; v_total numeric;
begin
  if not eh_equipe() then raise exception 'Sem permissão'; end if;
  select * into c from compras where id = p_compra for update;
  if c.status <> 'aberta' then raise exception 'Compra já processada'; end if;

  for it in select * from compra_itens where compra_id = p_compra loop
    insert into lotes (produto_id, lote, validade, quantidade, custo_unit, compra_id)
    values (it.produto_id, it.lote, it.validade, it.quantidade, it.custo_unit, p_compra);
    update produtos p set custo_medio = round(
      ((select coalesce(sum(quantidade),0) from lotes where produto_id = p.id and compra_id is distinct from p_compra) * p.custo_medio
        + it.quantidade * it.custo_unit)
      / nullif((select coalesce(sum(quantidade),0) from lotes where produto_id = p.id), 0), 2),
      atualizado_em = now()
    where p.id = it.produto_id;
  end loop;

  select coalesce(sum(total),0) + c.frete into v_total from compra_itens where compra_id = p_compra;
  c.parcelas := greatest(1, c.parcelas);
  v_parc := round(v_total / c.parcelas, 2);
  for i in 1..c.parcelas loop
    insert into contas_pagar (fornecedor_id, compra_id, descricao, parcela, vencimento, valor)
    values (c.fornecedor_id, c.id, 'Compra ' || coalesce(c.numero_doc, left(c.id::text, 8)), i,
            coalesce(c.primeiro_venc, current_date) + ((i-1) * 30),
            case when i = c.parcelas then v_total - v_parc * (c.parcelas-1) else v_parc end);
  end loop;
  update compras set status = 'recebida', recebida_em = now(), total = v_total where id = p_compra;
end $$;

-- Converter lead em cliente (CRM)
create or replace function converter_lead(p_lead uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare l leads; v_cli uuid;
begin
  if not eh_equipe() then raise exception 'Sem permissão'; end if;
  select * into l from leads where id = p_lead;
  if l.cliente_id is not null then return l.cliente_id; end if;
  insert into clientes (nome, fantasia, categoria, whatsapp, telefone, endereco, bairro, cidade, cep, lat, lon,
                        origem, lead_id, tabela_preco, etapa_id)
  values (l.nome, l.nome, l.categoria, l.whatsapp, l.telefone, l.endereco, l.bairro, l.cidade, l.cep, l.lat, l.lon,
          'lead', l.id, 'atacado', (select id from crm_etapas order by ordem limit 1))
  returning id into v_cli;
  update leads set status = 'convertido', cliente_id = v_cli, atualizado_em = now() where id = p_lead;
  return v_cli;
end $$;

-- Aprovar lote de mensagens: espalha envios com intervalo aleatório e respeita opt-out.
create or replace function aprovar_mensagens(p_ids uuid[], p_intervalo_min int default 45, p_intervalo_max int default 180)
returns int language plpgsql security definer set search_path = public as $$
declare r record; t timestamptz := now(); n int := 0;
begin
  if not eh_equipe() then raise exception 'Sem permissão'; end if;
  for r in select m.id, m.numero from whatsapp_mensagens m
           where m.id = any(p_ids) and m.status = 'pendente_aprovacao' order by m.criado_em loop
    if exists (select 1 from whatsapp_optout o where o.numero = r.numero)
       or exists (select 1 from clientes c where c.whatsapp = r.numero and c.opt_out) then
      update whatsapp_mensagens set status = 'cancelada', erro = 'opt-out' where id = r.id;
      continue;
    end if;
    t := t + make_interval(secs => p_intervalo_min + floor(random() * (p_intervalo_max - p_intervalo_min)));
    update whatsapp_mensagens set status = 'aprovada', aprovado_por = auth.uid(), aprovado_em = now(), enviar_apos = t
    where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- RLS: loja pública só lê catálogo; todo o resto é da equipe.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['equipe','categorias','produtos','lotes','leads','crm_etapas','clientes','crm_atividades',
    'pedidos','pedido_itens','fornecedores','compras','compra_itens','contas_pagar','contas_receber',
    'whatsapp_templates','whatsapp_mensagens','whatsapp_optout','whatsapp_recebidas','config'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists equipe_tudo on %I', t);
    execute format('create policy equipe_tudo on %I for all to authenticated using (eh_equipe()) with check (eh_equipe())', t);
  end loop;
end $$;

drop policy if exists publico_le_produtos on produtos;
create policy publico_le_produtos on produtos for select to anon, authenticated using (ativo);
drop policy if exists publico_le_categorias on categorias;
create policy publico_le_categorias on categorias for select to anon, authenticated using (true);

-- Só admin mexe na equipe e em config
drop policy if exists equipe_tudo on equipe;
create policy equipe_le on equipe for select to authenticated using (eh_equipe());
create policy admin_gerencia_equipe on equipe for all to authenticated using (eh_admin()) with check (eh_admin());
drop policy if exists equipe_tudo on config;
create policy admin_config on config for all to authenticated using (eh_admin()) with check (eh_admin());

-- Views herdam permissão de quem consulta
alter view v_estoque set (security_invoker = on);
alter view v_contas_pagar set (security_invoker = on);
alter view v_contas_receber set (security_invoker = on);

revoke all on function criar_pedido_site(text,text,text,text,text,jsonb) from public;
grant execute on function criar_pedido_site(text,text,text,text,text,jsonb) to anon, authenticated;
revoke all on function confirmar_pedido(uuid,text,int,date) from public, anon;
revoke all on function receber_compra(uuid) from public, anon;
revoke all on function converter_lead(uuid) from public, anon;
revoke all on function aprovar_mensagens(uuid[],int,int) from public, anon;
grant execute on function confirmar_pedido(uuid,text,int,date), receber_compra(uuid), converter_lead(uuid),
  aprovar_mensagens(uuid[],int,int) to authenticated;

-- Storage: bucket público de imagens de produtos (upload só da equipe)
insert into storage.buckets (id, name, public) values ('produtos', 'produtos', true) on conflict (id) do nothing;
drop policy if exists equipe_sobe_imagens on storage.objects;
create policy equipe_sobe_imagens on storage.objects for all to authenticated
  using (bucket_id = 'produtos' and public.eh_equipe()) with check (bucket_id = 'produtos' and public.eh_equipe());
