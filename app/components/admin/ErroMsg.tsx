export function ErroMsg({ erro }: { erro: string | null }) {
  if (!erro) return null;
  return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>;
}
