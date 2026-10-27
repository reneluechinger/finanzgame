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
