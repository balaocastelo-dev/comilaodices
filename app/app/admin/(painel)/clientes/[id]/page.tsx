import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatusBadge, Vazio } from "@/components/admin/ui";
import { EditarCliente } from "@/components/admin/clientes/EditarCliente";
import { Atividades } from "@/components/admin/Atividades";
import { brl, dataBR, dataHoraBR, formatarDocumento, formatarTelefone, linkWhatsapp, STATUS_PEDIDO } from "@/lib/format";
import type { Cliente, ContaReceber, CrmAtividade, CrmEtapa, Pedido } from "@/lib/types";

export const metadata = { title: "Cliente" };

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Cliente;
  const [{ data: et }, { data: peds }, { data: contas }, { data: ativ }] = await Promise.all([
    supabase.from("crm_etapas").select("*").order("ordem"),
    supabase.from("pedidos").select("*").eq("cliente_id", id).order("criado_em", { ascending: false }).limit(50),
    supabase.from("v_contas_receber").select("*").eq("cliente_id", id).order("vencimento", { ascending: false }).limit(100),
    supabase.from("crm_atividades").select("*").eq("cliente_id", id).order("criado_em", { ascending: false }).limit(100),
  ]);
  const etapas = (et as CrmEtapa[]) ?? [];
  const etapa = etapas.find((e) => e.id === c.etapa_id);
  const pedidos = (peds as Pedido[]) ?? [];
  const cr = (contas as ContaReceber[]) ?? [];
  const emAberto = cr.filter((x) => x.situacao !== "recebido").reduce((s, x) => s + Number(x.valor), 0);
  const vencido = cr.filter((x) => x.situacao === "vencido").reduce((s, x) => s + Number(x.valor), 0);
  const totalComprado = pedidos.filter((p) => p.status !== "novo" && p.status !== "cancelado").reduce((s, p) => s + Number(p.total), 0);

  return (
    <div>
      <PageHeader titulo={c.fantasia || c.nome} sub={[c.fantasia ? c.nome : null, formatarDocumento(c.documento), c.categoria].filter((x) => x && x !== "—").join(" · ")}>
        {etapa && <span className="badge text-white" style={{ background: etapa.cor }}>{etapa.nome}</span>}
        <Link href={`/admin/pedidos/novo?cliente=${c.id}`} className="btn-yellow">Novo pedido</Link>
        <EditarCliente cliente={c} etapas={etapas} />
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <div className="card space-y-1 p-3 text-sm">
            <h2 className="mb-1 font-semibold">Contato</h2>
            {c.contato_nome && <div>{c.contato_nome}</div>}
            {c.whatsapp && (
              <a href={linkWhatsapp(c.whatsapp)} target="_blank" rel="noopener noreferrer" className="block text-green-700 hover:underline">
                WhatsApp {formatarTelefone(c.whatsapp)}
              </a>
            )}
            {c.opt_out && <div className="badge bg-red-100 text-red-700">Não quer mensagens (opt-out)</div>}
            {c.telefone && <div>Tel. {formatarTelefone(c.telefone)}</div>}
            {c.email && <div>{c.email}</div>}
            <div className="text-gray-600">{[c.endereco, c.bairro, c.cidade, c.cep].filter(Boolean).join(", ") || "Sem endereço"}</div>
            <div className="pt-2 text-xs text-gray-500">
              Tabela <b className="capitalize">{c.tabela_preco}</b> · prazo {c.prazo_dias} dias · limite {brl(c.limite_credito)} · origem {c.origem}
            </div>
            {c.observacoes && <div className="mt-2 whitespace-pre-line rounded bg-yellow-50 p-2">{c.observacoes}</div>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="card p-2"><div className="text-xs text-gray-500">Comprado</div><div className="font-bold">{brl(totalComprado)}</div></div>
            <div className="card p-2"><div className="text-xs text-gray-500">Em aberto</div><div className="font-bold">{brl(emAberto)}</div></div>
            <div className="card p-2"><div className="text-xs text-gray-500">Vencido</div><div className={`font-bold ${vencido > 0 ? "text-red-600" : ""}`}>{brl(vencido)}</div></div>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <div className="card overflow-x-auto">
            <div className="border-b border-gray-200 px-3 py-2 font-semibold">Pedidos</div>
            {pedidos.length ? (
              <table className="table-admin">
                <tbody>
                  {pedidos.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/admin/pedidos/${p.id}`} className="font-semibold text-blue-700 hover:underline">#{p.numero}</Link></td>
                      <td className="text-xs text-gray-500">{dataHoraBR(p.criado_em)}</td>
                      <td><StatusBadge mapa={STATUS_PEDIDO} valor={p.status} /></td>
                      <td className="text-right font-medium">{brl(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Vazio>Nenhum pedido.</Vazio>}
          </div>

          <div className="card overflow-x-auto">
            <div className="border-b border-gray-200 px-3 py-2 font-semibold">Contas a receber</div>
            {cr.length ? (
              <table className="table-admin">
                <tbody>
                  {cr.map((x) => (
                    <tr key={x.id}>
                      <td>{x.descricao} <span className="text-xs text-gray-500">({x.parcela}ª)</span></td>
                      <td>{dataBR(x.vencimento)}</td>
                      <td className={x.situacao === "vencido" ? "text-red-600" : x.situacao === "recebido" ? "text-green-700" : ""}>{x.situacao}</td>
                      <td className="text-right font-medium">{brl(x.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Vazio>Nenhuma conta.</Vazio>}
          </div>

          <div className="card">
            <div className="border-b border-gray-200 px-3 py-2 font-semibold">Atividades</div>
            <Atividades atividades={(ativ as CrmAtividade[]) ?? []} clienteId={c.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
