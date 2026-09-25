"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/admin/Modal";
import { ClienteForm } from "./ClienteForm";
import type { CrmEtapa } from "@/lib/types";

export function NovoClienteBotao({ etapas, abrirInicial = false }: { etapas: CrmEtapa[]; abrirInicial?: boolean }) {
  const [aberto, setAberto] = useState(abrirInicial);
  const router = useRouter();
  return (
    <>
      <button className="btn-yellow" onClick={() => setAberto(true)}>
        <Plus size={16} /> Novo cliente
      </button>
      <Modal aberto={aberto} titulo="Novo cliente" onFechar={() => setAberto(false)} largura="max-w-3xl">
        <ClienteForm etapas={etapas} onCancelar={() => setAberto(false)} onSalvo={(id) => router.push(`/admin/clientes/${id}`)} />
      </Modal>
    </>
  );
}
