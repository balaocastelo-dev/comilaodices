"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CHAVE_ULTIMO_PEDIDO, type UltimoPedido } from "./Checkout";
import { WhatsIcon } from "./WhatsIcon";
import { brl } from "@/lib/format";
import { WHATSAPP_LOJA } from "@/lib/env";

export function SucessoPedido({ numero, total }: { numero: string; total: string }) {
  const [resumo, setResumo] = useState<UltimoPedido | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAVE_ULTIMO_PEDIDO);
      if (raw) {
        const r = JSON.parse(raw) as UltimoPedido;
        if (String(r.numero) === numero) setResumo(r);
      }
    } catch {
      /* ignore */
    }
  }, [numero]);

  const totalNum = resumo?.total ?? Number(total);
  const linhas = [
    `Olá! Acabei de fazer o pedido *#${numero}* no site da Doces Komilão 😋`,
    resumo?.nome ? `Nome: ${resumo.nome}` : null,
    ...(resumo?.itens.length ? ["", "*Itens:*", ...resumo.itens.map((i) => `• ${i.quantidade}x ${i.nome}`)] : []),
    "",
    Number.isFinite(totalNum) ? `Total: ${brl(totalNum)}` : null,
    "Pode confirmar, por favor?",
  ].filter((l) => l !== null);
  const href = WHATSAPP_LOJA ? `https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent(linhas.join("\n"))}` : null;

  return (
    <div className="mx-auto max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-[0_8px_0_rgba(43,27,14,.08)] ring-2 ring-komi-ink/5">
      <div className="text-6xl">🎉</div>
      <h1 className="mt-2 text-3xl font-bold">Pedido recebido!</h1>
      <p className="mt-2 text-komi-ink/70">Seu número de pedido é</p>
      <div className="mt-1 text-5xl font-bold text-komi-red">#{numero}</div>
      {Number.isFinite(totalNum) && <p className="mt-2 text-lg">Total estimado: <b>{brl(totalNum)}</b></p>}
      <p className="mt-4 text-sm text-komi-ink/70">
        Agora é só chamar a gente no WhatsApp para confirmar o pedido, a forma de pagamento e a entrega.
      </p>
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="btn-loja mt-6 w-full bg-[#25D366] text-lg text-white shadow-[0_4px_0_#128C7E]">
          <WhatsIcon size={22} /> Enviar pedido pelo WhatsApp
        </a>
      )}
      <Link href="/produtos" className="btn-loja-ghost mt-3 w-full">
        Continuar comprando
      </Link>
    </div>
  );
}
