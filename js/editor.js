// Lehrpersonen-Editor: Variante anpassen und als Link teilen
import * as S from "./storage.js";
import { DEFAULT_CONFIG } from "./config.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const WHEN = [
  ["werktag-nachmittag", "Werktag Nachmittag"], ["werktag-abend", "Werktag Abend"],
  ["wochenende-morgen", "Wochenende Morgen"], ["wochenende-nachmittag", "Wochenende Nachmittag"], ["wochenende-abend", "Wochenende Abend"]
];
const TABS = [["allg", "Allgemein"], ["werte", "Werte"], ["akt", "Aktivitäten"], ["ev", "Ereignisse"], ["fragen", "Kosten & Fragen"], ["teilen", "Teilen"], ["json", "JSON"]];

let draft, tab = "allg", onSaveCb, root, dirty = false, openItem = null;

export function renderEditor(el, cfg, onSave) {
  root = el;
  onSaveCb = onSave;
  draft = structuredClone(cfg);
  dirty = false;
  render();
}

function render() {
  root.innerHTML = `
  <div class="screen editor sans">
    <header class="top"><h1 class="logo">Editor für Lehrpersonen</h1>
      <div class="row"><button class="btn ghost" data-e="leave">Zum Spiel</button>
      <button class="btn primary" data-e="save">${dirty ? "Speichern ●" : "Gespeichert"}</button></div></header>
    <nav class="tabs">${TABS.map(([id, n]) => `<button class="${tab === id ? "on" : ""}" data-e="tab" data-tab="${id}">${n}</button>`).join("")}</nav>
    <div id="ed-msg" class="msg"></div>
    <div class="ed-body">${body()}</div>
  </div>`;
}

const num = (path, val, label, step = 1) =>
  `<label class="f"><span>${label}</span><input type="number" step="${step}" data-p="${path}" data-t="num" value="${esc(val ?? 0)}"></label>`;
const txt = (path, val, label, cls = "") =>
  `<label class="f ${cls}"><span>${label}</span><input data-p="${path}" value="${esc(val ?? "")}"></label>`;
const chk = (path, val, label) =>
  `<label class="c"><input type="checkbox" data-p="${path}" data-t="bool" ${val ? "checked" : ""}> ${label}</label>`;

function effectInputs(base, effects) {
  return `<div class="effects">${draft.values.filter(v => !v.money).map(v =>
    num(`${base}.effects.${v.id}`, effects?.[v.id] ?? 0, `${esc(v.icon)} ${esc(v.name)}`)).join("")}</div>`;
}

