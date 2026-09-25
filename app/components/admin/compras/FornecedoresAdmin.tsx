"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { createClient } from "@/lib/supabase/client";
import { formatarDocumento, formatarTelefone, linkWhatsapp, normalizarWhatsapp, num, soDigitos } from "@/lib/format";
import type { Fornecedor } from "@/lib/types";

type F = { id?: string; nome: string; documento: string; contato: string; whatsapp: string; email: string; prazo_dias: string; observacoes: string };
const vazio: F = { nome: "", documento: "", contato: "", whatsapp: "", email: "", prazo_dias: "0", observacoes: "" };

export function FornecedoresAdmin({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const { executar, carregando, erro, setErro } = useAcao();
  const [form, setForm] = useState<F | null>(null);
  const [busca, setBusca] = useState("");
  const sb = createClient();

  async function salvar() {
    if (!form) return;
    if (!form.nome.trim()) return setErro("Informe o nome.");
    const dados = {
      nome: form.nome.trim(), documento: soDigitos(form.documento) || null, contato: form.contato.trim() || null, whatsapp: normalizarWhatsapp(form.whatsapp) || null,
      email: form.email.trim() || null, prazo_dias: Math.max(0, Math.floor(num(form.prazo_dias))), observacoes: form.observacoes.trim() || null,
    };
    const r = await executar(async () => ok(form.id ? await sb.from("fornecedores").update(dados).eq("id", form.id) : await sb.from("fornecedores").insert(dados)));
    if (r) setForm(null);
  }

  async function excluir(f: Fornecedor) {
    if (!window.confirm(`Excluir ${f.nome}?`)) return;
    await executar(async () => {
      const { error } = await sb.from("fornecedores").delete().eq("id", f.id);
      if (error) throw new Error(error.code === "23503" ? "Fornecedor tem compras/contas vinculadas — não pode ser excluído." : error.message);
    });
  }

  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((x) => (x ? { ...x, [k]: e.target.value } : x));
  const lista = fornecedores.filter((f) => !busca || f.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <>
      <div className="mb-3 flex gap-2">
        <input className="input w-60" placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="btn-yellow ml-auto" onClick={() => { setErro(null); setForm({ ...vazio }); }}><Plus size={16} /> Novo fornecedor</button>
      </div>
      {!form && <ErroMsg erro={erro} />}
      <div className="card overflow-x-auto">
        <table className="table-admin">
          <thead><tr><th>Nome</th><th>CNPJ</th><th>Contato</th><th>WhatsApp</th><th>E-mail</th><th className="text-right">Prazo</th><th /></tr></thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.id}>
                <td className="font-medium">{f.nome}{f.observacoes && <div className="text-xs font-normal text-gray-500">{f.observacoes}</div>}</td>
                <td className="text-xs">{formatarDocumento(f.documento)}</td>
                <td>{f.contato ?? "—"}</td>
                <td>{f.whatsapp ? <a className="text-green-700 hover:underline" href={linkWhatsapp(f.whatsapp)} target="_blank" rel="noopener noreferrer">{formatarTelefone(f.whatsapp)}</a> : "—"}</td>
                <td>{f.email ?? "—"}</td>
                <td className="text-right">{f.prazo_dias} dias</td>
                <td className="whitespace-nowrap text-right">
                  <button className="p-1 text-gray-500 hover:text-blue-600" aria-label="Editar" onClick={() => { setErro(null); setForm({ id: f.id, nome: f.nome, documento: f.documento ?? "", contato: f.contato ?? "", whatsapp: f.whatsapp ?? "", email: f.email ?? "", prazo_dias: String(f.prazo_dias), observacoes: f.observacoes ?? "" }); }}><Pencil size={16} /></button>
                  <button className="p-1 text-gray-500 hover:text-red-600" aria-label="Excluir" onClick={() => excluir(f)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={7} className="py-6 text-center text-gray-500">Nenhum fornecedor.</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal aberto={!!form} titulo={form?.id ? "Editar fornecedor" : "Novo fornecedor"} onFechar={() => setForm(null)}>
        {form && (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Nome *</label><input className="input" value={form.nome} onChange={set("nome")} /></div>
            <div><label className="label">CNPJ</label><input className="input" value={form.documento} onChange={set("documento")} /></div>
            <div><label className="label">Contato</label><input className="input" value={form.contato} onChange={set("contato")} /></div>
            <div><label className="label">WhatsApp</label><input className="input" value={form.whatsapp} onChange={set("whatsapp")} /></div>
            <div><label className="label">E-mail</label><input className="input" type="email" value={form.email} onChange={set("email")} /></div>
            <div><label className="label">Prazo padrão (dias)</label><input className="input" type="number" min={0} value={form.prazo_dias} onChange={set("prazo_dias")} /></div>
            <div className="sm:col-span-2"><label className="label">Observações</label><textarea className="input" rows={2} value={form.observacoes} onChange={set("observacoes")} /></div>
            <div className="sm:col-span-2"><ErroMsg erro={erro} /></div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button className="btn-outline" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn-yellow" onClick={salvar} disabled={carregando}>Salvar</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
