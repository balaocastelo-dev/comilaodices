/* eslint-disable @next/next/no-img-element */
const CORES = [
  ["#FFBB12", "#F97316"],
  ["#EC4899", "#8B5CF6"],
  ["#22C55E", "#14B8A6"],
  ["#3B82F6", "#8B5CF6"],
  ["#E53935", "#EC4899"],
  ["#8B5CF6", "#3B82F6"],
];

const EMOJI: Record<string, string> = {
  "doces-e-balas": "🍬",
  salgadinhos: "🍟",
  saudaveis: "🥣",
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Imagem do produto (só do nosso Storage). Sem imagem → placeholder colorido com emoji e iniciais. */
export function ProductImage({
  nome,
  url,
  categoriaSlug,
  className = "",
  tamanho = "md",
}: {
  nome: string;
  url: string | null;
  categoriaSlug?: string | null;
  className?: string;
  tamanho?: "sm" | "md" | "lg";
}) {
  if (url) {
    return <img src={url} alt={nome} loading="lazy" className={`h-full w-full object-contain ${className}`} />;
  }
  const [a, b] = CORES[hash(nome) % CORES.length];
  const emoji = (categoriaSlug && EMOJI[categoriaSlug]) || "🍭";
  const emojiSize = tamanho === "lg" ? "text-8xl" : tamanho === "sm" ? "text-2xl" : "text-5xl";
  const txtSize = tamanho === "lg" ? "text-3xl" : tamanho === "sm" ? "text-[10px]" : "text-lg";
  return (
    <div
      role="img"
      aria-label={nome}
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      <span className="pointer-events-none absolute -left-4 -top-4 h-16 w-16 rounded-full bg-white/20" />
      <span className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-white/15" />
      <span className={`${emojiSize} drop-shadow`} aria-hidden>
        {emoji}
      </span>
      {tamanho !== "sm" && <span className={`mt-1 font-display font-bold tracking-wider text-white/90 ${txtSize}`}>{iniciais(nome)}</span>}
    </div>
  );
}