function body() {
  const d = draft;
  if (tab === "allg") return `
    <section class="card">
      <h2>Spiel</h2>
      ${txt("name", d.name, "Name der Variante (z.B. Klasse 3a)", "wide")}
      <div class="grid3">
        ${num("startMoney", d.startMoney, "Startgeld (Fr.)")}
        ${num("pocketMoney", d.pocketMoney, "Taschengeld pro Woche (Fr.)")}
        ${num("moneyTarget", d.moneyTarget, "Franken für Geld-Wert 100")}
        ${num("interestPercent", d.interestPercent, "Zins pro Woche (%)", 0.1)}
        ${num("lowEnergyLimit", d.lowEnergyLimit, "Müde unter Energie")}
        ${num("days", d.days, "Anzahl Tage (7, 14, 21, 28)", 7)}
      </div>
      <h3>Was jeden Tag automatisch passiert</h3>
      <p class="small">Jeden Tag:</p>${driftInputs("everyDay")}
      <p class="small">Zusätzlich an Schultagen:</p>${driftInputs("schoolDay")}
    </section>
    <section class="card">
      <h2>Bestenliste</h2>
      ${txt("scriptUrl", d.scriptUrl, "URL der Google-Apps-Script-Web-App (leer = nur lokal)", "wide")}
      <p class="small">Anleitung: siehe README im Projekt, Abschnitt «Bestenliste einrichten».</p>
    </section>
    <section class="card">
      <h2>PIN ändern</h2>
      <label class="f"><span>Neue PIN</span><input id="newpin" type="password" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <button class="btn ghost" data-e="pin">PIN setzen</button>
    </section>`;

  if (tab === "werte") return `
    <section class="card">
      <h2>Werte</h2>
      <p class="small">Der Geld-Wert wird aus Konto und Sparkonto berechnet. Beim Energie-Wert gilt die Müde-Regel.</p>
      ${d.values.map((v, i) => `
        <div class="item-row">
          ${txt(`values.${i}.icon`, v.icon, "Symbol", "narrow")}
          ${txt(`values.${i}.name`, v.name, "Name")}
          <label class="f narrow"><span>Farbe</span><input type="color" data-p="values.${i}.color" value="${esc(v.color)}"></label>
          ${v.money ? `<span class="tag">Geld-Wert</span>` : num(`values.${i}.start`, v.start ?? 50, "Startwert")}
          ${v.money ? "" : chk(`values.${i}.energy`, v.energy, "Energie-Wert")}
          ${v.money ? "" : `<button class="btn danger" data-e="del-value" data-i="${i}">Entfernen</button>`}
        </div>`).join("")}
      <button class="btn ghost" data-e="add-value">+ Wert hinzufügen</button>
    </section>`;

  if (tab === "akt") return `
    <section class="card">
      <h2>Aktivitäten (${d.activities.length})</h2>
      <p class="small">Effekte: ungefähr 5 = ↑, 10 = ↑↑. Geld in Franken, negative Zahl = kostet.</p>
      ${d.activities.map((a, i) => `
        <details ${openItem === "a" + i ? "open" : ""} data-open="a${i}">
          <summary>${esc(a.icon)} ${esc(a.name)}</summary>
          <div class="item">
            <div class="grid3">${txt(`activities.${i}.icon`, a.icon, "Symbol")}${txt(`activities.${i}.name`, a.name, "Name")}${num(`activities.${i}.money`, a.money, "Geld (Fr.)")}</div>
            ${effectInputs(`activities.${i}`, a.effects)}
            <p class="small">Wann möglich?</p>
            <div class="checks">${WHEN.map(([k, n]) => `<label class="c"><input type="checkbox" data-p="activities.${i}.when" data-t="when" data-k="${k}" ${a.when?.includes(k) ? "checked" : ""}> ${n}</label>`).join("")}</div>
            ${txt(`activities.${i}.info`, a.info, "Hinweis für Lernende (optional)", "wide")}
            <details class="adv"><summary>Erweitert: Freischalten und Verzögerung</summary>
              <div class="grid3">
                ${txt(`activities.${i}.requires`, a.requires, "Braucht Merkmal")}
                ${txt(`activities.${i}.lockedInfo`, a.lockedInfo, "Text, wenn gesperrt")}
                ${chk(`activities.${i}.once`, a.once, "Nur einmal im Monat")}
                ${txt(`activities.${i}.grants.flag`, a.grants?.flag, "Gibt Merkmal")}
                <label class="f"><span>Merkmal wirkt</span><select data-p="activities.${i}.grants.delay">
                  <option value="now" ${a.grants?.delay !== "nextWeek" ? "selected" : ""}>sofort</option>
                  <option value="nextWeek" ${a.grants?.delay === "nextWeek" ? "selected" : ""}>ab nächster Woche</option></select></label>
                ${num(`activities.${i}.grants.duration`, a.grants?.duration ?? 0, "Dauer in Tagen (0 = immer)")}
              </div>
              <p class="small">Beispiel: «Babysitter-Kurs» gibt das Merkmal «babysitter» ab nächster Woche, «Babysitten» braucht es.</p>
            </details>
            <button class="btn danger" data-e="del-act" data-i="${i}">Aktivität löschen</button>
          </div>
        </details>`).join("")}
      <button class="btn ghost" data-e="add-act">+ Aktivität hinzufügen</button>
    </section>`;

  if (tab === "ev") return `
    <section class="card">
      <h2>Ereignisse (${d.events.length})</h2>
      <p class="small">An etwa jedem zweiten Tag passiert ein Ereignis. Jedes kommt höchstens einmal pro Monat vor.</p>
      ${d.events.map((e, i) => `
        <details ${openItem === "e" + i ? "open" : ""} data-open="e${i}">
          <summary>${esc(e.icon)} ${esc(e.text)}</summary>
          <div class="item">
            <div class="grid3">${txt(`events.${i}.icon`, e.icon, "Symbol")}${txt(`events.${i}.text`, e.text, "Text", "wide")}</div>
            <div class="grid3">${txt(`events.${i}.condition.flag`, e.condition?.flag, "Nur wenn Merkmal (optional)")}
              ${chk(`events.${i}.condition.not`, e.condition?.not, "… wenn Merkmal fehlt")}</div>
            ${e.options.map((o, j) => `
              <div class="opt-box">
                <div class="grid3">${txt(`events.${i}.options.${j}.label`, o.label, `Wahl ${j + 1}`, "wide")}
                ${num(`events.${i}.options.${j}.money`, o.money, "Geld (Fr.)")}${num(`events.${i}.options.${j}.savings`, o.savings, "aufs Sparkonto (Fr.)")}</div>
                ${effectInputs(`events.${i}.options.${j}`, o.effects)}
                ${e.options.length > 1 ? `<button class="btn danger small" data-e="del-opt" data-i="${i}" data-j="${j}">Wahl entfernen</button>` : ""}
              </div>`).join("")}
            ${e.options.length < 3 ? `<button class="btn ghost" data-e="add-opt" data-i="${i}">+ Wahl hinzufügen</button>` : ""}
            <button class="btn danger" data-e="del-ev" data-i="${i}">Ereignis löschen</button>
          </div>
        </details>`).join("")}
      <button class="btn ghost" data-e="add-ev">+ Ereignis hinzufügen</button>
    </section>`;

  if (tab === "fragen") return `
    <section class="card">
      <h2>Laufende Kosten</h2>
      ${d.costs.map((c, i) => `<div class="item-row">${txt(`costs.${i}.name`, c.name, "Name")}${num(`costs.${i}.amount`, c.amount, "Betrag (Fr.)")}
        <label class="f"><span>Wie oft</span><select data-p="costs.${i}.interval"><option value="woche" ${c.interval === "woche" ? "selected" : ""}>jeden Montag</option><option value="monat" ${c.interval !== "woche" ? "selected" : ""}>am Monatsanfang</option></select></label>
        <button class="btn danger" data-e="del-cost" data-i="${i}">Entfernen</button></div>`).join("")}
      <button class="btn ghost" data-e="add-cost">+ Kosten hinzufügen</button>
    </section>
    <section class="card">
      <h2>Reflexionsfragen (eine pro Woche)</h2>
      ${[0, 1, 2, 3].map(i => txt(`questions.${i}`, d.questions[i], `Woche ${i + 1}`, "wide")).join("")}
    </section>`;

  if (tab === "teilen") return `
    <section class="card">
      <h2>Variante mit der Klasse teilen</h2>
      <p>Speichere zuerst deine Änderungen. Dann erzeugst du einen Link. Wer den Link öffnet, spielt mit deiner Variante, auch die Bestenliste ist getrennt pro Variante.</p>
      <button class="btn primary" data-e="link">Link erzeugen</button>
      <textarea id="share" rows="4" readonly placeholder="Hier erscheint der Link"></textarea>
      <button class="btn ghost" data-e="copy">Link kopieren</button>
      <p class="small">Tipp: Den Link als QR-Code oder über die Schulplattform teilen. Ändert sich etwas an der Variante, braucht es einen neuen Link.</p>
    </section>
    <section class="card">
      <h2>Sichern und laden</h2>
      <button class="btn ghost" data-e="download">Variante als Datei herunterladen</button>
      <label class="btn ghost file">Variante aus Datei laden<input type="file" accept=".json,application/json" data-e-file="upload" hidden></label>
      <button class="btn danger" data-e="reset">Auf Standard zurücksetzen</button>
    </section>`;

  if (tab === "json") return `
    <section class="card">
      <h2>Alles als JSON bearbeiten</h2>
      <p class="small">Für Fortgeschrittene. Mit «Übernehmen» wird der Text geprüft.</p>
      <textarea id="json" rows="24" spellcheck="false">${esc(JSON.stringify(d, null, 2))}</textarea>
      <button class="btn primary" data-e="json">Übernehmen</button>
    </section>`;
  return "";
}

