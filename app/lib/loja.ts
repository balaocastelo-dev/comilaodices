import "server-only";
import { createPublicClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/env";
import type { Categoria, Produto } from "@/lib/types";

// Leitura pública do catálogo. Em caso de erro (ex.: env não configurado) devolve vazio e registra no log.

export async function listarCategorias(): Promise<Categoria[]> {
  if (!supabaseConfigurado) return [];
  const { data, error } = await createPublicClient().from("categorias").select("*").order("ordem").order("nome");
  if (error) console.error("[loja] categorias:", error.message);
  return (data as Categoria[]) ?? [];
}

export async function listarProdutos(opts: { categoriaId?: number; busca?: string; destaque?: boolean; limite?: number } = {}): Promise<Produto[]> {
  if (!supabaseConfigurado) return [];
  let q = createPublicClient().from("produtos").select("*").eq("ativo", true);
  if (opts.categoriaId) q = q.eq("categoria_id", opts.categoriaId);
  if (opts.destaque) q = q.eq("destaque", true);
  if (opts.busca) {
    const termo = opts.busca.replace(/[%,()]/g, " ").trim().slice(0, 60);
    if (termo) q = q.or(`nome.ilike.%${termo}%,marca.ilike.%${termo}%,sku.ilike.%${termo}%`);
  }
  q = q.order("destaque", { ascending: false }).order("nome");
  if (opts.limite) q = q.limit(opts.limite);
  const { data, error } = await q;
  if (error) console.error("[loja] produtos:", error.message);
  return (data as Produto[]) ?? [];
}

export async function buscarProduto(id: string): Promise<Produto | null> {
  if (!supabaseConfigurado || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await createPublicClient().from("produtos").select("*").eq("id", id).eq("ativo", true).maybeSingle();
  if (error) console.error("[loja] produto:", error.message);
  return (data as Produto | null) ?? null;
}

export function mapaSlugs(cats: Categoria[]): Record<number, string> {
  return Object.fromEntries(cats.map((c) => [c.id, c.slug]));
}
