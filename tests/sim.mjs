import { DEFAULT_CONFIG as cfg } from "../js/config.js";
import * as E from "../js/engine.js";
function seeded(s){return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296}}
const strategies = {
  nurArbeit: (st, slot, ok) => pick(ok, ["babysitten","nachhilfe","zeitungen","garten","kuchen","babysitterkurs"]),
  nurSpass: (st, slot, ok) => pick(ok, ["gamen","shoppen","kino","freunde","ausruhen"]),
  ausgewogen: (st, slot, ok) => {
    const v = E.allValues(cfg, st); const low = Object.entries(v).sort((a,b)=>a[1]-b[1])[0][0];
    const best = {geld:["babysitten","nachhilfe","kuchen","garten","zeitungen"],zufriedenheit:["freunde","sport","kino"],wertstiftung:["tierheim","nachhilfe","familie"],energie:["ausruhen","sport"],beziehungen:["familie","freunde","sport"]}[low];
    if (st.day<=6 && E.isWeekend(st.day)) { const k = pick(ok,["babysitterkurs"]); if(k) return k; }
    return pick(ok, best) || pick(ok, ["sport","familie","ausruhen"]);
  },
  zufall: (st, slot, ok, rng) => ok[Math.floor(rng()*ok.length)]
};
function pick(ok, prefs){ for(const p of prefs) if(ok.includes(p)) return p; return null; }
for (const [name, strat] of Object.entries(strategies)) {
  const scores=[]; let last;
  for (let seed=1; seed<=30; seed++) {
    const rng=seeded(seed); const st=E.newGame(cfg,"t","x");
    while (st.status!=="done") {
      if (st.status==="review") { E.continueAfterReview(cfg,st,rng); continue; }
      if (st.event) E.chooseEventOption(cfg, st, Math.floor(rng()*cfg.events.find(e=>e.id===st.event).options.length));
      for (const slot of E.slotsFor(st.day)) {
        const ok = cfg.activities.filter(a=>E.activityStatus(cfg,st,a,slot).ok).map(a=>a.id);
        const c = strat(st, slot, ok, rng) || ok[0]; if (c) st.plan[slot]=c;
      }
      E.endDay(cfg, st, rng);
    }
    scores.push(st.history.at(-1).score); last=st;
  }
  const avg = scores.reduce((a,b)=>a+b)/scores.length;
  console.log(name.padEnd(11), "Ø", avg.toFixed(1), "min", Math.min(...scores), "max", Math.max(...scores), "| Beispiel-Endwerte", JSON.stringify(last.history.at(-1).values), "Konto", last.konto, "Spar", last.spar);
}
