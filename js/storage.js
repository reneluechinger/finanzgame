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
export const loadConfig = () => get("config") || structuredClone(DEFAULT_CONFIG);
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
  const bytes = new TextEncoder().encode(JSON.stringify(cfg));
  if ("CompressionStream" in window) {
    try { return "z" + toB64(await pipe(bytes, new CompressionStream("deflate-raw"))); } catch { /* weiter ohne */ }
  }
  return "j" + toB64(bytes);
}

export async function decodeConfig(code) {
  const kind = code[0], bytes = fromB64(code.slice(1));
  const raw = kind === "z" ? await pipe(bytes, new DecompressionStream("deflate-raw")) : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
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
  return errors;
}
