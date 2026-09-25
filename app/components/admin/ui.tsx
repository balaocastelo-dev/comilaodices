import Link from "next/link";

export function PageHeader({ titulo, sub, children }: { titulo: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{titulo}</h1>
        {sub && <p className="text-sm text-gray-500">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function StatusBadge({ mapa, valor }: { mapa: Record<string, { label: string; cls: string }>; valor: string }) {
  const m = mapa[valor] ?? { label: valor, cls: "bg-gray-100 text-gray-700" };
  return <Badge cls={m.cls}>{m.label}</Badge>;
}

export function Stat({ titulo, valor, sub, cor = "bg-komi-yellow", href }: { titulo: string; valor: React.ReactNode; sub?: React.ReactNode; cor?: string; href?: string }) {
  const inner = (
    <div className="card flex h-full items-stretch overflow-hidden transition hover:shadow-sm">
      <div className={`w-1.5 ${cor}`} />
      <div className="p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</div>
        <div className="mt-1 text-2xl font-bold text-gray-900">{valor}</div>
        {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-sm text-gray-500">{children}</div>;
}

export function Tabs({ abas, atual }: { abas: { href: string; label: string; chave: string }[]; atual: string }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200">
      {abas.map((a) => (
        <Link
          key={a.chave}
          href={a.href}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${a.chave === atual ? "border-komi-yellow text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"}`}
        >
          {a.label}
        </Link>
      ))}
    </div>
  );
}

export function ErroCarga({ erro }: { erro?: { message: string } | null }) {
  if (!erro) return null;
  return <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Erro ao carregar dados: {erro.message}</div>;
}
