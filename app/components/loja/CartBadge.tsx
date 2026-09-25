"use client";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./CartProvider";

export function CartBadge() {
  const { totalItens, carregado } = useCart();
  return (
    <Link href="/carrinho" className="relative inline-flex items-center gap-2 rounded-full bg-komi-red px-4 py-2 font-semibold text-white shadow-[0_3px_0_#b71c1c]">
      <ShoppingCart size={20} />
      <span className="hidden sm:inline">Carrinho</span>
      {carregado && totalItens > 0 && (
        <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-komi-yellow px-1 text-xs font-bold text-komi-ink ring-2 ring-white">
          {totalItens > 99 ? "99+" : totalItens}
        </span>
      )}
    </Link>
  );
}
