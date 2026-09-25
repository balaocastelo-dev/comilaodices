// Tipos das tabelas/views do Supabase (espelham supabase/migrations/0001_schema.sql)

export type Categoria = { id: number; nome: string; slug: string; ordem: number };

export type Produto = {
  id: string;
  sku: string | null;
  nome: string;
  marca: string | null;
  categoria_id: number | null;
  descricao: string | null;
  unidade: string;
  qtd_por_caixa: number;
  preco_varejo: number;
  preco_atacado: number | null;
  pedido_minimo_atacado: number;
  custo_medio: number;
  estoque_minimo: number;
  imagem_url: string | null;
  ativo: boolean;
  destaque: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type Lote = {
  id: string;
  produto_id: string;
  lote: string | null;
  validade: string | null;
  quantidade: number;
  custo_unit: number;
  compra_id: string | null;
  criado_em: string;
};

export type EstoqueRow = {
  produto_id: string;
  nome: string;
  sku: string | null;
  estoque_minimo: number;
  estoque: number;
  proxima_validade: string | null;
};

export type LeadStatus = "novo" | "qualificado" | "contatado" | "descartado" | "convertido";
export type Lead = {
  id: string;
  fonte: string;
  fonte_id: string | null;
  nome: string;
  categoria: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  lat: number | null;
  lon: number | null;
  telefone: string | null;
  whatsapp: string | null;
  site: string | null;
  instagram: string | null;
  horario: string | null;
  score: number;
  status: LeadStatus;
  motivo_descarte: string | null;
  cliente_id: string | null;
  dados: Record<string, unknown>;
  capturado_em: string;
  atualizado_em: string;
};

export type CrmEtapa = { id: number; nome: string; ordem: number; cor: string };

export type Cliente = {
  id: string;
  tipo: "PJ" | "PF";
  nome: string;
  fantasia: string | null;
  documento: string | null;
  categoria: string | null;
  contato_nome: string | null;
  whatsapp: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  lat: number | null;
  lon: number | null;
  etapa_id: number | null;
  vendedor_id: string | null;
  tabela_preco: "varejo" | "atacado";
  prazo_dias: number;
  limite_credito: number;
  opt_out: boolean;
  origem: string;
  lead_id: string | null;
  auth_user_id: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type AtividadeTipo = "nota" | "whatsapp" | "ligacao" | "visita" | "pedido" | "tarefa";
export type CrmAtividade = {
  id: string;
  cliente_id: string | null;
  lead_id: string | null;
  tipo: AtividadeTipo;
  texto: string;
  agendado_para: string | null;
  concluido: boolean;
  autor_id: string | null;
  criado_em: string;
};

export type PedidoStatus = "novo" | "confirmado" | "separado" | "entregue" | "cancelado";
export type Pedido = {
  id: string;
  numero: number;
  cliente_id: string | null;
  canal: "site" | "whatsapp" | "vendedor" | "balcao";
  status: PedidoStatus;
  tabela_preco: "varejo" | "atacado";
  subtotal: number;
  desconto: number;
  frete: number;
  total: number;
  forma_pagamento: string | null;
  parcelas: number;
  entrega_nome: string | null;
  entrega_whatsapp: string | null;
  entrega_endereco: string | null;
  observacao: string | null;
  confirmado_em: string | null;
  criado_em: string;
};

export type PedidoItem = {
  id: string;
  pedido_id: string;
  produto_id: string;
  descricao: string;
  quantidade: number;
  preco_unit: number;
  total: number;
};

export type Fornecedor = {
  id: string;
  nome: string;
  documento: string | null;
  contato: string | null;
  whatsapp: string | null;
  email: string | null;
  prazo_dias: number;
  observacoes: string | null;
  criado_em: string;
};

export type Compra = {
  id: string;
  fornecedor_id: string | null;
  numero_doc: string | null;
  data: string;
  status: "aberta" | "recebida" | "cancelada";
  frete: number;
  total: number;
  parcelas: number;
  primeiro_venc: string | null;
  observacao: string | null;
  recebida_em: string | null;
  criado_em: string;
};

export type CompraItem = {
  id: string;
  compra_id: string;
  produto_id: string;
  quantidade: number;
  custo_unit: number;
  lote: string | null;
  validade: string | null;
  total: number;
};

export type ContaPagar = {
  id: string;
  fornecedor_id: string | null;
  compra_id: string | null;
  descricao: string;
  categoria: string;
  parcela: number;
  vencimento: string;
  valor: number;
  pago_em: string | null;
  valor_pago: number | null;
  forma: string | null;
  criado_em: string;
  fornecedor_nome?: string | null;
  situacao?: "aberto" | "vencido" | "pago";
};

export type ContaReceber = {
  id: string;
  cliente_id: string | null;
  pedido_id: string | null;
  descricao: string;
  parcela: number;
  vencimento: string;
  valor: number;
  recebido_em: string | null;
  valor_recebido: number | null;
  forma: string | null;
  criado_em: string;
  cliente_nome?: string | null;
  situacao?: "aberto" | "vencido" | "recebido";
};

export type WaTemplate = { id: number; nome: string; texto: string; ativo: boolean };

export type WaStatus = "pendente_aprovacao" | "aprovada" | "enviando" | "enviada" | "erro" | "cancelada";
export type WaMensagem = {
  id: string;
  numero: string;
  cliente_id: string | null;
  lead_id: string | null;
  template_id: number | null;
  campanha: string | null;
  texto: string;
  status: WaStatus;
  aprovado_por: string | null;
  aprovado_em: string | null;
  enviar_apos: string | null;
  enviado_em: string | null;
  evolution_id: string | null;
  erro: string | null;
  tentativas: number;
  criado_em: string;
};

export type WaOptout = { numero: string; motivo: string | null; criado_em: string };
export type WaRecebida = { id: string; numero: string; texto: string | null; recebido_em: string };

export type Equipe = { user_id: string; nome: string; papel: "admin" | "vendedor" | "financeiro"; ativo: boolean; criado_em: string };

export type CarrinhoItem = {
  produto_id: string;
  nome: string;
  preco_varejo: number;
  preco_atacado: number | null;
  pedido_minimo_atacado: number;
  unidade: string;
  imagem_url: string | null;
  categoria_slug?: string | null;
  quantidade: number;
};
