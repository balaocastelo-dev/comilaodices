-- Dados iniciais Doces Komilão
insert into categorias (nome, slug, ordem) values
  ('Doces e Balas', 'doces-e-balas', 1),
  ('Salgadinhos', 'salgadinhos', 2),
  ('Saudáveis', 'saudaveis', 3)
on conflict (slug) do nothing;

-- 7 produtos únicos (a lista original tinha 4 repetidos).
-- preco_varejo = preço informado. preco_atacado fica NULL até o cliente definir a tabela B2B.
-- imagem_url fica NULL: subir fotos próprias/oficiais pelo painel (não usar imagens de outra loja).
insert into produtos (sku, nome, marca, categoria_id, unidade, preco_varejo, destaque) values
  ('KMO-0001', 'Maria Mole pote com 20 unidades', 'Clamel', (select id from categorias where slug='doces-e-balas'), 'pote', 19.95, true),
  ('KMO-0002', 'Batata Ruffles Sour Cream e Cebola 100g', 'Ruffles', (select id from categorias where slug='salgadinhos'), 'pacote', 9.99, false),
  ('KMO-0003', 'Gelatina Pulseira Mágica 12 pacotes 15g', 'Docile', (select id from categorias where slug='doces-e-balas'), 'pacote', 10.75, true),
  ('KMO-0004', 'Granola com Nuts e Cereais Premium Sem Glúten 400g', 'DaColônia', (select id from categorias where slug='saudaveis'), 'pacote', 36.50, false),
  ('KMO-0005', 'Suspiro Caseiro sabor Leite Condensado 100g', 'Ke-Delícia', (select id from categorias where slug='doces-e-balas'), 'pacote', 4.05, false),
  ('KMO-0006', 'Batata Ruffles Original 100g', 'Elma Chips', (select id from categorias where slug='salgadinhos'), 'pacote', 9.99, false),
  ('KMO-0007', 'Pirulito sabor Framboesa pacote 500g', '7 Belo', (select id from categorias where slug='doces-e-balas'), 'pacote', 9.65, true)
on conflict (sku) do nothing;

insert into crm_etapas (nome, ordem, cor) values
  ('Novo', 1, '#9CA3AF'),
  ('Contato feito', 2, '#3B82F6'),
  ('Interessado', 3, '#FFBB12'),
  ('Pedido teste', 4, '#F97316'),
  ('Cliente ativo', 5, '#22C55E'),
  ('Inativo', 6, '#EF4444')
on conflict (nome) do nothing;

insert into whatsapp_templates (nome, texto) values
  ('Primeiro contato',
   'Olá, {{nome}}! 😋 Aqui é da *Doces Komilão*, distribuidora de doces e salgadinhos aqui de {{cidade}}. '
   || 'Trabalhamos com Maria Mole, pirulitos, gelatinas, Ruffles e mais, com preço de atacado para padarias, lanchonetes e bares. '
   || 'Posso te mandar nossa tabela? Catálogo: {{link_loja}}' || chr(10) || chr(10)
   || '_Se não quiser receber mensagens, responda SAIR._'),
  ('Follow-up',
   'Oi, {{nome}}! Passando pra saber se conseguiu ver nosso catálogo 🍭 {{link_loja}} — posso separar um pedido teste pra você?'
   || chr(10) || chr(10) || '_Responda SAIR para não receber mais mensagens._'),
  ('Pedido confirmado',
   'Pedido confirmado! ✅ Obrigado pela preferência, {{nome}}. Em breve avisamos a entrega. — Doces Komilão')
on conflict (nome) do nothing;

insert into config (chave, valor) values
  ('whatsapp_limite_diario', '40'::jsonb),
  ('whatsapp_horario', '{"inicio": "09:00", "fim": "18:00", "dias": [1,2,3,4,5,6]}'::jsonb),
  ('loja', '{"nome": "Doces Komilão", "whatsapp": "", "cidade": "Campinas", "link": "https://komilaodoces.com.br"}'::jsonb)
on conflict (chave) do nothing;
