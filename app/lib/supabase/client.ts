"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

let cliente: SupabaseClient | null = null;

/** Cliente Supabase do navegador (anon key + sessão do usuário via cookies). RLS se aplica. */
export function createClient(): SupabaseClient {
  if (!cliente) cliente = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cliente;
}
