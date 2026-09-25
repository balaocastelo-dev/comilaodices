// Variáveis públicas (inlined no build). Não coloque segredos aqui.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://komilaodoces.com.br").replace(/\/$/, "");
export const WHATSAPP_LOJA = (process.env.NEXT_PUBLIC_WHATSAPP_LOJA ?? "").replace(/\D/g, "");
export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
