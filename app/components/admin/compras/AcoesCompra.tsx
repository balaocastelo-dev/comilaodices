"use client";
import { PackageCheck, XCircle } from "lucide-react";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";

export function AcoesCompra({ id, status }: { id: string; status: string }) {
  const { executar, carregando, erro } = useAcao();
  if (status !== "aberta") return null;
  const sb = createClient();
  return (
    <div className="space-y-2">
      <div className="card flex flex-wrap gap-2 p-3">
        <button
          className="btn-success"
          disabled={carregando}
          onClick={() => window.confirm("Confirmar recebimento? O estoque entra em lotes, o custo médio é atualizado e as contas a pagar são geradas.") && executar(async () => ok(await sb.rpc("receber_compra", { p_compra: id })))}
        >
          <PackageCheck size={16} /> Receber mercadoria
        </button>
        <button
          className="btn-outline ml-auto text-red-600"
          disabled={carregando}
          onClick={() => window.confirm("Cancelar esta compra?") && executar(async () => ok(await sb.from("compras").update({ status: "cancelada" }).eq("id", id).eq("status", "aberta")))}
        >
          <XCircle size={16} /> Cancelar compra
        </button>
      </div>
      <ErroMsg erro={erro} />
    </div>
  );
}
