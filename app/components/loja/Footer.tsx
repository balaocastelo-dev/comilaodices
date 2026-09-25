import Image from "next/image";
import Link from "next/link";
import { WHATSAPP_LOJA } from "@/lib/env";
import { formatarTelefone } from "@/lib/format";

export function Footer() {
  return (
    <footer className="mt-16 bg-komi-ink text-white">
      <div className="h-3 w-full bg-[linear-gradient(90deg,#FFBB12_0_20%,#E53935_20%_40%,#EC4899_40%_60%,#22C55E_60%_80%,#3B82F6_80%)]" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="flex items-start gap-3">
          <Image src="/logo.png" alt="" width={64} height={64} className="h-16 w-16" />
          <div>
            <div className="text-xl font-bold">Doces Komilão</div>
            <p className="mt-1 text-sm text-white/70">Distribuidora de doces e salgadinhos em Campinas-SP. Varejo e atacado.</p>
          </div>
        </div>
        <div>
          <div className="font-semibold text-komi-yellow">Navegue</div>
          <ul className="mt-2 space-y-1 text-sm text-white/80">
            <li><Link href="/produtos" className="hover:text-white">Todos os produtos</Link></li>
            <li><Link href="/#atacado" className="hover:text-white">Compre no atacado</Link></li>
            <li><Link href="/carrinho" className="hover:text-white">Meu carrinho</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-komi-yellow">Atendimento</div>
          <ul className="mt-2 space-y-1 text-sm text-white/80">
            <li>Campinas e região — SP</li>
            {WHATSAPP_LOJA && (
              <li>
                WhatsApp:{" "}
                <a href={`https://wa.me/${WHATSAPP_LOJA}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                  {formatarTelefone(WHATSAPP_LOJA)}
                </a>
              </li>
            )}
            <li>Seg a sáb, horário comercial</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Doces Komilão. Imagens meramente ilustrativas. Preços sujeitos a alteração.
      </div>
    </footer>
  );
}
