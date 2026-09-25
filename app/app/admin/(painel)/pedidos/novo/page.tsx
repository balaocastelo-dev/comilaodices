import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { NovoPedido } from "@/components/admin/pedidos/NovoPedido";
import type { Cliente, Produto } from "@/lib/types";

export const metadata = { title: "Novo pedido" };

export default async function NovoPedidoPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: cli }] = await Promise.all([
    supabase.from("produtos").select("*").eq("ativo", true).order("nome"),
    sp.cliente && /^[0-9a-f-]{36}$/i.test(sp.cliente) ? supabase.from("clientes").select("*").eq("id", sp.cliente).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <div className="max-w-5xl">
      <PageHeader titulo="Novo pedido" sub="Pedido manual (vendedor, WhatsApp ou balcão)" />
      <NovoPedido produtos={(data as Produto[]) ?? []} clienteInicial={(cli as Cliente | null) ?? null} />
    </div>
  );
}
