import { AlertTriangle } from "lucide-react";
import { ErroCarga, PageHeader, Tabs } from "@/components/admin/ui";
import { Conexao } from "@/components/admin/whatsapp/Conexao";
import { Fila, type MsgFila } from "@/components/admin/whatsapp/Fila";
import { Templates } from "@/components/admin/whatsapp/Templates";
import { Optouts } from "@/components/admin/whatsapp/Optouts";
import { getEquipeAtual } from "@/lib/auth";
import { dataHoraBR, formatarTelefone, hojeISO, inicioDiaSP } from "@/lib/format";
import type { WaOptout, WaRecebida, WaTemplate } from "@/lib/types";

export const metadata = { title: "WhatsApp" };

const ABAS = [
  { chave: "fila", label: "Fila de envio", href: "/admin/whatsapp?aba=fila" },
  { chave: "conexao", label: "Conexão", href: "/admin/whatsapp?aba=conexao" },
  { chave: "templates", label: "Templates", href: "/admin/whatsapp?aba=templates" },
  { chave: "optout", label: "Opt-outs", href: "/admin/whatsapp?aba=optout" },
  { chave: "recebidas", label: "Recebidas", href: "/admin/whatsapp?aba=recebidas" },
];

const SELECT_MSG = "id,numero,texto,status,campanha,erro,tentativas,criado_em,enviar_apos,enviado_em,lead_id,cliente_id,leads(nome,cidade),clientes(nome,fantasia)";

export default async function WhatsappPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const sp = await searchParams;
  const aba = ABAS.some((a) => a.chave === sp.aba) ? sp.aba! : "fila";
  const { supabase, equipe } = await getEquipeAtual();
  const ehAdmin = equipe?.papel === "admin";

  // config só é legível por admin (RLS); para os demais usamos os padrões do seed
  const { data: cfg } = await supabase.from("config").select("chave,valor").in("chave", ["whatsapp_limite_diario", "whatsapp_horario"]);
  const cfgMap = Object.fromEntries(((cfg as { chave: string; valor: unknown }[]) ?? []).map((c) => [c.chave, c.valor]));
  const limite = Number(cfgMap.whatsapp_limite_diario ?? 40);
  const horario = (cfgMap.whatsapp_horario as { inicio: string; fim: string; dias: number[] } | undefined) ?? { inicio: "09:00", fim: "18:00", dias: [1, 2, 3, 4, 5, 6] };
  const { count: enviadasHoje } = await supabase.from("whatsapp_mensagens").select("id", { count: "exact", head: true }).eq("status", "enviada").gte("enviado_em", inicioDiaSP(hojeISO()));

  let conteudo: React.ReactNode = null;
  if (aba === "fila") {
    const [pend, outras] = await Promise.all([
      supabase.from("whatsapp_mensagens").select(SELECT_MSG).eq("status", "pendente_aprovacao").order("criado_em").limit(500),
      supabase.from("whatsapp_mensagens").select(SELECT_MSG).neq("status", "pendente_aprovacao").order("criado_em", { ascending: false }).limit(150),
    ]);
    conteudo = (
      <>
        <ErroCarga erro={pend.error} />
        <Fila pendentes={(pend.data as unknown as MsgFila[]) ?? []} outras={(outras.data as unknown as MsgFila[]) ?? []} />
      </>
    );
  } else if (aba === "conexao") {
    conteudo = <Conexao ehAdmin={ehAdmin} limite={limite} horario={horario} />;
  } else if (aba === "templates") {
    const { data } = await supabase.from("whatsapp_templates").select("*").order("nome");
    conteudo = <Templates templates={(data as WaTemplate[]) ?? []} />;
  } else if (aba === "optout") {
    const { data } = await supabase.from("whatsapp_optout").select("*").order("criado_em", { ascending: false }).limit(1000);
    conteudo = <Optouts optouts={(data as WaOptout[]) ?? []} />;
  } else {
    const { data } = await supabase.from("whatsapp_recebidas").select("id,numero,texto,recebido_em").order("recebido_em", { ascending: false }).limit(200);
    const rows = (data as WaRecebida[]) ?? [];
    conteudo = (
      <div className="card overflow-x-auto">
        <table className="table-admin">
          <thead><tr><th>Quando</th><th>Número</th><th>Mensagem</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs text-gray-500">{dataHoraBR(r.recebido_em)}</td>
                <td className="whitespace-nowrap">{formatarTelefone(r.numero)}</td>
                <td className="whitespace-pre-line">{r.texto ?? <span className="text-gray-400">(mídia/sem texto)</span>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={3} className="py-6 text-center text-gray-500">Nenhuma mensagem recebida ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <PageHeader titulo="WhatsApp" sub="Envio por QR code com aprovação humana obrigatória" />
      <div className="mb-4 flex gap-3 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
        <AlertTriangle className="mt-0.5 shrink-0" size={20} />
        <div>
          <b>Risco de banimento do número.</b> O WhatsApp bane números que enviam mensagens em massa para quem não conhece a empresa ou que recebem
          muitas denúncias. Envie apenas mensagens relevantes, personalizadas e com opção de saída (“responda SAIR”). Limite diário configurado:{" "}
          <b>{limite} mensagens</b> (hoje: {enviadasHoje ?? 0} enviadas), das {horario.inicio} às {horario.fim}, com intervalos aleatórios entre envios.
          Prefira um chip dedicado e “aquecido”.
        </div>
      </div>
      <Tabs abas={ABAS} atual={aba} />
      {conteudo}
    </div>
  );
}
