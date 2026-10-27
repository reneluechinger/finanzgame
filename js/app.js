import * as E from "./engine.js";
import * as S from "./storage.js";
import { radar, lines } from "./charts.js";
import { submitScore, fetchBoard } from "./leaderboard.js";
import { renderEditor } from "./editor.js";

const app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fr = n => (n < 0 ? "−" : "") + "Fr. " + Math.abs(n).toFixed(2).replace(/\.00$/, ".–");

let cfg, variant, state = null;
let activeSlot = null;
let modal = null; // "event" | "spar" | "menu" | null
let unlockedEditor = false;

// ---------- Start ----------
async function init() {
  cfg = S.loadConfig();
  const m = location.hash.match(/^#v=(.+)$/);
  if (m) {
    try {
      const shared = await S.decodeConfig(m[1]);
      if (S.validateConfig(shared).length) throw new Error("ungültig");
      cfg = shared;
      S.saveConfig(cfg);
    } catch {
      alert("Der Link zur Spielvariante ist beschädigt. Es wird die gespeicherte Variante verwendet.");
    }
    history.replaceState(null, "", location.pathname);
  }
  variant = S.variantId(cfg);
  state = S.loadGame(variant);
  route();
}

function route() {
  if (location.hash === "#lehrperson") return showEditor();
  showStart();
}
window.addEventListener("hashchange", route);

function save() { if (state) S.saveGame(state); }

function showStart() {
  modal = null;
  const saved = state && state.status !== "done" ? state : null;
  const nick = saved?.nickname || S.lastNickname();
  app.innerHTML = `
  <div class="screen start">
    <h1 class="logo big">FinanzGame</h1>
    <p class="lead">Ein Monat, deine Entscheidungen. Halte Geld, Zufriedenheit, Wertstiftung und mehr im Gleichgewicht.</p>
    ${cfg.name !== "Standard" ? `<p class="variant sans">Variante: <b>${esc(cfg.name)}</b></p>` : ""}
    <div class="card start-card sans">
      ${saved ? `
        <p>Gespeichertes Spiel von <b>${esc(saved.nickname)}</b>: Woche ${E.weekOf(Math.min(saved.day, cfg.days))}, Tag ${Math.min(saved.day, cfg.days)} von ${cfg.days}</p>
        <button class="btn primary" data-a="continue">Weiterspielen →</button>
        <button class="btn ghost" data-a="new-confirm">Neu beginnen</button>
      ` : `
        <label for="nick">Dein Spitzname (kein echter Name)</label>
        <input id="nick" maxlength="20" autocomplete="off" value="${esc(nick)}" placeholder="z.B. Sternschnuppe">
        <button class="btn primary" data-a="new">Spiel starten →</button>
      `}
    </div>
    <div class="row sans">
      <button class="btn ghost" data-a="help">So funktioniert's</button>
      <button class="btn ghost" data-a="board">🏆 Bestenliste</button>
    </div>
    <a class="teacher sans" href="#lehrperson">Für Lehrpersonen</a>
  </div>`;
}

// ---------- Spielbildschirm ----------
function showGame() {
  if (!state) return showStart();
  if (state.status === "review") return showReview();
  if (state.status === "done") return showFinal();
  const day = state.day, slots = E.slotsFor(day);
  if (!activeSlot || !slots.includes(activeSlot)) activeSlot = slots.find(s => !state.plan[s]) || slots[0];
  const vals = E.allValues(cfg, state);
  const planned = slots.some(s => state.plan[s]);
  const preview = planned ? E.previewValues(cfg, state) : null;
  const sc = E.scoreOf(vals);
  const tired = (() => { const id = cfg.values.find(v => v.energy)?.id; return id && state.values[id] < cfg.lowEnergyLimit; })();
  const allSet = slots.every(s => state.plan[s]);
  const lowest = cfg.values.reduce((a, v) => (vals[v.id] < vals[a.id] ? v : a), cfg.values[0]);

  const acts = cfg.activities.map(a => ({ a, st: E.activityStatus(cfg, state, a, activeSlot) })).filter(x => !x.st.hidden);

  app.innerHTML = `
  <div class="screen game">
    <header class="top">
      <button class="logo linkish" data-a="menu" aria-label="Menü">FinanzGame ☰</button>
      <div class="meta sans">
        <span>Woche ${E.weekOf(day)} · <b>${E.DAY_NAMES[E.weekdayIndex(day)]}</b> · Tag ${day}/${cfg.days}</span>
        <button class="money ${state.konto < 0 ? "neg" : ""}" data-a="spar">Konto <b>${fr(state.konto)}</b> · Sparkonto ${fr(state.spar)}</button>
      </div>
    </header>
    <div class="progress"><i style="width:${(day - 1) / cfg.days * 100}%"></i></div>
    <div class="wrap">
      <section class="card radar">
        <h2>Dein Gleichgewicht</h2>
        ${radar(cfg.values, vals, preview)}
        <div class="score-row sans">
          <div><small>Punkte</small><b>${sc.score}</b></div>
          <div class="formula">Ø ${sc.avg} − Ungleichgewicht ${sc.gap}${sc.zeros ? ` − ${sc.zeros * 5} (Wert auf 0)` : ""}<br><span>Je runder die Form, desto mehr Punkte.</span></div>
        </div>
        ${preview ? `<p class="hint">Gestrichelt: So sieht es nach diesem Tag aus.</p>` : ""}
      </section>
      <section class="side">
        ${state.log.length ? `<div class="log sans">${state.log.map(esc).join(" · ")}</div>` : ""}
        <div class="plan card sans">
          ${!E.isWeekend(day) ? `<div class="slot fixed"><small>Morgen</small><p>🏫 Schule</p></div>` : ""}
          ${slots.map(s => {
            const act = cfg.activities.find(a => a.id === state.plan[s]);
            return `<button class="slot ${s === activeSlot ? "now" : ""} ${act ? "on" : ""}" data-a="slot" data-slot="${s}">
              <small>${E.SLOT_NAMES[s]}</small><p>${act ? `${esc(act.icon)} ${esc(act.name)}` : "offen …"}</p></button>`;
          }).join("")}
        </div>
        <h3 class="ask">Was machst du am ${E.SLOT_NAMES[activeSlot]}?</h3>
        <div class="acts sans">
          ${acts.map(({ a, st }) => `
            <button class="act ${state.plan[activeSlot] === a.id ? "hl" : ""}" data-a="act" data-id="${esc(a.id)}" ${st.ok ? "" : "disabled"}>
              <b>${esc(a.icon)} ${esc(a.name)}</b>
              <small>${effectText(a)}</small>
              ${!st.ok ? `<em>🔒 ${esc(st.reason)}</em>` : a.info ? `<em>${esc(a.info)}</em>` : ""}
            </button>`).join("")}
        </div>
        <p class="tip">${tired ? `⚠️ Du bist müde: Positive Effekte wirken heute nur halb. Gönn dir Erholung.` :
          `Tipp: ${esc(lowest.icon)} ${esc(lowest.name)} ist gerade am tiefsten.`}</p>
        <button class="btn primary end sans" data-a="end" ${allSet ? "" : "disabled"}>${allSet ? "Tag beenden →" : "Wähle für jedes Zeitfenster etwas"}</button>
      </section>
    </div>
    ${modal ? renderModal() : ""}
  </div>`;
}

function effectText(a) {
  const parts = [];
  if (a.money) parts.push(`<span class="${a.money > 0 ? "pos" : "neg"}">${a.money > 0 ? "+" : ""}${fr(a.money)}</span>`);
  for (const v of cfg.values) {
    const d = a.effects?.[v.id];
    if (!d) continue;
    const arrow = d > 0 ? (d >= 8 ? "↑↑" : "↑") : (d <= -8 ? "↓↓" : "↓");
    parts.push(`<span class="${d > 0 ? "pos" : "neg"}">${esc(v.name)} ${arrow}</span>`);
  }
  if (a.grants?.delay === "nextWeek") parts.push(`<span class="pos">⏳ wirkt später</span>`);
  return parts.join(" · ") || "keine Wirkung";
}

function renderModal() {
  if (modal === "event") {
    const ev = cfg.events.find(e => e.id === state.event);
    if (!ev) { modal = null; return ""; }
    return `<div class="overlay"><div class="dialog">
      <div class="ev-icon">${esc(ev.icon)}</div>
      <p class="ev-text">${esc(ev.text)}</p>
      <div class="ev-opts sans">${ev.options.map((o, i) => `
        <button class="btn opt" data-a="ev" data-i="${i}"><b>${esc(o.label)}</b><small>${optText(o)}</small></button>`).join("")}</div>
    </div></div>`;
  }
  if (modal === "spar") {
    return `<div class="overlay"><div class="dialog sans">
      <h2>💰 Sparkonto</h2>
      <p>Konto: <b>${fr(state.konto)}</b> · Sparkonto: <b>${fr(state.spar)}</b></p>
      <p class="small">Jeden Montag gibt es ${cfg.interestPercent} % Zins auf das Sparkonto (Spiel-Zins, auf echten Konten ist er viel tiefer). Geld auf dem Sparkonto kannst du nicht für Aktivitäten ausgeben, es hilft aber bei Notfällen.</p>
      <div class="row">${[10, 20, 50].map(n => `<button class="btn ghost" data-a="sparen" data-n="${n}">+${n} sparen</button>`).join("")}</div>
      <div class="row">${[10, 20, 50].map(n => `<button class="btn ghost" data-a="sparen" data-n="${-n}">${n} zurückholen</button>`).join("")}</div>
      <button class="btn primary" data-a="close">Fertig</button>
    </div></div>`;
  }
  if (modal === "menu") {
    return `<div class="overlay"><div class="dialog sans">
      <h2>Menü</h2>
      <p class="small">Dein Spiel wird nach jeder Aktion automatisch gespeichert.</p>
      <button class="btn ghost" data-a="help">So funktioniert's</button>
      <button class="btn ghost" data-a="home">Pause: zum Startbildschirm</button>
      <button class="btn primary" data-a="close">Weiterspielen</button>
    </div></div>`;
  }
  return "";
}

function optText(o) {
  const parts = [];
  if (o.money) parts.push(`${o.money > 0 ? "+" : ""}${fr(o.money)}`);
  if (o.savings) parts.push(`+${fr(o.savings)} aufs Sparkonto`);
  if (o.addCost) parts.push(`neue Kosten: ${fr(o.addCost.amount)} pro ${o.addCost.interval === "woche" ? "Woche" : "Monat"}`);
  for (const v of cfg.values) {
    const d = o.effects?.[v.id];
    if (d) parts.push(`${v.name} ${d > 0 ? "↑" : "↓"}`);
  }
  return esc(parts.join(" · "));
}

// ---------- Wochenrückblick ----------
function showReview() {
  const week = E.weekOf(state.day - 1);
  const from = (week - 1) * 7 + 1, to = week * 7;
  const hist = state.history.filter(h => h.day >= from && h.day <= to);
  const before = state.history.find(h => h.day === from - 1);
  const q = cfg.questions[week - 1] || cfg.questions[cfg.questions.length - 1] || "";
  const scStart = before ? before.score : null, scEnd = hist.at(-1)?.score ?? 0;
  app.innerHTML = `
  <div class="screen review">
    <h1 class="logo">Rückblick Woche ${week}</h1>
    <div class="grid2">
      <section class="card">
        <h2>So haben sich deine Werte entwickelt</h2>
        ${lines(cfg.values, hist, { from, to, startValues: before?.values })}
      </section>
      <section class="card sans">
        <p class="bigscore">${scEnd} <small>Punkte</small></p>
        ${scStart != null ? `<p>${scEnd >= scStart ? "▲" : "▼"} ${Math.abs(scEnd - scStart)} Punkte seit letzter Woche</p>` : ""}
        <p>Konto ${fr(state.konto)} · Sparkonto ${fr(state.spar)}</p>
        ${topActs(hist)}
      </section>
    </div>
    <section class="card sans">
      <label for="refl"><b>Nachdenken:</b> ${esc(q)}</label>
      <textarea id="refl" rows="3" placeholder="Schreib ein paar Sätze …">${esc(state.reflections[week] || "")}</textarea>
    </section>
    <div class="row sans right">
      <button class="btn ghost" data-a="review-pause">Speichern und beenden</button>
      <button class="btn primary" data-a="review-next">Weiter zu Woche ${week + 1} →</button>
    </div>
  </div>`;
}

function topActs(hist) {
  const count = {};
  hist.forEach(h => h.acts.forEach(id => (count[id] = (count[id] || 0) + 1)));
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!top.length) return "";
  return `<p><b>Am häufigsten gewählt:</b></p><ul class="tops">${top.map(([id, n]) => {
    const a = cfg.activities.find(x => x.id === id);
    return `<li>${esc(a?.icon)} ${esc(a?.name || id)} <span>${n}×</span></li>`;
  }).join("")}</ul>`;
}

