import Link from "next/link";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import { listarCategorias, listarProdutos, mapaSlugs } from "@/lib/loja";
import { ProductCard } from "@/components/loja/ProductCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Produtos" };

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ categoria?: string; q?: string }> }) {
  const sp = await searchParams;
  const cats = await listarCategorias();
  const cat = cats.find((c) => c.slug === sp.categoria);
  const busca = (sp.q ?? "").trim();
  const produtos = await listarProdutos({ categoriaId: cat?.id, busca });
  const slugs = mapaSlugs(cats);

  const chip = (ativo: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${ativo ? "bg-komi-red text-white shadow-[0_3px_0_#b71c1c]" : "bg-white ring-2 ring-komi-ink/10 hover:ring-komi-yellow"}`;
  const href = (slug?: string) => {
    const p = new URLSearchParams();
    if (slug) p.set("categoria", slug);
    if (busca) p.set("q", busca);
    const s = p.toString();
    return s ? `/produtos?${s}` : "/produtos";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">{cat ? cat.nome : "Todos os produtos"}</h1>

      <form action="/produtos" className="mt-4 flex gap-2">
        {cat && <input type="hidden" name="categoria" value={cat.slug} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-komi-ink/40" size={20} />
          <input name="q" defaultValue={busca} placeholder="Buscar por nome, marca ou código..." className="input-loja !pl-11" />
        </div>
        <button className="btn-loja-yellow">Buscar</button>
      </form>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2">
        <Link href={href()} className={chip(!cat)}>
          Todos
        </Link>
        {cats.map((c) => (
          <Link key={c.id} href={href(c.slug)} className={chip(cat?.id === c.id)}>
            {c.nome}
          </Link>
        ))}
      </div>

      {busca && (
        <p className="mt-2 text-sm text-komi-ink/70">
          {produtos.length} resultado(s) para “{busca}”.{" "}
          <Link href={cat ? `/produtos?categoria=${cat.slug}` : "/produtos"} className="text-komi-red underline">
            limpar busca
          </Link>
        </p>
      )}

      {produtos.length ? (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {produtos.map((p) => (
            <ProductCard key={p.id} p={p} categoriaSlug={p.categoria_id ? slugs[p.categoria_id] : null} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl bg-white p-10 text-center">
          <div className="text-5xl">🔍</div>
          <p className="mt-2 text-lg">Nenhum produto encontrado.</p>
          <Link href="/produtos" className="btn-loja-yellow mt-4">
            Ver todos
          </Link>
        </div>
      )}
    </div>
  );
}
