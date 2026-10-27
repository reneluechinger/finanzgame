// Spiellogik ohne Oberfläche. Alle Funktionen verändern den übergebenen Zustand.

export const DAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const SLOT_NAMES = { morgen: "Morgen", nachmittag: "Nachmittag", abend: "Abend" };

const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const round1 = x => Math.round(x * 10) / 10;

export const weekdayIndex = day => (day - 1) % 7;
export const weekOf = day => Math.ceil(day / 7);
export const isWeekend = day => weekdayIndex(day) >= 5;
export const slotsFor = day => isWeekend(day) ? ["morgen", "nachmittag", "abend"] : ["nachmittag", "abend"];
export const slotKey = (day, slot) => (isWeekend(day) ? "wochenende-" : "werktag-") + slot;

export function moneyValue(cfg, state) {
  return clamp(Math.round((state.konto + state.spar) / cfg.moneyTarget * 100));
}

// Alle Werte (inkl. Geld) als Objekt id -> 0..100
export function allValues(cfg, state, raw = state.values) {
  const out = {};
  for (const v of cfg.values) out[v.id] = v.money ? moneyValue(cfg, state) : clamp(Math.round(raw[v.id] ?? 0));
  return out;
}

export function scoreOf(values) {
  const arr = Object.values(values);
  if (!arr.length) return { score: 0, avg: 0, gap: 0, zeros: 0 };
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const gap = Math.max(...arr) - Math.min(...arr);
  const zeros = arr.filter(v => v <= 0).length;
  const score = clamp(Math.round(avg - 0.5 * gap - 5 * zeros));
  return { score, avg: Math.round(avg), gap: Math.round(gap * 0.5), zeros };
}

export function newGame(cfg, nickname, variant) {
  const values = {};
  for (const v of cfg.values) if (!v.money) values[v.id] = v.start ?? 50;
  const state = {
    variant, nickname, day: 1, konto: cfg.startMoney, spar: 0, values,
    flags: {}, extraCosts: [], plan: {}, history: [], reflections: {},
    seenEvents: [], log: [], event: null, status: "day", started: new Date().toISOString()
  };
  startDay(cfg, state);
  return state;
}

export function flagActive(state, flag) {
  const f = state.flags[flag];
  return !!f && state.day >= f.from && (f.until == null || state.day <= f.until);
}

function applyEffects(cfg, state, effects = {}, factor = 1) {
  for (const [id, d] of Object.entries(effects)) {
    if (!(id in state.values)) continue;
    const v = state.values[id];
    // Hohe Werte steigen langsamer (ab 70 abnehmend)
    const f = d > 0 ? factor * Math.min(1, (100 - v) / 30) : 1;
    state.values[id] = clamp(v + d * f);
  }
}

function energyId(cfg) {
  return cfg.values.find(v => v.energy)?.id;
}

function isTired(cfg, state) {
  const id = energyId(cfg);
  return !!id && state.values[id] < cfg.lowEnergyLimit;
}

// Wird zu Beginn jedes Tages aufgerufen: Taschengeld, Kosten, Zins, Ereignis
export function startDay(cfg, state, rng = Math.random) {
  state.log = [];
  state.plan = {};
  const wd = weekdayIndex(state.day);
  if (wd === 0) {
    if (state.day > 1 && state.spar > 0 && cfg.interestPercent) {
      const z = round1(state.spar * cfg.interestPercent / 100);
      state.spar = round1(state.spar + z);
      state.log.push(`Zins auf dem Sparkonto: +Fr. ${z.toFixed(2)}`);
    }
    if (cfg.pocketMoney) {
      state.konto += cfg.pocketMoney;
      state.log.push(`Taschengeld: +Fr. ${cfg.pocketMoney}`);
    }
  }
  for (const c of [...cfg.costs, ...state.extraCosts]) {
    const due = c.interval === "woche" ? wd === 0 : (state.day - 1) % 28 === 0 || (c.added && c.added === state.day);
    if (due) {
      pay(state, c.amount);
      state.log.push(`${c.name}: −Fr. ${c.amount}`);
    }
  }
  state.event = null;
  if (state.day > 1 && rng() < 0.5) {
    // Ereignisse derselben Gruppe (z.B. zwei Varianten des Mathetests) kommen nur einmal vor
    const seenGroups = cfg.events.filter(e => e.group && state.seenEvents.includes(e.id)).map(e => e.group);
    const pool = cfg.events.filter(e => !state.seenEvents.includes(e.id) && !(e.group && seenGroups.includes(e.group)) && conditionOk(state, e.condition));
    if (pool.length) state.event = pool[Math.floor(rng() * pool.length)].id;
  }
}

function conditionOk(state, cond) {
  if (!cond || !cond.flag) return true;
  return cond.not ? !flagActive(state, cond.flag) : flagActive(state, cond.flag);
}

