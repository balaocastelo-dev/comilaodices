import { WhatsIcon } from "./WhatsIcon";
import { WHATSAPP_LOJA } from "@/lib/env";

export function WhatsAppFloat() {
  if (!WHATSAPP_LOJA) return null;
  const href = `https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent("Olá! Vim pelo site da Doces Komilão 😋")}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-4 ring-white transition hover:scale-110"
    >
      <WhatsIcon size={30} />
    </a>
  );
}
