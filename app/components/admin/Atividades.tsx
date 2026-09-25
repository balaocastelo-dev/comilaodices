"use client";
import { useState } from "react";
import { CalendarClock, CheckSquare, FileText, MessageCircle, Phone, ShoppingBag, Square, MapPin } from "lucide-react";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { dataHoraBR } from "@/lib/format";
import type { AtividadeTipo, CrmAtividade } from "@/lib/types";

const TIPOS: { v: AtividadeTipo; l: string; icon: typeof FileText; cor: string }[] = [
  { v: "nota", l: "Nota", icon: FileText, cor: "bg-gray-400" },
  { v: "ligacao", l: "Ligação", icon: Phone, cor: "bg-komi-blue" },
  { v: "visita", l: "Visita", icon: MapPin, cor: "bg-komi-purple" },
  { v: "tarefa", l: "Tarefa", icon: CalendarClock, cor: "bg-orange-500" },
  { v: "whatsapp", l: "WhatsApp", icon: MessageCircle, cor: "bg-komi-green" },
  { v: "pedido", l: "Pedido", icon: ShoppingBag, cor: "bg-komi-yellow" },
];
const MAPA = Object.fromEntries(TIPOS.map((t) => [t.v, t]));

export function Atividades({ atividades, clienteId, leadId }: { atividades: CrmAtividade[]; clienteId?: string; leadId?: string }) {
  const { executar, carregando, erro } = useAcao();
  const [tipo, setTipo] = useState<AtividadeTipo>("nota");
  const [texto, setTexto] = useState("");
  const [agendado, setAgendado] = useState("");
  const sb = createClient();

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    const {
      data: { user },
    } = await sb.auth.getUser();
    const r = await executar(async () =>
      ok(
        await sb.from("crm_atividades").insert({
          cliente_id: clienteId ?? null,
          lead_id: leadId ?? null,
          tipo,
          texto: texto.trim(),
          agendado_para: agendado ? new Date(agendado).toISOString() : null,
          autor_id: user?.id ?? null,
        }),
      ),
    );
    if (r) {
      setTexto("");
      setAgendado("");
    }
  }

  const alternar = (a: CrmAtividade) => executar(async () => ok(await sb.from("crm_atividades").update({ concluido: !a.concluido }).eq("id", a.id)));

  return (
    <div>
      <form onSubmit={adicionar} className="space-y-2 border-b border-gray-200 p-3">
        <div className="flex flex-wrap gap-1">
          {TIPOS.filter((t) => ["nota", "ligacao", "visita", "tarefa"].includes(t.v)).map((t) => (
            <button
              type="button"
              key={t.v}
              onClick={() => setTipo(t.v)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tipo === t.v ? "bg-komi-ink text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              <t.icon size={13} /> {t.l}
            </button>
          ))}
        </div>
        <textarea className="input" rows={2} placeholder="O que aconteceu / o que fazer?" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-600">Agendar para (opcional):</label>
          <input type="datetime-local" className="input w-auto" value={agendado} onChange={(e) => setAgendado(e.target.value)} />
          <button className="btn-primary ml-auto" disabled={carregando || !texto.trim()}>Adicionar</button>
        </div>
        <ErroMsg erro={erro} />
      </form>
      <ol className="relative space-y-3 p-3">
        {atividades.map((a) => {
          const t = MAPA[a.tipo] ?? TIPOS[0];
          const atrasada = a.agendado_para && !a.concluido && new Date(a.agendado_para) < new Date();
          return (
            <li key={a.id} className="flex gap-3">
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${t.cor}`}>
                <t.icon size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{t.l}</span>
                  <span>{dataHoraBR(a.criado_em)}</span>
                  {a.agendado_para && (
                    <span className={atrasada ? "font-semibold text-red-600" : "text-orange-600"}>
                      <CalendarClock size={12} className="mr-0.5 inline" />
                      {dataHoraBR(a.agendado_para)}
                    </span>
                  )}
                </div>
                <div className={`whitespace-pre-line text-sm ${a.concluido ? "text-gray-400 line-through" : ""}`}>{a.texto}</div>
              </div>
              {a.agendado_para && (
                <button className="self-start p-1 text-gray-500 hover:text-green-700" onClick={() => alternar(a)} title={a.concluido ? "Reabrir" : "Concluir"}>
                  {a.concluido ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
              )}
            </li>
          );
        })}
        {!atividades.length && <li className="text-center text-sm text-gray-500">Nenhuma atividade ainda.</li>}
      </ol>
    </div>
  );
}
