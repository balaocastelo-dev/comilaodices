"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, MapPin, Square } from "lucide-react";
import { WhatsIcon } from "@/components/loja/WhatsIcon";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { dataHoraBR, linkWhatsapp } from "@/lib/format";
import type { CrmEtapa } from "@/lib/types";

export type CardCliente = { id: string; nome: string; fantasia: string | null; categoria: string | null; cidade: string | null; whatsapp: string | null; etapa_id: number | null; opt_out: boolean };
export type ProximaAcao = {
  id: string; tipo: string; texto: string; agendado_para: string; cliente_id: string | null; lead_id: string | null;
  clientes: { nome: string; fantasia: string | null } | null; leads: { nome: string } | null;
};

export function Kanban({ etapas, clientes, acoes }: { etapas: CrmEtapa[]; clientes: CardCliente[]; acoes: ProximaAcao[] }) {
  const [cards, setCards] = useState(clientes);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const { executar, erro } = useAcao();
  const sb = createClient();
  useEffect(() => setCards(clientes), [clientes]);

  const primeira = etapas[0]?.id ?? null;
  const porEtapa = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const m = new Map<number, CardCliente[]>();
    etapas.forEach((e) => m.set(e.id, []));
    cards
      .filter((c) => !t || `${c.nome} ${c.fantasia ?? ""} ${c.cidade ?? ""} ${c.categoria ?? ""}`.toLowerCase().includes(t))
      .forEach((c) => {
        const k = c.etapa_id && m.has(c.etapa_id) ? c.etapa_id : primeira;
        if (k != null) m.get(k)!.push(c);
      });
    return m;
  }, [cards, etapas, busca, primeira]);

  async function mover(clienteId: string, etapaId: number) {
    const antes = cards;
    const card = cards.find((c) => c.id === clienteId);
    if (!card || card.etapa_id === etapaId) return;
    setCards((cs) => cs.map((c) => (c.id === clienteId ? { ...c, etapa_id: etapaId } : c)));
    const r = await executar(
      async () => {
        ok(await sb.from("clientes").update({ etapa_id: etapaId, atualizado_em: new Date().toISOString() }).eq("id", clienteId));
        const nome = etapas.find((e) => e.id === etapaId)?.nome;
        await sb.from("crm_atividades").insert({ cliente_id: clienteId, tipo: "nota", texto: `Etapa alterada para “${nome}”` });
        return true;
      },
      { refresh: false },
    );
    if (!r) setCards(antes);
  }

  const concluir = (id: string) => executar(async () => ok(await sb.from("crm_atividades").update({ concluido: true }).eq("id", id)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-64" placeholder="Filtrar cartões..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="text-xs text-gray-500">{cards.length} cliente(s)</span>
      </div>
      <ErroMsg erro={erro} />
      <div className="flex gap-3 overflow-x-auto pb-3">
        {etapas.map((e) => {
          const lista = porEtapa.get(e.id) ?? [];
          return (
            <div
              key={e.id}
              onDragOver={(ev) => {
                ev.preventDefault();
                ev.dataTransfer.dropEffect = "move";
                setSobre(e.id);
              }}
              onDragLeave={() => setSobre((s) => (s === e.id ? null : s))}
              onDrop={(ev) => {
                ev.preventDefault();
                const id = ev.dataTransfer.getData("text/plain") || arrastando;
                setSobre(null);
                setArrastando(null);
                if (id) mover(id, e.id);
              }}
              className={`flex w-64 shrink-0 flex-col rounded-lg bg-gray-100 ${sobre === e.id ? "ring-2 ring-komi-yellow" : ""}`}
            >
              <div className="flex items-center gap-2 rounded-t-lg border-t-4 bg-white px-3 py-2" style={{ borderTopColor: e.cor }}>
                <span className="font-semibold">{e.nome}</span>
                <span className="ml-auto rounded-full bg-gray-100 px-2 text-xs text-gray-600">{lista.length}</span>
              </div>
              <div className="flex max-h-[65vh] min-h-24 flex-col gap-2 overflow-y-auto p-2">
                {lista.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData("text/plain", c.id);
                      ev.dataTransfer.effectAllowed = "move";
                      setArrastando(c.id);
                    }}
                    onDragEnd={() => setArrastando(null)}
                    className={`cursor-grab rounded-md border border-gray-200 bg-white p-2 text-sm shadow-sm active:cursor-grabbing ${arrastando === c.id ? "opacity-40" : ""}`}
                  >
                    <Link href={`/admin/clientes/${c.id}`} className="block font-medium leading-tight hover:underline">
                      {c.fantasia || c.nome}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                      {c.categoria && <span className="badge bg-komi-yellow-soft capitalize text-gray-700">{c.categoria}</span>}
                      {c.cidade && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin size={11} /> {c.cidade}
                        </span>
                      )}
                      {c.whatsapp && !c.opt_out && (
                        <a href={linkWhatsapp(c.whatsapp)} target="_blank" rel="noopener noreferrer" className="ml-auto text-green-600 hover:text-green-800" title="Abrir WhatsApp" onClick={(ev) => ev.stopPropagation()}>
                          <WhatsIcon size={16} />
                        </a>
                      )}
                    </div>
                    {/* alternativa ao arrastar (mobile/teclado) */}
                    <select
                      className="mt-1 w-full rounded border-0 bg-gray-50 px-1 py-0.5 text-xs text-gray-500 lg:hidden"
                      value={c.etapa_id ?? primeira ?? ""}
                      onChange={(ev) => mover(c.id, Number(ev.target.value))}
                      aria-label="Mover para etapa"
                    >
                      {etapas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card max-w-3xl">
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 font-semibold">
          <CalendarClock size={17} /> Próximas ações
        </div>
        {acoes.length ? (
          <ul className="divide-y divide-gray-100 text-sm">
            {acoes.map((a) => {
              const atrasada = new Date(a.agendado_para) < new Date();
              return (
                <li key={a.id} className="flex items-start gap-3 px-3 py-2">
                  <button className="p-0.5 text-gray-400 hover:text-green-700" onClick={() => concluir(a.id)} title="Concluir">
                    <Square size={17} />
                  </button>
                  <span className={`w-28 shrink-0 text-xs ${atrasada ? "font-semibold text-red-600" : "text-gray-500"}`}>{dataHoraBR(a.agendado_para)}</span>
                  <div className="min-w-0">
                    <div>
                      <span className="mr-1 text-xs uppercase text-gray-400">{a.tipo}</span>
                      {a.texto}
                    </div>
                    <div className="text-xs text-gray-500">
                      {a.cliente_id ? <Link className="hover:underline" href={`/admin/clientes/${a.cliente_id}`}>{a.clientes?.fantasia || a.clientes?.nome}</Link> : `Lead: ${a.leads?.nome ?? ""}`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-4 text-sm text-gray-500">Nenhuma ação agendada. Agende pelo detalhe do cliente.</div>
        )}
      </div>
    </div>
  );
}
