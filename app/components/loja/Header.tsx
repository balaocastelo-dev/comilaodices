import Image from "next/image";
import Link from "next/link";
import { CartBadge } from "./CartBadge";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b-4 border-komi-red bg-komi-yellow">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Doces Komilão" width={52} height={52} priority className="h-12 w-12 drop-shadow" />
          <span className="hidden text-xl font-bold leading-none text-komi-ink sm:block">
            Doces <span className="text-komi-red">Komilão</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm font-semibold sm:gap-3 sm:text-base">
          <Link href="/produtos" className="rounded-full px-3 py-2 hover:bg-white/50">
            Produtos
          </Link>
          <Link href="/#atacado" className="hidden rounded-full px-3 py-2 hover:bg-white/50 sm:block">
            Atacado
          </Link>
          <CartBadge />
        </nav>
      </div>
    </header>
  );
}
