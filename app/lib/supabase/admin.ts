import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Cliente com SERVICE ROLE (ignora RLS). Use SOMENTE em rotas de servidor
 * (/api/whatsapp/processar e /api/whatsapp/webhook). Nunca importe em código de cliente.
 */
export function createAdminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_URL não configurados");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