function saveReflection() {
  const ta = document.getElementById("refl");
  if (ta) state.reflections[ta.dataset.week || E.weekOf(state.day - 1)] = ta.value.trim();
}

// ---------- Monatsauswertung ----------
function showFinal() {
  const last = state.history.at(-1);
  const vals = last.values;
  const sc = E.scoreOf(vals);
  const lastWeek = Math.ceil(cfg.days / 7);
  const q = cfg.questions[lastWeek - 1] || "";
  const eventsTaken = state.history.filter(h => h.event).map(h => {
    const ev = cfg.events.find(e => e.id === h.event.id);
    return ev ? `<li>${esc(ev.icon)} ${esc(ev.text)} → <b>${esc(ev.options[h.event.choice]?.label)}</b></li>` : "";
  }).join("");
  app.innerHTML = `
  <div class="screen final">
    <header class="top"><h1 class="logo">Monatsauswertung</h1><span class="sans">${esc(state.nickname)} · ${new Date().toLocaleDateString("de-CH")}${cfg.name !== "Standard" ? " · " + esc(cfg.name) : ""}</span></header>
    <div class="grid2">
      <section class="card radar">${radar(cfg.values, vals)}
        <div class="score-row sans"><div><small>Endpunktzahl</small><b>${sc.score}</b></div>
        <div class="formula">Ø ${sc.avg} − Ungleichgewicht ${sc.gap}${sc.zeros ? ` − ${sc.zeros * 5}` : ""}</div></div>
      </section>
      <section class="card sans">
        <h2>Verlauf im Monat</h2>
        ${lines(cfg.values, state.history, { from: 1, to: cfg.days })}
        <p>Konto ${fr(state.konto)} · Sparkonto ${fr(state.spar)}</p>
      </section>
    </div>
    <div class="grid2">
      <section class="card sans">${topActs(state.history)}
        ${eventsTaken ? `<p><b>Deine Entscheidungen bei Ereignissen:</b></p><ul class="evlist">${eventsTaken}</ul>` : ""}</section>
      <section class="card sans">
        <h2>Deine Gedanken</h2>
        ${cfg.questions.slice(0, lastWeek - 1).map((qq, i) => state.reflections[i + 1] ? `<p class="refl-q">${esc(qq)}</p><p class="refl-a">${esc(state.reflections[i + 1])}</p>` : "").join("")}
        <label for="refl"><b>${esc(q)}</b></label>
        <textarea id="refl" data-week="${lastWeek}" rows="3">${esc(state.reflections[lastWeek] || "")}</textarea>
      </section>
    </div>
    <div class="row sans right noprint">
      ${state.submitted ? `<span class="ok">✓ In der Bestenliste eingetragen</span>` : `<button class="btn ghost" data-a="submit">🏆 In Bestenliste eintragen</button>`}
      <button class="btn ghost" data-a="print">Drucken / als PDF speichern</button>
      <button class="btn primary" data-a="new-confirm">Neuer Monat</button>
    </div>
    <p class="sans small noprint" id="submit-msg"></p>
  </div>`;
}

