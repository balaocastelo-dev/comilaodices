import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { AcoesPedido } from "@/components/admin/pedidos/AcoesPedido";
import { brl, CANAIS, dataBR, dataHoraBR, formatarDocumento, formatarTelefone, linkWhatsapp, STATUS_PEDIDO } from "@/lib/format";
import type { Cliente, ContaReceber, Pedido, PedidoItem } from "@/lib/types";

export const metadata = { title: "Pedido" };

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: ped } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
  if (!ped) notFound();
  const p = ped as Pedido;
  const [{ data: itens }, { data: cli }, { data: contas }] = await Promise.all([
    supabase.from("pedido_itens").select("*").eq("pedido_id", id),
    p.cliente_id ? supabase.from("clientes").select("*").eq("id", p.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("v_contas_receber").select("*").eq("pedido_id", id).order("parcela"),
  ]);
  const cliente = cli as Cliente | null;
  const wa = p.entrega_whatsapp || cliente?.whatsapp;

  return (
    <div className="max-w-5xl">
      <PageHeader titulo={`Pedido #${p.numero}`} sub={`${CANAIS[p.canal] ?? p.canal} · ${dataHoraBR(p.criado_em)} · tabela ${p.tabela_preco}`}>
        <StatusBadge mapa={STATUS_PEDIDO} valor={p.status} />
        <Link href="/admin/pedidos" className="btn-outline">Voltar</Link>
      </PageHeader>

      <AcoesPedido pedido={p} itens={(itens as PedidoItem[]) ?? []} />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <table className="table-admin">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="text-right">Qtd</th>
                <th className="text-right">Unit.</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {((itens as PedidoItem[]) ?? []).map((i) => (
                <tr key={i.id}>
                  <td>{i.descricao}</td>
                  <td className="text-right">{i.quantidade}</td>
                  <td className="text-right">{brl(i.preco_unit)}</td>
                  <td className="text-right font-medium">{brl(i.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr><td colSpan={3} className="px-3 py-1 text-right text-gray-500">Subtotal</td><td className="px-3 py-1 text-right">{brl(p.subtotal)}</td></tr>
              {Number(p.desconto) > 0 && <tr><td colSpan={3} className="px-3 py-1 text-right text-gray-500">Desconto</td><td className="px-3 py-1 text-right">- {brl(p.desconto)}</td></tr>}
              {Number(p.frete) > 0 && <tr><td colSpan={3} className="px-3 py-1 text-right text-gray-500">Frete</td><td className="px-3 py-1 text-right">{brl(p.frete)}</td></tr>}
              <tr><td colSpan={3} className="px-3 py-2 text-right font-semibold">Total</td><td className="px-3 py-2 text-right text-lg font-bold">{brl(p.total)}</td></tr>
            </tfoot>
          </table>
        </div>

        <div className="space-y-4">
          <div className="card p-3 text-sm">
            <h2 className="mb-2 font-semibold">Cliente / entrega</h2>
            {cliente ? (
              <Link href={`/admin/clientes/${cliente.id}`} className="font-medium text-blue-700 hover:underline">
                {cliente.fantasia || cliente.nome}
              </Link>
            ) : (
              <div className="font-medium">{p.entrega_nome ?? "—"}</div>
            )}
            {cliente?.documento && <div className="text-gray-500">{formatarDocumento(cliente.documento)}</div>}
            {wa && (
              <a href={linkWhatsapp(wa, `Olá! Sobre o seu pedido #${p.numero} na Doces Komilão:`)} target="_blank" rel="noopener noreferrer" className="mt-1 block text-green-700 hover:underline">
                WhatsApp {formatarTelefone(wa)}
              </a>
            )}
            <div className="mt-2 whitespace-pre-line text-gray-700">{p.entrega_endereco || cliente?.endereco || "Sem endereço"}</div>
            {p.observacao && <div className="mt-2 rounded bg-yellow-50 p-2 text-gray-700">Obs.: {p.observacao}</div>}
          </div>
          <div className="card p-3 text-sm">
            <h2 className="mb-2 font-semibold">Pagamento</h2>
            <div>Forma: <b>{p.forma_pagamento ?? "—"}</b> · {p.parcelas}x</div>
            {p.confirmado_em && <div className="text-gray-500">Confirmado em {dataHoraBR(p.confirmado_em)}</div>}
            {((contas as ContaReceber[]) ?? []).length > 0 && (
              <ul className="mt-2 divide-y divide-gray-100">
                {(contas as ContaReceber[]).map((c) => (
                  <li key={c.id} className="flex justify-between py-1">
                    <span>{c.parcela}ª · {dataBR(c.vencimento)}</span>
                    <span className={c.situacao === "vencido" ? "text-red-600" : c.situacao === "recebido" ? "text-green-700" : ""}>
                      {brl(c.valor)} · {c.situacao}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
