import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErroCarga, PageHeader, Vazio } from "@/components/admin/ui";
import { Paginacao } from "@/components/admin/Paginacao";
import { NovoClienteBotao } from "@/components/admin/clientes/NovoClienteBotao";
import { CATEGORIAS_CLIENTE, formatarDocumento, formatarTelefone, linkWhatsapp } from "@/lib/format";
import type { Cliente, CrmEtapa } from "@/lib/types";

export const metadata = { title: "Clientes" };
const POR_PAGINA = 50;

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string; etapa?: string; pagina?: string; novo?: string }> }) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const supabase = await createClient();
  let q = supabase.from("clientes").select("*", { count: "exact" }).order("nome").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  const busca = (sp.q ?? "").trim().replace(/[%,()]/g, " ");
  if (busca) q = q.or(`nome.ilike.%${busca}%,fantasia.ilike.%${busca}%,documento.ilike.%${busca}%,whatsapp.ilike.%${busca}%,cidade.ilike.%${busca}%`);
  if (sp.categoria) q = q.eq("categoria", sp.categoria);
  if (sp.etapa) q = q.eq("etapa_id", Number(sp.etapa));
  const [{ data, count, error }, { data: et }] = await Promise.all([q, supabase.from("crm_etapas").select("*").order("ordem")]);
  const etapas = (et as CrmEtapa[]) ?? [];
  const etMap = new Map(etapas.map((e) => [e.id, e]));
  const rows = (data as Cliente[]) ?? [];

  return (
    <div>
      <PageHeader titulo="Clientes">
        <NovoClienteBotao etapas={etapas} abrirInicial={sp.novo === "1"} />
      </PageHeader>
      <form className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Nome, CNPJ, WhatsApp, cidade" className="input w-64" />
        <select name="categoria" defaultValue={sp.categoria ?? ""} className="input w-40">
          <option value="">Categoria</option>
          {CATEGORIAS_CLIENTE.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="etapa" defaultValue={sp.etapa ?? ""} className="input w-40">
          <option value="">Etapa</option>
          {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <button className="btn-outline">Filtrar</button>
        {(sp.q || sp.categoria || sp.etapa) && <Link href="/admin/clientes" className="btn-outline">Limpar</Link>}
      </form>
      <ErroCarga erro={error} />
      <div className="card overflow-x-auto">
        {rows.length ? (
          <table className="table-admin">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Documento</th>
                <th>Categoria</th>
                <th>Cidade</th>
                <th>WhatsApp</th>
                <th>Etapa</th>
                <th>Tabela</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const e = c.etapa_id ? etMap.get(c.etapa_id) : null;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/clientes/${c.id}`} className="font-medium text-blue-700 hover:underline">{c.fantasia || c.nome}</Link>
                      {c.fantasia && <div className="text-xs text-gray-500">{c.nome}</div>}
                    </td>
                    <td className="text-xs">{formatarDocumento(c.documento)}</td>
                    <td className="capitalize">{c.categoria ?? "—"}</td>
                    <td>{c.cidade ?? "—"}</td>
                    <td>
                      {c.whatsapp ? (
                        <a href={linkWhatsapp(c.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline">{formatarTelefone(c.whatsapp)}</a>
                      ) : "—"}
                      {c.opt_out && <span className="badge ml-1 bg-red-100 text-red-700">opt-out</span>}
                    </td>
                    <td>{e ? <span className="badge text-white" style={{ background: e.cor }}>{e.nome}</span> : "—"}</td>
                    <td className="capitalize">{c.tabela_preco}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Vazio>Nenhum cliente encontrado.</Vazio>
        )}
        <Paginacao pagina={pagina} total={count ?? 0} porPagina={POR_PAGINA} base="/admin/clientes" params={sp} />
      </div>
    </div>
  );
}
