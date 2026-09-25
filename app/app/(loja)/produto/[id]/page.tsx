import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { buscarProduto, listarCategorias, listarProdutos, mapaSlugs } from "@/lib/loja";
import { ProductImage } from "@/components/loja/ProductImage";
import { AddToCart } from "@/components/loja/AddToCart";
import { ProductCard } from "@/components/loja/ProductCard";
import { brl } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await buscarProduto(id);
  return p ? { title: p.nome, description: p.descricao ?? `${p.nome} — Doces Komilão, Campinas-SP` } : { title: "Produto não encontrado" };
}

export default async function ProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, cats] = await Promise.all([buscarProduto(id), listarCategorias()]);
  if (!p) notFound();
  const slugs = mapaSlugs(cats);
  const slug = p.categoria_id ? slugs[p.categoria_id] : null;
  const cat = cats.find((c) => c.id === p.categoria_id);
  const relacionados = (p.categoria_id ? await listarProdutos({ categoriaId: p.categoria_id, limite: 5 }) : []).filter((r) => r.id !== p.id).slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={cat ? `/produtos?categoria=${cat.slug}` : "/produtos"} className="inline-flex items-center gap-1 text-sm font-semibold text-komi-ink/70 hover:text-komi-red">
        <ChevronLeft size={18} /> {cat ? cat.nome : "Produtos"}
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-[2rem] bg-white ring-2 ring-komi-ink/5">
          <ProductImage nome={p.nome} url={p.imagem_url} categoriaSlug={slug} tamanho="lg" />
        </div>
        <div>
          {p.marca && <div className="text-sm font-semibold uppercase tracking-wide text-komi-purple">{p.marca}</div>}
          <h1 className="mt-1 text-3xl font-bold leading-tight">{p.nome}</h1>
          {p.sku && <div className="mt-1 text-sm text-komi-ink/50">Cód. {p.sku}</div>}

          <div className="mt-6 rounded-3xl bg-white p-5 ring-2 ring-komi-ink/5">
            <div className="text-sm text-komi-ink/60">Varejo (por {p.unidade})</div>
            <div className="text-4xl font-bold text-komi-red">{brl(p.preco_varejo)}</div>
            <div className="mt-3 rounded-2xl bg-komi-yellow-soft p-3 text-sm">
              {p.preco_atacado != null ? (
                <>
                  <b className="text-komi-green">Atacado: {brl(p.preco_atacado)}</b> por {p.unidade}, a partir de{" "}
                  <b>{p.pedido_minimo_atacado}</b> {p.unidade}(s). Válido para compras com CNPJ.
                </>
              ) : (
                <>Tem CNPJ? Consulte nossa tabela de atacado pelo WhatsApp.</>
              )}
              {p.qtd_por_caixa > 1 && (
                <div className="mt-1 text-komi-ink/70">
                  Caixa com {p.qtd_por_caixa} {p.unidade}(s).
                </div>
              )}
            </div>
            <div className="mt-5">
              <AddToCart
                grande
                item={{
                  produto_id: p.id,
                  nome: p.nome,
                  preco_varejo: Number(p.preco_varejo),
                  preco_atacado: p.preco_atacado == null ? null : Number(p.preco_atacado),
                  pedido_minimo_atacado: p.pedido_minimo_atacado,
                  unidade: p.unidade,
                  imagem_url: p.imagem_url,
                  categoria_slug: slug,
                }}
              />
            </div>
          </div>

          {p.descricao && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold">Descrição</h2>
              <p className="mt-1 whitespace-pre-line font-sans text-komi-ink/80">{p.descricao}</p>
            </div>
          )}
        </div>
      </div>

      {relacionados.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold">Você também vai gostar</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {relacionados.map((r) => (
              <ProductCard key={r.id} p={r} categoriaSlug={slug} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
