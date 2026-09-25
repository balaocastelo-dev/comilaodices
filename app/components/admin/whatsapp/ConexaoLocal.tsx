"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Laptop, Loader2, Plug, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatarTelefone } from "@/lib/format";

type StatusLocal = {
  estado: "iniciando" | "aguardando_qr" | "conectado" | "reconectando" | "desconectado" | "offline";
  qr: string | null;
  numero: string | null;
  nome: string | null;
  mensagem: string | null;
  visto_em: string;
  computador: string | null;
};

const OFFLINE_MS = 90_000;

/** Conexão pelo conector "WhatsApp Komilão" que roda no computador da loja (sem servidor). */
export function ConexaoLocal({ ehAdmin }: { ehAdmin: boolean }) {
  const [st, setSt] = useState<StatusLocal | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb.from("config").select("valor").eq("chave", "whatsapp_local").maybeSingle();
    setSt((data?.valor as StatusLocal | undefined) ?? null);
    setCarregado(true);
    setAgora(Date.now());
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 4000);
    return () => clearInterval(t);
  }, [carregar]);

  async function desconectar() {
    if (!window.confirm("Desconectar este número do WhatsApp? Será preciso escanear um novo QR code.")) return;
    setEnviando(true);
    const sb = createClient();
    await sb.from("config").upsert({ chave: "whatsapp_local_cmd", valor: { acao: "desconectar", em: new Date().toISOString() } });
    setEnviando(false);
  }

  const online = !!st && st.estado !== "offline" && agora - new Date(st.visto_em).getTime() < OFFLINE_MS;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <Laptop size={18} />
        <b>Conector no computador da loja</b>
        <span className="ml-auto text-xs text-gray-400">atualiza sozinho</span>
      </div>

      {!carregado && <p className="text-gray-500"><Loader2 size={14} className="inline animate-spin" /> Consultando…</p>}

      {carregado && !online && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-1 flex items-center gap-2 font-semibold text-gray-700"><WifiOff size={16} /> Conector desligado</div>
          <p className="text-gray-600">
            Abra o atalho <b>“WhatsApp Komilão”</b> na Área de Trabalho do computador da loja e deixe a janela aberta.
            Em alguns segundos o QR code aparece aqui.
          </p>
          {st?.visto_em && <p className="mt-1 text-xs text-gray-400">Último sinal: {new Date(st.visto_em).toLocaleString("pt-BR")}{st.computador ? ` · ${st.computador}` : ""}</p>}
        </div>
      )}

      {online && st?.estado === "conectado" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center gap-2 font-semibold text-green-800"><CheckCircle2 size={16} /> WhatsApp conectado</div>
          <p className="mt-1 text-green-900">
            Número: <b>{st.numero ? formatarTelefone(st.numero) : "—"}</b>{st.nome ? ` (${st.nome})` : ""}
            {st.computador ? <span className="text-green-700"> · no computador {st.computador}</span> : null}
          </p>
          <p className="mt-1 text-xs text-green-800">As mensagens aprovadas na Fila saem por este número, dentro do horário e do limite diário.</p>
          {ehAdmin && (
            <button className="btn-outline btn-sm mt-2 text-red-600" onClick={desconectar} disabled={enviando}>
              <Plug size={14} /> Desconectar número
            </button>
          )}
        </div>
      )}

      {online && st?.estado === "aguardando_qr" && st.qr && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 p-3">
          <img src={st.qr} alt="QR code do WhatsApp" className="h-64 w-64" />
          <p className="text-center text-xs text-gray-600">
            No celular da loja: <b>WhatsApp → ⋮ → Aparelhos conectados → Conectar aparelho</b> e aponte para este QR.
            <br />Ele é renovado automaticamente.
          </p>
        </div>
      )}

      {online && ["iniciando", "reconectando"].includes(st?.estado ?? "") && (
        <p className="text-gray-600"><Loader2 size={14} className="inline animate-spin" /> {st?.estado === "iniciando" ? "Iniciando o conector…" : "Reconectando ao WhatsApp…"}</p>
      )}
      {online && st?.estado === "desconectado" && <p className="text-orange-700">{st.mensagem ?? "Desconectado."} Gerando novo QR code…</p>}
    </div>
  );
}
