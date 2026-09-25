import type { Metadata } from "next";
import { Checkout } from "@/components/loja/Checkout";

export const metadata: Metadata = { title: "Carrinho", robots: { index: false } };

export default function CarrinhoPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Meu carrinho</h1>
      <Checkout />
    </div>
  );
}