function driftInputs(key) {
  return `<div class="effects">${draft.values.filter(v => !v.money).map(v =>
    num(`drift.${key}.${v.id}`, draft.drift?.[key]?.[v.id] ?? 0, `${esc(v.icon)} ${esc(v.name)}`)).join("")}</div>`;
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (o[k] == null || typeof o[k] !== "object") o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  }
  const last = keys.at(-1);
  if (value === undefined || value === "" || value === 0 && /effects|savings|duration/.test(path)) delete o[last];
  else o[last] = value;
}

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

function msg(text, bad = false) {
  const m = root.querySelector("#ed-msg");
  if (!m) return;
  m.textContent = text;
  m.className = "msg " + (bad ? "bad" : "good");
}

function markDirty() {
  dirty = true;
  const b = root.querySelector('[data-e="save"]');
  if (b) b.textContent = "Speichern ●";
}

function cleanup(cfg) {
  // leere Hilfsobjekte entfernen
  for (const a of cfg.activities) {
    if (a.grants && !a.grants.flag) delete a.grants;
    if (!a.requires) delete a.requires;
    a.money = Number(a.money) || 0;
    a.effects = a.effects || {};
  }
  for (const e of cfg.events) if (e.condition && !e.condition.flag) delete e.condition;
  cfg.questions = (cfg.questions || []).filter(q => q != null);
  return cfg;
}

