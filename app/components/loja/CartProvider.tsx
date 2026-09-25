"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CarrinhoItem } from "@/lib/types";

const CHAVE = "komilao:carrinho:v1";

type CartCtx = {
  itens: CarrinhoItem[];
  carregado: boolean;
  adicionar: (item: Omit<CarrinhoItem, "quantidade">, qtd?: number) => void;
  alterarQtd: (produtoId: string, qtd: number) => void;
  remover: (produtoId: string) => void;
  limpar: () => void;
  totalItens: number;
  subtotalVarejo: number;
};

const Ctx = createContext<CartCtx | null>(null);

function ler(): CarrinhoItem[] {
  try {
    const raw = window.localStorage.getItem(CHAVE);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((i) => i && typeof i.produto_id === "string" && Number(i.quantidade) > 0);
  } catch {
    return [];
  }
}

function gravar(itens: CarrinhoItem[]) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(itens));
  } catch {
    /* modo privado / storage bloqueado: segue só em memória */
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<CarrinhoItem[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    setItens(ler());
    setCarregado(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CHAVE) setItens(ler());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const atualizar = useCallback((fn: (prev: CarrinhoItem[]) => CarrinhoItem[]) => {
    setItens((prev) => {
      const novo = fn(prev);
      gravar(novo);
      return novo;
    });
  }, []);

  const value = useMemo<CartCtx>(
    () => ({
      itens,
      carregado,
      adicionar: (item, qtd = 1) =>
        atualizar((prev) => {
          const ex = prev.find((i) => i.produto_id === item.produto_id);
          if (ex) return prev.map((i) => (i.produto_id === item.produto_id ? { ...i, ...item, quantidade: Math.min(9999, i.quantidade + qtd) } : i));
          return [...prev, { ...item, quantidade: Math.max(1, qtd) }];
        }),
      alterarQtd: (id, qtd) =>
        atualizar((prev) =>
          qtd <= 0 ? prev.filter((i) => i.produto_id !== id) : prev.map((i) => (i.produto_id === id ? { ...i, quantidade: Math.min(9999, Math.floor(qtd)) } : i)),
        ),
      remover: (id) => atualizar((prev) => prev.filter((i) => i.produto_id !== id)),
      limpar: () => atualizar(() => []),
      totalItens: itens.reduce((s, i) => s + i.quantidade, 0),
      subtotalVarejo: itens.reduce((s, i) => s + i.quantidade * Number(i.preco_varejo), 0),
    }),
    [itens, carregado, atualizar],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart fora do CartProvider");
  return c;
}
