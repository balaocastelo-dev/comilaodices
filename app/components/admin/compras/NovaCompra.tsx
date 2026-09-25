"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { addDias, brl, hojeISO, num } from "@/lib/format";
import type { Fornecedor, Produto } from "@/lib/types";

type Item = { key: number; produto_id: string; quantidade: string; custo_unit: string; lote: string; validade: string };

export function NovaCompra({ fornecedores, produtos }: { fornecedores: Fornecedor[]; produtos: Produto[] }) {
  const router = useRouter();
  const { executar, carregando, erro, setErro } = useAcao();
  const [fornecedorId, setFornecedorId] = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [data, setData] = useState(hojeISO());
  const [frete, setFrete] = useState("0");
  const [parcelas, setParcelas] = useState("1");
  const [venc, setVenc] = useState(hojeISO());
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const mapa = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  function trocarFornecedor(id: string) {
    setFornecedorId(id);
    const f = fornecedores.find((x) => x.id === id);
    if (f) setVenc(addDias(data, f.prazo_dias));
  }

  const add = () => setItens((xs) => [...xs, { key: Date.now(), produto_id: "", quantidade: "1", custo_unit: "", lote: "", validade: "" }]);
  const upd = (key: number, k: keyof Item, v: string) =>
    setItens((xs) =>
      xs.map((x) => {
        if (x.key !== key) return x;
        const n = { ...x, [k]: v };
        if (k === "produto_id" && !x.custo_unit) {
          const p = mapa.get(v);
          if (p && Number(p.custo_medio) > 0) n.custo_unit = String(p.custo_medio);
        }
        return n;
      }),
    );

  const subtotal = itens.reduce((s, i) => s + num(i.quantidade) * num(i.custo_unit), 0);
  const total = subtotal + num(frete);

  async function salvar(receber: boolean) {
    setErro(null);
    const validos = itens.filter((i) => i.produto_id);
    if (!validos.length) return setErro("Adicione ao menos um item com produto.");
    if (validos.some((i) => num(i.quantidade) <= 0 || !Number.isInteger(num(i.quantidade)))) return setErro("Quantidades devem ser inteiras e maiores que zero.");
    if (validos.some((i) => i.custo_unit === "" || num(i.custo_unit, -1) < 0)) return setErro("Informe o custo unitário de todos os itens.");
    const sb = createClient();
    const id = await executar(
      async () => {
        const { data: c } = ok(
          await sb
            .from("compras")
            .insert({
              fornecedor_id: fornecedorId || null,
              numero_doc: numeroDoc.trim() || null,
              data,
              frete: num(frete),
              total: Math.round(total * 100) / 100,
              parcelas: Math.max(1, Math.floor(num(parcelas, 1))),
              primeiro_venc: venc || null,
              observacao: obs.trim() || null,
            })
            .select("id")
            .single(),
        );
        const compraId = (c as { id: string }).id;
        const r = await sb.from("compra_itens").insert(
          validos.map((i) => ({ compra_id: compraId, produto_id: i.produto_id, quantidade: Math.floor(num(i.quantidade)), custo_unit: num(i.custo_unit), lote: i.lote.trim() || null, validade: i.validade || null })),
        );
        if (r.error) {
          await sb.from("compras").delete().eq("id", compraId);
          throw new Error(r.error.message);
        }
        if (receber) ok(await sb.rpc("receber_compra", { p_compra: compraId }));
        return compraId;
      },
      { refresh: false },
    );
    if (id) router.push(`/admin/compras/${id}`);
  }

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 p-4 text-sm sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">Fornecedor</label>
          <select className="input" value={fornecedorId} onChange={(e) => trocarFornecedor(e.target.value)}>
            <option value="">—</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <Link href="/admin/fornecedores" className="text-xs text-blue-600 hover:underline">+ cadastrar fornecedor</Link>
        </div>
        <div>
          <label className="label">Nº nota / pedido</label>
          <input className="input" value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value)} />
        </div>
        <div>
          <label className="label">Data</label>
          <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-admin">
          <thead>
            <tr><th>Produto</th><th className="w-24">Qtd (un.)</th><th className="w-28">Custo unit.</th><th className="w-28">Lote</th><th className="w-36">Validade</th><th className="text-right">Total</th><th /></tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.key}>
                <td>
                  <select className="input" value={i.produto_id} onChange={(e) => upd(i.key, "produto_id", e.target.value)}>
                    <option value="">Selecione…</option>
                    {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.sku ? ` (${p.sku})` : ""}</option>)}
                  </select>
                </td>
                <td><input type="number" min={1} className="input" value={i.quantidade} onChange={(e) => upd(i.key, "quantidade", e.target.value)} /></td>
                <td><input type="number" min={0} step="0.01" className="input" value={i.custo_unit} onChange={(e) => upd(i.key, "custo_unit", e.target.value)} /></td>
                <td><input className="input" value={i.lote} onChange={(e) => upd(i.key, "lote", e.target.value)} /></td>
                <td><input type="date" className="input" value={i.validade} onChange={(e) => upd(i.key, "validade", e.target.value)} /></td>
                <td className="text-right font-medium">{brl(num(i.quantidade) * num(i.custo_unit))}</td>
                <td><button className="p-1 text-gray-400 hover:text-red-600" onClick={() => setItens((xs) => xs.filter((x) => x.key !== i.key))} aria-label="Remover"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-3">
          <button className="btn-outline" onClick={add}><Plus size={16} /> Adicionar item</button>
          {mapa.size > 0 && <span className="ml-2 text-xs text-gray-500">Quantidade sempre em unidades de venda (se comprou 10 caixas de 24, informe 240).</span>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4 text-sm">
          <label className="label">Observação</label>
          <textarea className="input" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
        <div className="card space-y-2 p-4 text-sm">
          <div className="flex justify-between"><span>Itens</span><b>{brl(subtotal)}</b></div>
          <div className="flex items-center justify-between gap-2"><span>Frete</span><input type="number" min={0} step="0.01" className="input w-32 text-right" value={frete} onChange={(e) => setFrete(e.target.value)} /></div>
          <div className="flex items-center justify-between gap-2"><span>Parcelas</span><input type="number" min={1} max={24} className="input w-32 text-right" value={parcelas} onChange={(e) => setParcelas(e.target.value)} /></div>
          <div className="flex items-center justify-between gap-2"><span>1º vencimento</span><input type="date" className="input w-40" value={venc} onChange={(e) => setVenc(e.target.value)} /></div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-lg"><span className="font-semibold">Total</span><b>{brl(total)}</b></div>
          <ErroMsg erro={erro} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline flex-1" onClick={() => salvar(false)} disabled={carregando}>Salvar (aberta)</button>
            <button className="btn-yellow flex-1" onClick={() => salvar(true)} disabled={carregando}>Salvar e receber mercadoria</button>
          </div>
        </div>
      </div>
    </div>
  );
}
