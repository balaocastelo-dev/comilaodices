// =====================================================================
//  WhatsApp Komilão — conector por QR code que roda no computador da loja
//  • Mostra o QR code no painel (/admin/whatsapp → Conexão) e nesta janela
//  • Envia SOMENTE as mensagens aprovadas no painel, respeitando horário e limite diário
//  • Grava respostas recebidas e trata "SAIR" (opt-out) automaticamente
//  Não precisa de servidor: só conexões de saída para o Supabase e o WhatsApp.
// =====================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import pino from "pino";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ENV = path.join(DIR, ".env");
if (fs.existsSync(ENV)) process.loadEnvFile(ENV);

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  PAINEL_EMAIL,
  PAINEL_SENHA,
  LINK_LOJA = "https://comilaodices.vercel.app",
} = process.env;
const SESSAO = path.join(DIR, "sessao-whatsapp");
const TZ = "America/Sao_Paulo";
const MAX_POR_CICLO = 5;
const MAX_TENTATIVAS = 3;
const PALAVRAS_SAIR = ["SAIR", "PARAR", "STOP", "CANCELAR", "DESCADASTRAR"];

// ---------- saída na tela ----------
const cor = { reset: "\x1b[0m", ama: "\x1b[33m", verde: "\x1b[32m", verm: "\x1b[31m", ciano: "\x1b[36m", cinza: "\x1b[90m" };
const hora = () => new Date().toLocaleTimeString("pt-BR", { timeZone: TZ });
const log = (m, c = "") => console.log(`${cor.cinza}[${hora()}]${cor.reset} ${c}${m}${cor.reset}`);
const ok = (m) => log(`✔ ${m}`, cor.verde);
const aviso = (m) => log(`! ${m}`, cor.ama);
const erro = (m) => log(`✖ ${m}`, cor.verm);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PAINEL_EMAIL || !PAINEL_SENHA) {
  erro("Arquivo .env incompleto. Preencha SUPABASE_URL, SUPABASE_ANON_KEY, PAINEL_EMAIL e PAINEL_SENHA.");
  process.exit(1);
}

// ---------- Supabase (login como usuário da equipe — respeita o RLS) ----------
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: true } });
{
  const { error } = await sb.auth.signInWithPassword({ email: PAINEL_EMAIL, password: PAINEL_SENHA });
  if (error) {
    erro(`Não consegui entrar no painel com ${PAINEL_EMAIL}: ${error.message}`);
    process.exit(1);
  }
  ok(`Conectado ao painel como ${PAINEL_EMAIL}`);
}