function uniqueId(base, list) {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "x";
  let id = slug, n = 2;
  while (list.some(x => x.id === id)) id = slug + n++;
  return id;
}

function onInput(ev) {
  const el = ev.target;
  const p = el.dataset.p;
  if (!p) return;
  const t = el.dataset.t;
  if (t === "when") {
    const arr = getPath(draft, p) || [];
    const k = el.dataset.k;
    setPath(draft, p, el.checked ? [...new Set([...arr, k])] : arr.filter(x => x !== k));
  } else if (t === "bool") setPath(draft, p, el.checked || undefined);
  else if (t === "num") setPath(draft, p, el.value === "" ? 0 : Number(el.value));
  else setPath(draft, p, el.value);
  markDirty();
}

function structural(fn) {
  fn();
  markDirty();
  render();
}

async function onClick(ev) {
  const sum = ev.target.closest("summary");
  if (sum) { const det = sum.parentElement; openItem = det.open ? null : det.dataset.open; }
  const el = ev.target.closest("[data-e]");
  if (!el) return;
  const i = Number(el.dataset.i), j = Number(el.dataset.j);
  switch (el.dataset.e) {
    case "tab": tab = el.dataset.tab; openItem = null; render(); break;
    case "leave":
      if (dirty && !confirm("Ungespeicherte Änderungen verwerfen?")) return;
      location.hash = "";
      break;
    case "save": {
      const errors = S.validateConfig(cleanup(draft));
      if (errors.length) return msg(errors.join(" "), true);
      onSaveCb(structuredClone(draft));
      dirty = false;
      render();
      msg("Gespeichert. Für die Klasse unter «Teilen» einen neuen Link erzeugen.");
      break;
    }
    case "pin": {
      const p = root.querySelector("#newpin").value.trim();
      if (p.length < 4) return msg("Die PIN braucht mindestens 4 Zeichen.", true);
      draft.pinHash = S.pinHash(p);
      markDirty();
      msg("PIN gesetzt. Jetzt speichern.");
      break;
    }
    case "add-value": structural(() => {
      const id = uniqueId("wert" + draft.values.length, draft.values);
      draft.values.push({ id, name: "Neuer Wert", icon: "⭐", color: "#7a6cf0", start: 50 });
    }); break;
    case "del-value": {
      const v = draft.values[i];
      if (!confirm(`Wert «${v.name}» entfernen? Alle Effekte darauf werden gelöscht.`)) return;
      structural(() => {
        draft.values.splice(i, 1);
        for (const a of draft.activities) delete a.effects?.[v.id];
        for (const e of draft.events) for (const o of e.options) delete o.effects?.[v.id];
        for (const k of Object.keys(draft.drift || {})) delete draft.drift[k][v.id];
      });
      break;
    }
    case "add-act": structural(() => {
      draft.activities.push({ id: uniqueId("aktivitaet", draft.activities), name: "Neue Aktivität", icon: "✨", when: ["werktag-nachmittag"], money: 0, effects: {} });
      openItem = "a" + (draft.activities.length - 1);
    }); break;
    case "del-act": if (confirm("Aktivität löschen?")) structural(() => draft.activities.splice(i, 1)); break;
    case "add-ev": structural(() => {
      draft.events.push({ id: uniqueId("ereignis", draft.events), icon: "❗", text: "Neues Ereignis", options: [{ label: "Wahl 1", effects: {} }, { label: "Wahl 2", effects: {} }] });
      openItem = "e" + (draft.events.length - 1);
    }); break;
    case "del-ev": if (confirm("Ereignis löschen?")) structural(() => draft.events.splice(i, 1)); break;
    case "add-opt": structural(() => draft.events[i].options.push({ label: "Neue Wahl", effects: {} })); break;
    case "del-opt": structural(() => draft.events[i].options.splice(j, 1)); break;
    case "add-cost": structural(() => draft.costs.push({ name: "Neue Kosten", amount: 5, interval: "woche" })); break;
    case "del-cost": structural(() => draft.costs.splice(i, 1)); break;
    case "link": {
      if (dirty) return msg("Bitte zuerst speichern.", true);
      const code = await S.encodeConfig(draft);
      root.querySelector("#share").value = location.origin + location.pathname + "#v=" + code;
      msg("Link erzeugt.");
      break;
    }
    case "copy": {
      const ta = root.querySelector("#share");
      if (!ta.value) return msg("Zuerst einen Link erzeugen.", true);
      try { await navigator.clipboard.writeText(ta.value); msg("Link kopiert."); }
      catch { ta.select(); msg("Bitte den markierten Link kopieren."); }
      break;
    }
    case "download": {
      const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `finanzgame-${(draft.name || "variante").replace(/[^\w-]+/g, "_")}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      break;
    }
    case "reset":
      if (!confirm("Alle Anpassungen verwerfen und die Standard-Variante laden? PIN und Bestenlisten-URL bleiben erhalten.")) return;
      structural(() => { draft = { ...structuredClone(DEFAULT_CONFIG), pinHash: draft.pinHash, scriptUrl: draft.scriptUrl }; });
      msg("Standard geladen. Jetzt speichern.");
      break;
    case "json": {
      try {
        const parsed = JSON.parse(root.querySelector("#json").value);
        const errors = S.validateConfig(parsed);
        if (errors.length) return msg(errors.join(" "), true);
        structural(() => { draft = parsed; });
        msg("Übernommen. Jetzt speichern.");
      } catch (e) { msg("JSON-Fehler: " + e.message, true); }
      break;
    }
  }
}

async function onChange(ev) {
  const el = ev.target;
  if (el.dataset.eFile === "upload" && el.files[0]) {
    try {
      const parsed = JSON.parse(await el.files[0].text());
      const errors = S.validateConfig(parsed);
      if (errors.length) return msg(errors.join(" "), true);
      structural(() => { draft = parsed; });
      msg("Datei geladen. Jetzt speichern.");
    } catch (e) { msg("Datei konnte nicht gelesen werden: " + e.message, true); }
    return;
  }
  onInput(ev);
}

// Ereignisse einmalig am Dokument anmelden; sie wirken nur im Editor
document.addEventListener("input", ev => { if (root?.querySelector(".editor") && ev.target.dataset.p && ev.target.type !== "checkbox" && ev.target.tagName !== "SELECT") onInput(ev); });
document.addEventListener("change", ev => { if (root?.querySelector(".editor") && (ev.target.type === "checkbox" || ev.target.tagName === "SELECT" || ev.target.type === "file")) onChange(ev); });
document.addEventListener("click", ev => { if (root?.querySelector(".editor")) onClick(ev); });
