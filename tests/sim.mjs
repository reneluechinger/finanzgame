// Spielt vier Strategien je 30-mal durch, um die Zahlen abzustimmen: node tests/sim.mjs
import { DEFAULT_CONFIG as cfg } from "../js/config.js";
import * as E from "../js/engine.js";

const seeded = s => () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const gain = (a, id) => (id === "geld" ? (a.money || 0) / 3 : a.effects?.[id] || 0);
const best = (list, f) => list.reduce((x, y) => (f(y) > f(x) ? y : x), list[0]);

const strategies = {
  nurArbeit: (st, ok) => best(ok, a => a.money || 0),
  nurSpass: (st, ok) => best(ok, a => a.effects?.zufriedenheit || 0),
  ausgewogen: (st, ok) => {
    const v = E.allValues(cfg, st);
    const low = Object.entries(v).sort((a, b) => a[1] - b[1])[0][0];
    return best(ok, a => gain(a, low) * 2 + Object.keys(v).reduce((s, id) => s + gain(a, id), 0) * 0.3);
  },
  zufall: (st, ok, rng) => ok[Math.floor(rng() * ok.length)]
};

for (const [name, strat] of Object.entries(strategies)) {
  const scores = [];
  for (let seed = 1; seed <= 30; seed++) {
    const rng = seeded(seed), st = E.newGame(cfg, "t", "x");
    st.started = "sim" + seed;
    while (st.status !== "done") {
      if (st.status === "review") { E.continueAfterReview(cfg, st, rng); continue; }
      if (st.event) {
        const ev = cfg.events.find(e => e.id === st.event);
        const ok = E.eventOptionsAffordable(st, ev).map((x, i) => (x ? i : -1)).filter(i => i >= 0);
        E.chooseEventOption(cfg, st, ok[Math.floor(rng() * ok.length)]);
      }
      for (const slot of E.slotsFor(st.day)) {
        const ok = E.offeredActivities(cfg, st, slot).filter(a => E.activityStatus(cfg, st, a, slot).ok);
        st.plan[slot] = (strat(st, ok, rng) || ok[0]).id;
      }
      E.endDay(cfg, st, rng);
    }
    scores.push(st.history.at(-1).score);
  }
  const avg = scores.reduce((a, b) => a + b) / scores.length;
  console.log(name.padEnd(11), "Ø", avg.toFixed(1), "min", Math.min(...scores), "max", Math.max(...scores));
}
