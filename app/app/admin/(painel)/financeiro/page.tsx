import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErroCarga, PageHeader, Tabs } from "@/components/admin/ui";
import { ContasTabela } from "@/components/admin/financeiro/ContasTabela";
import { NovaDespesa } from "@/components/admin/financeiro/NovaDespesa";
import { addDias, brl, dataBR, hojeISO } from "@/lib/format";
import type { ContaPagar, ContaReceber, Fornecedor } from "@/lib/types";

export const metadata = { title: "Financeiro" };

type SP = { tipo?: string; situacao?: string; de?: string; ate?: string };
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tipo = sp.tipo === "pagar" || sp.tipo === "fluxo" ? sp.tipo : "receber";
  const situacao = sp.situacao ?? "pendente";
  const de = sp.de && DATA_RE.test(sp.de) ? sp.de : "";
  const ate = sp.ate && DATA_RE.test(sp.ate) ? sp.ate : "";
  const supabase = await createClient();
  const hoje = hojeISO();

  const abas = [
    { chave: "receber", label: "Contas a receber", href: "/admin/financeiro?tipo=receber" },
    { chave: "pagar", label: "Contas a pagar", href: "/admin/financeiro?tipo=pagar" },
    { chave: "fluxo", label: "Fluxo de caixa (30 dias)", href: "/admin/financeiro?tipo=fluxo" },
  ];

  if (tipo === "fluxo") {
    const fim = addDias(hoje, 30);
    const [rec, pag] = await Promise.all([
      supabase.from("contas_receber").select("vencimento,valor").is("recebido_em", null).lte("vencimento", fim),
      supabase.from("contas_pagar").select("vencimento,valor").is("pago_em", null).lte("vencimento", fim),
    ]);
    const dias: { dia: string; entradas: number; saidas: number }[] = [];
    const atras = { entradas: 0, saidas: 0 };
    for (let i = 0; i <= 30; i++) dias.push({ dia: addDias(hoje, i), entradas: 0, saidas: 0 });
    const idx = new Map(dias.map((d, i) => [d.dia, i]));
    ((rec.data as { vencimento: string; valor: number }[]) ?? []).forEach((r) => {
      if (r.vencimento < hoje) atras.entradas += Number(r.valor);
      else dias[idx.get(r.vencimento)!]!.entradas += Number(r.valor);
    });
    ((pag.data as { vencimento: string; valor: number }[]) ?? []).forEach((r) => {
      if (r.vencimento < hoje) atras.saidas += Number(r.valor);
      else dias[idx.get(r.vencimento)!]!.saidas += Number(r.valor);
    });
    const max = Math.max(1, ...dias.map((d) => Math.max(d.entradas, d.saidas)));
    const totE = dias.reduce((s, d) => s + d.entradas, 0);
    const totS = dias.reduce((s, d) => s + d.saidas, 0);
    let acum = 0;
    const semana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

    return (
      <div>
        <PageHeader titulo="Financeiro" />
        <Tabs abas={abas} atual="fluxo" />
        <ErroCarga erro={rec.error ?? pag.error} />
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card p-3"><div className="text-xs text-gray-500">Entradas previstas</div><div className="text-xl font-bold text-green-700">{brl(totE)}</div></div>
          <div className="card p-3"><div className="text-xs text-gray-500">Saídas previstas</div><div className="text-xl font-bold text-red-600">{brl(totS)}</div></div>
          <div className="card p-3"><div className="text-xs text-gray-500">Saldo do período</div><div className={`text-xl font-bold ${totE - totS < 0 ? "text-red-600" : ""}`}>{brl(totE - totS)}</div></div>
          <div className="card p-3"><div className="text-xs text-gray-500">Em atraso (fora do gráfico)</div><div className="text-sm"><span className="text-green-700">+{brl(atras.entradas)}</span> / <span className="text-red-600">-{brl(atras.saidas)}</span></div></div>
        </div>
        <div className="card overflow-x-auto">
          <table className="table-admin">
            <thead><tr><th className="w-28">Dia</th><th>Entradas × saídas</th><th className="text-right">Entradas</th><th className="text-right">Saídas</th><th className="text-right">Saldo acumulado</th></tr></thead>
            <tbody>
              {dias.map((d) => {
                acum += d.entradas - d.saidas;
                const vazio = !d.entradas && !d.saidas;
                const dow = new Date(d.dia + "T12:00:00Z").getUTCDay();
                return (
                  <tr key={d.dia} className={vazio ? "text-gray-400" : ""}>
                    <td className="whitespace-nowrap">{dataBR(d.dia).slice(0, 5)} <span className="text-xs">{semana[dow]}</span></td>
                    <td className="min-w-48">
                      <div className="space-y-0.5">
                        <div className="h-2 rounded-full bg-komi-green" style={{ width: `${(d.entradas / max) * 100}%` }} />
                        <div className="h-2 rounded-full bg-komi-red" style={{ width: `${(d.saidas / max) * 100}%` }} />
                      </div>
                    </td>
                    <td className="text-right text-green-700">{d.entradas ? brl(d.entradas) : "—"}</td>
                    <td className="text-right text-red-600">{d.saidas ? brl(d.saidas) : "—"}</td>
                    <td className={`text-right font-medium ${acum < 0 ? "text-red-600" : "text-gray-900"}`}>{brl(acum)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">Considera apenas títulos em aberto (não inclui saldo bancário atual).</p>
      </div>
    );
  }

  const view = tipo === "pagar" ? "v_contas_pagar" : "v_contas_receber";
  const pago = tipo === "pagar" ? "pago" : "recebido";
  let q = supabase.from(view).select("*").order("vencimento").limit(1000);
  if (situacao === "pendente") q = q.neq("situacao", pago);
  else if (situacao === "aberto" || situacao === "vencido") q = q.eq("situacao", situacao);
  else if (situacao === "pago") q = q.eq("situacao", pago);
  if (de) q = q.gte("vencimento", de);
  if (ate) q = q.lte("vencimento", ate);
  const [{ data, error }, forn] = await Promise.all([q, tipo === "pagar" ? supabase.from("fornecedores").select("id,nome").order("nome") : Promise.resolve({ data: [] })]);
  const rows = (data as (ContaPagar | ContaReceber)[]) ?? [];
  const tot = (f: (r: ContaPagar | ContaReceber) => boolean) => rows.filter(f).reduce((s, r) => s + Number(r.valor), 0);
  const sit = (r: ContaPagar | ContaReceber) => r.situacao as string;
  const qs = (o: Partial<SP>) => {
    const u = new URLSearchParams({ tipo, situacao, ...(de ? { de } : {}), ...(ate ? { ate } : {}), ...o } as Record<string, string>);
    return `/admin/financeiro?${u.toString()}`;
  };

  return (
    <div>
      <PageHeader titulo="Financeiro">{tipo === "pagar" && <NovaDespesa fornecedores={(forn.data as Pick<Fornecedor, "id" | "nome">[]) ?? []} />}</PageHeader>
      <Tabs abas={abas} atual={tipo} />
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-1">
          {[
            ["pendente", "Em aberto + vencidas"],
            ["aberto", "A vencer"],
            ["vencido", "Vencidas"],
            ["pago", tipo === "pagar" ? "Pagas" : "Recebidas"],
            ["todos", "Todas"],
          ].map(([v, l]) => (
            <Link key={v} href={qs({ situacao: v })} className={`rounded-full px-3 py-1 text-xs font-medium ${situacao === v ? "bg-komi-ink text-white" : "bg-white ring-1 ring-gray-300"}`}>{l}</Link>
          ))}
        </div>
        <form className="ml-auto flex flex-wrap items-end gap-2">
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="situacao" value={situacao} />
          <div><label className="label">Vencimento de</label><input type="date" name="de" defaultValue={de} className="input" /></div>
          <div><label className="label">até</label><input type="date" name="ate" defaultValue={ate} className="input" /></div>
          <button className="btn-outline">Filtrar</button>
          {(de || ate) && <Link href={`/admin/financeiro?tipo=${tipo}&situacao=${situacao}`} className="btn-outline">Limpar</Link>}
        </form>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-3"><div className="text-xs text-gray-500">Total listado</div><div className="text-lg font-bold">{brl(tot(() => true))}</div><div className="text-xs text-gray-500">{rows.length} título(s)</div></div>
        <div className="card p-3"><div className="text-xs text-gray-500">A vencer</div><div className="text-lg font-bold">{brl(tot((r) => sit(r) === "aberto"))}</div></div>
        <div className="card p-3"><div className="text-xs text-gray-500">Vencido</div><div className="text-lg font-bold text-red-600">{brl(tot((r) => sit(r) === "vencido"))}</div></div>
        <div className="card p-3"><div className="text-xs text-gray-500">{tipo === "pagar" ? "Pago" : "Recebido"}</div><div className="text-lg font-bold text-green-700">{brl(rows.reduce((s, r) => s + Number(("valor_pago" in r ? r.valor_pago : (r as ContaReceber).valor_recebido) ?? 0), 0))}</div></div>
      </div>
      <ErroCarga erro={error} />
      <ContasTabela tipo={tipo} contas={rows} hoje={hoje} />
    </div>
  );
}
