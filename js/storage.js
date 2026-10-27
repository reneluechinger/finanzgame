// Lokales Speichern und Teilen von Varianten per Link
import { DEFAULT_CONFIG } from "./config.js";

const PREFIX = "finanzgame:";

function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function set(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
}
function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* egal */ }
}

// Kurzer, stabiler Hash (cyrb53) für Varianten-ID und PIN
export function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function variantId(cfg) {
  // PIN und Bestenlisten-URL gehören nicht zur Spielvariante
  const { pinHash, scriptUrl, ...rest } = cfg;
  return hash(JSON.stringify(rest)).slice(0, 6);
}

export const pinHash = pin => hash("finanzgame-pin:" + pin);
export const checkPin = (cfg, pin) => pinHash(pin) === (cfg.pinHash || pinHash("1234"));

// --- Konfiguration ---
export const loadConfig = () => sanitizeConfig(get("config") || structuredClone(DEFAULT_CONFIG));
export const saveConfig = cfg => set("config", cfg);
export const resetConfig = () => remove("config");

// --- Spielstände (einer pro Variante) ---
export const loadGame = variant => get("save:" + variant);
export const saveGame = state => set("save:" + state.variant, state);
export const deleteGame = variant => remove("save:" + variant);
export const lastNickname = () => get("nickname", "");
export const setNickname = n => set("nickname", n);

// --- Abgeschlossene Durchgänge (lokale Bestenliste) ---
export const loadRuns = () => get("runs", []);
export function addRun(run) {
  const runs = loadRuns();
  if (runs.some(r => r.name === run.name && r.variant === run.variant && r.started && r.started === run.started)) return;
  runs.push(run);
  set("runs", runs.slice(-200));
}

// --- Link-Codierung: JSON -> deflate -> base64url ---
function toB64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const fromB64 = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeConfig(cfg) {
  // Der PIN-Hash bleibt auf dem Gerät der Lehrperson
  const { pinHash: _, ...shared } = cfg;
  const bytes = new TextEncoder().encode(JSON.stringify(shared));
  if ("CompressionStream" in window) {
    try { return "z" + toB64(await pipe(bytes, new CompressionStream("deflate-raw"))); } catch { /* weiter ohne */ }
  }
  return "j" + toB64(bytes);
}

export async function decodeConfig(code) {
  const kind = code[0], bytes = fromB64(code.slice(1));
  const raw = kind === "z" ? await pipe(bytes, new DecompressionStream("deflate-raw")) : bytes;
  return sanitizeConfig(JSON.parse(new TextDecoder().decode(raw)));
}

