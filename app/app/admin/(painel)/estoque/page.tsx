import { AlertTriangle, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ErroCarga, PageHeader, Vazio } from "@/components/admin/ui";
import { addDias, dataBR, hojeISO } from "@/lib/format";
import type { EstoqueRow } from "@/lib/types";

export const metadata = { title: "Estoque" };

type LoteRow = { id: string; lote: string | null; validade: string; quantidade: number; produtos: { nome: string } | null };

export default async function EstoquePage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const hoje = hojeISO();
  const em30 = addDias(hoje, 30);
  const [est, lotes] = await Promise.all([
    supabase.from("v_estoque").select("*").order("nome"),
    supabase.from("lotes").select("id,lote,validade,quantidade,produtos(nome)").gt("quantidade", 0).not("validade", "is", null).lte("validade", em30).order("validade"),
  ]);
  const todos = (est.data as EstoqueRow[]) ?? [];
  const baixos = todos.filter((e) => e.estoque < e.estoque_minimo);
  const vencendo = (lotes.data as unknown as LoteRow[]) ?? [];
  const lista = sp.filtro === "baixo" ? baixos : todos;

  return (
    <div>
      <PageHeader titulo="Estoque" sub="Saldo por produto (soma dos lotes). Entradas pelas Compras; saídas ao confirmar pedidos (FEFO)." />
      <ErroCarga erro={est.error} />

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="card p-3">
          <div className="mb-2 flex items-center gap-2 font-semibold text-red-700">
            <AlertTriangle size={18} /> Abaixo do mínimo ({baixos.length})
          </div>
          {baixos.length ? (
            <ul className="space-y-1 text-sm">
              {baixos.map((e) => (
                <li key={e.produto_id} className="flex justify-between">
                  <span>{e.nome}</span>
                  <span className="font-medium text-red-600">{e.estoque} / mín. {e.estoque_minimo}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Tudo certo por aqui. ✅</p>
          )}
        </div>
        <div className="card p-3">
          <div className="mb-2 flex items-center gap-2 font-semibold text-orange-700">
            <CalendarClock size={18} /> Lotes vencendo em 30 dias ({vencendo.length})
          </div>
          {vencendo.length ? (
            <ul className="space-y-1 text-sm">
              {vencendo.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {l.produtos?.nome} {l.lote && <span className="text-xs text-gray-500">lote {l.lote}</span>}
                  </span>
                  <span className={`whitespace-nowrap font-medium ${l.validade < hoje ? "text-red-600" : "text-orange-600"}`}>
                    {l.quantidade} un · {dataBR(l.validade)} {l.validade < hoje && "(vencido)"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Nenhum lote vencendo nos próximos 30 dias.</p>
          )}
        </div>
      </div>

      <div className="mb-2 flex gap-2 text-sm">
        <a href="/admin/estoque" className={`rounded-full px-3 py-1 ${sp.filtro !== "baixo" ? "bg-komi-ink text-white" : "bg-white ring-1 ring-gray-300"}`}>Todos</a>
        <a href="/admin/estoque?filtro=baixo" className={`rounded-full px-3 py-1 ${sp.filtro === "baixo" ? "bg-komi-ink text-white" : "bg-white ring-1 ring-gray-300"}`}>Abaixo do mínimo</a>
      </div>
      <div className="card overflow-x-auto">
        {lista.length ? (
          <table className="table-admin">
            <thead>
              <tr>
                <th>Produto</th>
                <th>SKU</th>
                <th className="text-right">Estoque</th>
                <th className="text-right">Mínimo</th>
                <th className="text-right">Próx. validade</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => {
                const baixo = e.estoque < e.estoque_minimo;
                const venc = e.proxima_validade && e.proxima_validade <= em30;
                return (
                  <tr key={e.produto_id}>
                    <td>{e.nome}</td>
                    <td className="text-gray-500">{e.sku ?? "—"}</td>
                    <td className={`text-right font-semibold ${baixo ? "text-red-600" : ""}`}>{e.estoque}</td>
                    <td className="text-right text-gray-500">{e.estoque_minimo}</td>
                    <td className={`text-right ${venc ? "font-medium text-orange-600" : ""}`}>{dataBR(e.proxima_validade)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Vazio>Nada para mostrar.</Vazio>
        )}
      </div>
    </div>
  );
}
