import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { segredoIgual } from "@/lib/seguranca";
import { variacoesNumero } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PALAVRAS_SAIDA = new Set(["SAIR", "PARAR", "STOP", "CANCELAR"]);

type EvoMsg = {
  key?: { remoteJid?: string; remoteJidAlt?: string; fromMe?: boolean; id?: string; participant?: string; senderPn?: string };
  message?: { conversation?: string; extendedTextMessage?: { text?: string } } | null;
  pushName?: string;
};

function extrairNumero(d: EvoMsg): string | null {
  const cands = [d.key?.remoteJid, d.key?.remoteJidAlt, d.key?.senderPn].filter(Boolean) as string[];
  const jid = cands.find((j) => j.endsWith("@s.whatsapp.net")) ?? null;
  if (!jid) return null; // grupos (@g.us), status, @lid sem número real → ignora
  const n = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
  return n || null;
}

function normalizar(t: string) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .toUpperCase();
}

/**
 * Webhook da Evolution API (evento messages.upsert).
 * Configure na Evolution: URL = https://komilaodoces.com.br/api/whatsapp/webhook?token=WHATSAPP_WEBHOOK_SECRET
 */
export async function POST(req: NextRequest) {
  if (!segredoIgual(req.nextUrl.searchParams.get("token"), process.env.WHATSAPP_WEBHOOK_SECRET)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { event?: string; data?: EvoMsg | EvoMsg[] } | null;
  if (!body) return NextResponse.json({ ok: true, ignorado: "corpo inválido" });
  const evento = String(body.event ?? "").toLowerCase().replace(/_/g, ".");
  if (evento !== "messages.upsert") return NextResponse.json({ ok: true, ignorado: evento || "sem evento" });

  const lista = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
  let sb;
  try {
    sb = createAdminClient();
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  const processadas: { numero: string; optout: boolean }[] = [];
  for (const d of lista) {
    if (!d?.key || d.key.fromMe) continue;
    const numero = extrairNumero(d);
    if (!numero) continue;
    const texto = d.message?.conversation ?? d.message?.extendedTextMessage?.text ?? null;

    await sb.from("whatsapp_recebidas").insert({ numero, texto, payload: d as unknown as Record<string, unknown> });

    const variantes = variacoesNumero(numero);
    const optout = !!texto && PALAVRAS_SAIDA.has(normalizar(texto));
    const agora = new Date().toISOString();

    if (optout) {
      await sb.from("whatsapp_optout").upsert(variantes.map((n) => ({ numero: n, motivo: `respondeu "${texto!.trim().slice(0, 30)}"` })), { onConflict: "numero" });
      await sb.from("clientes").update({ opt_out: true, atualizado_em: agora }).in("whatsapp", variantes);
      await sb.from("whatsapp_mensagens").update({ status: "cancelada", erro: "opt-out" }).in("numero", variantes).in("status", ["pendente_aprovacao", "aprovada", "erro"]);
    }

    const [{ data: leads }, { data: clientes }] = await Promise.all([
      sb.from("leads").select("id,status").in("whatsapp", variantes),
      sb.from("clientes").select("id").in("whatsapp", variantes),
    ]);

    const leadsAtivos = ((leads as { id: string; status: string }[]) ?? []).filter((l) => l.status === "novo" || l.status === "qualificado");
    if (leadsAtivos.length) {
      await sb.from("leads").update({ status: "contatado", atualizado_em: agora }).in("id", leadsAtivos.map((l) => l.id));
    }

    const resumo = texto ? (texto.length > 300 ? texto.slice(0, 300) + "…" : texto) : "(mídia)";
    const nota = optout ? `Pediu para não receber mensagens (opt-out): "${resumo}"` : `WhatsApp recebido${d.pushName ? ` de ${d.pushName}` : ""}: ${resumo}`;
    const atividades = [
      ...((clientes as { id: string }[]) ?? []).map((c) => ({ cliente_id: c.id, lead_id: null, tipo: "whatsapp", texto: nota, concluido: true })),
      ...((leads as { id: string }[]) ?? []).map((l) => ({ cliente_id: null, lead_id: l.id, tipo: "whatsapp", texto: nota, concluido: true })),
    ];
    if (atividades.length) await sb.from("crm_atividades").insert(atividades);

    processadas.push({ numero, optout });
  }

  return NextResponse.json({ ok: true, processadas });
}
