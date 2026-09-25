import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, PageHeader } from "@/components/admin/ui";
import { AcoesCompra } from "@/components/admin/compras/AcoesCompra";
import { brl, dataBR, dataHoraBR } from "@/lib/format";
import type { Compra, ContaPagar } from "@/lib/types";

export const metadata = { title: "Compra" };

type ItemRow = { id: string; quantidade: number; custo_unit: number; lote: string | null; validade: string | null; total: number; produtos: { nome: string } | null };

export default async function CompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("compras").select("*, fornecedores(nome)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Compra & { fornecedores: { nome: string } | null };
  const [{ data: itens }, { data: contas }] = await Promise.all([
    supabase.from("compra_itens").select("id,quantidade,custo_unit,lote,validade,total,produtos(nome)").eq("compra_id", id),
    supabase.from("v_contas_pagar").select("*").eq("compra_id", id).order("parcela"),
  ]);
  const its = (itens as unknown as ItemRow[]) ?? [];
  const soma = its.reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="max-w-5xl">
      <PageHeader titulo={`Compra ${c.numero_doc ?? ""}`.trim()} sub={`${c.fornecedores?.nome ?? "Sem fornecedor"} · ${dataBR(c.data)}`}>
        <Badge cls={c.status === "recebida" ? "bg-green-100 text-green-800" : c.status === "aberta" ? "bg-blue-100 text-blue-800" : "bg-gray-200 text-gray-600"}>{c.status}</Badge>
        <Link href="/admin/compras" className="btn-outline">Voltar</Link>
      </PageHeader>
      <AcoesCompra id={c.id} status={c.status} />
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <table className="table-admin">
            <thead><tr><th>Produto</th><th className="text-right">Qtd</th><th className="text-right">Custo</th><th>Lote</th><th>Validade</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {its.map((i) => (
                <tr key={i.id}>
                  <td>{i.produtos?.nome}</td>
                  <td className="text-right">{i.quantidade}</td>
                  <td className="text-right">{brl(i.custo_unit)}</td>
                  <td>{i.lote ?? "—"}</td>
                  <td>{dataBR(i.validade)}</td>
                  <td className="text-right font-medium">{brl(i.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr><td colSpan={5} className="px-3 py-1 text-right text-gray-500">Frete</td><td className="px-3 py-1 text-right">{brl(c.frete)}</td></tr>
              <tr><td colSpan={5} className="px-3 py-2 text-right font-semibold">Total</td><td className="px-3 py-2 text-right text-lg font-bold">{brl(soma + Number(c.frete))}</td></tr>
            </tfoot>
          </table>
        </div>
        <div className="card p-3 text-sm">
          <h2 className="mb-2 font-semibold">Pagamento</h2>
          <div>{c.parcelas}x · 1º venc. {dataBR(c.primeiro_venc)}</div>
          {c.recebida_em && <div className="text-gray-500">Recebida em {dataHoraBR(c.recebida_em)}</div>}
          {c.observacao && <div className="mt-2 rounded bg-yellow-50 p-2">{c.observacao}</div>}
          {((contas as ContaPagar[]) ?? []).length > 0 && (
            <ul className="mt-2 divide-y divide-gray-100">
              {(contas as ContaPagar[]).map((x) => (
                <li key={x.id} className="flex justify-between py-1">
                  <span>{x.parcela}ª · {dataBR(x.vencimento)}</span>
                  <span className={x.situacao === "vencido" ? "text-red-600" : x.situacao === "pago" ? "text-green-700" : ""}>{brl(x.valor)} · {x.situacao}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
