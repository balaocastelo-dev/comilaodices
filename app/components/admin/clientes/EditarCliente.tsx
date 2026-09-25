"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { ErroMsg } from "@/components/admin/ErroMsg";
import { useAcao } from "@/components/admin/useAcao";
import { ClienteForm } from "./ClienteForm";
import { createClient } from "@/lib/supabase/client";
import type { Cliente, CrmEtapa } from "@/lib/types";

export function EditarCliente({ cliente, etapas }: { cliente: Cliente; etapas: CrmEtapa[] }) {
  const [aberto, setAberto] = useState(false);
  const router = useRouter();
  const { executar, erro } = useAcao();

  async function excluir() {
    if (!window.confirm("Excluir este cliente? Só é possível se não houver pedidos ou contas vinculados.")) return;
    const r = await executar(
      async () => {
        const { error } = await createClient().from("clientes").delete().eq("id", cliente.id);
        if (error) throw new Error(error.code === "23503" ? "Cliente possui pedidos/contas vinculados — não pode ser excluído." : error.message);
        return true;
      },
      { refresh: false },
    );
    if (r) router.push("/admin/clientes");
  }

  return (
    <>
      <button className="btn-outline" onClick={() => setAberto(true)}>
        <Pencil size={15} /> Editar
      </button>
      <button className="btn-outline text-red-600" onClick={excluir}>
        <Trash2 size={15} />
      </button>
      {erro && <div className="w-full"><ErroMsg erro={erro} /></div>}
      <Modal aberto={aberto} titulo="Editar cliente" onFechar={() => setAberto(false)} largura="max-w-3xl">
        <ClienteForm
          cliente={cliente}
          etapas={etapas}
          onCancelar={() => setAberto(false)}
          onSalvo={() => {
            setAberto(false);
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}
