"use client";
import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/admin/Modal";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { brl, dataBR, FORMAS_PAGAMENTO, num } from "@/lib/format";
import type { ContaPagar, ContaReceber } from "@/lib/types";

type Conta = ContaPagar | ContaReceber;

export function ContasTabela({ tipo, contas, hoje }: { tipo: "pagar" | "receber"; contas: Conta[]; hoje: string }) {
  const { executar, carregando, erro, setErro } = useAcao();
  const [baixa, setBaixa] = useState<Conta | null>(null);
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState("pix");
  const sb = createClient();
  const tabela = tipo === "pagar" ? "contas_pagar" : "contas_receber";

  const quitada = (c: Conta) => (tipo === "pagar" ? (c as ContaPagar).pago_em : (c as ContaReceber).recebido_em);
  const valorQuit = (c: Conta) => (tipo === "pagar" ? (c as ContaPagar).valor_pago : (c as ContaReceber).valor_recebido);
  const nome = (c: Conta) => (tipo === "pagar" ? (c as ContaPagar).fornecedor_nome : (c as ContaReceber).cliente_nome);

  function abrirBaixa(c: Conta) {
    setErro(null);
    setBaixa(c);
    setData(hoje);
    setValor(String(c.valor));
    setForma(c.forma ?? "pix");
  }

  async function darBaixa() {
    if (!baixa) return;
    const v = num(valor, -1);
    if (v < 0) return setErro("Valor inválido.");
    const dados = tipo === "pagar" ? { pago_em: data, valor_pago: v, forma } : { recebido_em: data, valor_recebido: v, forma };
    const r = await executar(async () => ok(await sb.from(tabela).update(dados).eq("id", baixa.id)));
    if (r) setBaixa(null);
  }

  async function estornar(c: Conta) {
    if (!window.confirm("Estornar a baixa deste título?")) return;
    const dados = tipo === "pagar" ? { pago_em: null, valor_pago: null } : { recebido_em: null, valor_recebido: null };
    await executar(async () => ok(await sb.from(tabela).update(dados).eq("id", c.id)));
  }

  async function excluir(c: Conta) {
    if (!window.confirm(`Excluir "${c.descricao}"?`)) return;
    await executar(async () => ok(await sb.from(tabela).delete().eq("id", c.id)));
  }

  const avulsa = (c: Conta) => (tipo === "pagar" ? !(c as ContaPagar).compra_id : !(c as ContaReceber).pedido_id);

  return (
    <>
      {!baixa && <ErroMsg erro={erro} />}
      <div className="card overflow-x-auto">
        <table className="table-admin">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Descrição</th>
              <th>{tipo === "pagar" ? "Fornecedor / categoria" : "Cliente"}</th>
              <th className="text-right">Valor</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {contas.map((c) => {
              const q = quitada(c);
              return (
                <tr key={c.id}>
                  <td className={`whitespace-nowrap ${c.situacao === "vencido" ? "font-semibold text-red-600" : ""}`}>{dataBR(c.vencimento)}</td>
                  <td>
                    {tipo === "receber" && (c as ContaReceber).pedido_id ? (
                      <Link className="text-blue-700 hover:underline" href={`/admin/pedidos/${(c as ContaReceber).pedido_id}`}>{c.descricao}</Link>
                    ) : tipo === "pagar" && (c as ContaPagar).compra_id ? (
                      <Link className="text-blue-700 hover:underline" href={`/admin/compras/${(c as ContaPagar).compra_id}`}>{c.descricao}</Link>
                    ) : (
                      c.descricao
                    )}
                    <span className="ml-1 text-xs text-gray-500">({c.parcela}ª)</span>
                  </td>
                  <td className="text-xs">
                    {tipo === "receber" && (c as ContaReceber).cliente_id ? (
                      <Link className="hover:underline" href={`/admin/clientes/${(c as ContaReceber).cliente_id}`}>{nome(c)}</Link>
                    ) : (
                      nome(c) ?? "—"
                    )}
                    {tipo === "pagar" && <div className="capitalize text-gray-500">{(c as ContaPagar).categoria}</div>}
                  </td>
                  <td className="text-right font-medium">{brl(c.valor)}</td>
                  <td className="text-xs">
                    {q ? (
                      <span className="text-green-700">
                        {tipo === "pagar" ? "Pago" : "Recebido"} {dataBR(q)} · {brl(valorQuit(c))} {c.forma && `· ${c.forma}`}
                      </span>
                    ) : c.situacao === "vencido" ? (
                      <span className="badge bg-red-100 text-red-700">vencido</span>
                    ) : (
                      <span className="badge bg-blue-50 text-blue-700">a vencer</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {q ? (
                      <button className="btn-outline btn-sm" onClick={() => estornar(c)} disabled={carregando}>Estornar</button>
                    ) : (
                      <button className="btn-success btn-sm" onClick={() => abrirBaixa(c)}>Dar baixa</button>
                    )}
                    {avulsa(c) && !q && (
                      <button className="btn-outline btn-sm ml-1 text-red-600" onClick={() => excluir(c)} disabled={carregando}>Excluir</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!contas.length && <tr><td colSpan={6} className="py-8 text-center text-gray-500">Nenhum título.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal aberto={!!baixa} titulo={tipo === "pagar" ? "Registrar pagamento" : "Registrar recebimento"} onFechar={() => setBaixa(null)}>
        {baixa && (
          <div className="space-y-3 text-sm">
            <div className="rounded bg-gray-50 p-2">
              {baixa.descricao} ({baixa.parcela}ª) — {nome(baixa) ?? ""} — venc. {dataBR(baixa.vencimento)} — <b>{brl(baixa.valor)}</b>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="label">Data</label><input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} /></div>
              <div><label className="label">Valor</label><input type="number" step="0.01" min={0} className="input" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
              <div>
                <label className="label">Forma</label>
                <select className="input" value={forma} onChange={(e) => setForma(e.target.value)}>
                  {FORMAS_PAGAMENTO.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
                </select>
              </div>
            </div>
            <ErroMsg erro={erro} />
            <div className="flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setBaixa(null)}>Cancelar</button>
              <button className="btn-success" onClick={darBaixa} disabled={carregando || !data}>Confirmar baixa</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
