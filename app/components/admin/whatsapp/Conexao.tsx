"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plug, PlugZap, QrCode, RefreshCw } from "lucide-react";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { ConexaoLocal } from "@/components/admin/whatsapp/ConexaoLocal";

type Estado = { configurado: boolean; instancia?: string | null; existe?: boolean | null; estado?: string | null; qr?: string | null; pairingCode?: string | null; erro?: string };

const ROTULO: Record<string, { l: string; cls: string }> = {
  open: { l: "Conectado", cls: "bg-green-100 text-green-800" },
  connecting: { l: "Conectando (aguardando QR)", cls: "bg-yellow-100 text-yellow-800" },
  close: { l: "Desconectado", cls: "bg-red-100 text-red-800" },
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function Conexao({ ehAdmin, limite, horario }: { ehAdmin: boolean; limite: number; horario: { inicio: string; fim: string; dias: number[] } }) {
  const [st, setSt] = useState<Estado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroReq, setErroReq] = useState<string | null>(null);
  const cfgAcao = useAcao();
  const [lim, setLim] = useState(String(limite));
  const [ini, setIni] = useState(horario.inicio);
  const [fim, setFim] = useState(horario.fim);
  const [dias, setDias] = useState<number[]>(horario.dias.map((d) => (d === 7 ? 0 : d)));

  const carregar = useCallback(async (qr = false) => {
    setCarregando(true);
    setErroReq(null);
    try {
      const r = await fetch(`/api/admin/evolution${qr ? "?qr=1" : ""}`, { cache: "no-store" });
      const j = (await r.json()) as Estado & { erro?: string };
      if (!r.ok) throw new Error(j.erro ?? `HTTP ${r.status}`);
      setSt(j);
    } catch (e) {
      setErroReq(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar(false);
  }, [carregar]);

  // enquanto mostra QR, atualiza a cada 20s (QR expira)
  useEffect(() => {
    if (!st?.qr || st.estado === "open") return;
    const t = setInterval(() => carregar(true), 20000);
    return () => clearInterval(t);
  }, [st?.qr, st?.estado, carregar]);

  async function acao(a: "criar" | "desconectar") {
    if (a === "desconectar" && !window.confirm("Desconectar o WhatsApp desta instância?")) return;
    setCarregando(true);
    setErroReq(null);
    try {
      const r = await fetch("/api/admin/evolution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: a }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? `HTTP ${r.status}`);
      await carregar(a === "criar");
    } catch (e) {
      setErroReq(e instanceof Error ? e.message : String(e));
      setCarregando(false);
    }
  }

  async function salvarConfig() {
    const sb = createClient();
    await cfgAcao.executar(async () => {
      const l = Math.max(1, Math.min(500, Math.floor(Number(lim) || 40)));
      ok(await sb.from("config").upsert({ chave: "whatsapp_limite_diario", valor: l }));
      ok(await sb.from("config").upsert({ chave: "whatsapp_horario", valor: { inicio: ini, fim, dias: [...dias].sort() } }));
    });
  }

  const rot = st?.estado ? ROTULO[st.estado] ?? { l: st.estado, cls: "bg-gray-100 text-gray-700" } : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-semibold">{st && !st.configurado ? "Conexão do WhatsApp" : "Instância Evolution"}</h2>
          <button className="btn-outline btn-sm ml-auto" onClick={() => carregar(false)} disabled={carregando}>
            {carregando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Atualizar
          </button>
        </div>
        {!st && carregando && <p className="text-sm text-gray-500">Consultando…</p>}
        {st && !st.configurado && <ConexaoLocal ehAdmin={ehAdmin} />}
        {st?.configurado && (
          <div className="space-y-3 text-sm">
            <div>
              Instância: <b>{st.instancia}</b> {rot && <span className={`badge ml-1 ${rot.cls}`}>{rot.l}</span>}
            </div>
            {st.existe === false && (
              <div className="space-y-2">
                <p className="text-gray-600">A instância ainda não existe na Evolution.</p>
                {ehAdmin ? (
                  <button className="btn-yellow" onClick={() => acao("criar")} disabled={carregando}>
                    <PlugZap size={16} /> Criar instância
                  </button>
                ) : (
                  <p className="text-xs text-gray-500">Peça a um administrador para criar.</p>
                )}
              </div>
            )}
            {st.existe && st.estado !== "open" && (
              <button className="btn-primary" onClick={() => carregar(true)} disabled={carregando}>
                <QrCode size={16} /> Gerar QR code para conectar
              </button>
            )}
            {st.qr && st.estado !== "open" && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 p-3">
                <img src={st.qr} alt="QR code do WhatsApp" className="h-64 w-64" />
                {st.pairingCode && <div>Código de pareamento: <b className="font-mono">{st.pairingCode}</b></div>}
                <p className="text-center text-xs text-gray-500">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. O QR é renovado a cada 20 s.</p>
              </div>
            )}
            {st.estado === "open" && ehAdmin && (
              <button className="btn-outline text-red-600" onClick={() => acao("desconectar")} disabled={carregando}>
                <Plug size={16} /> Desconectar
              </button>
            )}
          </div>
        )}
        <div className="mt-2">
          <ErroMsg erro={erroReq ?? st?.erro ?? null} />
        </div>
      </div>

      <div className="card p-4 text-sm">
        <h2 className="mb-3 font-semibold">Regras de envio</h2>
        {ehAdmin ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Limite diário</label>
                <input type="number" min={1} max={500} className="input" value={lim} onChange={(e) => setLim(e.target.value)} />
              </div>
              <div>
                <label className="label">Início</label>
                <input type="time" className="input" value={ini} onChange={(e) => setIni(e.target.value)} />
              </div>
              <div>
                <label className="label">Fim</label>
                <input type="time" className="input" value={fim} onChange={(e) => setFim(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {DIAS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDias((ds) => (ds.includes(i) ? ds.filter((x) => x !== i) : [...ds, i]))}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${dias.includes(i) ? "bg-komi-ink text-white" : "bg-gray-100 text-gray-600"}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <ErroMsg erro={cfgAcao.erro} />
            <button className="btn-yellow" onClick={salvarConfig} disabled={cfgAcao.carregando}>Salvar regras</button>
            <p className="text-xs text-gray-500">Fuso: America/Sao_Paulo. Recomendado começar com 20–40 mensagens/dia em chip novo.</p>
          </div>
        ) : (
          <p className="text-gray-600">
            Limite diário: <b>{limite}</b> · horário {horario.inicio}–{horario.fim} · dias {horario.dias.map((d) => DIAS[d % 7]).join(", ")}. Apenas administradores alteram.
          </p>
        )}
        <div className="mt-4 rounded bg-gray-50 p-3 text-xs text-gray-600">
          <b>Como funciona:</b> o conector “WhatsApp Komilão” (no computador da loja) ou a Evolution API verificam a fila a cada poucos segundos e
          enviam no máximo 5 mensagens aprovadas por vez, com pausas, dentro do horário e do limite diário. Respostas “SAIR/PARAR/STOP/CANCELAR”
          viram opt-out automaticamente.
        </div>
      </div>
    </div>
  );
}
