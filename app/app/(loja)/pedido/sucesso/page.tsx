import type { Metadata } from "next";
import { SucessoPedido } from "@/components/loja/SucessoPedido";

export const metadata: Metadata = { title: "Pedido recebido", robots: { index: false } };

export default async function SucessoPage({ searchParams }: { searchParams: Promise<{ numero?: string; total?: string }> }) {
  const sp = await searchParams;
  const numero = (sp.numero ?? "").replace(/\D/g, "").slice(0, 12);
  return (
    <div className="px-4 py-12">
      <SucessoPedido numero={numero || "?"} total={sp.total ?? ""} />
    </div>
  );
}