// Bezahlen: zuerst Konto, dann Sparkonto, Rest als Minus auf dem Konto
function pay(state, amount) {
  state.konto = round1(state.konto - amount);
  if (state.konto < 0 && state.spar > 0) {
    const take = Math.min(state.spar, -state.konto);
    state.spar = round1(state.spar - take);
    state.konto = round1(state.konto + take);
  }
}

export function chooseEventOption(cfg, state, index) {
  const ev = cfg.events.find(e => e.id === state.event);
  if (!ev) return;
  const opt = ev.options[index];
  if (opt.money) opt.money < 0 ? pay(state, -opt.money) : (state.konto = round1(state.konto + opt.money));
  if (opt.savings) state.spar = round1(state.spar + opt.savings);
  if (opt.addCost) state.extraCosts.push({ ...opt.addCost, added: state.day + 1 });
  applyEffects(cfg, state, opt.effects);
  state.seenEvents.push(ev.id);
  state.eventToday = { id: ev.id, choice: index };
  state.event = null;
}

// Status einer Aktivität für das aktuelle Zeitfenster
export function activityStatus(cfg, state, act, slot) {
  if (!act.when.includes(slotKey(state.day, slot))) return { ok: false, hidden: true };
  if (act.requires && !flagActive(state, act.requires)) return { ok: false, reason: act.lockedInfo || "Noch nicht freigeschaltet" };
  if (act.once && state.history.some(h => h.acts.includes(act.id))) return { ok: false, reason: "Schon erledigt" };
  const planned = Object.entries(state.plan).filter(([s]) => s !== slot).map(([, id]) => id);
  if (planned.includes(act.id)) return { ok: false, reason: "Heute schon gewählt" };
  if (act.money < 0) {
    const spent = planned.map(id => cfg.activities.find(a => a.id === id)).reduce((s, a) => s + Math.min(0, a?.money || 0), 0);
    if (state.konto + spent + act.money < 0) return { ok: false, reason: "Zu wenig Geld auf dem Konto" };
  }
  return { ok: true };
}

// Wendet Plan + tägliche Veränderung auf eine Kopie an (für Vorschau) oder auf den Zustand
function simulateDay(cfg, state) {
  const tired = isTired(cfg, state);
  const factor = tired ? 0.5 : 1;
  for (const slot of slotsFor(state.day)) {
    const act = cfg.activities.find(a => a.id === state.plan[slot]);
    if (!act) continue;
    if (act.money) {
      if (act.money < 0) pay(state, -act.money);
      else state.konto = round1(state.konto + act.money * factor);
    }
    applyEffects(cfg, state, act.effects, factor);
  }
  applyEffects(cfg, state, cfg.drift?.everyDay);
  if (!isWeekend(state.day)) applyEffects(cfg, state, cfg.drift?.schoolDay);
  return tired;
}

export function previewValues(cfg, state) {
  const copy = JSON.parse(JSON.stringify(state));
  simulateDay(cfg, copy);
  return allValues(cfg, copy);
}

export function endDay(cfg, state, rng = Math.random) {
  const acts = slotsFor(state.day).map(s => state.plan[s]).filter(Boolean);
  const tired = simulateDay(cfg, state);
  for (const id of acts) {
    const act = cfg.activities.find(a => a.id === id);
    if (act?.grants?.flag) {
      const from = act.grants.delay === "nextWeek" ? (weekOf(state.day) * 7 + 1) : state.day;
      state.flags[act.grants.flag] = { from, until: act.grants.duration ? state.day + act.grants.duration : null };
    }
  }
  const vals = allValues(cfg, state);
  state.history.push({
    day: state.day, acts, values: vals, score: scoreOf(vals).score,
    konto: state.konto, spar: state.spar, event: state.eventToday || null, tired
  });
  state.eventToday = null;
  const finishedWeek = weekdayIndex(state.day) === 6;
  state.day += 1;
  if (state.day > cfg.days) state.status = "done";
  else if (finishedWeek) state.status = "review";
  else { state.status = "day"; startDay(cfg, state, rng); }
}

// Nach dem Wochenrückblick weiter
export function continueAfterReview(cfg, state, rng = Math.random) {
  state.status = "day";
  startDay(cfg, state, rng);
}

export function transferSavings(state, amount) {
  // amount > 0: Konto -> Sparkonto, amount < 0: zurück
  if (amount > 0) amount = Math.min(amount, Math.max(0, state.konto));
  else amount = -Math.min(-amount, state.spar);
  state.konto = round1(state.konto - amount);
  state.spar = round1(state.spar + amount);
  return amount;
}

export function currentScore(cfg, state) {
  return scoreOf(allValues(cfg, state));
}
