// ===== out on the road: the district clock, deadlines, trucks left on the roads, tows, the changing weather =====
// The clock (seconds, in the save) runs whenever one of your trucks is driving, and services add their time: the
// tow truck coming out, a fuel truck. Urgent and priority hauls are due on it; late deliveries pay less.
const JOB_TIERS = {
  urgent: { name: 'Urgent', k: 1.3, bonus: 0.25 },
  priority: { name: 'Priority', k: 1.8, bonus: 0.10 },
  standard: { name: 'Standard', k: 0, bonus: 0 },
};
const ROAD_PACE = { main: 9, river: 7.5, track: 6, zimnik: 6.5, pass: 5, ice: 8 };   // m/s a careful driver keeps up
const WX_PACE = { clear: 1, overcast: 1.05, snow: 1.15, blizzard: 1.4, fog: 1.2, thaw: 1.2 };
const TOW_SERVICE = { base: 900, perKm: 700, semi: 1.8, time: 360, timePerKm: 120 };   // the district tow truck: ₽, seconds
const FUEL_CALL = { litres: 40, time: 240 };
const ABANDON_FEE = 0.10;
const tierOf = dem => dem > 0.75 ? 'urgent' : dem > 0.5 ? 'priority' : 'standard';
// share of the pay a delivery late by `late` seconds still earns: a fifth off at once, then a tenth a minute, down to 30%
const latePay = late => late <= 0 ? 1 : Math.max(0.3, 0.8 - 0.1 * late / 60);
// the weather on its own: how long a spell lasts (seconds on the clock) and what tends to follow it
const WX_SPELL = { clear: [360, 720], overcast: [300, 600], snow: [240, 480], blizzard: [120, 240], fog: [180, 360], thaw: [240, 480] };
const WX_NEXT = {
  clear: { overcast: 0.5, fog: 0.2, snow: 0.2, thaw: 0.1 },
  overcast: { clear: 0.3, snow: 0.35, fog: 0.15, thaw: 0.1, blizzard: 0.1 },
  snow: { overcast: 0.35, blizzard: 0.25, clear: 0.25, fog: 0.15 },
  blizzard: { snow: 0.6, overcast: 0.4 },
  fog: { clear: 0.4, overcast: 0.4, snow: 0.2 },
  thaw: { overcast: 0.5, clear: 0.3, fog: 0.2 },
};
const WX_BLEND = 90;   // seconds a change of weather takes
function blendWeather(a, b, f) {
  if (f <= 0) return a; if (f >= 1) return b;
  const o = Object.assign({}, f < 0.5 ? a : b);
  for (const k of ['fog', 'desat', 'dim', 'grey', 'part', 'wind', 'temp', 'fresh', 'clouds']) o[k] = lerp(a[k] || 0, b[k] || 0, f);
  o.accum = lerp(a.accum || 0, b.accum || 0, f);
  o.vis = Math.exp(lerp(Math.log(a.vis), Math.log(b.vis), f));
  o.sleet = (f < 0.5 ? a : b).sleet;
  return o;
}