// Bringt eine Variante (z.B. aus einem fremden Link) in eine sichere Form:
// Zahlen werden Zahlen, Farben echte Farbcodes, Listen echte Listen.
export function sanitizeConfig(cfg) {
  const c = structuredClone(cfg || {});
  const n = (x, lo, hi, d) => { const v = Number(x); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  const str = (x, max = 200) => (x == null ? "" : String(x).slice(0, max));
  const D = DEFAULT_CONFIG;
  c.name = str(c.name, 60) || "Standard";
  c.pinHash = str(c.pinHash, 40);
  c.scriptUrl = /^https:\/\/script\.google(usercontent)?\.com\//.test(str(c.scriptUrl, 300)) ? str(c.scriptUrl, 300) : "";
  c.days = Math.round(n(c.days, 1, 56, D.days));
  c.startMoney = n(c.startMoney, -1000, 100000, D.startMoney);
  c.moneyTarget = n(c.moneyTarget, 1, 100000, D.moneyTarget);
  c.pocketMoney = n(c.pocketMoney, 0, 10000, D.pocketMoney);
  c.interestPercent = n(c.interestPercent, 0, 100, D.interestPercent);
  c.lowEnergyLimit = n(c.lowEnergyLimit, 0, 100, D.lowEnergyLimit);
  const effects = e => Object.fromEntries(Object.entries(e && typeof e === "object" ? e : {})
    .map(([k, v]) => [str(k, 40), n(v, -100, 100, 0)]));
  c.values = (Array.isArray(c.values) ? c.values : []).map(v => ({
    ...v, id: str(v.id, 40), name: str(v.name, 40), icon: str(v.icon, 8),
    color: /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : "#7a6cf0",
    ...(v.money ? { money: true } : { start: n(v.start, 0, 100, 50) })
  }));
  c.drift = { everyDay: effects(c.drift?.everyDay), schoolDay: effects(c.drift?.schoolDay) };
  c.costs = (Array.isArray(c.costs) ? c.costs : []).map(x => ({ name: str(x.name, 60), amount: n(x.amount, 0, 100000, 0), interval: x.interval === "woche" ? "woche" : "monat" }));
  c.activities = (Array.isArray(c.activities) ? c.activities : []).map(a => ({
    ...a, id: str(a.id, 40), name: str(a.name, 60), icon: str(a.icon, 8), money: n(a.money, -100000, 100000, 0),
    when: (Array.isArray(a.when) ? a.when : []).map(w => str(w, 30)), effects: effects(a.effects),
    info: str(a.info), lockedInfo: str(a.lockedInfo)
  }));
  c.events = (Array.isArray(c.events) ? c.events : []).map(e => ({
    ...e, id: str(e.id, 40), icon: str(e.icon, 8), text: str(e.text, 300),
    options: (Array.isArray(e.options) ? e.options : []).map(o => ({
      ...o, label: str(o.label, 120), money: n(o.money, -100000, 100000, 0), savings: n(o.savings, 0, 100000, 0),
      effects: effects(o.effects),
      ...(o.addCost ? { addCost: { name: str(o.addCost.name, 60), amount: n(o.addCost.amount, 0, 100000, 0), interval: o.addCost.interval === "woche" ? "woche" : "monat" } } : {})
    }))
  }));
  c.questions = (Array.isArray(c.questions) ? c.questions : []).map(q => str(q, 300));
  return c;
}

// Prüft eine Konfiguration grob, damit Tippfehler das Spiel nicht zerstören
export function validateConfig(cfg) {
  const errors = [];
  if (!Array.isArray(cfg.values) || cfg.values.length < 2) errors.push("Es braucht mindestens 2 Werte.");
  if (!cfg.values?.some(v => v.money)) errors.push("Ein Wert muss der Geld-Wert sein.");
  const ids = new Set(cfg.values?.map(v => v.id));
  if (ids.size !== cfg.values?.length) errors.push("Zwei Werte haben dieselbe ID.");
  if (!Array.isArray(cfg.activities) || cfg.activities.length < 3) errors.push("Es braucht mindestens 3 Aktivitäten.");
  for (const a of cfg.activities || []) {
    if (!a.id || !a.name) errors.push("Eine Aktivität hat keinen Namen.");
    if (!a.when?.length) errors.push(`«${a.name}» ist keinem Zeitfenster zugeordnet.`);
  }
  for (const e of cfg.events || []) if (!e.options?.length) errors.push(`Ereignis «${e.text}» hat keine Wahlmöglichkeit.`);
  if (!(cfg.days >= 1)) errors.push("Das Spiel braucht mindestens 1 Tag.");
  // Jedes Zeitfenster braucht eine Aktivität, die immer geht (gratis, ohne Bedingung)
  const names = { "werktag-nachmittag": "Werktag Nachmittag", "werktag-abend": "Werktag Abend", "wochenende-morgen": "Wochenende Morgen", "wochenende-nachmittag": "Wochenende Nachmittag", "wochenende-abend": "Wochenende Abend" };
  for (const [k, label] of Object.entries(names)) {
    if (!(cfg.activities || []).some(a => a.when?.includes(k) && (Number(a.money) || 0) >= 0 && !a.requires && !a.once)) {
      errors.push(`Für «${label}» braucht es mindestens eine Gratis-Aktivität ohne Bedingung.`);
    }
  }
  return errors;
}
