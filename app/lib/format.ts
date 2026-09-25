// Formatação e utilidades compartilhadas (cliente e servidor)

export const TZ = "America/Sao_Paulo";

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function brl(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return brlFmt.format(Number.isFinite(n) ? (n as number) : 0);
}

export function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** 'YYYY-MM-DD' de hoje no fuso de São Paulo */
export function hojeISO(offsetDias = 0): string {
  const d = new Date(Date.now() + offsetDias * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Soma dias a uma data 'YYYY-MM-DD' (sem problemas de fuso) */
export function addDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/** Formata 'YYYY-MM-DD' (date) sem conversão de fuso */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Formata timestamp (timestamptz) no fuso de São Paulo */
export function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Normaliza WhatsApp brasileiro para E.164 sem '+', ex.: 5519999999999 */
export function normalizarWhatsapp(s: string | null | undefined): string {
  let d = soDigitos(s);
  if (!d) return "";
  d = d.replace(/^0+/, "");
  if (d.length <= 11) d = "55" + d;
  return d;
}

/** Variações do número BR com/sem o 9º dígito (o WhatsApp às vezes omite o 9) */
export function variacoesNumero(numero: string): string[] {
  const d = soDigitos(numero);
  const set = new Set<string>([d]);
  if (d.startsWith("55")) {
    if (d.length === 13 && d[4] === "9") set.add(d.slice(0, 4) + d.slice(5));
    if (d.length === 12) set.add(d.slice(0, 4) + "9" + d.slice(4));
  }
  return [...set].filter(Boolean);
}

export function formatarTelefone(s: string | null | undefined): string {
  let d = soDigitos(s);
  if (!d) return "—";
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s ?? d;
}

export function formatarDocumento(s: string | null | undefined): string {
  const d = soDigitos(s);
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return s || "—";
}

/** Link wa.me com texto opcional */
export function linkWhatsapp(numero: string | null | undefined, texto?: string): string {
  const n = normalizarWhatsapp(numero);
  const q = texto ? `?text=${encodeURIComponent(texto)}` : "";
  return `https://wa.me/${n}${q}`;
}

export function preencherTemplate(texto: string, vars: Record<string, string | null | undefined>): string {
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

/** Preço unitário estimado conforme a tabela (a regra definitiva está no banco) */
export function precoEstimado(
  p: { preco_varejo: number; preco_atacado: number | null; pedido_minimo_atacado: number },
  qtd: number,
  tabela: "varejo" | "atacado",
): number {
  if (tabela === "atacado" && p.preco_atacado != null && qtd >= p.pedido_minimo_atacado) return Number(p.preco_atacado);
  return Number(p.preco_varejo);
}

export function mensagemErro(e: unknown): string {
  if (!e) return "Erro desconhecido";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as { message: unknown }).message);
  return "Erro desconhecido";
}

export const STATUS_PEDIDO: Record<string, { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-blue-100 text-blue-800" },
  confirmado: { label: "Confirmado", cls: "bg-yellow-100 text-yellow-800" },
  separado: { label: "Separado", cls: "bg-purple-100 text-purple-800" },
  entregue: { label: "Entregue", cls: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelado", cls: "bg-gray-200 text-gray-600" },
};

export const STATUS_LEAD: Record<string, { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-blue-100 text-blue-800" },
  qualificado: { label: "Qualificado", cls: "bg-yellow-100 text-yellow-800" },
  contatado: { label: "Contatado", cls: "bg-purple-100 text-purple-800" },
  descartado: { label: "Descartado", cls: "bg-gray-200 text-gray-600" },
  convertido: { label: "Convertido", cls: "bg-green-100 text-green-800" },
};

export const STATUS_WA: Record<string, { label: string; cls: string }> = {
  pendente_aprovacao: { label: "Pendente", cls: "bg-yellow-100 text-yellow-800" },
  aprovada: { label: "Aprovada", cls: "bg-blue-100 text-blue-800" },
  enviando: { label: "Enviando", cls: "bg-purple-100 text-purple-800" },
  enviada: { label: "Enviada", cls: "bg-green-100 text-green-800" },
  erro: { label: "Erro", cls: "bg-red-100 text-red-800" },
  cancelada: { label: "Cancelada", cls: "bg-gray-200 text-gray-600" },
};

export const CANAIS: Record<string, string> = { site: "Site", whatsapp: "WhatsApp", vendedor: "Vendedor", balcao: "Balcão" };
export const FORMAS_PAGAMENTO = [
  { v: "pix", l: "PIX" },
  { v: "dinheiro", l: "Dinheiro" },
  { v: "boleto", l: "Boleto" },
  { v: "prazo", l: "A prazo" },
  { v: "cartao", l: "Cartão" },
  { v: "transferencia", l: "Transferência" },
];
export const CATEGORIAS_CLIENTE = ["padaria", "lanchonete", "bar", "mercearia", "conveniencia", "cafeteria", "doceria", "mercado", "outro"];

/** Início do dia (00:00 em São Paulo) como ISO com offset. Brasil sem horário de verão desde 2019. */
export function inicioDiaSP(isoDate: string): string {
  return `${isoDate}T00:00:00-03:00`;
}
