import { NextResponse, type NextRequest } from "next/server";
import { getEquipeAtual } from "@/lib/auth";
import { erroEvolution, evolutionConfig, evolutionFetch } from "@/lib/evolution";

export const dynamic = "force-dynamic";

async function autorizar() {
  try {
    const { equipe } = await getEquipeAtual();
    return equipe;
  } catch {
    return null;
  }
}

/** GET: estado da instância (e QR code se ?qr=1 e não estiver conectada) */
export async function GET(req: NextRequest) {
  if (!(await autorizar())) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  const cfg = evolutionConfig();
  if (!cfg.configurado) return NextResponse.json({ configurado: false, instancia: cfg.instancia || null });

  try {
    const st = await evolutionFetch(`/instance/connectionState/${encodeURIComponent(cfg.instancia)}`);
    if (st.status === 404) return NextResponse.json({ configurado: true, instancia: cfg.instancia, existe: false, estado: null });
    if (!st.ok) return NextResponse.json({ configurado: true, instancia: cfg.instancia, existe: null, erro: erroEvolution(st.json, st.status) });

    const estado = (st.json as { instance?: { state?: string } } | null)?.instance?.state ?? (st.json as { state?: string } | null)?.state ?? "desconhecido";
    let qr: string | null = null;
    let pairingCode: string | null = null;
    if (req.nextUrl.searchParams.get("qr") === "1" && estado !== "open") {
      const c = await evolutionFetch(`/instance/connect/${encodeURIComponent(cfg.instancia)}`);
      if (c.ok && c.json && typeof c.json === "object") {
        const j = c.json as { base64?: string; qrcode?: { base64?: string }; pairingCode?: string };
        qr = j.base64 ?? j.qrcode?.base64 ?? null;
        pairingCode = j.pairingCode ?? null;
        if (qr && !qr.startsWith("data:")) qr = `data:image/png;base64,${qr}`;
      } else if (!c.ok) {
        return NextResponse.json({ configurado: true, instancia: cfg.instancia, existe: true, estado, erro: erroEvolution(c.json, c.status) });
      }
    }
    return NextResponse.json({ configurado: true, instancia: cfg.instancia, existe: true, estado, qr, pairingCode });
  } catch (e) {
    return NextResponse.json({ configurado: true, instancia: cfg.instancia, erro: `Falha ao falar com a Evolution API: ${e instanceof Error ? e.message : String(e)}` });
  }
}

/** POST {acao: "criar" | "desconectar"} */
export async function POST(req: NextRequest) {
  const eq = await autorizar();
  if (!eq) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  if (eq.papel !== "admin") return NextResponse.json({ erro: "Apenas administradores" }, { status: 403 });
  const cfg = evolutionConfig();
  if (!cfg.configurado) return NextResponse.json({ erro: "Evolution API não configurada" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { acao?: string };

  try {
    if (body.acao === "criar") {
      const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
      const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
      const payload: Record<string, unknown> = { instanceName: cfg.instancia, integration: "WHATSAPP-BAILEYS", qrcode: true };
      if (site && secret) {
        payload.webhook = {
          url: `${site}/api/whatsapp/webhook?token=${encodeURIComponent(secret)}`,
          byEvents: false,
          base64: false,
          events: ["MESSAGES_UPSERT"],
        };
      }
      const r = await evolutionFetch("/instance/create", { method: "POST", body: payload });
      if (!r.ok) return NextResponse.json({ erro: erroEvolution(r.json, r.status) }, { status: 502 });
      const j = r.json as { qrcode?: { base64?: string } } | null;
      return NextResponse.json({ ok: true, qr: j?.qrcode?.base64 ?? null });
    }
    if (body.acao === "desconectar") {
      const r = await evolutionFetch(`/instance/logout/${encodeURIComponent(cfg.instancia)}`, { method: "DELETE" });
      if (!r.ok) return NextResponse.json({ erro: erroEvolution(r.json, r.status) }, { status: 502 });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ erro: "Ação inválida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ erro: `Falha ao falar com a Evolution API: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}
