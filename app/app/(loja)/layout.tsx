import { CartProvider } from "@/components/loja/CartProvider";
import { Header } from "@/components/loja/Header";
import { Footer } from "@/components/loja/Footer";
import { WhatsAppFloat } from "@/components/loja/WhatsAppFloat";

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="loja flex min-h-dvh flex-col bg-[#FFFBEF]">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsAppFloat />
      </div>
    </CartProvider>
  );
}
