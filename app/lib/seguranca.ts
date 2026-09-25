import "server-only";
import { timingSafeEqual } from "crypto";

/** Comparação em tempo constante de segredos */
export function segredoIgual(recebido: string | null | undefined, esperado: string | undefined): boolean {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
