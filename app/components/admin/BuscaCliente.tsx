"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Cliente } from "@/lib/types";
import { formatarTelefone } from "@/lib/format";

/** Campo de busca de cliente (nome, fantasia, documento ou WhatsApp) */
export function BuscaCliente({ valor, onSelecionar }: { valor: Cliente | null; onSelecionar: (c: Cliente | null) => void }) {
  const [termo, setTermo] = useState("");
  const [res, setRes] = useState<Cliente[]>([]);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const t = termo.trim().replace(/[%,()]/g, " ");
    if (t.length < 2) {
      setRes([]);
      return;
    }
    const h = setTimeout(async () => {
      const { data } = await createClient()
        .from("clientes")
        .select("*")
        .or(`nome.ilike.%${t}%,fantasia.ilike.%${t}%,documento.ilike.%${t}%,whatsapp.ilike.%${t}%`)
        .order("nome")
        .limit(15);
      setRes((data as Cliente[]) ?? []);
      setAberto(true);
    }, 250);
    return () => clearTimeout(h);
  }, [termo]);

  if (valor) {
    return (
      <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
        <div>
          <div className="font-medium">{valor.fantasia || valor.nome}</div>
          <div className="text-xs text-gray-500">
            {formatarTelefone(valor.whatsapp)} · tabela {valor.tabela_preco} · {valor.cidade ?? "—"}
          </div>
        </div>
        <button type="button" className="btn-outline btn-sm" onClick={() => onSelecionar(null)}>
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input className="input" placeholder="Digite nome, CNPJ ou WhatsApp..." value={termo} onChange={(e) => setTermo(e.target.value)} onFocus={() => res.length && setAberto(true)} />
      {aberto && res.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {res.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-komi-yellow-soft"
                onClick={() => {
                  onSelecionar(c);
                  setAberto(false);
                  setTermo("");
                }}
              >
                <div className="font-medium">{c.fantasia || c.nome}</div>
                <div className="text-xs text-gray-500">
                  {formatarTelefone(c.whatsapp)} · {c.cidade ?? "—"} · {c.tabela_preco}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {aberto && termo.trim().length >= 2 && res.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-500 shadow">Nenhum cliente encontrado.</div>
      )}
    </div>
  );
}
