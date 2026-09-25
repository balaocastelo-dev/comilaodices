import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, ErroCarga, PageHeader, Vazio } from "@/components/admin/ui";
import { brl, dataBR } from "@/lib/format";

export const metadata = { title: "Compras" };

type Row = { id: string; numero_doc: string | null; data: string; status: string; total: number; frete: number; parcelas: number; fornecedores: { nome: string } | null; compra_itens: { total: number }[] };
const ST: Record<string, string> = { aberta: "bg-blue-100 text-blue-800", recebida: "bg-green-100 text-green-800", cancelada: "bg-gray-200 text-gray-600" };

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("compras").select("id,numero_doc,data,status,total,frete,parcelas,fornecedores(nome),compra_itens(total)").order("data", { ascending: false }).limit(200);
  if (sp.status) q = q.eq("status", sp.status);
  const { data, error } = await q;
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div>
      <PageHeader titulo="Compras" sub="Pedidos a fornecedores. Ao receber a mercadoria, o estoque entra em lotes e as contas a pagar são geradas.">
        <Link href="/admin/compras/nova" className="btn-yellow"><Plus size={16} /> Nova compra</Link>
      </PageHeader>
      <div className="mb-3 flex gap-1 text-xs">
        {[["", "Todas"], ["aberta", "Abertas"], ["recebida", "Recebidas"], ["cancelada", "Canceladas"]].map(([v, l]) => (
          <Link key={v} href={v ? `/admin/compras?status=${v}` : "/admin/compras"} className={`rounded-full px-3 py-1 font-medium ${(sp.status ?? "") === v ? "bg-komi-ink text-white" : "bg-white ring-1 ring-gray-300"}`}>{l}</Link>
        ))}
      </div>
      <ErroCarga erro={error} />
      <div className="card overflow-x-auto">
        {rows.length ? (
          <table className="table-admin">
            <thead><tr><th>Data</th><th>Fornecedor</th><th>Documento</th><th>Status</th><th className="text-right">Parcelas</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {rows.map((c) => {
                const total = c.status === "recebida" ? Number(c.total) : c.compra_itens.reduce((s, i) => s + Number(i.total), 0) + Number(c.frete);
                return (
                  <tr key={c.id}>
                    <td><Link href={`/admin/compras/${c.id}`} className="font-medium text-blue-700 hover:underline">{dataBR(c.data)}</Link></td>
                    <td>{c.fornecedores?.nome ?? "—"}</td>
                    <td>{c.numero_doc ?? "—"}</td>
                    <td><Badge cls={ST[c.status] ?? ""}>{c.status}</Badge></td>
                    <td className="text-right">{c.parcelas}x</td>
                    <td className="text-right font-medium">{brl(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <Vazio>Nenhuma compra.</Vazio>}
      </div>
    </div>
  );
}
