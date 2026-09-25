import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-komi-yellow p-6 text-center font-display">
      <Image src="/logo.png" alt="Doces Komilão" width={140} height={140} />
      <h1 className="text-3xl font-bold">Ops! Página não encontrada</h1>
      <p className="text-komi-ink/70">Parece que alguém comeu essa página 😋</p>
      <Link href="/" className="btn-loja-primary">
        Voltar para a loja
      </Link>
    </div>
  );
}
