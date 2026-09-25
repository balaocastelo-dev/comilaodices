"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { mensagemErro } from "@/lib/format";

/** Executa uma mutação, controla carregando/erro e atualiza os dados do servidor (router.refresh). */
export function useAcao() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const executar = useCallback(
    async <T,>(fn: () => Promise<T>, opts: { refresh?: boolean } = {}): Promise<T | undefined> => {
      setCarregando(true);
      setErro(null);
      try {
        const r = await fn();
        if (opts.refresh !== false) router.refresh();
        return r;
      } catch (e) {
        setErro(mensagemErro(e));
        return undefined;
      } finally {
        setCarregando(false);
      }
    },
    [router],
  );

  return { executar, carregando, erro, setErro };
}

/** Lança o erro do Supabase, se houver (para usar dentro de executar). */
export function ok<T extends { error: { message: string } | null }>(r: T): T {
  if (r.error) throw new Error(r.error.message);
  return r;
}
