"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { BuscaCliente } from "@/components/admin/BuscaCliente";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { brl, num, precoEstimado } from "@/lib/format";
import type { Cliente, Produto } from "@/lib/types";

type Linha = { key: number; produto_id: string; quantidade: number; preco_unit: number };

export function NovoPedido({ produtos, clienteInicial = null }: { produtos: Produto[]; clienteInicial?: Cliente | null }) {
  const router = useRouter();
  const { executar, carregando, erro, setErro } = useAcao();
  const [cliente, setCliente] = useState<Cliente | null>(clienteInicial);
  const [canal, setCanal] = useState<"vendedor" | "whatsapp" | "balcao">("vendedor");
  const [tabela, setTabela] = useState<"varejo" | "atacado">(clienteInicial?.tabela_preco ?? "atacado");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [frete, setFrete] = useState(0);
  const [endereco, setEndereco] = useState(clienteInicial ? [clienteInicial.endereco, clienteInicial.bairro, clienteInicial.cidade].filter(Boolean).join(", ") : "");
  const [obs, setObs] = useState("");
  const [addId, setAddId] = useState("");
  const mapa = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  function escolherCliente(c: Cliente | null) {
    setCliente(c);
    if (c) {
      setTabela(c.tabela_preco);
      setEndereco([c.endereco, c.bairro, c.cidade].filter(Boolean).join(", "));
      setLinhas((ls) => ls.map((l) => recalc(l, c.tabela_preco)));
    }
  }

  function recalc(l: Linha, t = tabela): Linha {
    const p = mapa.get(l.produto_id);
    return p ? { ...l, preco_unit: precoEstimado(p, l.quantidade, t) } : l;
  }

  function adicionar() {
    const p = mapa.get(addId);
    if (!p) return;
    setLinhas((ls) => {
      const ex = ls.find((l) => l.produto_id === p.id);
      if (ex) return ls.map((l) => (l.produto_id === p.id ? recalc({ ...l, quantidade: l.quantidade + 1 }) : l));
      const q = tabela === "atacado" ? Math.max(1, p.pedido_minimo_atacado) : 1;
      return [...ls, { key: Date.now(), produto_id: p.id, quantidade: q, preco_unit: precoEstimado(p, q, tabela) }];
    });
    setAddId("");
  }

  const subtotal = linhas.reduce((s, l) => s + l.quantidade * l.preco_unit, 0);
  const total = Math.max(0, subtotal - desconto + frete);

  async function salvar() {
    setErro(null);
    if (!cliente) return setErro("Escolha o cliente.");
    if (!linhas.length) return setErro("Adicione ao menos um produto.");
    const sb = createClient();
    const r = await executar(
      async () => {
        const { data: ped } = ok(
          await sb
            .from("pedidos")
            .insert({
              cliente_id: cliente.id,
              canal,
              tabela_preco: tabela,
              subtotal: round(subtotal),
              desconto: round(desconto),
              frete: round(frete),
              total: round(total),
              entrega_nome: cliente.fantasia || cliente.nome,
              entrega_whatsapp: cliente.whatsapp,
              entrega_endereco: endereco || null,
              observacao: obs || null,
            })
            .select("id")
            .single(),
        );
        const pedidoId = (ped as { id: string }).id;
        const ins = await sb.from("pedido_itens").insert(
          linhas.map((l) => ({ pedido_id: pedidoId, produto_id: l.produto_id, descricao: mapa.get(l.produto_id)?.nome ?? "Produto", quantidade: l.quantidade, preco_unit: round(l.preco_unit) })),
        );
        if (ins.error) {
          await sb.from("pedidos").delete().eq("id", pedidoId);
          throw new Error(ins.error.message);
        }
        return pedidoId;
      },
      { refresh: false },
    );
    if (r) router.push(`/admin/pedidos/${r}`);
  }

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 p-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="label">Cliente *</label>
          <BuscaCliente valor={cliente} onSelecionar={escolherCliente} />
          <Link href="/admin/clientes?novo=1" className="mt-1 inline-block text-xs text-blue-600 hover:underline">
            + cadastrar novo cliente
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Canal</label>
            <select className="input" value={canal} onChange={(e) => setCanal(e.target.value as typeof canal)}>
              <option value="vendedor">Vendedor</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="balcao">Balcão</option>
            </select>
          </div>
          <div>
            <label className="label">Tabela</label>
            <select
              className="input"
              value={tabela}
              onChange={(e) => {
                const t = e.target.value as "varejo" | "atacado";
                setTabela(t);
                setLinhas((ls) => ls.map((l) => recalc(l, t)));
              }}
            >
              <option value="atacado">Atacado</option>
              <option value="varejo">Varejo</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex flex-wrap gap-2 border-b border-gray-200 p-3">
          <select className="input max-w-md flex-1" value={addId} onChange={(e) => setAddId(e.target.value)}>
            <option value="">Selecione um produto…</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} — var. {brl(p.preco_varejo)}
                {p.preco_atacado != null ? ` / atac. ${brl(p.preco_atacado)} (mín. ${p.pedido_minimo_atacado})` : ""}
              </option>
            ))}
          </select>
          <button type="button" className="btn-primary" onClick={adicionar} disabled={!addId}>
            <Plus size={16} /> Adicionar
          </button>
        </div>
        <table className="table-admin">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="w-24">Qtd</th>
              <th className="w-32">Preço unit.</th>
              <th className="text-right">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const p = mapa.get(l.produto_id);
              return (
                <tr key={l.key}>
                  <td>
                    {p?.nome}
                    <div className="text-xs text-gray-500">
                      var. {brl(p?.preco_varejo)} {p?.preco_atacado != null && `· atac. ${brl(p.preco_atacado)} a partir de ${p.pedido_minimo_atacado}`}
                      {p && p.qtd_por_caixa > 1 && ` · cx ${p.qtd_por_caixa}`}
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={l.quantidade}
                      onChange={(e) => setLinhas((ls) => ls.map((x) => (x.key === l.key ? recalc({ ...x, quantidade: Math.max(1, Number(e.target.value) || 1) }) : x)))}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="input"
                      value={l.preco_unit}
                      onChange={(e) => setLinhas((ls) => ls.map((x) => (x.key === l.key ? { ...x, preco_unit: num(e.target.value) } : x)))}
                    />
                  </td>
                  <td className="text-right font-medium">{brl(l.quantidade * l.preco_unit)}</td>
                  <td>
                    <button type="button" className="p-1 text-gray-400 hover:text-red-600" onClick={() => setLinhas((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remover">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!linhas.length && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-500">Nenhum item.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-2 p-4">
          <div>
            <label className="label">Endereço de entrega</label>
            <textarea className="input" rows={2} value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </div>
          <div>
            <label className="label">Observação</label>
            <textarea className="input" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <div className="card space-y-2 p-4 text-sm">
          <div className="flex items-center justify-between"><span>Subtotal</span><b>{brl(subtotal)}</b></div>
          <div className="flex items-center justify-between gap-2">
            <span>Desconto (R$)</span>
            <input type="number" step="0.01" min={0} className="input w-32 text-right" value={desconto} onChange={(e) => setDesconto(Math.max(0, num(e.target.value)))} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Frete (R$)</span>
            <input type="number" step="0.01" min={0} className="input w-32 text-right" value={frete} onChange={(e) => setFrete(Math.max(0, num(e.target.value)))} />
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-lg"><span className="font-semibold">Total</span><b>{brl(total)}</b></div>
          <ErroMsg erro={erro} />
          <button className="btn-yellow w-full !py-2" onClick={salvar} disabled={carregando}>
            Criar pedido
          </button>
          <p className="text-xs text-gray-500">O pedido é criado como “novo”. Confirme depois para baixar estoque e gerar contas a receber.</p>
        </div>
      </div>
    </div>
  );
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}
