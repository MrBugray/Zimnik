// ===== economy: cargo, who makes and needs what, job boards =====
// Every yard makes some goods and needs others. How badly a place needs something (demand, 0..1) sets the pay;
// deliveries satisfy it and it builds up again over the next drives. The sawmill only has lumber to ship when
// someone has brought it logs, and the pulp mill only makes paper from pulpwood that was delivered.
const CARGO = {
  pulp: { name: 'Pulpwood', units: 'bundles', unit: 'bundle', rate: 460, desc: 'Chained bundles of short pulpwood.' },
  logs: { name: 'Logs', units: 'bundles', unit: 'bundle', rate: 430, desc: 'Long logs, chained in bundles.' },
  drums: { name: 'Fuel drums', units: 'drums', unit: 'drum', rate: 680, fragile: true, desc: 'Strapped drums of diesel. They tip easily.' },
  crates: { name: 'Supplies', units: 'crates', unit: 'crate', rate: 760, fragile: true, desc: 'Crates of food, tools and spare parts.' },
  planks: { name: 'Lumber', units: 'packs', unit: 'pack', rate: 540, desc: 'Strapped packs of sawn timber.' },
  fuel: { name: 'Bulk diesel', units: 't', unit: 't', rate: 520, bulk: true, desc: 'A tanker load of diesel.' },
  coal: { name: 'Coal', units: 't', unit: 't', rate: 340, bulk: true, desc: 'A tipper load of coal.' },
  gravel: { name: 'Gravel', units: 't', unit: 't', rate: 310, bulk: true, desc: 'A tipper load of road gravel.' },
};
// unit masses (kg) where the truck does not say otherwise
const UNIT_KG = { pulp: 1800, logs: 1150, drums: 210, crates: 265, planks: 1600, fuel: 1000, coal: 1000, gravel: 1000 };
const ECON = {
  camp: { makes: ['logs', 'pulp'], needs: { drums: 1, crates: 1, gravel: 0.5 } },
  cut12: { makes: ['logs', 'pulp'], needs: { drums: 1, crates: 0.8, fuel: 0.5 } },
  mill: { makes: ['planks'], needs: { logs: 1.4, pulp: 0.7, drums: 0.8, fuel: 0.6, coal: 0.4 }, process: { logs: ['planks', 0.55] } },
  depot: { makes: ['drums', 'fuel'], needs: { crates: 0.3 } },
  port: { makes: ['crates', 'drums'], needs: { planks: 1, pulp: 0.5, coal: 0.5 } },
  mine: { makes: ['coal'], needs: { logs: 1.1, drums: 1, crates: 0.8, fuel: 0.7 } },
  lesnoy: { makes: [], needs: { crates: 1, drums: 0.8, coal: 0.9, planks: 0.6 } },
  sosn: { makes: [], needs: { crates: 1, drums: 0.8, coal: 1, planks: 0.6, gravel: 0.5 } },
  rail: { makes: ['crates', 'drums', 'fuel'], needs: { planks: 1.3, coal: 1, pulp: 0.6 } },
  pit: { makes: ['gravel'], needs: { drums: 0.8, fuel: 0.5, crates: 0.3 } },
  pulp: { makes: ['crates'], needs: { pulp: 1.6, logs: 0.5, fuel: 0.8, coal: 0.8 }, process: { pulp: ['crates', 0.6] } },
  zar: { makes: ['pulp'], needs: { crates: 1, drums: 0.8, coal: 1, planks: 0.8, gravel: 0.6 } },
};
const WEATHER_PAY = { clear: 1, overcast: 1.05, snow: 1.2, blizzard: 1.6, fog: 1.25, thaw: 1.3 };
const TIME_PAY = { morning: 1, noon: 1, dusk: 1.1, night: 1.2 };
const RESCUE_BASE = 2600, TOW_BASE = 1400;
// The district savings desk: borrow against future hauls. The debt grows by LOAN_GROWTH every drive you finish
// (the same beat the economy's day counter ticks on), up to LOAN_MAX outstanding at any time.
const LOAN_STEP = 5000, LOAN_MAX = 10000, LOAN_GROWTH = 1.04;
// Fuel: what a litre costs at each pump, petrol ('gas') and diesel. The depot and the railhead are cheapest, villages
// sell from jerrycans at a premium, the mine, pulp mill and cutting keep only diesel for their machines, and the
// gravel pit has none. Where fuel is trucked in (the places that take fuel or drums), the price rises as their stock
// runs down and falls when you deliver. With no pump, or not your fuel, a fuel truck comes out from the depot.
const FUEL_BASE = { gas: 17, diesel: 14 }, FUEL_KG = { gas: 0.74, diesel: 0.84 }, FUEL_NAME = { gas: 'Petrol', diesel: 'Diesel' };
const PUMPS = {
  depot: { gas: 0.85, diesel: 0.85 }, rail: { gas: 1.0, diesel: 0.92 }, camp: { gas: 1.0, diesel: 1.0 }, mill: { gas: 1.05, diesel: 1.0 },
  port: { gas: 1.1, diesel: 1.05 }, pulp: { diesel: 1.08 }, mine: { diesel: 1.12 }, cut12: { diesel: 1.2 },
  lesnoy: { gas: 1.3, diesel: 1.3 }, sosn: { gas: 1.35, diesel: 1.35 }, zar: { gas: 1.4, diesel: 1.4 },
};
const FUEL_TRUCK = { callout: 400, k: 1.6, max: 100 };
const FUEL_RESERVE = 25;   // a nearly empty tank can always be filled this far, on credit if need be

