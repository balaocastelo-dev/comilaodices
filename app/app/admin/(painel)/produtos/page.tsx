import { createClient } from "@/lib/supabase/server";
import { ErroCarga, PageHeader } from "@/components/admin/ui";
import { ProdutosAdmin } from "@/components/admin/produtos/ProdutosAdmin";
import type { Categoria, EstoqueRow, Produto } from "@/lib/types";

export const metadata = { title: "Produtos" };

export default async function ProdutosAdminPage() {
  const supabase = await createClient();
  const [p, c, e] = await Promise.all([
    supabase.from("produtos").select("*").order("nome"),
    supabase.from("categorias").select("*").order("ordem"),
    supabase.from("v_estoque").select("produto_id,estoque"),
  ]);
  const estoque = Object.fromEntries(((e.data as Pick<EstoqueRow, "produto_id" | "estoque">[]) ?? []).map((r) => [r.produto_id, r.estoque]));
  return (
    <div>
      <PageHeader titulo="Produtos" sub="Catálogo, preços de varejo/atacado e imagens" />
      <ErroCarga erro={p.error} />
      <ProdutosAdmin produtos={(p.data as Produto[]) ?? []} categorias={(c.data as Categoria[]) ?? []} estoque={estoque} />
    </div>
  );
}
