import type { MetadataRoute } from "next";
import { listarProdutos } from "@/lib/loja";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://komilaodoces.com.br").replace(/\/$/, "");
  const produtos = await listarProdutos();
  return [
    { url: `${site}/`, changeFrequency: "daily", priority: 1 },
    { url: `${site}/produtos`, changeFrequency: "daily", priority: 0.9 },
    ...produtos.map((p) => ({ url: `${site}/produto/${p.id}`, lastModified: p.atualizado_em, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
