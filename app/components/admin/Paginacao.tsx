import Link from "next/link";

export function Paginacao({ pagina, total, porPagina, base, params }: { pagina: number; total: number; porPagina: number; base: string; params: Record<string, string | undefined> }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return <div className="px-3 py-2 text-xs text-gray-500">{total} registro(s)</div>;
  const href = (p: number) => {
    const u = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && k !== "pagina" && u.set(k, v));
    if (p > 1) u.set("pagina", String(p));
    const s = u.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-600">
      <span>
        {total} registro(s) — página {pagina} de {paginas}
      </span>
      <div className="flex gap-1">
        {pagina > 1 && <Link className="btn-outline btn-sm" href={href(pagina - 1)}>← Anterior</Link>}
        {pagina < paginas && <Link className="btn-outline btn-sm" href={href(pagina + 1)}>Próxima →</Link>}
      </div>
    </div>
  );
}
