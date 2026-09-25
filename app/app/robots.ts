import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://komilaodoces.com.br").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/carrinho", "/pedido"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
