import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ErroCarga, PageHeader, StatusBadge, Vazio } from "@/components/admin/ui";
import { Paginacao } from "@/components/admin/Paginacao";
import { brl, CANAIS, dataHoraBR, STATUS_PEDIDO } from "@/lib/format";

export const metadata = { title: "Pedidos" };
const POR_PAGINA = 50;

type Row = { id: string; numero: number; status: string; canal: string; tabela_preco: string; total: number; entrega_nome: string | null; criado_em: string; clientes: { nome: string; fantasia: string | null } | null };

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; pagina?: string }> }) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const supabase = await createClient();
  let q = supabase
    .from("pedidos")
    .select("id,numero,status,canal,tabela_preco,total,entrega_nome,criado_em,clientes(nome,fantasia)", { count: "exact" })
    .order("criado_em", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (sp.status) q = q.eq("status", sp.status);
  const busca = (sp.q ?? "").trim();
  if (busca) {
    if (/^\d+$/.test(busca)) q = q.eq("numero", Number(busca));
    else q = q.ilike("entrega_nome", `%${busca.replace(/[%,]/g, "")}%`);
  }
  const { data, count, error } = await q;
  const rows = (data as unknown as Row[]) ?? [];

  const filtros = [{ v: "", l: "Todos" }, ...Object.entries(STATUS_PEDIDO).map(([v, m]) => ({ v, l: m.label }))];

  return (
    <div>
      <PageHeader titulo="Pedidos">
        <Link href="/admin/pedidos/novo" className="btn-yellow">
          <Plus size={16} /> Novo pedido
        </Link>
      </PageHeader>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {filtros.map((f) => (
            <Link
              key={f.v}
              href={f.v ? `/admin/pedidos?status=${f.v}` : "/admin/pedidos"}
              className={`rounded-full px-3 py-1 text-xs font-medium ${(sp.status ?? "") === f.v ? "bg-komi-ink text-white" : "bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-100"}`}
            >
              {f.l}
            </Link>
          ))}
        </div>
        <form className="ml-auto flex gap-1">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input name="q" defaultValue={busca} placeholder="Nº ou nome" className="input w-44" />
          <button className="btn-outline">Buscar</button>
        </form>
      </div>
      <ErroCarga erro={error} />
      <div className="card overflow-x-auto">
        {rows.length ? (
          <table className="table-admin">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th>Tabela</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th className="text-right">Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/pedidos/${p.id}`} className="font-semibold text-blue-700 hover:underline">
                      #{p.numero}
                    </Link>
                  </td>
                  <td className="max-w-[240px] truncate">{p.clientes?.fantasia || p.clientes?.nome || p.entrega_nome || "—"}</td>
                  <td>{CANAIS[p.canal] ?? p.canal}</td>
                  <td className="capitalize">{p.tabela_preco}</td>
                  <td><StatusBadge mapa={STATUS_PEDIDO} valor={p.status} /></td>
                  <td className="text-right font-medium">{brl(p.total)}</td>
                  <td className="text-right text-xs text-gray-500">{dataHoraBR(p.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Vazio>Nenhum pedido encontrado.</Vazio>
        )}
        <Paginacao pagina={pagina} total={count ?? 0} porPagina={POR_PAGINA} base="/admin/pedidos" params={sp} />
      </div>
    </div>
  );
}