// ---------- utilidades ----------
const soDigitos = (s) => String(s ?? "").replace(/\D/g, "");
function variacoes(numero) {
  const d = soDigitos(numero);
  const out = new Set([d]);
  // celular BR com e sem o 9º dígito
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") out.add(d.slice(0, 4) + d.slice(5));
  if (d.startsWith("55") && d.length === 12) out.add(d.slice(0, 4) + "9" + d.slice(4));
  return [...out];
}
function agoraSP() {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t)?.value ?? "";
  return { dia: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday")), hhmm: `${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}` };
}
function inicioDiaSPIso() {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${d}T00:00:00-03:00`).toISOString();
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const numeroDoJid = (jid) => soDigitos(String(jid ?? "").split("@")[0].split(":")[0]);

// ---------- estado publicado no painel (tabela config, chave whatsapp_local) ----------
const status = { estado: "iniciando", qr: null, numero: null, nome: null, mensagem: null };
async function publicarStatus(extra = {}) {
  Object.assign(status, extra);
  const valor = { ...status, visto_em: new Date().toISOString(), computador: process.env.COMPUTERNAME ?? null, versao: 1 };
  const { error } = await sb.from("config").upsert({ chave: "whatsapp_local", valor });
  if (error) erro(`Falha ao atualizar status no painel: ${error.message}`);
}

// ---------- WhatsApp ----------
let sock = null;
let conectado = false;

async function iniciarWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSAO);
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    /* usa a versão padrão da biblioteca */
  }
  sock = makeWASocket({
    auth: state,
    version,
    browser: Browsers.windows("Doces Komilão"),
    logger: pino({ level: "silent" }),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (u) => {
    if (u.qr) {
      const dataUrl = await QRCode.toDataURL(u.qr, { margin: 1, width: 320 });
      fs.writeFileSync(path.join(DIR, "qrcode.png"), Buffer.from(dataUrl.split(",")[1], "base64"));
      console.log(await QRCode.toString(u.qr, { type: "terminal", small: true }));
      aviso("Escaneie o QR code: no painel (WhatsApp → Conexão), nesta janela ou no arquivo qrcode.png.");
      aviso("No celular: WhatsApp → ⋮ → Aparelhos conectados → Conectar aparelho.");
      await publicarStatus({ estado: "aguardando_qr", qr: dataUrl, mensagem: null });
    }
    if (u.connection === "open") {
      conectado = true;
      const numero = numeroDoJid(sock.user?.id);
      ok(`WhatsApp conectado: +${numero} ${sock.user?.name ? `(${sock.user.name})` : ""}`);
      try { fs.unlinkSync(path.join(DIR, "qrcode.png")); } catch { /* ok */ }
      await publicarStatus({ estado: "conectado", qr: null, numero, nome: sock.user?.name ?? null, mensagem: null });
    }
    if (u.connection === "close") {
      conectado = false;
      const code = u.lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        aviso("O WhatsApp foi desconectado pelo celular. Apagando a sessão e gerando um novo QR code…");
        fs.rmSync(SESSAO, { recursive: true, force: true });
        await publicarStatus({ estado: "desconectado", qr: null, numero: null, nome: null, mensagem: "Desconectado pelo celular" });
      } else {
        aviso(`Conexão caiu (código ${code ?? "?"}). Reconectando em 5 s…`);
        await publicarStatus({ estado: "reconectando", qr: null });
      }
      await dormir(5000);
      iniciarWhatsApp().catch((e) => erro(`Falha ao reconectar: ${e.message}`));
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      try {
        await tratarRecebida(m);
      } catch (e) {
        erro(`Erro ao registrar mensagem recebida: ${e.message}`);
      }
    }
  });
}

// ---------- mensagens recebidas ----------
async function tratarRecebida(m) {
  const k = m.key ?? {};
  if (k.fromMe) return;
  const jid = k.remoteJid ?? "";
  if (jid.endsWith("@g.us") || jid === "status@broadcast" || jid.endsWith("@newsletter")) return;
  // Com endereçamento LID, o telefone real vem em remoteJidAlt / senderPn
  const jidTel = [k.remoteJidAlt, k.senderPn, jid].find((j) => j && String(j).endsWith("@s.whatsapp.net"));
  if (!jidTel) return;
  const numero = numeroDoJid(jidTel);
  const msg = m.message ?? {};
  const texto = msg.conversation ?? msg.extendedTextMessage?.text ?? msg.imageMessage?.caption ?? msg.videoMessage?.caption ?? null;

  await sb.from("whatsapp_recebidas").insert({ numero, texto, payload: { id: k.id, pushName: m.pushName ?? null } });
  const vars = variacoes(numero);
  const [{ data: cli }, { data: leads }] = await Promise.all([
    sb.from("clientes").select("id").in("whatsapp", vars).limit(1),
    sb.from("leads").select("id,status").in("whatsapp", vars).limit(5),
  ]);
  const clienteId = cli?.[0]?.id ?? null;
  const leadId = leads?.[0]?.id ?? null;

  const normal = (texto ?? "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z]/g, "");
  if (PALAVRAS_SAIR.includes(normal)) {
    await sb.from("whatsapp_optout").upsert({ numero, motivo: `Respondeu "${texto}"` });
    await sb.from("clientes").update({ opt_out: true }).in("whatsapp", vars);
    await sb.from("whatsapp_mensagens").update({ status: "cancelada", erro: "opt-out" }).in("numero", vars).in("status", ["pendente_aprovacao", "aprovada"]);
    aviso(`+${numero} pediu para sair — não receberá mais mensagens.`);
  } else {
    log(`Mensagem recebida de +${numero}${m.pushName ? ` (${m.pushName})` : ""}: ${String(texto ?? "(mídia)").slice(0, 80)}`, cor.ciano);
  }
  for (const l of leads ?? []) if (["novo", "qualificado"].includes(l.status)) await sb.from("leads").update({ status: "contatado", atualizado_em: new Date().toISOString() }).eq("id", l.id);
  if (clienteId || leadId) {
    await sb.from("crm_atividades").insert({ cliente_id: clienteId, lead_id: clienteId ? null : leadId, tipo: "whatsapp", texto: `Recebida: ${texto ?? "(mídia)"}` });
  }
}

// ---------- envio da fila aprovada ----------
async function processarFila() {
  if (!conectado || !sock) return;
  const { data: cfgRows } = await sb.from("config").select("chave,valor").in("chave", ["whatsapp_limite_diario", "whatsapp_horario", "whatsapp_local_cmd"]);
  const cfg = Object.fromEntries((cfgRows ?? []).map((c) => [c.chave, c.valor]));

  // comando vindo do painel (ex.: desconectar)
  const cmd = cfg.whatsapp_local_cmd;
  if (cmd?.acao === "desconectar" && !cmd.feito) {
    await sb.from("config").upsert({ chave: "whatsapp_local_cmd", valor: { ...cmd, feito: new Date().toISOString() } });
    aviso("Painel pediu para desconectar este número.");
    await sock.logout().catch(() => {});
    return;
  }

  const limite = Math.max(0, Number(cfg.whatsapp_limite_diario ?? 40) || 0);
  const h = cfg.whatsapp_horario ?? {};
  const inicio = h.inicio ?? "09:00";
  const fim = h.fim ?? "18:00";
  const dias = (h.dias ?? [1, 2, 3, 4, 5, 6]).map((d) => Number(d) % 7);
  const { dia, hhmm } = agoraSP();
  if (!dias.includes(dia) || hhmm < inicio || hhmm >= fim) return;

  const { count } = await sb.from("whatsapp_mensagens").select("id", { count: "exact", head: true }).eq("status", "enviada").gte("enviado_em", inicioDiaSPIso());
  const restante = limite - (count ?? 0);
  if (restante <= 0) return;

  const agora = new Date().toISOString();
  const { data: fila, error } = await sb
    .from("whatsapp_mensagens")
    .select("id,numero,texto,cliente_id,lead_id,tentativas,status")
    .or(`status.eq.aprovada,and(status.eq.erro,tentativas.lt.${MAX_TENTATIVAS})`)
    .lte("enviar_apos", agora)
    .order("enviar_apos")
    .limit(Math.min(MAX_POR_CICLO, restante));
  if (error) return erro(`Erro ao ler a fila: ${error.message}`);

  for (const msg of fila ?? []) {
    const vars = variacoes(msg.numero);
    const { data: opt } = await sb.from("whatsapp_optout").select("numero").in("numero", vars).limit(1);
    if (opt?.length) {
      await sb.from("whatsapp_mensagens").update({ status: "cancelada", erro: "opt-out" }).eq("id", msg.id);
      continue;
    }
    const { data: trava } = await sb.from("whatsapp_mensagens").update({ status: "enviando" }).eq("id", msg.id).eq("status", msg.status).select("id");
    if (!trava?.length) continue; // outra execução pegou

    try {
      const existe = await sock.onWhatsApp(soDigitos(msg.numero));
      const destino = existe?.find((x) => x.exists)?.jid;
      if (!destino) throw Object.assign(new Error("Número não tem WhatsApp"), { definitivo: true });
      const texto = String(msg.texto).replaceAll("{{link_loja}}", LINK_LOJA);
      const r = await sock.sendMessage(destino, { text: texto });
      await sb.from("whatsapp_mensagens").update({ status: "enviada", enviado_em: new Date().toISOString(), evolution_id: r?.key?.id ?? null, erro: null }).eq("id", msg.id);
      ok(`Enviada para +${numeroDoJid(destino)}`);
      if (msg.lead_id) await sb.from("leads").update({ status: "contatado", atualizado_em: new Date().toISOString() }).eq("id", msg.lead_id).in("status", ["novo", "qualificado"]);
      if (msg.cliente_id || msg.lead_id) {
        await sb.from("crm_atividades").insert({ cliente_id: msg.cliente_id, lead_id: msg.cliente_id ? null : msg.lead_id, tipo: "whatsapp", texto: `Enviada: ${texto.slice(0, 300)}` });
      }
    } catch (e) {
      const tent = (msg.tentativas ?? 0) + 1;
      const final = e.definitivo || tent >= MAX_TENTATIVAS;
      await sb
        .from("whatsapp_mensagens")
        .update({ status: "erro", erro: e.message, tentativas: final ? MAX_TENTATIVAS : tent, enviar_apos: new Date(Date.now() + tent * 5 * 60000).toISOString() })
        .eq("id", msg.id);
      erro(`Falha ao enviar para +${msg.numero}: ${e.message}${final ? "" : " (vai tentar de novo)"}`);
    }
    await dormir(4000 + Math.random() * 6000); // pausa humana entre envios
  }
}

// ---------- ciclos ----------
console.log(`\n${cor.ama}  ==============================================\n        WHATSAPP KOMILÃO — conector por QR code\n  ==============================================${cor.reset}\n`);
log("Deixe esta janela aberta. Fechou = mensagens aprovadas ficam esperando na fila.");
await publicarStatus({ estado: "iniciando" });
await iniciarWhatsApp();

setInterval(() => publicarStatus().catch(() => {}), 30000); // sinal de vida para o painel
(async function laco() {
  while (true) {
    try {
      await processarFila();
    } catch (e) {
      erro(`Erro no envio: ${e.message}`);
    }
    await dormir(20000);
  }
})();

async function encerrar() {
  log("Encerrando…");
  await publicarStatus({ estado: "offline", qr: null }).catch(() => {});
  process.exit(0);
}
process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
