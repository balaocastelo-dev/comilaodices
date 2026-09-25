import "server-only";

// Cliente mínimo da Evolution API (v2). A apikey fica SEMPRE no servidor.

export function evolutionConfig() {
  const url = (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
  const key = process.env.EVOLUTION_API_KEY ?? "";
  const instancia = process.env.EVOLUTION_INSTANCE ?? "";
  return { url, key, instancia, configurado: Boolean(url && key && instancia) };
}

export async function evolutionFetch(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}) {
  const { url, key } = evolutionConfig();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 20000);
  try {
    const res = await fetch(`${url}${path}`, {
      method: init.method ?? "GET",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 500) };
    }
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

export function erroEvolution(json: unknown, status: number): string {
  if (json && typeof json === "object") {
    const j = json as { message?: unknown; error?: unknown; response?: { message?: unknown } };
    const m = j.response?.message ?? j.message ?? j.error;
    if (m) return `HTTP ${status}: ${Array.isArray(m) ? m.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("; ") : String(typeof m === "object" ? JSON.stringify(m) : m)}`;
  }
  return `HTTP ${status}`;
}
