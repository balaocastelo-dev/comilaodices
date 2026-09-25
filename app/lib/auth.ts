import "server-only";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/env";
import type { Equipe } from "@/lib/types";

/** Retorna o usuário logado e seu registro na tabela equipe (ou null se não for da equipe). */
export async function getEquipeAtual() {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, equipe: null as Equipe | null };
  const { data } = await supabase.from("equipe").select("*").eq("user_id", user.id).eq("ativo", true).maybeSingle();
  return { supabase, user, equipe: (data as Equipe | null) ?? null };
}
