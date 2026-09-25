import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getEquipeAtual } from "@/lib/auth";
import { Sidebar } from "@/components/admin/Sidebar";
import { SemAcesso } from "@/components/admin/SemAcesso";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Painel", template: "%s | Painel Komilão" }, robots: { index: false, follow: false } };

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { user, equipe } = await getEquipeAtual();
  if (!user) redirect("/admin/login");
  if (!equipe) return <SemAcesso email={user.email ?? ""} />;

  return (
    <div className="min-h-dvh bg-gray-50 font-sans text-gray-900 lg:flex">
      <Sidebar nome={equipe.nome} papel={equipe.papel} />
      <main className="min-w-0 flex-1 p-3 sm:p-5">{children}</main>
    </div>
  );
}
