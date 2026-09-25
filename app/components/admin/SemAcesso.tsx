"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SemAcesso({ email }: { email: string }) {
  const router = useRouter();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md rounded-xl bg-white p-6 text-center shadow">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-2 text-lg font-bold">Sem acesso</h1>
        <p className="mt-1 text-sm text-gray-600">
          O usuário <b>{email}</b> não faz parte da equipe (ou está inativo). Peça a um administrador para incluí-lo na tabela <code>equipe</code>.
        </p>
        <button
          className="btn-primary mt-4"
          onClick={async () => {
            await createClient().auth.signOut();
            router.replace("/admin/login");
            router.refresh();
          }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}
