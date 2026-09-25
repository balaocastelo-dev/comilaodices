import { createClient } from "@/lib/supabase/server";
import { ErroCarga, PageHeader } from "@/components/admin/ui";
import { Kanban, type CardCliente, type ProximaAcao } from "@/components/admin/Kanban";
import type { CrmEtapa } from "@/lib/types";

export const metadata = { title: "CRM" };

export default async function CrmPage() {
  const supabase = await createClient();
  const [et, cli, acoes] = await Promise.all([
    supabase.from("crm_etapas").select("*").order("ordem"),
    supabase.from("clientes").select("id,nome,fantasia,categoria,cidade,whatsapp,etapa_id,opt_out").order("atualizado_em", { ascending: false }).limit(2000),
    supabase
      .from("crm_atividades")
      .select("id,tipo,texto,agendado_para,cliente_id,lead_id,clientes(nome,fantasia),leads(nome)")
      .eq("concluido", false)
      .not("agendado_para", "is", null)
      .order("agendado_para")
      .limit(50),
  ]);
  return (
    <div>
      <PageHeader titulo="CRM" sub="Arraste os cartões entre as etapas do funil" />
      <ErroCarga erro={cli.error} />
      <Kanban etapas={(et.data as CrmEtapa[]) ?? []} clientes={(cli.data as CardCliente[]) ?? []} acoes={(acoes.data as unknown as ProximaAcao[]) ?? []} />
    </div>
  );
}
