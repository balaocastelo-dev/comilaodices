"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { dataHoraBR, formatarTelefone, normalizarWhatsapp } from "@/lib/format";
import type { WaOptout } from "@/lib/types";

export function Optouts({ optouts }: { optouts: WaOptout[] }) {
  const { executar, carregando, erro, setErro } = useAcao();
  const [numero, setNumero] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busca, setBusca] = useState("");
  const sb = createClient();

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const n = normalizarWhatsapp(numero);
    if (n.length < 12) return setErro("Número inválido.");
    const r = await executar(async () => {
      ok(await sb.from("whatsapp_optout").upsert({ numero: n, motivo: motivo.trim() || "manual" }));
      ok(await sb.from("clientes").update({ opt_out: true }).eq("whatsapp", n));
      ok(await sb.from("whatsapp_mensagens").update({ status: "cancelada", erro: "opt-out" }).eq("numero", n).in("status", ["pendente_aprovacao", "aprovada", "erro"]));
      return true;
    });
    if (r) {
      setNumero("");
      setMotivo("");
    }
  }

  async function remover(o: WaOptout) {
    if (!window.confirm(`Remover ${formatarTelefone(o.numero)} da lista de opt-out? Só faça isso se a pessoa pediu para voltar a receber.`)) return;
    await executar(async () => {
      ok(await sb.from("whatsapp_optout").delete().eq("numero", o.numero));
      ok(await sb.from("clientes").update({ opt_out: false }).eq("whatsapp", o.numero));
    });
  }

  const lista = optouts.filter((o) => !busca || o.numero.includes(busca.replace(/\D/g, "")));

  return (
    <div className="max-w-3xl space-y-3">
      <form onSubmit={adicionar} className="card flex flex-wrap items-end gap-2 p-3">
        <div>
          <label className="label">Número</label>
          <input className="input w-48" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="(19) 99999-9999" />
        </div>
        <div className="flex-1">
          <label className="label">Motivo</label>
          <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="pediu por telefone..." />
        </div>
        <button className="btn-primary" disabled={carregando}>Adicionar opt-out</button>
      </form>
      <ErroMsg erro={erro} />
      <input className="input w-60" placeholder="Buscar número" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <div className="card overflow-x-auto">
        <table className="table-admin">
          <thead><tr><th>Número</th><th>Motivo</th><th>Desde</th><th /></tr></thead>
          <tbody>
            {lista.map((o) => (
              <tr key={o.numero}>
                <td>{formatarTelefone(o.numero)}</td>
                <td className="text-gray-600">{o.motivo ?? "—"}</td>
                <td className="text-xs text-gray-500">{dataHoraBR(o.criado_em)}</td>
                <td className="text-right">
                  <button className="p-1 text-gray-400 hover:text-red-600" onClick={() => remover(o)} aria-label="Remover"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={4} className="py-6 text-center text-gray-500">Nenhum opt-out.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
