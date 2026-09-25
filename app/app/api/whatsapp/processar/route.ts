import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evolutionConfig, evolutionFetch, erroEvolution } from "@/lib/evolution";
import { segredoIgual } from "@/lib/seguranca";
import { hojeISO, inicioDiaSP, TZ, variacoesNumero } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_POR_CHAMADA = 5;
const MAX_TENTATIVAS = 3;

type Msg = { id: string; numero: string; texto: string; cliente_id: string | null; lead_id: string | null; tentativas: number; status: string };

function agoraSP() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const hh = get("hour") === "24" ? "00" : get("hour");
  return { dia, hhmm: `${hh}:${get("minute")}` };
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Processa a fila de WhatsApp. Chamado a cada minuto por um agendador (Coolify/cron):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://komilaodoces.com.br/api/whatsapp/processar
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!process.env.CRON_SECRET) return NextResponse.json({ erro: "CRON_SECRET não configurado" }, { status: 500 });
  if (!segredoIgual(token, process.env.CRON_SECRET)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });

  const evo = evolutionConfig();
  if (!evo.configurado) return NextResponse.json({ ok: false, motivo: "Evolution API não configurada" }, { status: 200 });

  let sb;
  try {
    sb = createAdminClient();
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  // Configurações
  const { data: cfgRows } = await sb.from("config").select("chave,valor").in("chave", ["whatsapp_limite_diario", "whatsapp_horario"]);
  const cfg = Object.fromEntries(((cfgRows as { chave: string; valor: unknown }[]) ?? []).map((c) => [c.chave, c.valor]));
  const limite = Math.max(0, Number(cfg.whatsapp_limite_diario ?? 40) || 0);
  const horario = (cfg.whatsapp_horario as { inicio?: string; fim?: string; dias?: number[] } | undefined) ?? {};
  const inicio = horario.inicio ?? "09:00";
  const fim = horario.fim ?? "18:00";
  const dias = (horario.dias ?? [1, 2, 3, 4, 5, 6]).map((d) => Number(d) % 7); // 0/7 = domingo

  const { dia, hhmm } = agoraSP();
  if (!dias.includes(dia) || hhmm < inicio || hhmm >= fim) {
    return NextResponse.json({ ok: true, enviadas: 0, motivo: `fora do horário (${hhmm}, dia ${dia}; janela ${inicio}-${fim}, dias ${dias.join(",")})` });
  }

  const { count: enviadasHoje, error: errCount } = await sb
    .from("whatsapp_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("status", "enviada")
    .gte("enviado_em", inicioDiaSP(hojeISO()));
  if (errCount) return NextResponse.json({ erro: errCount.message }, { status: 500 });
  const restante = limite - (enviadasHoje ?? 0);
  if (restante <= 0) return NextResponse.json({ ok: true, enviadas: 0, motivo: `limite diário atingido (${enviadasHoje}/${limite})` });

  // Recupera mensagens presas em "enviando" (execução interrompida há mais de 15 min). Não reenvia para evitar duplicidade.
  await sb
    .from("whatsapp_mensagens")
    .update({ status: "erro", erro: "Envio interrompido — confira no WhatsApp se foi entregue", tentativas: MAX_TENTATIVAS })
    .eq("status", "enviando")
    .lt("enviar_apos", new Date(Date.now() - 15 * 60000).toISOString());

  const lote = Math.min(MAX_POR_CHAMADA, restante);
  const agoraIso = new Date().toISOString();
  const { data: candidatas, error: errSel } = await sb
    .from("whatsapp_mensagens")
    .select("id,numero,texto,cliente_id,lead_id,tentativas,status")
    .or(`status.eq.aprovada,and(status.eq.erro,tentativas.lt.${MAX_TENTATIVAS})`)
    .lte("enviar_apos", agoraIso)
    .order("enviar_apos")
    .limit(lote);
  if (errSel) return NextResponse.json({ erro: errSel.message }, { status: 500 });

  const resultado: { id: string; numero: string; status: string; erro?: string }[] = [];

  for (const [i, m] of ((candidatas as Msg[]) ?? []).entries()) {
    // "trava" a mensagem (evita envio duplicado se duas execuções se sobrepuserem)
    const { data: travada } = await sb
      .from("whatsapp_mensagens")
      .update({ status: "enviando", enviar_apos: new Date().toISOString() }) // enviar_apos passa a marcar o início do envio
      .eq("id", m.id)
      .eq("status", m.status)
      .select("id")
      .maybeSingle();
    if (!travada) continue;

    // confere opt-out de novo (pode ter chegado depois da aprovação)
    const variantes = variacoesNumero(m.numero);
    const [{ data: opt }, { data: cliOpt }] = await Promise.all([
      sb.from("whatsapp_optout").select("numero").in("numero", variantes).limit(1),
      sb.from("clientes").select("id").in("whatsapp", variantes).eq("opt_out", true).limit(1),
    ]);
    if ((opt && opt.length) || (cliOpt && cliOpt.length)) {
      await sb.from("whatsapp_mensagens").update({ status: "cancelada", erro: "opt-out" }).eq("id", m.id);
      resultado.push({ id: m.id, numero: m.numero, status: "cancelada", erro: "opt-out" });
      continue;
    }

    if (i > 0) await dormir(2000 + Math.floor(Math.random() * 4000)); // pequena pausa humana entre envios

    try {
      const r = await evolutionFetch(`/message/sendText/${encodeURIComponent(evo.instancia)}`, {
        method: "POST",
        body: { number: m.numero, text: m.texto },
        timeoutMs: 25000,
      });
      if (!r.ok) throw new Error(erroEvolution(r.json, r.status));
      const evolutionId = (r.json as { key?: { id?: string } } | null)?.key?.id ?? null;
      await sb.from("whatsapp_mensagens").update({ status: "enviada", enviado_em: new Date().toISOString(), evolution_id: evolutionId, erro: null }).eq("id", m.id);

      const texto = `WhatsApp enviado: ${m.texto.length > 300 ? m.texto.slice(0, 300) + "…" : m.texto}`;
      if (m.cliente_id || m.lead_id) {
        await sb.from("crm_atividades").insert({ cliente_id: m.cliente_id, lead_id: m.lead_id, tipo: "whatsapp", texto, concluido: true });
      }
      if (m.lead_id) {
        await sb.from("leads").update({ status: "contatado", atualizado_em: new Date().toISOString() }).eq("id", m.lead_id).in("status", ["novo", "qualificado"]);
      }
      resultado.push({ id: m.id, numero: m.numero, status: "enviada" });
    } catch (e) {
      const tentativas = m.tentativas + 1;
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      await sb
        .from("whatsapp_mensagens")
        .update({
          status: "erro",
          erro: tentativas >= MAX_TENTATIVAS ? `${msg} (desistiu após ${tentativas} tentativas)` : msg,
          tentativas,
          // nova tentativa com espera crescente (5, 10 min)
          enviar_apos: new Date(Date.now() + tentativas * 5 * 60000).toISOString(),
        })
        .eq("id", m.id);
      resultado.push({ id: m.id, numero: m.numero, status: "erro", erro: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    horario: hhmm,
    limite,
    enviadas_hoje_antes: enviadasHoje ?? 0,
    processadas: resultado.length,
    enviadas: resultado.filter((r) => r.status === "enviada").length,
    erros: resultado.filter((r) => r.status === "erro").length,
    canceladas: resultado.filter((r) => r.status === "cancelada").length,
    resultado,
  });
}

// A Vercel Cron chama via GET com "Authorization: Bearer $CRON_SECRET" — mesma lógica e mesma proteção do POST.
export const GET = POST;
