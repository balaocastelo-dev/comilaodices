"use client";
import { useState } from "react";
import { FileUp } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { normalizarWhatsapp } from "@/lib/format";

const FONTES = new Set(["osm", "google_places", "manual", "site", "indicacao"]);
const LOTE = 500;

type LeadImport = {
  fonte: string; fonte_id: string | null; nome: string; categoria: string | null; endereco: string | null; bairro: string | null; cidade: string | null;
  cep: string | null; lat: number | null; lon: number | null; telefone: string | null; whatsapp: string | null; site: string | null; instagram: string | null;
  horario: string | null; score: number; dados: Record<string, unknown>; atualizado_em: string;
};

const txt = (v: unknown) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());
const numOuNull = (v: unknown) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

function mapear(o: Record<string, unknown>, agora: string): LeadImport | null {
  const nome = txt(o.nome);
  if (!nome) return null;
  const fonte = txt(o.fonte) ?? "manual";
  const wa = txt(o.whatsapp);
  return {
    fonte: FONTES.has(fonte) ? fonte : "manual",
    fonte_id: txt(o.fonte_id),
    nome,
    categoria: txt(o.categoria)?.toLowerCase() ?? null,
    endereco: txt(o.endereco),
    bairro: txt(o.bairro),
    cidade: txt(o.cidade),
    cep: txt(o.cep),
    lat: numOuNull(o.lat),
    lon: numOuNull(o.lon),
    telefone: txt(o.telefone),
    whatsapp: wa ? normalizarWhatsapp(wa) || null : null,
    site: txt(o.site),
    instagram: txt(o.instagram),
    horario: txt(o.horario),
    score: Math.round(numOuNull(o.score) ?? 0),
    dados: o.dados && typeof o.dados === "object" && !Array.isArray(o.dados) ? (o.dados as Record<string, unknown>) : {},
    atualizado_em: agora,
  };
}

/** Importa leads.json. Upsert por (fonte, fonte_id) SEM alterar status/cliente de leads já existentes. */
export function ImportarLeads() {
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [progresso, setProgresso] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const { executar, carregando, erro, setErro } = useAcao();

  async function importar() {
    setErro(null);
    setResultado(null);
    if (!arquivo) return setErro("Escolha o arquivo leads.json");
    const sb = createClient();
    const r = await executar(async () => {
      let json: unknown;
      try {
        json = JSON.parse(await arquivo.text());
      } catch {
        throw new Error("Arquivo não é um JSON válido.");
      }
      const arr = Array.isArray(json) ? json : Array.isArray((json as { leads?: unknown }).leads) ? (json as { leads: unknown[] }).leads : null;
      if (!arr) throw new Error("O JSON deve ser um array de leads.");
      const agora = new Date().toISOString();
      const validos: LeadImport[] = [];
      let invalidos = 0;
      const vistos = new Set<string>();
      for (const item of arr) {
        const l = item && typeof item === "object" ? mapear(item as Record<string, unknown>, agora) : null;
        if (!l) { invalidos++; continue; }
        if (l.fonte_id) {
          const k = `${l.fonte}|${l.fonte_id}`;
          if (vistos.has(k)) continue; // duplicado no próprio arquivo
          vistos.add(k);
        }
        validos.push(l);
      }
      const comId = validos.filter((l) => l.fonte_id);
      const semId = validos.filter((l) => !l.fonte_id);
      let feitos = 0;
      for (let i = 0; i < comId.length; i += LOTE) {
        const lote = comId.slice(i, i + LOTE);
        // status/motivo/cliente_id não são enviados → leads existentes mantêm o status; novos entram como 'novo'
        const { error } = await sb.from("leads").upsert(lote, { onConflict: "fonte,fonte_id" });
        if (error) throw new Error(`Lote ${i / LOTE + 1}: ${error.message}`);
        feitos += lote.length;
        setProgresso(`${feitos} / ${validos.length}`);
      }
      for (let i = 0; i < semId.length; i += LOTE) {
        const lote = semId.slice(i, i + LOTE);
        const { error } = await sb.from("leads").insert(lote);
        if (error) throw new Error(`Lote sem fonte_id: ${error.message}`);
        feitos += lote.length;
        setProgresso(`${feitos} / ${validos.length}`);
      }
      return { total: arr.length, feitos, invalidos, semId: semId.length };
    });
    if (r) {
      setResultado(`${r.feitos} lead(s) importados/atualizados de ${r.total}. ${r.invalidos ? `${r.invalidos} ignorado(s) sem nome. ` : ""}${r.semId ? `${r.semId} sem fonte_id foram inseridos como novos.` : ""}`);
      setArquivo(null);
    }
  }

  return (
    <>
      <button className="btn-outline" onClick={() => { setAberto(true); setResultado(null); setProgresso(""); }}>
        <FileUp size={16} /> Importar leads.json
      </button>
      <Modal aberto={aberto} titulo="Importar leads" onFechar={() => setAberto(false)}>
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">
            Arquivo JSON com um array de objetos com as colunas: <code className="text-xs">fonte, fonte_id, nome, categoria, endereco, bairro, cidade, cep, lat, lon, telefone, whatsapp, site, instagram, horario, score, dados</code>.
          </p>
          <p className="text-gray-600">Leads já existentes (mesma fonte + fonte_id) têm os dados atualizados, mas o <b>status é preservado</b>.</p>
          <input type="file" accept="application/json,.json" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
          {progresso && carregando && <div className="text-gray-600">Enviando… {progresso}</div>}
          {resultado && <div className="rounded bg-green-50 p-2 text-green-800">{resultado}</div>}
          <ErroMsg erro={erro} />
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setAberto(false)}>Fechar</button>
            <button className="btn-yellow" onClick={importar} disabled={carregando || !arquivo}>Importar</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
