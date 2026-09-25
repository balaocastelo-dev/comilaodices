"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle, ExternalLink, MessageSquarePlus, UserPlus } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { StatusBadge } from "@/components/admin/ui";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { formatarTelefone, linkWhatsapp, normalizarWhatsapp, preencherTemplate, STATUS_LEAD } from "@/lib/format";
import type { Lead, WaTemplate } from "@/lib/types";

export function LeadsTabela({ leads, templates, siteUrl, children }: { leads: Lead[]; templates: WaTemplate[]; siteUrl: string; children?: React.ReactNode }) {
  const router = useRouter();
  const { executar, carregando, erro, setErro } = useAcao();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [descarte, setDescarte] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [gerar, setGerar] = useState(false);
  const [tplId, setTplId] = useState<number | "">(templates[0]?.id ?? "");
  const [campanha, setCampanha] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const sb = createClient();
  const linkLoja = (siteUrl || "https://komilaodoces.com.br").replace(/\/$/, "");

  useEffect(() => setSel(new Set()), [leads]);

  const selecionados = useMemo(() => leads.filter((l) => sel.has(l.id)), [leads, sel]);
  const comWhats = selecionados.filter((l) => normalizarWhatsapp(l.whatsapp).length >= 12 && l.status !== "descartado");
  const todos = leads.length > 0 && sel.size === leads.length;
  const tpl = templates.find((t) => t.id === tplId);

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function mudarStatus(status: "qualificado" | "descartado", motivoDescarte?: string) {
    const ids = [...sel];
    if (!ids.length) return;
    const r = await executar(async () =>
      ok(
        await sb
          .from("leads")
          .update({ status, motivo_descarte: status === "descartado" ? motivoDescarte || null : null, atualizado_em: new Date().toISOString() })
          .in("id", ids)
          .neq("status", "convertido"),
      ),
    );
    if (r) {
      setDescarte(false);
      setMotivo("");
      setAviso(`${ids.length} lead(s) marcados como ${status}.`);
    }
  }

  async function converter() {
    const ids = selecionados.filter((l) => l.status !== "convertido").map((l) => l.id);
    if (!ids.length) return;
    if (!window.confirm(`Converter ${ids.length} lead(s) em cliente(s)?`)) return;
    const r = await executar(async () => {
      let n = 0;
      let ultimo = "";
      for (const id of ids) {
        const { data } = ok(await sb.rpc("converter_lead", { p_lead: id }));
        ultimo = String(data);
        n++;
      }
      return { n, ultimo };
    });
    if (r) {
      if (r.n === 1 && r.ultimo) router.push(`/admin/clientes/${r.ultimo}`);
      else setAviso(`${r.n} lead(s) convertidos em clientes.`);
    }
  }

  async function gerarMensagens() {
    if (!tpl) return setErro("Escolha um template.");
    const alvo = comWhats;
    if (!alvo.length) return setErro("Nenhum lead selecionado com WhatsApp válido.");
    const r = await executar(async () => {
      const numeros = [...new Set(alvo.map((l) => normalizarWhatsapp(l.whatsapp)))];
      const [{ data: opt }, { data: pend }, { data: cliOpt }] = await Promise.all([
        sb.from("whatsapp_optout").select("numero").in("numero", numeros),
        sb.from("whatsapp_mensagens").select("lead_id,numero").in("numero", numeros).in("status", ["pendente_aprovacao", "aprovada", "enviando"]),
        sb.from("clientes").select("whatsapp").in("whatsapp", numeros).eq("opt_out", true),
      ]);
      const bloqueados = new Set([...(opt ?? []).map((o: { numero: string }) => o.numero), ...(cliOpt ?? []).map((c: { whatsapp: string }) => c.whatsapp)]);
      const naFila = new Set((pend ?? []).map((p: { numero: string }) => p.numero));
      const vistos = new Set<string>();
      const linhas = [];
      let pulados = 0;
      for (const l of alvo) {
        const numero = normalizarWhatsapp(l.whatsapp);
        if (bloqueados.has(numero) || naFila.has(numero) || vistos.has(numero)) {
          pulados++;
          continue;
        }
        vistos.add(numero);
        linhas.push({
          numero,
          lead_id: l.id,
          cliente_id: l.cliente_id,
          template_id: tpl.id,
          campanha: campanha.trim() || tpl.nome,
          texto: preencherTemplate(tpl.texto, { nome: l.nome, cidade: l.cidade || "Campinas", link_loja: linkLoja }),
          status: "pendente_aprovacao",
        });
      }
      if (linhas.length) ok(await sb.from("whatsapp_mensagens").insert(linhas));
      return { criadas: linhas.length, pulados };
    });
    if (r) {
      setGerar(false);
      setAviso(`${r.criadas} mensagem(ns) criadas na fila de aprovação${r.pulados ? ` (${r.pulados} ignorada(s): opt-out, duplicada ou já na fila)` : ""}. Revise em WhatsApp → Fila.`);
    }
  }

  const exemplo = tpl && comWhats[0] ? preencherTemplate(tpl.texto, { nome: comWhats[0].nome, cidade: comWhats[0].cidade || "Campinas", link_loja: linkLoja }) : tpl?.texto;

  return (
    <>
      <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-2 rounded-md bg-white/90 p-2 ring-1 ring-gray-200 backdrop-blur lg:top-0">
        <span className="text-sm text-gray-600">{sel.size} selecionado(s)</span>
        <button className="btn-outline btn-sm" disabled={!sel.size || carregando} onClick={() => mudarStatus("qualificado")}>
          <CheckCircle size={14} /> Qualificar
        </button>
        <button className="btn-outline btn-sm" disabled={!sel.size || carregando} onClick={() => setDescarte(true)}>
          <Ban size={14} /> Descartar
        </button>
        <button className="btn-outline btn-sm" disabled={!sel.size || carregando} onClick={converter}>
          <UserPlus size={14} /> Converter em cliente
        </button>
        <button className="btn-yellow btn-sm" disabled={!sel.size || carregando} onClick={() => { setErro(null); setGerar(true); }}>
          <MessageSquarePlus size={14} /> Gerar mensagens ({comWhats.length})
        </button>
        {aviso && (
          <span className="ml-auto text-xs text-green-700">
            {aviso}{" "}
            <button className="underline" onClick={() => setAviso(null)}>ok</button>
          </span>
        )}
      </div>
      {!gerar && !descarte && <ErroMsg erro={erro} />}

      <div className="card overflow-x-auto">
        <table className="table-admin">
          <thead>
            <tr>
              <th className="w-8">
                <input type="checkbox" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(leads.map((l) => l.id)))} aria-label="Selecionar todos" />
              </th>
              <th>Estabelecimento</th>
              <th>Endereço</th>
              <th>Contato</th>
              <th className="text-right">Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className={sel.has(l.id) ? "bg-komi-yellow-soft/60" : ""}>
                <td><input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Selecionar ${l.nome}`} /></td>
                <td>
                  <div className="font-medium">{l.nome}</div>
                  <div className="text-xs text-gray-500">
                    <span className="capitalize">{l.categoria ?? "—"}</span> · {l.fonte}
                    {l.horario && <span title={l.horario}> · horário ✓</span>}
                  </div>
                </td>
                <td className="max-w-[260px] text-xs">
                  <div className="truncate">{l.endereco ?? "—"}</div>
                  <div className="text-gray-500">
                    {[l.bairro, l.cidade].filter(Boolean).join(" · ")}
                    {l.lat != null && l.lon != null && (
                      <a href={`https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lon}#map=18/${l.lat}/${l.lon}`} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600">
                        mapa <ExternalLink size={10} className="inline" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="text-xs">
                  {l.whatsapp && (
                    <a href={linkWhatsapp(l.whatsapp)} target="_blank" rel="noopener noreferrer" className="block text-green-700 hover:underline">WA {formatarTelefone(l.whatsapp)}</a>
                  )}
                  {l.telefone && <div>Tel. {formatarTelefone(l.telefone)}</div>}
                  {l.instagram && <div className="text-pink-600">{l.instagram.startsWith("@") ? l.instagram : `@${l.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "")}`}</div>}
                  {l.site && <a href={l.site.startsWith("http") ? l.site : `https://${l.site}`} target="_blank" rel="noopener noreferrer" className="block truncate text-blue-600">site</a>}
                </td>
                <td className="text-right font-semibold">{l.score}</td>
                <td>
                  <StatusBadge mapa={STATUS_LEAD} valor={l.status} />
                  {l.motivo_descarte && <div className="text-xs text-gray-500">{l.motivo_descarte}</div>}
                  {l.cliente_id && <Link href={`/admin/clientes/${l.cliente_id}`} className="block text-xs text-blue-600 hover:underline">ver cliente</Link>}
                </td>
              </tr>
            ))}
            {!leads.length && <tr><td colSpan={6} className="py-8 text-center text-gray-500">Nenhum lead. Importe um arquivo leads.json.</td></tr>}
          </tbody>
        </table>
        {children}
      </div>

      <Modal aberto={descarte} titulo={`Descartar ${sel.size} lead(s)`} onFechar={() => setDescarte(false)}>
        <div className="space-y-3 text-sm">
          <label className="label">Motivo</label>
          <select className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="">Selecione…</option>
            <option>Fechado / não existe mais</option>
            <option>Fora da área de entrega</option>
            <option>Não vende doces/salgadinhos</option>
            <option>Não tem interesse</option>
            <option>Contato inválido</option>
            <option>Duplicado</option>
            <option>Outro</option>
          </select>
          <ErroMsg erro={erro} />
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setDescarte(false)}>Voltar</button>
            <button className="btn-danger" disabled={carregando} onClick={() => mudarStatus("descartado", motivo)}>Descartar</button>
          </div>
        </div>
      </Modal>

      <Modal aberto={gerar} titulo="Gerar mensagens de WhatsApp" onFechar={() => setGerar(false)} largura="max-w-xl">
        <div className="space-y-3 text-sm">
          <p className="rounded bg-yellow-50 p-2 text-yellow-900">
            As mensagens <b>não são enviadas agora</b>: vão para a fila com status “pendente de aprovação”. Revise e aprove em WhatsApp → Fila.
          </p>
          <div>{comWhats.length} de {selecionados.length} lead(s) selecionado(s) têm WhatsApp válido.</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Template</label>
              <select className="input" value={tplId} onChange={(e) => setTplId(Number(e.target.value))}>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Campanha (opcional)</label>
              <input className="input" value={campanha} onChange={(e) => setCampanha(e.target.value)} placeholder={tpl?.nome} />
            </div>
          </div>
          {exemplo && (
            <div>
              <div className="label">Prévia</div>
              <div className="whitespace-pre-line rounded-lg bg-[#DCF8C6] p-3 text-gray-800">{exemplo}</div>
            </div>
          )}
          <ErroMsg erro={erro} />
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setGerar(false)}>Cancelar</button>
            <button className="btn-yellow" disabled={carregando || !comWhats.length || !tpl} onClick={gerarMensagens}>
              Criar {comWhats.length} mensagem(ns)
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
