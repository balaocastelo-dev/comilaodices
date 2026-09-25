import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErroCarga, PageHeader } from "@/components/admin/ui";
import { Paginacao } from "@/components/admin/Paginacao";
import { LeadsTabela } from "@/components/admin/leads/LeadsTabela";
import { ImportarLeads } from "@/components/admin/leads/ImportarLeads";
import { STATUS_LEAD } from "@/lib/format";
import type { Lead, WaTemplate } from "@/lib/types";

export const metadata = { title: "Leads" };
const POR_PAGINA = 100;

type SP = { cidade?: string; categoria?: string; status?: string; whats?: string; score?: string; q?: string; pagina?: string; ordem?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const supabase = await createClient();
  const limpa = (s?: string) => (s ?? "").trim().replace(/[%,()]/g, " ");

  let q = supabase.from("leads").select("*", { count: "exact" });
  if (sp.cidade) q = q.ilike("cidade", limpa(sp.cidade));
  if (sp.categoria) q = q.eq("categoria", sp.categoria);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.whats === "1") q = q.not("whatsapp", "is", null).neq("whatsapp", "");
  if (sp.whats === "0") q = q.or("whatsapp.is.null,whatsapp.eq.");
  if (sp.score) q = q.gte("score", Number(sp.score) || 0);
  if (sp.q) q = q.or(`nome.ilike.%${limpa(sp.q)}%,bairro.ilike.%${limpa(sp.q)}%,endereco.ilike.%${limpa(sp.q)}%`);
  q = sp.ordem === "recentes" ? q.order("capturado_em", { ascending: false }) : q.order("score", { ascending: false }).order("nome");
  q = q.range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);

  const [{ data, count, error }, { data: tpl }, { data: amostra }] = await Promise.all([
    q,
    supabase.from("whatsapp_templates").select("*").eq("ativo", true).order("nome"),
    supabase.from("leads").select("cidade,categoria").limit(5000),
  ]);
  const cidades = [...new Set(((amostra as { cidade: string | null }[]) ?? []).map((r) => r.cidade).filter(Boolean) as string[])].sort();
  const categorias = [...new Set(((amostra as { categoria: string | null }[]) ?? []).map((r) => r.categoria).filter(Boolean) as string[])].sort();
  const temFiltro = Object.entries(sp).some(([k, v]) => k !== "pagina" && v);

  return (
    <div>
      <PageHeader titulo="Leads" sub="Estabelecimentos captados (OSM, Google, indicação...). Qualifique, converta e gere mensagens para aprovação.">
        <ImportarLeads />
      </PageHeader>
      <form className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Busca</label>
          <input name="q" defaultValue={sp.q} placeholder="Nome, bairro, endereço" className="input w-48" />
        </div>
        <div>
          <label className="label">Cidade</label>
          <input name="cidade" defaultValue={sp.cidade} list="lista-cidades" className="input w-40" />
          <datalist id="lista-cidades">{cidades.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <label className="label">Categoria</label>
          <select name="categoria" defaultValue={sp.categoria ?? ""} className="input w-36">
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={sp.status ?? ""} className="input w-32">
            <option value="">Todos</option>
            {Object.entries(STATUS_LEAD).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">WhatsApp</label>
          <select name="whats" defaultValue={sp.whats ?? ""} className="input w-28">
            <option value="">Tanto faz</option>
            <option value="1">Tem</option>
            <option value="0">Não tem</option>
          </select>
        </div>
        <div>
          <label className="label">Score mín.</label>
          <input name="score" type="number" defaultValue={sp.score} className="input w-20" />
        </div>
        <div>
          <label className="label">Ordem</label>
          <select name="ordem" defaultValue={sp.ordem ?? ""} className="input w-32">
            <option value="">Maior score</option>
            <option value="recentes">Mais recentes</option>
          </select>
        </div>
        <button className="btn-primary">Filtrar</button>
        {temFiltro && <Link href="/admin/leads" className="btn-outline">Limpar</Link>}
      </form>
      <ErroCarga erro={error} />
      <LeadsTabela leads={(data as Lead[]) ?? []} templates={(tpl as WaTemplate[]) ?? []} siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}>
        <Paginacao pagina={pagina} total={count ?? 0} porPagina={POR_PAGINA} base="/admin/leads" params={sp} />
      </LeadsTabela>
    </div>
  );
}
