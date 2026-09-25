import Link from "next/link";
import { ProductImage } from "./ProductImage";
import { AddToCart } from "./AddToCart";
import { brl } from "@/lib/format";
import type { Produto } from "@/lib/types";

export function ProductCard({ p, categoriaSlug }: { p: Produto; categoriaSlug?: string | null }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_6px_0_rgba(43,27,14,.08)] ring-2 ring-komi-ink/5 transition hover:-translate-y-1 hover:ring-komi-yellow">
      <Link href={`/produto/${p.id}`} className="relative block aspect-square bg-komi-yellow-soft">
        <ProductImage nome={p.nome} url={p.imagem_url} categoriaSlug={categoriaSlug} />
        {p.destaque && (
          <span className="absolute left-3 top-3 rounded-full bg-komi-pink px-2.5 py-0.5 text-xs font-semibold text-white shadow">Destaque</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {p.marca && <span className="text-xs font-medium uppercase tracking-wide text-komi-purple">{p.marca}</span>}
        <Link href={`/produto/${p.id}`} className="line-clamp-2 font-semibold leading-snug hover:text-komi-red">
          {p.nome}
        </Link>
        <div className="mt-auto">
          <div className="text-2xl font-bold text-komi-red">{brl(p.preco_varejo)}</div>
          {p.preco_atacado != null ? (
            <div className="text-xs text-komi-ink/70">
              Atacado: <b className="text-komi-green">{brl(p.preco_atacado)}</b> a partir de {p.pedido_minimo_atacado} {p.unidade}
            </div>
          ) : (
            <div className="text-xs text-komi-ink/50">Preço de atacado sob consulta</div>
          )}
        </div>
        <AddToCart
          item={{
            produto_id: p.id,
            nome: p.nome,
            preco_varejo: Number(p.preco_varejo),
            preco_atacado: p.preco_atacado == null ? null : Number(p.preco_atacado),
            pedido_minimo_atacado: p.pedido_minimo_atacado,
            unidade: p.unidade,
            imagem_url: p.imagem_url,
            categoria_slug: categoriaSlug ?? null,
          }}
        />
      </div>
    </div>
  );
}
