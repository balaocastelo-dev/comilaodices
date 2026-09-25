"use client";
import { useState } from "react";
import { CheckCircle2, PackageCheck, Truck, XCircle } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { brl, FORMAS_PAGAMENTO, hojeISO } from "@/lib/format";
import type { Pedido, PedidoItem } from "@/lib/types";

export function AcoesPedido({ pedido, itens }: { pedido: Pedido; itens: PedidoItem[] }) {
  const { executar, carregando, erro } = useAcao();
  const [modal, setModal] = useState(false);
  const [forma, setForma] = useState("pix");
  const [parcelas, setParcelas] = useState(1);
  const [venc, setVenc] = useState(hojeISO());
  const sb = createClient();

  async function confirmar() {
    const r = await executar(async () =>
      ok(await sb.rpc("confirmar_pedido", { p_pedido: pedido.id, p_forma: forma, p_parcelas: parcelas, p_primeiro_venc: venc })),
    );
    if (r) setModal(false);
  }

  const avancar = (status: "separado" | "entregue") => executar(async () => ok(await sb.from("pedidos").update({ status }).eq("id", pedido.id)));

  async function cancelar() {
    const confirmado = pedido.status !== "novo";
    const msg = confirmado
      ? "Cancelar este pedido?\n\n• Os itens voltam ao estoque (lote de devolução)\n• As parcelas a receber ainda não pagas serão excluídas"
      : "Cancelar este pedido?";
    if (!window.confirm(msg)) return;
    await executar(async () => {
      if (confirmado) {
        // devolve ao estoque como lote de devolução
        const ids = [...new Set(itens.map((i) => i.produto_id))];
        const { data: prods } = await sb.from("produtos").select("id,custo_medio").in("id", ids);
        const custo = new Map((prods ?? []).map((p: { id: string; custo_medio: number }) => [p.id, Number(p.custo_medio)]));
        if (itens.length) {
          ok(
            await sb.from("lotes").insert(
              itens.map((i) => ({ produto_id: i.produto_id, lote: `DEV-${pedido.numero}`, quantidade: i.quantidade, custo_unit: custo.get(i.produto_id) ?? 0 })),
            ),
          );
        }
        ok(await sb.from("contas_receber").delete().eq("pedido_id", pedido.id).is("recebido_em", null));
      }
      ok(await sb.from("pedidos").update({ status: "cancelado" }).eq("id", pedido.id));
      if (pedido.cliente_id) {
        await sb.from("crm_atividades").insert({ cliente_id: pedido.cliente_id, tipo: "pedido", texto: `Pedido #${pedido.numero} cancelado` });
      }
    });
  }

  if (pedido.status === "cancelado" || pedido.status === "entregue") {
    return <ErroMsg erro={erro} />;
  }

  return (
    <div className="space-y-2">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <span className="mr-2 text-sm text-gray-500">Ações:</span>
        {pedido.status === "novo" && (
          <button className="btn-success" onClick={() => setModal(true)} disabled={carregando}>
            <CheckCircle2 size={16} /> Confirmar pedido
          </button>
        )}
        {pedido.status === "confirmado" && (
          <button className="btn-primary" onClick={() => avancar("separado")} disabled={carregando}>
            <PackageCheck size={16} /> Marcar como separado
          </button>
        )}
        {pedido.status === "separado" && (
          <button className="btn-primary" onClick={() => avancar("entregue")} disabled={carregando}>
            <Truck size={16} /> Marcar como entregue
          </button>
        )}
        <button className="btn-outline ml-auto text-red-600" onClick={cancelar} disabled={carregando}>
          <XCircle size={16} /> Cancelar
        </button>
      </div>
      <ErroMsg erro={erro} />

      <Modal aberto={modal} titulo={`Confirmar pedido #${pedido.numero}`} onFechar={() => setModal(false)}>
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">
            Ao confirmar, o estoque é baixado (FEFO — vence primeiro, sai primeiro) e são geradas as contas a receber de <b>{brl(pedido.total)}</b>.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Forma de pagamento</label>
              <select className="input" value={forma} onChange={(e) => setForma(e.target.value)}>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f.v} value={f.v}>{f.l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Parcelas</label>
              <input type="number" min={1} max={24} className="input" value={parcelas} onChange={(e) => setParcelas(Math.max(1, Math.min(24, Number(e.target.value) || 1)))} />
            </div>
            <div className="col-span-2">
              <label className="label">1º vencimento (demais a cada 30 dias)</label>
              <input type="date" className="input" value={venc} onChange={(e) => setVenc(e.target.value)} />
            </div>
          </div>
          {parcelas > 1 && <p className="text-xs text-gray-500">{parcelas}x de aprox. {brl(Number(pedido.total) / parcelas)}</p>}
          <ErroMsg erro={erro} />
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setModal(false)}>Voltar</button>
            <button className="btn-success" onClick={confirmar} disabled={carregando || !venc}>
              Confirmar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
