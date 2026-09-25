import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { NovaCompra } from "@/components/admin/compras/NovaCompra";
import type { Fornecedor, Produto } from "@/lib/types";

export const metadata = { title: "Nova compra" };

export default async function NovaCompraPage() {
  const supabase = await createClient();
  const [f, p] = await Promise.all([supabase.from("fornecedores").select("*").order("nome"), supabase.from("produtos").select("*").order("nome")]);
  return (
    <div className="max-w-5xl">
      <PageHeader titulo="Nova compra" />
      <NovaCompra fornecedores={(f.data as Fornecedor[]) ?? []} produtos={(p.data as Produto[]) ?? []} />
    </div>
  );
}