Object.defineProperty(Game.prototype, 'clock', { get() { return this.data.clock || 0; }, set(v) { this.data.clock = v; } });
Object.assign(Game.prototype, {
  addTime(s) { this.clock += s; if (this.state === 'drive' || this.state === 'pause') this.runT += s; this.wxStep(0); },
  // ---------- deadlines ----------
  // seconds the drive should take a careful driver: road by road, plus the yards and pads between, in this weather
  usualTime(from, to, id) {
    const r = route(from, to, null, s => this.secret(s)); if (!(r.d < Infinity)) return Infinity;
    let t = 45;
    for (const e of r.edges) t += EDGES[e].len / (ROAD_PACE[EDGES[e].kind] || 7);
    for (let i = 1; i < r.path.length - 1; i++) t += nodeLen(r.path[i]) / 6;
    return t * (WX_PACE[this.weather] || 1) * ((id || this.gid) === 'skt' ? 1.15 : 1);
  },
  jobTerms(j, id) {
    const tier = j.kind === 'haul' ? tierOf(j.dem) : 'standard', T = JOB_TIERS[tier];
    return { tier, bonus: T.bonus, allow: T.k ? Math.round(T.k * this.usualTime(j.from, j.to, id) / 15) * 15 : null };
  },
  dueLeft(J) { return J && J.due ? J.due - this.clock : null; },
  // ---------- where your trucks are ----------
  roadOf(id) { const c = this.data.trucks[id || this.gid]; return c && c.road ? c.road : null; },
  spotText(sp) {
    if (sp.node) return 'at ' + NODES[sp.node].name;
    const E = EDGES[sp.edge], nearA = sp.s < E.len / 2;
    return 'on the ' + E.name + ', ' + km(nearA ? sp.s : E.len - sp.s) + ' km from ' + NODES[nearA ? E.a : E.b].name;
  },
  whereText(id) { const c = this.data.trucks[id || this.gid]; return this.spotText(c.road || { node: c.loc }); },
  // the spot on the road under the truck right now (edge and metres from its a end), or the yard it stands in;
  // x: somewhere else on this drive (the truck on the bar behind you)
  spotHere(x) {
    const T = this.trip, c = this.course; if (x === undefined) x = this.truck.x;
    let leg = null; for (const l of c.legs) if (x >= l.x0 && x < l.x1) leg = l;
    if (leg && leg.kind === 'yard') return { node: leg.node };
    let z = null; for (const q of c.zones) if (x > q.x0 && x < q.x1) z = q;
    if (z) return { node: z.node };
    // on a junction pad or the stub after it: the nearest road of this drive
    if (!leg || leg.kind !== 'edge') {
      let best = null, bd = 1e9; for (const l of c.legs) if (l.kind === 'edge') { const d = x < l.x0 ? l.x0 - x : x > l.x1 ? x - l.x1 : 0; if (d < bd) { bd = d; best = l; } }
      if (!best) return { node: T.start };
      leg = best;
    }
    const E = EDGES[leg.edge], u = clamp(x - leg.x0, 10, leg.L - 10), s = leg.rev ? leg.L - u : u;
    return { edge: leg.edge, s: clamp(s, 10, E.len - 10), dir: leg.rev ? -1 : 1, from: leg.from, to: leg.to };
  },
  // metres by road from a spot (a yard, or a place on a road) to a place, either way along the road it is on
  spotDist(sp, node) {
    const found = k => this.secret(k);
    if (sp.node) return sp.node === node ? 0 : route(sp.node, node, null, found).d;
    const E = EDGES[sp.edge], via = (end, d0) => end === node ? d0 : d0 + route(end, node, null, found).d;
    return Math.min(via(E.a, sp.s), via(E.b, E.len - sp.s));
  },
  // from where a truck stands now (its yard, or the spot on the road it was left at)
  distFrom(node, id) { const c = this.data.trucks[id || this.gid]; return this.spotDist(c.road || { node: c.loc }, node); },
  // which way to head from a spot on a road toward a place: the truck turns round when the other way is shorter
  roadDir(R, to) { const E = EDGES[R.edge], f = k => this.secret(k), a = (E.a === to ? 0 : route(E.a, to, null, f).d) + R.s, b = (E.b === to ? 0 : route(E.b, to, null, f).d) + E.len - R.s; return a < b ? -1 : 1; },
  // what the district tow truck asks to take a truck d metres, and how long it takes (call-out, the drive, hooking up)
  towQuote(d, semi) {
    const kmv = d / 1000;
    return { cost: Math.round((TOW_SERVICE.base + TOW_SERVICE.perKm * kmv) * (semi ? TOW_SERVICE.semi : 1) / 50) * 50, time: Math.round((TOW_SERVICE.time + TOW_SERVICE.timePerKm * kmv) / 15) * 15 };
  },
  // the nearest yard by road from a spot, and the tow there
  closestFrom(sp, semi) {
    let best = null;
    for (const id in NODES) if (NODES[id].kind === 'yard') { const d = this.spotDist(sp, id); if (d < Infinity && (!best || d < best.d)) best = { node: id, d }; }
    if (!best) best = { node: 'camp', d: 2000 };
    return Object.assign(best, this.towQuote(best.d, semi), { spot: sp });
  },
  closestPlace() { return this.closestFrom(this.spotHere(), !!this.truck.semi); },
  // ---------- from the pause menu ----------
  // leave the truck where it stands, load and all; its job keeps running against the deadline
  leaveHere() {
    if (this.state !== 'drive' && this.state !== 'pause') return;
    const sp = this.spotHere();
    this.state = 'drive';
    if (sp.node) { this.finish(true, 'Parked at ' + NODES[sp.node].name + '.', sp.node, 'left'); return; }
    this.leftAt = { edge: sp.edge, s: Math.round(sp.s), dir: sp.dir, at: Math.round(this.clock) };
    if (this.truck.crashed) this.leftAt.crashed = true;   // on its side it needs a tow before it drives again
    this.finish(true, 'Left on the ' + EDGES[sp.edge].name + '. It waits there with whatever it carries.', null, 'left');
  },
  // the tow truck takes it to the closest yard. If that is where the job is going, it drops you at the gate and you
  // drive in and unload yourself; anywhere else the drive ends there and the job carries on from that yard later.
  towToClosest() {
    if (this.state !== 'drive' && this.state !== 'pause') return;
    const c = this.closestPlace(), J = this.job;
    this.cash -= c.cost; this.towCost += c.cost; this.tows++;
    this.addTime(c.time);
    this.state = 'drive'; this.hud.show('drive');
    if (J.to && c.node === J.to && J.kind !== 'free') {
      const T = this.trip;
      for (let i = 0; i < 12 && !T.done && T.pending; i++) T.choose(T.pending.opts[0].edge);
      const z = this.course.zones.find(q => q.node === J.to && q.role === 'end');
      if (z) {
        this.R.bg.setZones(this.course); this.hud.hideFork();
        const x = Math.max(z.x0 - 22, this.trip.spawnX);
        const nt = this.sim.respawn(this.truck, x); nt.engineOn = true; nt.autoHold = this.settings.autoHold;
        if (this.stranded && this.sim.tow) { this.stranded.truck = this.sim.tow.b; this.stranded.semi = this.sim.tow.b.semi; }
        this.iceCrack = 0; this.cam.x = x + 2; this.cam.y = this.course.hAt(x) + 1;
        this.hud.toast('The tow truck dropped you at the gate of ' + NODES[J.to].name + ' · −' + money(c.cost) + ' · +' + fmtTime(c.time) + '. Drive in and unload', 'warn', 4.5);
        return;
      }
    }
    this.finish(true, 'The tow truck took it to ' + NODES[c.node].name + ' (−' + money(c.cost) + ', ' + fmtTime(c.time) + ' on the clock).' + (J.kind === 'haul' ? ' The job carries on from there.' : ''), c.node, 'towed');
  },
  // a dry tank: a fuel truck brings 40 L out at fuel-truck prices
  fuelQuote() { const tr = this.truck, add = Math.max(0, Math.round(Math.min(FUEL_CALL.litres, tr.tank - tr.fuel))); return { add, cost: Math.round(add * FUEL_BASE[tr.eng.fuel] * FUEL_TRUCK.k + FUEL_TRUCK.callout) }; },
  fuelHelp() {
    const tr = this.truck; if (!tr) return;
    const { add, cost: fc } = this.fuelQuote(); if (add <= 0) return;
    tr.fuel += add; if (!tr.engineOn && !tr.crashed) tr.engineOn = true;
    this.cash -= fc; this.fuelCost += fc; this.addTime(FUEL_CALL.time);
    this.state = 'drive'; this.hud.show('drive');
    this.hud.toast('A fuel truck brought ' + add + ' L · −' + money(fc) + ' · +' + fmtTime(FUEL_CALL.time), 'warn', 3.4);
  },
  jobValue(J) { if (!J || J.kind !== 'haul' || !J.pay) return 0; return J.pay.base + J.pay.perT * (J.units * J.kg / 1000); },
  // give the job up: a fee, the load goes back to the sender, the truck stays where it is and drives on without a job
  abandonJob() {
    const J = this.job; if (!J || J.kind === 'free' || J.kind === 'travel') return;
    const fee = J.kind === 'haul' ? Math.round(this.jobValue(J) * ABANDON_FEE / 10) * 10 : 0;
    this.cash -= fee; this.feeCost = (this.feeCost || 0) + fee;
    // a truck on the bar is unhooked and stays where it is (yours: right here, at the roadside)
    const st = this.stranded;
    if (st) {
      if (J.kind === 'recover' && !st.ditch) this.settleTowed(st, null);
      if (st.semi) this.sim.removeTruck(st.semi, false);
      this.sim.removeTruck(st.truck, false);
      this.stranded = null; this.strandAt = null;
    }
    if (J.kind === 'haul') {
      const tr = this.truck, s = tr.snapshot(), x = tr.x; s.cargoLeft = 0;
      if (tr.semi) this.sim.removeTruck(tr.semi, false);
      this.sim.removeTruck(tr, false);
      const nt = this.sim.addTruck(TRUCKS[this.gid], this.cfg(), x, { player: true, state: s }); nt.engineOn = true; nt.gear = tr.gear < 0 ? -1 : tr.gear > 0 ? Math.min(tr.gear, nt.gb.ratios.length) : 0; nt.mode = tr.mode;
    }
    this.cfg().job = null;
    this.job = { kind: 'free', from: J.from, to: null, mult: 1 };
    // the rest of the drive is a free drive: every road is on offer at the next junction
    const T = this.trip; T.mode = 'free'; T.dest = null; T.rescue = null;
    if (T.pending) { T.refresh(); this.hud.hideFork(); }
    this.state = 'drive'; this.hud.show('drive');
    this.hud.toast('Job abandoned' + (fee ? ' · −' + money(fee) + ' fee' : '') + '. Park in any yard', 'warn', 3.4);
  },
  // ---------- trucks left on the roads ----------
  // your truck on the bar ends where the drive ends: in the yard `node`, or (null) at the roadside where it is now
  settleTowed(st, node) {
    const id = st.id, c = this.data.trucks[id], t = st.truck;
    c.fuel = clamp(t.fuel, 0, this.tankCap(id)); c.body = clamp(1 - t.damage / 100, 0, 1);
    this.applyWear(c, t);
    if (c.job && c.job.kind === 'haul') { const n = t.loadCount(); if (n > 0) c.job.left = n; else c.job = null; }
    if (!node) { const sp = this.spotHere(t.x); if (sp.node) node = sp.node; else c.road = { edge: sp.edge, s: Math.round(sp.s), dir: sp.dir, at: Math.round(this.clock) }; }
    if (node) { c.road = null; c.loc = node; }
    return id;
  },
  // from the hub: the tow truck fetches the truck off the road to the nearest yard
  towFromRoad() {
    const c = this.cfg(), R = c.road; if (!R) return;
    const q = this.closestFrom({ edge: R.edge, s: R.s, dir: R.dir }, this.gid === 'skt' && !!c.job);
    this.cash -= q.cost; this.addTime(q.time); c.road = null; c.loc = q.node;
    this.toHub();
    this.hud.toast('The tow truck brought it to ' + NODES[q.node].name + ' · −' + money(q.cost) + ' · +' + fmtTime(q.time) + ' on the clock', 'warn', 3.8);
  },
  // from the hub: give up the job the truck is carrying (on the road or parked)
  abandonParked() {
    const c = this.cfg(), J = c.job; if (!J) return;
    const fee = Math.round(this.jobValue(J) * ABANDON_FEE / 10) * 10;
    this.cash -= fee; c.job = null; this.saveNow(); this.buildHub();
    this.hud.toast('Job abandoned · −' + money(fee) + ' fee. The load goes back to ' + NODES[J.from].name, 'warn', 3.6);
    this.openJobs();
  },
  // jobs for the truck you're in: go and get one of the others, and tow it where you choose
  recoverJobs(loc) {
    const out = [], found = k => this.secret(k);
    for (const id in TRUCKS) {
      if (id === this.gid) continue;
      const R = this.roadOf(id); if (!R) continue;
      const E = EDGES[R.edge], cj = this.data.trucks[id].job, dests = [];
      if (cj && cj.kind === 'haul' && cj.to) dests.push([cj.to, 'its delivery']);
      let ws = null; for (const g of ['camp', 'mill']) { const d = Math.min(R.s + route(E.a, g, null, found).d, E.len - R.s + route(E.b, g, null, found).d); if (!ws || d < ws.d) ws = { g, d }; }
      if (ws && !dests.some(q => q[0] === ws.g)) dests.push([ws.g, 'the workshop']);
      for (const [to, why] of dests) {
        let best = Infinity;
        for (const [p, q] of [[E.a, E.b], [E.b, E.a]]) { const r1 = route(loc, p, null, found), r2 = route(q, to, new Set([p]), found); best = Math.min(best, r1.d + E.len + r2.d); }
        if (best < Infinity) out.push({ id: 'rc:' + id + ':' + to, kind: 'recover', cargo: 'tow', truck: id, edge: R.edge, s: R.s, dir: R.dir, from: loc, to, dist: best, why, dem: 0 });
      }
    }
    return out;
  },
  // ---------- the weather on its own ----------
  wxInit() {
    if (this.settings.weatherMode !== 'random') { this.W = WEATHER[this.weather]; this.wxF = 0; return; }
    const D = this.data;
    if (!D.wx || !WEATHER[D.wx.cur] || !WEATHER[D.wx.next]) D.wx = { cur: this.weather, next: this.wxPick(this.weather), at: this.clock + this.wxSpell(this.weather) };
    this.wxStep(0, true);
  },
  wxSpell(k) { const r = WX_SPELL[k] || [300, 600]; return r[0] + Math.random() * (r[1] - r[0]); },
  wxPick(k) { const T = WX_NEXT[k] || WX_NEXT.clear; let r = Math.random(), last = 'overcast'; for (const n in T) { last = n; if ((r -= T[n]) <= 0) return n; } return last; },
  wxStep(dt, quiet) {
    if (this.settings.weatherMode !== 'random') return;
    const D = this.data, w = D.wx; if (!w) return;
    let f = (this.clock - w.at) / WX_BLEND;
    while (f >= 1) { w.cur = w.next; w.next = this.wxPick(w.cur); w.at = w.at + WX_BLEND + this.wxSpell(w.cur); f = (this.clock - w.at) / WX_BLEND; quiet = true; }
    f = clamp(f, 0, 1);
    const q = Math.round(f * 12) / 12, key = f < 0.5 ? w.cur : w.next;
    if (q !== this.wxF || key !== this.weather || !this.W) {
      const turning = this.wxF === 0 && q > 0 && !quiet && this.state === 'drive';
      this.wxF = q; this.weather = key; this.W = blendWeather(WEATHER[w.cur], WEATHER[w.next], q);
      this.applyConditions(true);
      if (turning) this.hud.toast('The weather is turning: ' + WEATHER[w.next].name.toLowerCase() + ' coming' + (w.next === 'thaw' ? '. The ice will go soft' : ''), w.next === 'thaw' || w.next === 'blizzard' ? 'warn' : '', 3.6);
    }
  },
});
Object.assign(window.__w, { ABANDON_FEE, JOB_TIERS, latePay, TOW_SERVICE });   // test hook
