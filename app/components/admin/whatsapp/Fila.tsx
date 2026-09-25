"use client";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { StatusBadge } from "@/components/admin/ui";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { dataHoraBR, formatarTelefone, STATUS_WA } from "@/lib/format";

export type MsgFila = {
  id: string; numero: string; texto: string; status: string; campanha: string | null; erro: string | null; tentativas: number;
  criado_em: string; enviar_apos: string | null; enviado_em: string | null; lead_id: string | null; cliente_id: string | null;
  leads: { nome: string; cidade: string | null } | null; clientes: { nome: string; fantasia: string | null } | null;
};

export function Fila({ pendentes, outras }: { pendentes: MsgFila[]; outras: MsgFila[] }) {
  const { executar, carregando, erro } = useAcao();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const sb = createClient();

  useEffect(() => {
    setSel(new Set());
    setTextos({});
  }, [pendentes]);

  const todos = pendentes.length > 0 && sel.size === pendentes.length;
  const nome = (m: MsgFila) => m.clientes?.fantasia || m.clientes?.nome || m.leads?.nome || "—";

  async function salvarTexto(m: MsgFila) {
    const t = textos[m.id];
    if (t === undefined || t === m.texto) return;
    if (!t.trim()) return;
    await executar(async () => ok(await sb.from("whatsapp_mensagens").update({ texto: t }).eq("id", m.id).eq("status", "pendente_aprovacao")), { refresh: false });
  }

  async function aprovar() {
    const ids = [...sel];
    if (!ids.length) return;
    if (!window.confirm(`Aprovar ${ids.length} mensagem(ns)? Elas serão enviadas automaticamente, espaçadas por intervalos aleatórios, respeitando o limite diário e o horário.`)) return;
    const r = await executar(async () => {
      // grava edições pendentes antes de aprovar
      for (const id of ids) {
        const m = pendentes.find((x) => x.id === id);
        const t = textos[id];
        if (m && t !== undefined && t.trim() && t !== m.texto) ok(await sb.from("whatsapp_mensagens").update({ texto: t }).eq("id", id));
      }
      const { data } = ok(await sb.rpc("aprovar_mensagens", { p_ids: ids }));
      return Number(data);
    });
    if (r !== undefined) setAviso(`${r} mensagem(ns) aprovada(s). ${ids.length - r > 0 ? `${ids.length - r} cancelada(s) por opt-out.` : ""}`);
  }

  async function cancelar(ids: string[]) {
    if (!ids.length || !window.confirm(`Cancelar ${ids.length} mensagem(ns)?`)) return;
    await executar(async () => ok(await sb.from("whatsapp_mensagens").update({ status: "cancelada" }).in("id", ids).in("status", ["pendente_aprovacao", "aprovada", "erro"])));
  }

  const outrasFiltradas = outras.filter((m) => !filtro || m.status === filtro);

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Pendentes de aprovação ({pendentes.length})</h2>
          <button className="btn-success ml-auto" disabled={!sel.size || carregando} onClick={aprovar}>
            <Check size={16} /> Aprovar selecionadas ({sel.size})
          </button>
          <button className="btn-outline text-red-600" disabled={!sel.size || carregando} onClick={() => cancelar([...sel])}>
            <X size={16} /> Cancelar
          </button>
        </div>
        {aviso && <div className="mb-2 rounded bg-green-50 p-2 text-sm text-green-800">{aviso}</div>}
        <ErroMsg erro={erro} />
        <div className="card overflow-x-auto">
          <table className="table-admin">
            <thead>
              <tr>
                <th className="w-8"><input type="checkbox" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(pendentes.map((m) => m.id)))} aria-label="Selecionar todas" /></th>
                <th className="w-48">Destinatário</th>
                <th>Mensagem (editável)</th>
              </tr>
            </thead>
            <tbody>
              {pendentes.map((m) => (
                <tr key={m.id} className={sel.has(m.id) ? "bg-komi-yellow-soft/60" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={sel.has(m.id)}
                      onChange={() => setSel((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })}
                      aria-label="Selecionar"
                    />
                  </td>
                  <td className="text-xs">
                    <div className="font-medium text-gray-900">{nome(m)}</div>
                    <div>{formatarTelefone(m.numero)}</div>
                    {m.leads?.cidade && <div className="text-gray-500">{m.leads.cidade}</div>}
                    <div className="text-gray-400">{m.campanha} · {dataHoraBR(m.criado_em)}</div>
                  </td>
                  <td>
                    <textarea
                      className="input min-h-24 bg-[#F0FFF0] font-sans"
                      value={textos[m.id] ?? m.texto}
                      onChange={(e) => setTextos((t) => ({ ...t, [m.id]: e.target.value }))}
                      onBlur={() => salvarTexto(m)}
                      rows={4}
                    />
                  </td>
                </tr>
              ))}
              {!pendentes.length && <tr><td colSpan={3} className="py-6 text-center text-gray-500">Nada pendente. Gere mensagens na tela de Leads.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Histórico recente</h2>
          <select className="input ml-auto w-40" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos</option>
            {["aprovada", "enviando", "enviada", "erro", "cancelada"].map((s) => <option key={s} value={s}>{STATUS_WA[s].label}</option>)}
          </select>
        </div>
        <div className="card overflow-x-auto">
          <table className="table-admin">
            <thead>
              <tr><th>Destinatário</th><th>Mensagem</th><th>Status</th><th>Agendada / enviada</th><th /></tr>
            </thead>
            <tbody>
              {outrasFiltradas.map((m) => (
                <tr key={m.id}>
                  <td className="text-xs"><div className="font-medium">{nome(m)}</div>{formatarTelefone(m.numero)}</td>
                  <td className="max-w-md"><div className="line-clamp-2 text-xs text-gray-700" title={m.texto}>{m.texto}</div></td>
                  <td>
                    <StatusBadge mapa={STATUS_WA} valor={m.status} />
                    {m.erro && <div className="max-w-[200px] truncate text-xs text-red-600" title={m.erro}>{m.erro}</div>}
                    {m.tentativas > 0 && <div className="text-xs text-gray-500">{m.tentativas} tentativa(s)</div>}
                  </td>
                  <td className="whitespace-nowrap text-xs text-gray-500">{m.enviado_em ? `enviada ${dataHoraBR(m.enviado_em)}` : m.enviar_apos ? `após ${dataHoraBR(m.enviar_apos)}` : "—"}</td>
                  <td>
                    {(m.status === "aprovada" || m.status === "erro") && (
                      <button className="btn-outline btn-sm text-red-600" onClick={() => cancelar([m.id])}>Cancelar</button>
                    )}
                  </td>
                </tr>
              ))}
              {!outrasFiltradas.length && <tr><td colSpan={5} className="py-6 text-center text-gray-500">Nada por aqui.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
