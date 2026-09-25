"use client";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Modal({
  aberto,
  titulo,
  onFechar,
  children,
  largura = "max-w-lg",
}: {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onMouseDown={onFechar}>
      <div className={`w-full ${largura} rounded-lg bg-white shadow-xl`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold">{titulo}</h2>
          <button type="button" onClick={onFechar} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
