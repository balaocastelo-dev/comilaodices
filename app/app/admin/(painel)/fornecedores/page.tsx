import { createClient } from "@/lib/supabase/server";
import { ErroCarga, PageHeader } from "@/components/admin/ui";
import { FornecedoresAdmin } from "@/components/admin/compras/FornecedoresAdmin";
import type { Fornecedor } from "@/lib/types";

export const metadata = { title: "Fornecedores" };

export default async function FornecedoresPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
  return (
    <div>
      <PageHeader titulo="Fornecedores" />
      <ErroCarga erro={error} />
      <FornecedoresAdmin fornecedores={(data as Fornecedor[]) ?? []} />
    </div>
  );
}