class Economy {
  constructor(W) {
    // W is the saved world state: demand per place and cargo, stock of processed goods, boards, day counter
    this.W = W; W.day = W.day || 0; W.dem = W.dem || {}; W.stock = W.stock || {}; W.boards = W.boards || {};
    for (const id in ECON) {
      const d = W.dem[id] = W.dem[id] || {};
      for (const c in ECON[id].needs) if (d[c] === undefined) d[c] = clamp(0.45 + 0.4 * hashf(hashStr(id + c), 3), 0, 1);
      const s = W.stock[id] = W.stock[id] || {};
      for (const k in ECON[id].process || {}) { const out = ECON[id].process[k][0]; if (s[out] === undefined) s[out] = 8; }
    }
  }
  needs(loc, c) { return (ECON[loc] && ECON[loc].needs[c]) || 0; }
  demand(loc, c) { const d = this.W.dem[loc]; return d && d[c] !== undefined ? d[c] : 0; }
  stock(loc, c) { const p = ECON[loc] && ECON[loc].process; if (!p) return Infinity; for (const k in p) if (p[k][0] === c) return this.W.stock[loc][c] || 0; return Infinity; }
  demandWord(v) { return v > 0.75 ? 'urgent' : v > 0.5 ? 'high demand' : v > 0.25 ? 'steady demand' : 'low demand'; }
  // how short of fuel a place is (null: it does not depend on deliveries)
  fuelShort(loc) { const n = (ECON[loc] || {}).needs || {}, ks = ['fuel', 'drums'].filter(k => n[k]); return ks.length ? ks.reduce((s, k) => s + this.demand(loc, k), 0) / ks.length : null; }
  fuelWord(loc) { const s = this.fuelShort(loc); return s === null ? 'steady supply' : s > 0.7 ? 'running low' : s > 0.4 ? 'normal supply' : 'well stocked'; }
  // a litre at the pump here (null: no pump for this fuel)
  fuelPrice(loc, type) {
    const P = PUMPS[loc]; if (!P || !P[type]) return null;
    const s = this.fuelShort(loc);
    return Math.round(FUEL_BASE[type] * P[type] * (s === null ? 1 : 0.9 + 0.3 * s) * 10) / 10;
  }
  // pay for a load: a fixed part for the trip plus the load, both scaled by distance and how badly it is wanted
  pay(cargo, tonnes, km, demand, mult) {
    const C = CARGO[cargo], f = (0.75 + 0.6 * demand) * (mult || 1), dist = 0.55 + 0.45 * km;
    return { base: 300 * f * dist, perT: C.rate * f * dist };
  }
  // the board at a place: a handful of hauls out of here, now and then a breakdown to deal with
  board(loc, G) {
    const B = this.W.boards[loc];
    if (B && B.day === this.W.day && B.jobs) return B.jobs;
    const rnd = mulberry32(hashStr(loc) + this.W.day * 7919), jobs = [], found = s => G.secret(s);
    const E = ECON[loc];
    if (E) for (const c of E.makes) {
      if (this.stock(loc, c) < 1) continue;
      for (const to in ECON) {
        const w = this.needs(to, c); if (!w || to === loc) continue;
        const r = route(loc, to, null, found); if (r.d === Infinity) continue;
        const dem = this.demand(to, c);
        jobs.push({ id: 'h' + this.W.day + loc + to + c, kind: 'haul', cargo: c, from: loc, to, dist: r.d, dem, score: w * (0.4 + dem) * (0.6 + 0.8 * rnd()) / (0.6 + r.d / 4000) });
      }
    }
    jobs.sort((a, b) => b.score - a.score);
    const pick = [], per = {};
    for (const j of jobs) { if (pick.length >= 7) break; if ((per[j.cargo] = (per[j.cargo] || 0) + 1) > 3) continue; pick.push(j); }
    // breakdowns: a stranded truck out on the roads, towed to a workshop; or one in the yard here
    if (rnd() < 0.85) { const j = this.rescueJob(loc, rnd, found); if (j) pick.push(j); }
    if (!NODES[loc].garage && rnd() < 0.55) {
      let best = null; for (const g of ['camp', 'mill']) { const r = route(loc, g, null, found); if (!best || r.d < best.d) best = { to: g, d: r.d }; }
      if (best) pick.push({ id: 't' + this.W.day + loc, kind: 'tow', cargo: 'tow', from: loc, to: best.to, dist: best.d, dem: 0.5 });
    }
    this.W.boards[loc] = { day: this.W.day, jobs: pick };
    return pick;
  }
  rescueJob(loc, rnd, found) {
    const ids = Object.keys(EDGES).filter(id => { const e = EDGES[id]; return (!e.secret || found(e.secret)) && e.kind !== 'ice'; });
    for (let tries = 0; tries < 12; tries++) {
      const id = ids[(rnd() * ids.length) | 0], P = edgePiece(id), E = EDGES[id];
      let s = null;
      for (let k = 0; k < 20; k++) {
        const u = P.len * (0.2 + 0.6 * rnd()), i = Math.round(u / DX);
        if (i < 4 || i > P.n - 5) continue;
        if (Math.abs(P.y[i + 4] - P.y[i - 4]) / 4 > 0.06 || P.under[i] || P.s[i] === S_ICE || P.s[i] === S_WOOD) continue;
        s = u; break;
      }
      if (s === null) continue;
      // tow it to whichever workshop makes the shorter job from here
      let best = null;
      for (const g of ['camp', 'mill']) for (const [p, q] of [[E.a, E.b], [E.b, E.a]]) {
        const r1 = route(loc, p, null, found), r2 = route(q, g, new Set([p]), found);
        const d = r1.d + E.len + r2.d; if (d < Infinity && (!best || d < best.d)) best = { to: g, d };
      }
      if (!best || best.d > 9000) continue;
      return { id: 'r' + this.W.day + loc, kind: 'rescue', cargo: 'tow', from: loc, to: best.to, dist: best.d, dem: 0.6, edge: id, s: Math.round(s) };
    }
    return null;
  }
  delivered(job, tonnes) {
    if (job.kind !== 'haul') return;
    const d = this.W.dem[job.to]; if (d && d[job.cargo] !== undefined) d[job.cargo] = clamp(d[job.cargo] - 0.05 * tonnes, 0, 1);
    const pr = ECON[job.to] && ECON[job.to].process && ECON[job.to].process[job.cargo];
    if (pr) this.W.stock[job.to][pr[0]] = Math.min(60, (this.W.stock[job.to][pr[0]] || 0) + tonnes * pr[1]);
    const from = ECON[job.from] && ECON[job.from].process; if (from) for (const k in from) if (from[k][0] === job.cargo) this.W.stock[job.from][job.cargo] = Math.max(0, (this.W.stock[job.from][job.cargo] || 0) - tonnes);
  }
  // a drive finished somewhere: time passes, everybody's needs build up a little, all boards get new work
  nextDay() {
    this.W.day++;
    for (const id in this.W.dem) for (const c in this.W.dem[id]) this.W.dem[id][c] = clamp(this.W.dem[id][c] + 0.035 + 0.02 * hashf(this.W.day + hashStr(id + c), 5), 0, 1);
  }
}
