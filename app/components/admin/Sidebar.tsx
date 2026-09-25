"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Boxes, ClipboardList, Factory, Kanban, LayoutDashboard, LogOut, Menu, MessageCircle, Package, ShoppingBag, Target, Users, Wallet, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ITENS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/estoque", label: "Estoque", icon: Boxes },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/crm", label: "CRM", icon: Kanban },
  { href: "/admin/leads", label: "Leads", icon: Target },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/admin/compras", label: "Compras", icon: ShoppingBag },
  { href: "/admin/fornecedores", label: "Fornecedores", icon: Factory },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
];

export function Sidebar({ nome, papel }: { nome: string; papel: string }) {
  const path = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  async function sair() {
    await createClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const ativo = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 p-2">
      {ITENS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setAberto(false)}
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${ativo(href) ? "bg-komi-yellow text-komi-ink" : "text-gray-300 hover:bg-white/10 hover:text-white"}`}
        >
          <Icon size={17} />
          {label}
        </Link>
      ))}
    </nav>
  );

  const rodape = (
    <div className="border-t border-white/10 p-3 text-xs text-gray-400">
      <div className="truncate font-medium text-gray-200">{nome}</div>
      <div className="capitalize">{papel}</div>
      <div className="mt-2 flex gap-2">
        <Link href="/" target="_blank" className="rounded px-2 py-1 hover:bg-white/10">
          Ver loja
        </Link>
        <button onClick={sair} className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-white/10">
          <LogOut size={14} /> Sair
        </button>
      </div>
    </div>
  );

  const marca = (
    <Link href="/admin" className="flex items-center gap-2 px-4 py-3">
      <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8" />
      <span className="font-display text-lg font-bold text-white">
        Komilão <span className="text-xs font-normal text-komi-yellow">painel</span>
      </span>
    </Link>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-komi-ink px-2 lg:hidden">
        {marca}
        <button className="p-2 text-white" onClick={() => setAberto(true)} aria-label="Abrir menu">
          <Menu />
        </button>
      </div>
      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setAberto(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-komi-ink" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              {marca}
              <button className="p-3 text-white" onClick={() => setAberto(false)} aria-label="Fechar menu">
                <X />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto">{nav}</div>
            {rodape}
          </aside>
        </div>
      )}
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col bg-komi-ink lg:flex">
        {marca}
        <div className="flex flex-1 flex-col overflow-y-auto">{nav}</div>
        {rodape}
      </aside>
    </>
  );
}
