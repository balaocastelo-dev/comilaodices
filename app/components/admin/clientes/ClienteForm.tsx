"use client";
import { useState } from "react";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIAS_CLIENTE, normalizarWhatsapp, num, soDigitos } from "@/lib/format";
import type { Cliente, CrmEtapa } from "@/lib/types";

type F = Record<
  "tipo" | "nome" | "fantasia" | "documento" | "categoria" | "contato_nome" | "whatsapp" | "telefone" | "email" | "endereco" | "bairro" | "cidade" | "cep" | "etapa_id" | "tabela_preco" | "prazo_dias" | "limite_credito" | "observacoes",
  string
> & { opt_out: boolean };

function toForm(c?: Partial<Cliente>): F {
  return {
    tipo: c?.tipo ?? "PJ", nome: c?.nome ?? "", fantasia: c?.fantasia ?? "", documento: c?.documento ?? "", categoria: c?.categoria ?? "",
    contato_nome: c?.contato_nome ?? "", whatsapp: c?.whatsapp ?? "", telefone: c?.telefone ?? "", email: c?.email ?? "", endereco: c?.endereco ?? "",
    bairro: c?.bairro ?? "", cidade: c?.cidade ?? "Campinas", cep: c?.cep ?? "", etapa_id: c?.etapa_id ? String(c.etapa_id) : "",
    tabela_preco: c?.tabela_preco ?? "atacado", prazo_dias: String(c?.prazo_dias ?? 0), limite_credito: String(c?.limite_credito ?? 0),
    observacoes: c?.observacoes ?? "", opt_out: c?.opt_out ?? false,
  };
}

export function ClienteForm({ cliente, etapas, onSalvo, onCancelar }: { cliente?: Cliente; etapas: CrmEtapa[]; onSalvo: (id: string) => void; onCancelar: () => void }) {
  const [f, setF] = useState<F>(toForm(cliente));
  const { executar, carregando, erro, setErro } = useAcao();
  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function salvar() {
    setErro(null);
    if (!f.nome.trim()) return setErro("Informe o nome / razão social.");
    const doc = soDigitos(f.documento);
    if (doc && doc.length !== 11 && doc.length !== 14) return setErro("CPF/CNPJ inválido (11 ou 14 dígitos).");
    const sb = createClient();
    const dados = {
      tipo: f.tipo, nome: f.nome.trim(), fantasia: f.fantasia.trim() || null, documento: doc || null, categoria: f.categoria || null,
      contato_nome: f.contato_nome.trim() || null, whatsapp: normalizarWhatsapp(f.whatsapp) || null, telefone: f.telefone.trim() || null,
      email: f.email.trim() || null, endereco: f.endereco.trim() || null, bairro: f.bairro.trim() || null, cidade: f.cidade.trim() || null,
      cep: soDigitos(f.cep) || null, etapa_id: f.etapa_id ? Number(f.etapa_id) : null, tabela_preco: f.tabela_preco,
      prazo_dias: Math.max(0, Math.floor(num(f.prazo_dias))), limite_credito: Math.max(0, num(f.limite_credito)), observacoes: f.observacoes.trim() || null,
      opt_out: f.opt_out, atualizado_em: new Date().toISOString(),
    };
    const id = await executar(async () => {
      if (cliente) {
        ok(await sb.from("clientes").update(dados).eq("id", cliente.id));
        return cliente.id;
      }
      const { data } = ok(await sb.from("clientes").insert({ ...dados, origem: "manual", etapa_id: dados.etapa_id ?? etapas[0]?.id ?? null }).select("id").single());
      return (data as { id: string }).id;
    });
    if (id) onSalvo(id);
  }

  return (
    <div className="grid gap-3 text-sm sm:grid-cols-6">
      <div className="sm:col-span-1">
        <label className="label">Tipo</label>
        <select className="input" value={f.tipo} onChange={set("tipo")}>
          <option value="PJ">PJ</option>
          <option value="PF">PF</option>
        </select>
      </div>
      <div className="sm:col-span-3">
        <label className="label">Razão social / nome *</label>
        <input className="input" value={f.nome} onChange={set("nome")} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Nome fantasia</label>
        <input className="input" value={f.fantasia} onChange={set("fantasia")} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">{f.tipo === "PJ" ? "CNPJ" : "CPF"}</label>
        <input className="input" value={f.documento} onChange={set("documento")} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Categoria</label>
        <select className="input" value={f.categoria} onChange={set("categoria")}>
          <option value="">—</option>
          {CATEGORIAS_CLIENTE.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Contato</label>
        <input className="input" value={f.contato_nome} onChange={set("contato_nome")} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">WhatsApp</label>
        <input className="input" value={f.whatsapp} onChange={set("whatsapp")} placeholder="(19) 99999-9999" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Telefone</label>
        <input className="input" value={f.telefone} onChange={set("telefone")} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">E-mail</label>
        <input className="input" type="email" value={f.email} onChange={set("email")} />
      </div>
      <div className="sm:col-span-4">
        <label className="label">Endereço</label>
        <input className="input" value={f.endereco} onChange={set("endereco")} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Bairro</label>
        <input className="input" value={f.bairro} onChange={set("bairro")} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Cidade</label>
        <input className="input" value={f.cidade} onChange={set("cidade")} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">CEP</label>
        <input className="input" value={f.cep} onChange={set("cep")} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Etapa CRM</label>
        <select className="input" value={f.etapa_id} onChange={set("etapa_id")}>
          <option value="">—</option>
          {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Tabela de preço</label>
        <select className="input" value={f.tabela_preco} onChange={set("tabela_preco")}>
          <option value="atacado">Atacado</option>
          <option value="varejo">Varejo</option>
        </select>
      </div>
      <div className="sm:col-span-1">
        <label className="label">Prazo (dias)</label>
        <input type="number" min={0} className="input" value={f.prazo_dias} onChange={set("prazo_dias")} />
      </div>
      <div className="sm:col-span-1">
        <label className="label">Limite crédito</label>
        <input type="number" min={0} step="0.01" className="input" value={f.limite_credito} onChange={set("limite_credito")} />
      </div>
      <div className="sm:col-span-6">
        <label className="label">Observações</label>
        <textarea className="input" rows={2} value={f.observacoes} onChange={set("observacoes")} />
      </div>
      <label className="flex items-center gap-2 sm:col-span-6">
        <input type="checkbox" checked={f.opt_out} onChange={(e) => setF({ ...f, opt_out: e.target.checked })} />
        Não quer receber mensagens de WhatsApp (opt-out)
      </label>
      <div className="sm:col-span-6"><ErroMsg erro={erro} /></div>
      <div className="flex justify-end gap-2 sm:col-span-6">
        <button className="btn-outline" onClick={onCancelar}>Cancelar</button>
        <button className="btn-yellow" onClick={salvar} disabled={carregando}>Salvar</button>
      </div>
    </div>
  );
}
