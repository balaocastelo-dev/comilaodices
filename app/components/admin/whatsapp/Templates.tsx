"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { preencherTemplate } from "@/lib/format";
import type { WaTemplate } from "@/lib/types";

export function Templates({ templates }: { templates: WaTemplate[] }) {
  const { executar, carregando, erro, setErro } = useAcao();
  const [form, setForm] = useState<Partial<WaTemplate> | null>(null);
  const sb = createClient();

  async function salvar() {
    if (!form) return;
    if (!form.nome?.trim() || !form.texto?.trim()) return setErro("Preencha nome e texto.");
    const dados = { nome: form.nome.trim(), texto: form.texto, ativo: form.ativo ?? true };
    const r = await executar(async () => ok(form.id ? await sb.from("whatsapp_templates").update(dados).eq("id", form.id) : await sb.from("whatsapp_templates").insert(dados)));
    if (r) setForm(null);
  }

  async function excluir(t: WaTemplate) {
    if (!window.confirm(`Excluir o template "${t.nome}"? (Se já foi usado, será apenas desativado.)`)) return;
    await executar(async () => {
      const { error } = await sb.from("whatsapp_templates").delete().eq("id", t.id);
      if (error) ok(await sb.from("whatsapp_templates").update({ ativo: false }).eq("id", t.id));
    });
  }

  const inserir = (v: string) => setForm((f) => (f ? { ...f, texto: (f.texto ?? "") + v } : f));

  return (
    <div>
      <div className="mb-3 flex justify-between">
        <p className="text-sm text-gray-600">Variáveis: <code>{"{{nome}}"}</code> <code>{"{{cidade}}"}</code> <code>{"{{link_loja}}"}</code>. Inclua sempre a opção “responda SAIR”.</p>
        <button className="btn-yellow" onClick={() => { setErro(null); setForm({ nome: "", texto: "", ativo: true }); }}>
          <Plus size={16} /> Novo template
        </button>
      </div>
      {!form && <ErroMsg erro={erro} />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className={`card flex flex-col p-3 ${t.ativo ? "" : "opacity-50"}`}>
            <div className="mb-2 flex items-center gap-2">
              <b>{t.nome}</b>
              {!t.ativo && <span className="badge bg-gray-200 text-gray-600">inativo</span>}
              <button className="ml-auto p-1 text-gray-500 hover:text-blue-600" onClick={() => { setErro(null); setForm(t); }} aria-label="Editar"><Pencil size={15} /></button>
              <button className="p-1 text-gray-500 hover:text-red-600" onClick={() => excluir(t)} aria-label="Excluir"><Trash2 size={15} /></button>
            </div>
            <div className="flex-1 whitespace-pre-line rounded-lg bg-[#DCF8C6] p-2 text-sm text-gray-800">{t.texto}</div>
          </div>
        ))}
      </div>

      <Modal aberto={!!form} titulo={form?.id ? "Editar template" : "Novo template"} onFechar={() => setForm(null)} largura="max-w-xl">
        {form && (
          <div className="space-y-3 text-sm">
            <div>
              <label className="label">Nome</label>
              <input className="input" value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1">
                <label className="label !mb-0">Texto</label>
                {["{{nome}}", "{{cidade}}", "{{link_loja}}"].map((v) => (
                  <button key={v} type="button" className="btn-outline btn-sm ml-1" onClick={() => inserir(v)}>{v}</button>
                ))}
              </div>
              <textarea className="input" rows={7} value={form.texto ?? ""} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
            </div>
            <div>
              <div className="label">Prévia</div>
              <div className="whitespace-pre-line rounded-lg bg-[#DCF8C6] p-2">
                {preencherTemplate(form.texto ?? "", { nome: "Padaria Pão Quente", cidade: "Campinas", link_loja: "https://komilaodoces.com.br" })}
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.ativo ?? true} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo
            </label>
            <ErroMsg erro={erro} />
            <div className="flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn-yellow" onClick={salvar} disabled={carregando}>Salvar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
