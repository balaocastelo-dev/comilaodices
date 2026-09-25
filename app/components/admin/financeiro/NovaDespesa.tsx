"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { brl, hojeISO, num } from "@/lib/format";
import type { Fornecedor } from "@/lib/types";

const CATEGORIAS = ["aluguel", "salario", "imposto", "frete", "energia", "agua", "internet", "combustivel", "manutencao", "marketing", "mercadoria", "outros"];

function somaMeses(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/** Despesa avulsa (sem compra): aluguel, salário, impostos... Pode repetir mensalmente. */
export function NovaDespesa({ fornecedores }: { fornecedores: Pick<Fornecedor, "id" | "nome">[] }) {
  const [aberto, setAberto] = useState(false);
  const { executar, carregando, erro, setErro } = useAcao();
  const [f, setF] = useState({ descricao: "", categoria: "aluguel", fornecedor_id: "", vencimento: hojeISO(), valor: "", repeticoes: "1" });

  async function salvar() {
    setErro(null);
    if (!f.descricao.trim()) return setErro("Informe a descrição.");
    const v = num(f.valor, -1);
    if (v <= 0) return setErro("Informe o valor.");
    const n = Math.max(1, Math.min(36, Math.floor(num(f.repeticoes, 1))));
    const linhas = Array.from({ length: n }, (_, i) => ({
      descricao: f.descricao.trim(),
      categoria: f.categoria,
      fornecedor_id: f.fornecedor_id || null,
      parcela: i + 1,
      vencimento: somaMeses(f.vencimento, i),
      valor: v,
    }));
    const r = await executar(async () => ok(await createClient().from("contas_pagar").insert(linhas)));
    if (r) {
      setAberto(false);
      setF({ ...f, descricao: "", valor: "", repeticoes: "1" });
    }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <button className="btn-yellow" onClick={() => setAberto(true)}><Plus size={16} /> Despesa avulsa</button>
      <Modal aberto={aberto} titulo="Nova despesa (conta a pagar)" onFechar={() => setAberto(false)}>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Descrição *</label><input className="input" value={f.descricao} onChange={set("descricao")} placeholder="Aluguel do galpão" /></div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={f.categoria} onChange={set("categoria")}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div>
            <label className="label">Fornecedor / favorecido</label>
            <select className="input" value={f.fornecedor_id} onChange={set("fornecedor_id")}>
              <option value="">—</option>
              {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </div>
          <div><label className="label">Vencimento</label><input type="date" className="input" value={f.vencimento} onChange={set("vencimento")} /></div>
          <div><label className="label">Valor (R$) *</label><input type="number" step="0.01" min={0} className="input" value={f.valor} onChange={set("valor")} /></div>
          <div>
            <label className="label">Repetir por (meses)</label>
            <input type="number" min={1} max={36} className="input" value={f.repeticoes} onChange={set("repeticoes")} />
          </div>
          <div className="self-end text-xs text-gray-500">{Number(f.repeticoes) > 1 && num(f.valor) > 0 ? `${f.repeticoes} lançamentos mensais de ${brl(num(f.valor))}` : ""}</div>
          <div className="sm:col-span-2"><ErroMsg erro={erro} /></div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button className="btn-outline" onClick={() => setAberto(false)}>Cancelar</button>
            <button className="btn-yellow" onClick={salvar} disabled={carregando}>Salvar</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
