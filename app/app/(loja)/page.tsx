import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgePercent, Store, Truck } from "lucide-react";
import { listarCategorias, listarProdutos, mapaSlugs } from "@/lib/loja";
import { ProductCard } from "@/components/loja/ProductCard";
import { WHATSAPP_LOJA } from "@/lib/env";
import { WhatsIcon } from "@/components/loja/WhatsIcon";

export const dynamic = "force-dynamic";

const CORES_CAT = ["bg-komi-pink", "bg-komi-blue", "bg-komi-green", "bg-komi-purple", "bg-komi-red", "bg-orange-500"];
const EMOJI_CAT: Record<string, string> = { "doces-e-balas": "🍬", salgadinhos: "🍟", saudaveis: "🥣" };

export default async function Home() {
  const [cats, destaques] = await Promise.all([listarCategorias(), listarProdutos({ destaque: true, limite: 8 })]);
  const produtos = destaques.length ? destaques : await listarProdutos({ limite: 8 });
  const slugs = mapaSlugs(cats);
  const waAtacado = WHATSAPP_LOJA
    ? `https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent("Olá! Tenho um comércio e quero a tabela de atacado da Doces Komilão.")}`
    : null;

  return (
    <>
      {/* Hero */}
      <section className="loja-bg-dots relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:py-16 md:grid-cols-2">
          <div>
            <span className="inline-block rounded-full bg-white px-3 py-1 text-sm font-semibold text-komi-red shadow">Campinas e região 🍭</span>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-komi-ink sm:text-5xl">
              Doces e salgadinhos <span className="text-komi-red">de dar água na boca!</span>
            </h1>
            <p className="mt-4 max-w-md text-lg text-komi-ink/80">
              Maria mole, pirulitos, gelatinas, batatas e muito mais — no varejo ou com preço de atacado para o seu comércio.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/produtos" className="btn-loja-primary text-lg">
                Ver produtos <ArrowRight size={20} />
              </Link>
              <Link href="#atacado" className="btn-loja-ghost text-lg">
                Compre no atacado
              </Link>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 -z-0 scale-110 rounded-full bg-white/40 blur-2xl" />
              <Image src="/logo.png" alt="Doces Komilão" width={360} height={361} priority className="relative w-64 drop-shadow-2xl sm:w-80" />
            </div>
          </div>
        </div>
      </section>

      {/* Categorias */}
      {cats.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-10">
          <h2 className="text-2xl font-bold">Categorias</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cats.map((c, i) => (
              <Link
                key={c.id}
                href={`/produtos?categoria=${c.slug}`}
                className={`${CORES_CAT[i % CORES_CAT.length]} flex items-center gap-3 rounded-3xl p-4 text-white shadow-[0_5px_0_rgba(0,0,0,.15)] transition hover:-translate-y-1`}
              >
                <span className="text-3xl">{EMOJI_CAT[c.slug] ?? "🍭"}</span>
                <span className="text-lg font-semibold leading-tight">{c.nome}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Destaques */}
      <section className="mx-auto max-w-6xl px-4 pt-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold">Destaques da casa</h2>
          <Link href="/produtos" className="font-semibold text-komi-red hover:underline">
            Ver todos →
          </Link>
        </div>
        {produtos.length ? (
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {produtos.map((p) => (
              <ProductCard key={p.id} p={p} categoriaSlug={p.categoria_id ? slugs[p.categoria_id] : null} />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-3xl bg-white p-6 text-center text-komi-ink/60">Catálogo em atualização. Volte em instantes! 🍬</p>
        )}
      </section>

      {/* Atacado B2B */}
      <section id="atacado" className="mx-auto mt-16 max-w-6xl scroll-mt-24 px-4">
        <div className="overflow-hidden rounded-[2rem] bg-komi-red text-white shadow-[0_8px_0_#b71c1c]">
          <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-2">
            <div>
              <span className="inline-block rounded-full bg-komi-yellow px-3 py-1 text-sm font-bold text-komi-ink">Para empresas</span>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Compre no atacado</h2>
              <p className="mt-3 text-lg text-white/90">
                Tem padaria, lanchonete, bar, mercearia ou conveniência em Campinas e região? Informe seu <b>CNPJ</b> no fechamento do pedido e
                seus preços são calculados pela <b>tabela de atacado</b> (quando a quantidade atinge o pedido mínimo de cada produto).
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/produtos" className="btn-loja-yellow text-lg">
                  Montar meu pedido
                </Link>
                {waAtacado && (
                  <a href={waAtacado} target="_blank" rel="noopener noreferrer" className="btn-loja bg-white text-komi-ink text-lg">
                    <WhatsIcon size={20} className="text-[#25D366]" /> Pedir tabela
                  </a>
                )}
              </div>
            </div>
            <ul className="grid gap-3 self-center">
              {[
                { i: BadgePercent, t: "Preço de atacado", d: "Tabela especial para CNPJ, por unidade, a partir do pedido mínimo." },
                { i: Truck, t: "Entrega na região", d: "Atendemos Campinas e cidades vizinhas. Combine pelo WhatsApp." },
                { i: Store, t: "Mix que gira", d: "Doces, balas, pirulitos e salgadinhos que o seu cliente adora." },
              ].map(({ i: Icon, t, d }) => (
                <li key={t} className="flex gap-3 rounded-2xl bg-white/10 p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-komi-yellow text-komi-ink">
                    <Icon size={22} />
                  </span>
                  <div>
                    <div className="font-semibold">{t}</div>
                    <div className="text-sm text-white/80">{d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
