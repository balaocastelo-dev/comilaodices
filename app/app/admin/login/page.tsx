"use client";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigurado } from "@/lib/env";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(sp.get("erro") === "config" || !supabaseConfigurado ? "Supabase não configurado (verifique as variáveis de ambiente)." : null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password: senha });
    setCarregando(false);
    if (error) {
      setErro(error.message === "Invalid login credentials" ? "E-mail ou senha inválidos." : error.message);
      return;
    }
    const next = sp.get("next");
    router.replace(next && next.startsWith("/admin") ? next : "/admin");
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="w-full max-w-sm space-y-3 rounded-xl bg-white p-6 shadow-xl">
      <div className="flex flex-col items-center gap-2 pb-2">
        <Image src="/logo.png" alt="Doces Komilão" width={80} height={80} priority />
        <h1 className="font-display text-xl font-bold">Painel Komilão</h1>
      </div>
      <div>
        <label className="label">E-mail</label>
        <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      </div>
      <div>
        <label className="label">Senha</label>
        <input type="password" className="input" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
      </div>
      {erro && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      <button className="btn-primary w-full !py-2" disabled={carregando}>
        {carregando && <Loader2 size={16} className="animate-spin" />} Entrar
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-komi-yellow p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
