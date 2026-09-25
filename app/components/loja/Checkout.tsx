"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Info, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "./CartProvider";
import { ProductImage } from "./ProductImage";
import { createClient } from "@/lib/supabase/client";
import { brl, mensagemErro, precoEstimado, soDigitos } from "@/lib/format";
import { supabaseConfigurado } from "@/lib/env";

export const CHAVE_ULTIMO_PEDIDO = "komilao:ultimo-pedido";

export type UltimoPedido = {
  numero: number;
  total: number;
  nome: string;
  itens: { nome: string; quantidade: number }[];
};

export function Checkout() {
  const router = useRouter();
  const { itens, carregado, alterarQtd, remover, limpar } = useCart();
  const [form, setForm] = useState({ nome: "", whatsapp: "", cnpj: "", endereco: "", observacao: "" });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cnpjDigitos = soDigitos(form.cnpj);
  const temCnpj = cnpjDigitos.length === 14;
  const tabela = temCnpj ? "atacado" : "varejo";

  const linhas = useMemo(
    () =>
      itens.map((i) => {
        const unit = precoEstimado(i, i.quantidade, tabela);
        return { ...i, unit, total: unit * i.quantidade, atacadoAplicado: tabela === "atacado" && unit !== Number(i.preco_varejo) };
      }),
    [itens, tabela],
  );
  const total = linhas.reduce((s, l) => s + l.total, 0);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!supabaseConfigurado) return setErro("Loja em manutenção. Chame a gente no WhatsApp!");
    if (!form.nome.trim()) return setErro("Informe seu nome ou o nome do estabelecimento.");
    if (soDigitos(form.whatsapp).length < 10) return setErro("Informe um WhatsApp válido com DDD.");
    if (cnpjDigitos && cnpjDigitos.length !== 14) return setErro("CNPJ deve ter 14 dígitos (ou deixe em branco).");
    if (!form.endereco.trim()) return setErro("Informe o endereço de entrega.");
    if (!itens.length) return setErro("Seu carrinho está vazio.");

    setEnviando(true);
    try {
      const { data, error } = await createClient().rpc("criar_pedido_site", {
        p_nome: form.nome.trim(),
        p_whatsapp: form.whatsapp,
        p_endereco: form.endereco.trim(),
        p_documento: cnpjDigitos || null,
        p_observacao: form.observacao.trim() || null,
        p_itens: itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
      });
      if (error) throw error;
      const r = data as { pedido_id: string; numero: number; total: number };
      const resumo: UltimoPedido = {
        numero: r.numero,
        total: Number(r.total),
        nome: form.nome.trim(),
        itens: itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade })),
      };
      try {
        window.localStorage.setItem(CHAVE_ULTIMO_PEDIDO, JSON.stringify(resumo));
      } catch {
        /* ignore */
      }
      limpar();
      router.push(`/pedido/sucesso?numero=${r.numero}&total=${Number(r.total).toFixed(2)}`);
    } catch (err) {
      const msg = mensagemErro(err);
      setErro(
        /duplicate key|clientes_documento_uk/i.test(msg)
          ? "Este CNPJ já está cadastrado com outro WhatsApp. Use o WhatsApp cadastrado ou fale com a gente."
          : msg.includes("indisponível")
            ? "Algum produto do carrinho ficou indisponível. Remova-o e tente novamente."
            : `Não foi possível enviar o pedido: ${msg}`,
      );
    } finally {
      setEnviando(false);
    }
  }

  if (!carregado) {
    return <div className="py-20 text-center text-komi-ink/60">Carregando carrinho…</div>;
  }

  if (!itens.length) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center">
        <div className="text-6xl">🛒</div>
        <p className="mt-3 text-xl font-semibold">Seu carrinho está vazio</p>
        <p className="text-komi-ink/60">Bora encher de gostosuras?</p>
        <Link href="/produtos" className="btn-loja-primary mt-5">
          Ver produtos
        </Link>
      </div>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="space-y-3">
        {linhas.map((l) => (
          <div key={l.produto_id} className="flex gap-3 rounded-3xl bg-white p-3 ring-2 ring-komi-ink/5">
            <Link href={`/produto/${l.produto_id}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
              <ProductImage nome={l.nome} url={l.imagem_url} categoriaSlug={l.categoria_slug} tamanho="sm" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="line-clamp-2 font-semibold leading-snug">{l.nome}</div>
              <div className="text-sm text-komi-ink/60">
                {brl(l.unit)} / {l.unidade}
                {l.atacadoAplicado && <span className="ml-2 rounded-full bg-komi-green/15 px-2 text-xs font-semibold text-komi-green">atacado</span>}
              </div>
              {temCnpj && l.preco_atacado != null && !l.atacadoAplicado && (
                <div className="text-xs text-komi-purple">
                  Atacado ({brl(l.preco_atacado)}) a partir de {l.pedido_minimo_atacado} un.
                </div>
              )}
              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                <div className="flex items-center rounded-full ring-2 ring-komi-ink/10">
                  <button type="button" className="p-1.5" onClick={() => alterarQtd(l.produto_id, l.quantidade - 1)} aria-label="Diminuir">
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    value={l.quantidade}
                    min={1}
                    onChange={(e) => alterarQtd(l.produto_id, Math.max(1, Number(e.target.value) || 1))}
                    className="w-12 bg-transparent text-center font-semibold outline-none [appearance:textfield]"
                    aria-label="Quantidade"
                  />
                  <button type="button" className="p-1.5" onClick={() => alterarQtd(l.produto_id, l.quantidade + 1)} aria-label="Aumentar">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="font-bold">{brl(l.total)}</div>
                <button type="button" onClick={() => remover(l.produto_id)} className="p-1.5 text-komi-ink/40 hover:text-komi-red" aria-label="Remover">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={enviar} className="h-fit space-y-3 rounded-3xl bg-white p-5 ring-2 ring-komi-ink/5 lg:sticky lg:top-24">
        <h2 className="text-xl font-bold">Seus dados</h2>
        <div>
          <label className="mb-1 block text-sm font-semibold">Nome / estabelecimento *</label>
          <input className="input-loja" value={form.nome} onChange={set("nome")} maxLength={120} autoComplete="organization" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">WhatsApp com DDD *</label>
          <input className="input-loja" value={form.whatsapp} onChange={set("whatsapp")} inputMode="tel" placeholder="(19) 99999-9999" autoComplete="tel" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">CNPJ (opcional)</label>
          <input className="input-loja" value={form.cnpj} onChange={set("cnpj")} inputMode="numeric" placeholder="00.000.000/0000-00" />
          <p className="mt-1 flex gap-1.5 text-xs text-komi-ink/60">
            <Info size={14} className="mt-0.5 shrink-0" />
            Com CNPJ, seu pedido usa a <b>tabela de atacado</b> nos itens que atingem o pedido mínimo. Se você já é cliente, vale a tabela do seu
            cadastro.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Endereço de entrega *</label>
          <textarea className="input-loja" rows={2} value={form.endereco} onChange={set("endereco")} maxLength={300} placeholder="Rua, número, bairro, cidade" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Observação</label>
          <textarea className="input-loja" rows={2} value={form.observacao} onChange={set("observacao")} maxLength={1000} placeholder="Horário para entrega, forma de pagamento..." />
        </div>

        <div className="rounded-2xl bg-komi-yellow-soft p-4">
          <div className="flex items-center justify-between text-sm">
            <span>Tabela</span>
            <b className={temCnpj ? "text-komi-green" : ""}>{temCnpj ? "Atacado (CNPJ)" : "Varejo"}</b>
          </div>
          <div className="mt-1 flex items-center justify-between text-xl font-bold">
            <span>Total estimado</span>
            <span className="text-komi-red">{brl(total)}</span>
          </div>
          <p className="mt-1 text-xs text-komi-ink/60">O valor final é conferido pelo sistema e confirmado pela loja no WhatsApp. Frete combinado na confirmação.</p>
        </div>

        {erro && <div className="rounded-2xl bg-komi-red/10 p-3 text-sm font-semibold text-komi-red">{erro}</div>}

        <button type="submit" disabled={enviando} className="btn-loja-primary w-full text-lg">
          {enviando && <Loader2 className="animate-spin" size={20} />}
          {enviando ? "Enviando…" : "Finalizar pedido"}
        </button>
      </form>
    </div>
  );
}
