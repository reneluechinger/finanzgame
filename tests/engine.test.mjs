// Ausführen mit: node --test tests/engine.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG as cfg } from "../js/config.js";
import * as E from "../js/engine.js";

const seeded = s => () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);

function playMonth(seed) {
  const rng = seeded(seed), st = E.newGame(cfg, "t", "x");
  while (st.status !== "done") {
    if (st.status === "review") { E.continueAfterReview(cfg, st, rng); continue; }
    if (st.event) E.chooseEventOption(cfg, st, 0);
    for (const slot of E.slotsFor(st.day)) {
      const ok = cfg.activities.filter(a => E.activityStatus(cfg, st, a, slot).ok);
      st.plan[slot] = ok[Math.floor(rng() * ok.length)].id;
    }
    E.endDay(cfg, st, rng);
  }
  return st;
}

test("Punkteformel: Durchschnitt minus halber Abstand", () => {
  assert.equal(E.scoreOf({ a: 50, b: 50 }).score, 50);
  assert.equal(E.scoreOf({ a: 80, b: 40 }).score, 40); // 60 - 20
  assert.equal(E.scoreOf({ a: 100, b: 0 }).score, 0); // 50 - 50 - 5, nicht negativ
});

test("Ein Monat hat 28 Tage", () => {
  const st = playMonth(1);
  assert.equal(st.history.length, 28);
  assert.equal(st.status, "done");
});

test("Ereignisse derselben Gruppe kommen nie beide vor", () => {
  for (let s = 1; s <= 200; s++) {
    const seen = playMonth(s).seenEvents;
    assert.ok(!(seen.includes("pruefung") && seen.includes("pruefung_ok")), "Seed " + s);
  }
});

test("Babysitten erst nach dem Kurs und erst ab der nächsten Woche", () => {
  const st = E.newGame(cfg, "t", "x");
  const baby = cfg.activities.find(a => a.id === "babysitten");
  assert.equal(E.activityStatus(cfg, st, baby, "abend").ok, false);
  st.day = 6; st.plan = { morgen: "babysitterkurs" };
  E.endDay(cfg, st, () => 0.9);
  assert.equal(E.flagActive(st, "babysitter"), false); // Sonntag, gleiche Woche
  st.day = 8;
  assert.equal(E.flagActive(st, "babysitter"), true);
});

test("Taschengeld und Kosten am Montag", () => {
  const st = E.newGame(cfg, "t", "x");
  assert.equal(st.konto, cfg.startMoney + cfg.pocketMoney - 10 - 8);
});

test("Ereignis-Wahl ohne Deckung ist gesperrt", () => {
  const st = E.newGame(cfg, "t", "x");
  st.konto = 30; st.spar = 0;
  const ev = cfg.events.find(e => e.id === "sneaker");
  assert.deepEqual(E.eventOptionsAffordable(st, ev), [false, true]);
  st.event = "sneaker";
  E.chooseEventOption(cfg, st, 0);
  assert.equal(st.konto, 30); // nichts gekauft
});

test("Pro Zeitfenster 8 Aktivitäten, gleich beim Neuladen, Ausruhen immer dabei", () => {
  const st = E.newGame(cfg, "t", "x");
  for (let day = 1; day <= 28; day++) {
    st.day = day;
    for (const slot of E.slotsFor(day)) {
      const a = E.offeredActivities(cfg, st, slot);
      assert.ok(a.length >= 8 && a.length <= 9, `Tag ${day} ${slot}: ${a.length}`);
      assert.deepEqual(a.map(x => x.id), E.offeredActivities(cfg, st, slot).map(x => x.id));
      assert.ok(a.some(x => x.id === "ausruhen"));
    }
  }
});

test("Alle 200 Aktivitäten und 200 Ereignisse sind gültig", () => {
  assert.equal(cfg.activities.length, 200);
  assert.equal(cfg.events.length, 200);
  assert.equal(new Set(cfg.activities.map(a => a.id)).size, 200);
  assert.equal(new Set(cfg.events.map(e => e.id)).size, 200);
  const flags = new Set(cfg.activities.filter(a => a.grants).map(a => a.grants.flag));
  for (const a of cfg.activities) if (a.requires) assert.ok(flags.has(a.requires), a.id);
});

test("Die Auswahl bleibt gleich, wenn man etwas wählt", () => {
  const st = E.newGame(cfg, "t", "x");
  for (let day = 1; day <= 28; day++) {
    st.day = day; st.plan = {};
    for (const slot of E.slotsFor(day)) {
      const before = E.offeredActivities(cfg, st, slot).map(a => a.id);
      st.plan[slot] = before.at(-1);
      assert.deepEqual(E.offeredActivities(cfg, st, slot).map(a => a.id), before);
    }
  }
});
