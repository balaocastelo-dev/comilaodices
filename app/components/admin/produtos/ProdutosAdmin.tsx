"use client";
/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { ImagePlus, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { ok, useAcao } from "@/components/admin/useAcao";
import { ProductImage } from "@/components/loja/ProductImage";
import { createClient } from "@/lib/supabase/client";
import { brl, num } from "@/lib/format";
import type { Categoria, Produto } from "@/lib/types";

type Form = {
  id?: string;
  sku: string;
  nome: string;
  marca: string;
  categoria_id: string;
  descricao: string;
  unidade: string;
  qtd_por_caixa: string;
  preco_varejo: string;
  preco_atacado: string;
  pedido_minimo_atacado: string;
  estoque_minimo: string;
  imagem_url: string | null;
  ativo: boolean;
  destaque: boolean;
};

const vazio: Form = {
  sku: "", nome: "", marca: "", categoria_id: "", descricao: "", unidade: "un", qtd_por_caixa: "1", preco_varejo: "", preco_atacado: "",
  pedido_minimo_atacado: "1", estoque_minimo: "0", imagem_url: null, ativo: true, destaque: false,
};

const UNIDADES = ["un", "pote", "pacote", "caixa", "fardo", "kg"];

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ProdutosAdmin({ produtos, categorias, estoque }: { produtos: Produto[]; categorias: Categoria[]; estoque: Record<string, number> }) {
  const { executar, carregando, erro, setErro } = useAcao();
  const [form, setForm] = useState<Form | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroCat, setFiltroCat] = useState("");
  const [novaCat, setNovaCat] = useState("");
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const sb = createClient();

  const lista = produtos.filter((p) => {
    const t = busca.trim().toLowerCase();
    if (filtroCat && String(p.categoria_id) !== filtroCat) return false;
    return !t || p.nome.toLowerCase().includes(t) || (p.sku ?? "").toLowerCase().includes(t) || (p.marca ?? "").toLowerCase().includes(t);
  });

  function abrir(p?: Produto) {
    setErro(null);
    setArquivo(null);
    setPreview(null);
    setForm(
      p
        ? {
            id: p.id, sku: p.sku ?? "", nome: p.nome, marca: p.marca ?? "", categoria_id: p.categoria_id ? String(p.categoria_id) : "", descricao: p.descricao ?? "",
            unidade: p.unidade, qtd_por_caixa: String(p.qtd_por_caixa), preco_varejo: String(p.preco_varejo), preco_atacado: p.preco_atacado == null ? "" : String(p.preco_atacado),
            pedido_minimo_atacado: String(p.pedido_minimo_atacado), estoque_minimo: String(p.estoque_minimo), imagem_url: p.imagem_url, ativo: p.ativo, destaque: p.destaque,
          }
        : { ...vazio },
    );
  }

  async function salvar() {
    if (!form) return;
    setErro(null);
    if (!form.nome.trim()) return setErro("Informe o nome.");
    if (form.preco_varejo === "" || num(form.preco_varejo, -1) < 0) return setErro("Preço de varejo inválido.");
    const r = await executar(async () => {
      const dados = {
        sku: form.sku.trim() || null,
        nome: form.nome.trim(),
        marca: form.marca.trim() || null,
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
        descricao: form.descricao.trim() || null,
        unidade: form.unidade,
        qtd_por_caixa: Math.max(1, Math.floor(num(form.qtd_por_caixa, 1))),
        preco_varejo: num(form.preco_varejo),
        preco_atacado: form.preco_atacado === "" ? null : num(form.preco_atacado),
        pedido_minimo_atacado: Math.max(1, Math.floor(num(form.pedido_minimo_atacado, 1))),
        estoque_minimo: Math.max(0, Math.floor(num(form.estoque_minimo, 0))),
        imagem_url: form.imagem_url,
        ativo: form.ativo,
        destaque: form.destaque,
        atualizado_em: new Date().toISOString(),
      };
      let id = form.id;
      if (id) ok(await sb.from("produtos").update(dados).eq("id", id));
      else {
        const { data } = ok(await sb.from("produtos").insert(dados).select("id").single());
        id = (data as { id: string }).id;
      }
      if (arquivo && id) {
        if (arquivo.size > 5 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 5 MB).");
        const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${id}/${Date.now()}.${ext}`;
        ok(await sb.storage.from("produtos").upload(path, arquivo, { upsert: true, contentType: arquivo.type, cacheControl: "31536000" }));
        const url = sb.storage.from("produtos").getPublicUrl(path).data.publicUrl;
        ok(await sb.from("produtos").update({ imagem_url: url }).eq("id", id));
      }
      return true;
    });
    if (r) setForm(null);
  }

  async function excluir(p: Produto) {
    if (!window.confirm(`Excluir "${p.nome}"? Se já tiver pedidos/compras, será apenas desativado.`)) return;
    await executar(async () => {
      const { error } = await sb.from("produtos").delete().eq("id", p.id);
      if (error) {
        // produto com histórico (FK) → desativa
        ok(await sb.from("produtos").update({ ativo: false }).eq("id", p.id));
      }
    });
  }

  async function criarCategoria() {
    const nome = novaCat.trim();
    if (!nome) return;
    await executar(async () => {
      ok(await sb.from("categorias").insert({ nome, slug: slugify(nome), ordem: categorias.length + 1 }));
      setNovaCat("");
    });
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input w-60" placeholder="Buscar nome, SKU, marca" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="input w-48" value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <input className="input w-40" placeholder="Nova categoria" value={novaCat} onChange={(e) => setNovaCat(e.target.value)} />
          <button className="btn-outline" onClick={criarCategoria} disabled={!novaCat.trim() || carregando}>+ Categoria</button>
          <button className="btn-yellow" onClick={() => abrir()}>
            <Plus size={16} /> Novo produto
          </button>
        </div>
      </div>
      {!form && <ErroMsg erro={erro} />}

      <div className="card overflow-x-auto">
        <table className="table-admin">
          <thead>
            <tr>
              <th className="w-12" />
              <th>Produto</th>
              <th>Categoria</th>
              <th className="text-right">Varejo</th>
              <th className="text-right">Atacado</th>
              <th className="text-right">Mín. atac.</th>
              <th className="text-right">Cx</th>
              <th className="text-right">Custo méd.</th>
              <th className="text-right">Estoque</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const est = estoque[p.id] ?? 0;
              return (
                <tr key={p.id} className={p.ativo ? "" : "opacity-50"}>
                  <td>
                    <div className="h-10 w-10 overflow-hidden rounded">
                      <ProductImage nome={p.nome} url={p.imagem_url} categoriaSlug={p.categoria_id ? catMap.get(p.categoria_id)?.slug : null} tamanho="sm" />
                    </div>
                  </td>
                  <td>
                    <div className="font-medium">{p.nome}</div>
                    <div className="text-xs text-gray-500">{[p.sku, p.marca, p.unidade].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="text-xs">{p.categoria_id ? catMap.get(p.categoria_id)?.nome : "—"}</td>
                  <td className="text-right">{brl(p.preco_varejo)}</td>
                  <td className="text-right">{p.preco_atacado != null ? brl(p.preco_atacado) : <span className="text-gray-400">—</span>}</td>
                  <td className="text-right">{p.pedido_minimo_atacado}</td>
                  <td className="text-right">{p.qtd_por_caixa}</td>
                  <td className="text-right text-gray-500">{brl(p.custo_medio)}</td>
                  <td className={`text-right font-medium ${est < p.estoque_minimo ? "text-red-600" : ""}`}>{est}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <span className={`badge ${p.ativo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>{p.ativo ? "Ativo" : "Inativo"}</span>
                      {p.destaque && (
                        <span className="badge bg-pink-100 text-pink-700">
                          <Star size={10} className="mr-0.5" /> Destaque
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button className="p-1 text-gray-500 hover:text-blue-600" onClick={() => abrir(p)} aria-label="Editar"><Pencil size={16} /></button>
                    <button className="p-1 text-gray-500 hover:text-red-600" onClick={() => excluir(p)} aria-label="Excluir"><Trash2 size={16} /></button>
                  </td>
                </tr>
              );
            })}
            {!lista.length && (
              <tr><td colSpan={11} className="py-8 text-center text-gray-500">Nenhum produto.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal aberto={!!form} titulo={form?.id ? "Editar produto" : "Novo produto"} onFechar={() => setForm(null)} largura="max-w-2xl">
        {form && (
          <div className="grid gap-3 text-sm sm:grid-cols-6">
            <div className="sm:col-span-4">
              <label className="label">Nome *</label>
              <input className="input" value={form.nome} onChange={set("nome")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">SKU</label>
              <input className="input" value={form.sku} onChange={set("sku")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Marca</label>
              <input className="input" value={form.marca} onChange={set("marca")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Categoria</label>
              <select className="input" value={form.categoria_id} onChange={set("categoria_id")}>
                <option value="">—</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="label">Unidade</label>
              <select className="input" value={form.unidade} onChange={set("unidade")}>
                {UNIDADES.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="label">Qtd/caixa</label>
              <input type="number" min={1} className="input" value={form.qtd_por_caixa} onChange={set("qtd_por_caixa")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Preço varejo (R$) *</label>
              <input type="number" step="0.01" min={0} className="input" value={form.preco_varejo} onChange={set("preco_varejo")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Preço atacado (R$/un.)</label>
              <input type="number" step="0.01" min={0} className="input" value={form.preco_atacado} onChange={set("preco_atacado")} placeholder="vazio = sob consulta" />
            </div>
            <div className="sm:col-span-1">
              <label className="label">Mín. atacado</label>
              <input type="number" min={1} className="input" value={form.pedido_minimo_atacado} onChange={set("pedido_minimo_atacado")} />
            </div>
            <div className="sm:col-span-1">
              <label className="label">Estoque mín.</label>
              <input type="number" min={0} className="input" value={form.estoque_minimo} onChange={set("estoque_minimo")} />
            </div>
            <div className="sm:col-span-6">
              <label className="label">Descrição</label>
              <textarea className="input" rows={3} value={form.descricao} onChange={set("descricao")} />
            </div>
            <div className="flex items-center gap-3 sm:col-span-6">
              <div className="h-20 w-20 overflow-hidden rounded border border-gray-200">
                {preview ? <img src={preview} alt="" className="h-full w-full object-contain" /> : <ProductImage nome={form.nome || "Produto"} url={form.imagem_url} tamanho="sm" />}
              </div>
              <label className="btn-outline cursor-pointer">
                <ImagePlus size={16} /> Enviar imagem
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setArquivo(f);
                    setPreview(f ? URL.createObjectURL(f) : null);
                  }}
                />
              </label>
              {(form.imagem_url || arquivo) && (
                <button
                  type="button"
                  className="btn-outline text-red-600"
                  onClick={() => {
                    setArquivo(null);
                    setPreview(null);
                    setForm({ ...form, imagem_url: null });
                  }}
                >
                  Remover imagem
                </button>
              )}
              <span className="text-xs text-gray-500">Use fotos próprias ou oficiais (PNG/JPG/WebP, máx. 5 MB).</span>
            </div>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo na loja
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={form.destaque} onChange={(e) => setForm({ ...form, destaque: e.target.checked })} /> Destaque na home
            </label>
            <div className="sm:col-span-6"><ErroMsg erro={erro} /></div>
            <div className="flex justify-end gap-2 sm:col-span-6">
              <button className="btn-outline" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn-yellow" onClick={salvar} disabled={carregando}>Salvar</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