// ---------- Bestenliste ----------
async function showBoard() {
  app.innerHTML = `<div class="screen board"><h1 class="logo">🏆 Bestenliste</h1><div class="card sans"><p>Lade …</p></div></div>`;
  const { online, entries, error } = await fetchBoard(cfg, variant);
  app.innerHTML = `
  <div class="screen board">
    <h1 class="logo">🏆 Bestenliste</h1>
    <p class="sans small">${online ? "Gemeinsame Liste der Klasse" : cfg.scriptUrl ? `Keine Verbindung (${esc(error)}), es werden nur Durchgänge auf diesem Gerät gezeigt.` : "Durchgänge auf diesem Gerät"}${cfg.name !== "Standard" ? ` · Variante ${esc(cfg.name)}` : ""}</p>
    <div class="card sans">
      ${entries.length ? `<table class="board-t"><thead><tr><th>#</th><th>Spitzname</th><th>Punkte</th><th>Datum</th></tr></thead><tbody>
        ${entries.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}</td><td><b>${esc(e.score)}</b></td><td>${esc(new Date(e.date).toLocaleDateString("de-CH"))}</td></tr>`).join("")}
      </tbody></table>` : `<p>Noch keine Einträge. Spiel einen Monat durch und trag dich ein!</p>`}
    </div>
    <button class="btn primary sans" data-a="home">Zurück</button>
  </div>`;
}

// ---------- Anleitung ----------
function showHelp() {
  const backTo = state && state.status === "day" ? "continue" : "home";
  app.innerHTML = `
  <div class="screen help">
    <h1 class="logo">So funktioniert's</h1>
    <div class="card sans helptext">
      <p><b>Ziel:</b> Du spielst einen Monat (${cfg.days} Tage) im Leben einer jugendlichen Person. Halte alle Werte möglichst hoch und im Gleichgewicht:</p>
      <ul>${cfg.values.map(v => `<li>${esc(v.icon)} <b>${esc(v.name)}</b>${v.money ? ` (Konto + Sparkonto, ${fr(cfg.moneyTarget)} entsprechen 100)` : ""}</li>`).join("")}</ul>
      <p><b>Jeden Tag</b> wählst du, was du in deiner freien Zeit machst: an Schultagen am Nachmittag und am Abend, am Wochenende auch am Morgen. Tippe auf ein Zeitfenster, um deine Wahl zu ändern. Die gestrichelte Linie zeigt dir, wie sich deine Werte verändern.</p>
      <p><b>Wertstiftung</b> bedeutet: Du schaffst Nutzen für andere. Manchmal wirst du dafür bezahlt (Nachhilfe, Babysitten), manchmal nicht (Tierheim, Familie).</p>
      <p><b>Geld:</b> Jeden Montag gibt es ${fr(cfg.pocketMoney)} Taschengeld. Es gibt laufende Kosten. Auf dem Sparkonto gibt es Zins. Manche Dinge zahlen sich erst später aus, z.B. ein Kurs.</p>
      <p><b>Ereignisse:</b> Ab und zu passiert etwas Unerwartetes, und du entscheidest, wie du reagierst.</p>
      <p><b>Energie:</b> Ist sie unter ${cfg.lowEnergyLimit}, wirken gute Effekte nur halb. Hohe Werte steigen langsamer.</p>
      <p><b>Punkte</b> = Durchschnitt aller Werte − halber Abstand zwischen höchstem und tiefstem Wert. Für jeden Wert auf 0 gibt es 5 Punkte Abzug. Wer nur auf einen Wert setzt, verliert.</p>
      <p><b>Nach jeder Woche</b> gibt es einen Rückblick. Dort kannst du speichern und später weiterspielen. Alles wird nur auf diesem Gerät gespeichert.</p>
    </div>
    <button class="btn primary sans" data-a="${backTo}">Zurück</button>
  </div>`;
}

// ---------- Lehrpersonen ----------
function showEditor() {
  if (!unlockedEditor) {
    app.innerHTML = `<div class="screen start"><h1 class="logo">Für Lehrpersonen</h1>
      <div class="card start-card sans"><label for="pin">PIN eingeben</label>
      <input id="pin" type="password" inputmode="numeric" autocomplete="off">
      <button class="btn primary" data-a="pin">Öffnen</button>
      <p class="small">Standard-PIN beim ersten Mal: 1234. Bitte im Editor ändern.</p>
      <button class="btn ghost" data-a="home">Zurück zum Spiel</button></div></div>`;
    return;
  }
  renderEditor(app, cfg, newCfg => {
    cfg = newCfg;
    S.saveConfig(cfg);
    variant = S.variantId(cfg);
    state = S.loadGame(variant);
  });
}

// ---------- Ereignis-Steuerung ----------
function afterDayStart() {
  modal = state.event ? "event" : null;
  activeSlot = null;
  save();
  showGame();
}

app.addEventListener("click", async ev => {
  const el = ev.target.closest("[data-a]");
  if (!el || el.disabled) return;
  const a = el.dataset.a;
  switch (a) {
    case "new": {
      const nick = document.getElementById("nick").value.trim().slice(0, 20);
      if (!nick) { document.getElementById("nick").focus(); return; }
      S.setNickname(nick);
      state = E.newGame(cfg, nick, variant);
      afterDayStart();
      break;
    }
    case "new-confirm":
      if (state?.status === "done" ? true : confirm("Wirklich neu beginnen? Der gespeicherte Spielstand wird gelöscht.")) {
        if (state?.status === "done") saveReflection(), save();
        S.deleteGame(variant);
        state = null;
        showStart();
      }
      break;
    case "continue": modal = state.event ? "event" : null; showGame(); break;
    case "home": location.hash = ""; showStart(); break;
    case "help": modal = null; showHelp(); break;
    case "board": showBoard(); break;
    case "menu": modal = "menu"; showGame(); break;
    case "spar": modal = "spar"; showGame(); break;
    case "close": modal = null; showGame(); break;
    case "sparen": E.transferSavings(state, Number(el.dataset.n)); save(); showGame(); break;
    case "slot": activeSlot = el.dataset.slot; showGame(); break;
    case "act": {
      state.plan[activeSlot] = el.dataset.id;
      const next = E.slotsFor(state.day).find(s => !state.plan[s]);
      if (next) activeSlot = next;
      save();
      showGame();
      break;
    }
    case "ev": E.chooseEventOption(cfg, state, Number(el.dataset.i)); modal = null; save(); showGame(); break;
    case "end":
      E.endDay(cfg, state);
      if (state.status === "day") afterDayStart();
      else { save(); showGame(); window.scrollTo(0, 0); }
      break;
    case "review-next": saveReflection(); E.continueAfterReview(cfg, state); afterDayStart(); break;
    case "review-pause": saveReflection(); save(); showStart(); break;
    case "print": saveReflection(); save(); window.print(); break;
    case "submit": {
      saveReflection();
      const last = state.history.at(-1);
      el.disabled = true;
      const msg = document.getElementById("submit-msg");
      msg.textContent = "Wird gesendet …";
      const res = await submitScore(cfg, { name: state.nickname, score: last.score, variant, date: new Date().toISOString(), values: last.values });
      state.submitted = true;
      save();
      showFinal();
      document.getElementById("submit-msg").textContent = res.online
        ? "Eingetragen in die gemeinsame Bestenliste."
        : cfg.scriptUrl ? "Keine Verbindung: Nur auf diesem Gerät gespeichert." : "Auf diesem Gerät gespeichert.";
      break;
    }
    case "pin": {
      const pin = document.getElementById("pin").value;
      if (S.checkPin(cfg, pin)) { unlockedEditor = true; showEditor(); }
      else alert("Falsche PIN.");
      break;
    }
  }
});

app.addEventListener("keydown", ev => {
  if (ev.key !== "Enter") return;
  if (ev.target.id === "nick") app.querySelector('[data-a="new"]')?.click();
  if (ev.target.id === "pin") app.querySelector('[data-a="pin"]')?.click();
});

init();
