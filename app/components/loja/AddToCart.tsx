"use client";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useCart } from "./CartProvider";
import type { CarrinhoItem } from "@/lib/types";

export function AddToCart({ item, grande = false }: { item: Omit<CarrinhoItem, "quantidade">; grande?: boolean }) {
  const { adicionar } = useCart();
  const [qtd, setQtd] = useState(1);
  const [ok, setOk] = useState(false);

  function add() {
    adicionar(item, qtd);
    setOk(true);
    setTimeout(() => setOk(false), 1400);
  }

  if (!grande) {
    return (
      <button type="button" onClick={add} className="btn-loja-primary w-full !py-2 text-sm" aria-label={`Adicionar ${item.nome} ao carrinho`}>
        {ok ? <Check size={18} /> : <ShoppingCart size={18} />}
        {ok ? "Adicionado!" : "Adicionar"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center rounded-full bg-white ring-2 ring-komi-ink/10">
        <button type="button" className="p-3" onClick={() => setQtd((q) => Math.max(1, q - 1))} aria-label="Diminuir">
          <Minus size={18} />
        </button>
        <input
          type="number"
          min={1}
          value={qtd}
          onChange={(e) => setQtd(Math.max(1, Math.min(9999, Number(e.target.value) || 1)))}
          className="w-14 bg-transparent text-center text-lg font-semibold outline-none [appearance:textfield]"
          aria-label="Quantidade"
        />
        <button type="button" className="p-3" onClick={() => setQtd((q) => Math.min(9999, q + 1))} aria-label="Aumentar">
          <Plus size={18} />
        </button>
      </div>
      <button type="button" onClick={add} className="btn-loja-primary text-lg">
        {ok ? <Check size={20} /> : <ShoppingCart size={20} />}
        {ok ? "Adicionado!" : "Adicionar ao carrinho"}
      </button>
    </div>
  );
}
