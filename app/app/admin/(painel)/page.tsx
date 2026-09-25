import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Stat, StatusBadge, Vazio } from "@/components/admin/ui";
import { addDias, brl, dataHoraBR, hojeISO, inicioDiaSP, STATUS_PEDIDO } from "@/lib/format";
import type { EstoqueRow, Pedido } from "@/lib/types";

export const dynamic = "force-dynamic";

type AtivRow = { id: string; tipo: string; texto: string; agendado_para: string; cliente_id: string | null; clientes: { nome: string; fantasia: string | null } | null; leads: { nome: string } | null };

export default async function Dashboard() {
  const supabase = await createClient();
  const hoje = hojeISO();
  const inicioMes = inicioDiaSP(hoje.slice(0, 7) + "-01");
  const em7 = addDias(hoje, 7);

  const [vendas, novos, recVenc, pagar7, pagarVenc, estoque, leadsNovos, ultimos, acoes] = await Promise.all([
    supabase.from("pedidos").select("total").in("status", ["confirmado", "separado", "entregue"]).gte("confirmado_em", inicioMes),
    supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "novo"),
    supabase.from("v_contas_receber").select("valor").eq("situacao", "vencido"),
    supabase.from("contas_pagar").select("valor").is("pago_em", null).gte("vencimento", hoje).lte("vencimento", em7),
    supabase.from("contas_pagar").select("valor").is("pago_em", null).lt("vencimento", hoje),
    supabase.from("v_estoque").select("*"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "novo"),
    supabase.from("pedidos").select("id,numero,status,total,entrega_nome,canal,criado_em").order("criado_em", { ascending: false }).limit(8),
    supabase
      .from("crm_atividades")
      .select("id,tipo,texto,agendado_para,cliente_id,clientes(nome,fantasia),leads(nome)")
      .eq("concluido", false)
      .not("agendado_para", "is", null)
      .order("agendado_para")
      .limit(8),
  ]);

  const soma = (rows: { valor?: number; total?: number }[] | null, k: "valor" | "total") => (rows ?? []).reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const vendasMes = soma(vendas.data as { total: number }[], "total");
  const qtdVendas = vendas.data?.length ?? 0;
  const baixosReais = ((estoque.data as EstoqueRow[]) ?? []).filter((e) => e.estoque < e.estoque_minimo);

  return (
    <div>
      <PageHeader titulo="Dashboard" sub={`Hoje é ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(new Date())}`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat titulo="Vendas do mês" valor={brl(vendasMes)} sub={`${qtdVendas} pedido(s) confirmados`} cor="bg-komi-green" href="/admin/pedidos" />
        <Stat titulo="Pedidos novos" valor={novos.count ?? 0} sub="aguardando confirmação" cor="bg-komi-blue" href="/admin/pedidos?status=novo" />
        <Stat titulo="A receber vencido" valor={brl(soma(recVenc.data as { valor: number }[], "valor"))} sub={`${recVenc.data?.length ?? 0} título(s)`} cor="bg-komi-red" href="/admin/financeiro?tipo=receber&situacao=vencido" />
        <Stat
          titulo="A pagar (7 dias)"
          valor={brl(soma(pagar7.data as { valor: number }[], "valor"))}
          sub={pagarVenc.data?.length ? <span className="text-red-600">+ {brl(soma(pagarVenc.data as { valor: number }[], "valor"))} vencido</span> : `${pagar7.data?.length ?? 0} título(s)`}
          cor="bg-orange-500"
          href="/admin/financeiro?tipo=pagar"
        />
        <Stat titulo="Estoque baixo" valor={baixosReais.length} sub="produto(s) abaixo do mínimo" cor="bg-komi-purple" href="/admin/estoque" />
        <Stat titulo="Leads novos" valor={leadsNovos.count ?? 0} sub="para qualificar" cor="bg-komi-pink" href="/admin/leads?status=novo" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
            <h2 className="font-semibold">Últimos pedidos</h2>
            <Link href="/admin/pedidos" className="text-xs text-blue-600 hover:underline">ver todos</Link>
          </div>
          {ultimos.data?.length ? (
            <table className="table-admin">
              <tbody>
                {(ultimos.data as Pedido[]).map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/admin/pedidos/${p.id}`} className="font-semibold text-blue-700 hover:underline">#{p.numero}</Link></td>
                    <td className="max-w-[180px] truncate">{p.entrega_nome ?? "—"}</td>
                    <td><StatusBadge mapa={STATUS_PEDIDO} valor={p.status} /></td>
                    <td className="text-right font-medium">{brl(p.total)}</td>
                    <td className="text-right text-xs text-gray-500">{dataHoraBR(p.criado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Vazio>Nenhum pedido ainda.</Vazio>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
            <h2 className="font-semibold">Próximas ações</h2>
            <Link href="/admin/crm" className="text-xs text-blue-600 hover:underline">CRM</Link>
          </div>
          {acoes.data?.length ? (
            <ul className="divide-y divide-gray-100 text-sm">
              {(acoes.data as unknown as AtivRow[]).map((a) => {
                const atrasada = new Date(a.agendado_para) < new Date();
                return (
                  <li key={a.id} className="flex gap-3 px-3 py-2">
                    <span className={`w-28 shrink-0 text-xs ${atrasada ? "font-semibold text-red-600" : "text-gray-500"}`}>{dataHoraBR(a.agendado_para)}</span>
                    <div className="min-w-0">
                      <div className="truncate">
                        <span className="mr-1 text-xs uppercase text-gray-400">{a.tipo}</span>
                        {a.texto}
                      </div>
                      <div className="text-xs text-gray-500">
                        {a.cliente_id ? (
                          <Link href={`/admin/clientes/${a.cliente_id}`} className="hover:underline">{a.clientes?.fantasia || a.clientes?.nome}</Link>
                        ) : (
                          a.leads?.nome
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Vazio>Nenhuma ação agendada.</Vazio>
          )}
        </div>

        {baixosReais.length > 0 && (
          <div className="card xl:col-span-2">
            <div className="border-b border-gray-200 px-3 py-2 font-semibold">Estoque abaixo do mínimo</div>
            <div className="flex flex-wrap gap-2 p-3">
              {baixosReais.map((e) => (
                <span key={e.produto_id} className="badge bg-red-50 text-red-700 ring-1 ring-red-200">
                  {e.nome}: {e.estoque} / mín. {e.estoque_minimo}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
