// ===== game: state, loop, rules =====
function iceCapacity(T) { return T >= 0 ? 5 : T > -4 ? lerp(5, 12, -T / 4) : T > -15 ? lerp(12, 30, (-T - 4) / 11) : 30; }
function fmtTime(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
const SAVE_KEY = 'zimnik.v2';
const REPAIR_BASE = { engine: 6000, gearbox: 3600, tires: 2200, springs: 1600, body: 4500 };
const H_STEP = 1 / 120;
const FORK_BRAKE = { throttle: 0, brake: 1 };   // standing on the brake while the junction card waits
const TOWBACK = 400;
const WRECK_TOW = 5000;   // flat rate when the truck dies at 100% damage: dragged to the nearest workshop

class Game {
  constructor() {
    this.loadSave();
    const D = this.data;
    this.settings = Object.assign({ sound: true, quality: 'auto', fps: 'auto', autoHold: true, knobLook: 'face', sk12: 'a', autoGear: true }, D.settings || {});
    // the weather and the time of day run on their own now: cycling weather, flowing time
    this.settings.weatherMode = 'random';
    KNOB_PREF.sk12 = this.settings.sk12 === 'b' ? 'b' : 'a';
    this.perf = Object.assign({ scale: 1.5, fps: 60 }, D.perf || {});
    this.weather = WEATHER[D.weather] ? D.weather : 'clear'; this.timeKey = TIMES[D.time] ? D.time : 'noon'; this.timeFlow = true;
    this.econ = new Economy(D.world);
    for (const id in ART_IMG) artImg(id);   // start decoding drawn trucks now
    this.sound = new Sound(); this.sound.on = this.settings.sound;
    layoutView();
    this.R = new Renderer(document.getElementById('game'));
    this.applyQuality();
    this.palVer = 0; this.palHourQ = null;
    this.cam = { x: 0, y: 0, ppm: 30 }; this.camVx = 0; this.camRefY = 0; this.vSm = 0;
    this.state = 'title'; this.t = 0; this.acc = 0; this.gacc = 0; this.lastTs = 0;
    this.gid = TRUCKS[D.truck] ? D.truck : 'cc'; this.gTab = 'paint'; this.gSel = null;
    this.job = null; this.trip = null; this.jobSel = null;
    this.gpal = computePalette(12.5, 'clear'); this.gpal.amb = [1.0, 0.95, 0.88]; this.gpal.fogL = { far: 0, ridge: 0, mid: 0, near: 0, world: 0 }; this.gpal.fog = 0; this.glit = makeLit(this.gpal);
    this.env = { temp: -20, wind: 0, fresh: 0, extraSnow: 0, part: 0 };
    this.W = WEATHER[this.weather]; this.wxInit();
    this.buildHub();
    this.hud = new Hud(this);
    this.hud.showTitle();
    window.onAndroidBack = () => {
      if (this.mapOpen) this.closeMap();
      else if (this.state === 'drive') this.pause(); else if (this.state === 'pause') this.resume();
      else if (this.state === 'jobs' || this.state === 'results') this.toHub();
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (this.state === 'drive') this.pause(); this.saveNow(); if (this.sound.a) this.sound.a.suspend(); } else if (this.sound.a && this.sound.on) this.sound.a.resume(); });
    this._loop = ts => this.loop(ts);
    requestAnimationFrame(this._loop);
  }
  // render scale and frame-rate cap from the graphics settings; 'auto' starts at 1.5x / 60 fps and steps down if the phone can't keep up
  applyQuality() {
    const q = this.settings.quality;
    this.R.scaleCap = q === 'high' ? 2 : q === 'low' ? 1 : this.perf.scale;
    // when auto has already stepped the resolution all the way down, thin the world detail out too
    this.R.quality = q === 'low' ? 0.6 : (q === 'auto' && this.perf.scale <= 1.01 ? 0.75 : 1);
    if (this.hud) this.hud.resize();
  }
  fpsCap() {
    const st = this.state;
    if (this.mapOpen) return 8;                         // the map covers the screen
    if (st === 'pause' || st === 'results') return 12; // nothing moves behind the menus
    const f = this.settings.fps, cap = f === '30' ? 30 : f === '60' ? 60 : this.perf.fps;
    return st === 'drive' ? cap : Math.min(cap, 30);
  }
  perfWatch(dt) {
    if (this.state !== 'drive') { this.pw = null; return; }
    const w = this.pw || (this.pw = { t: -3, n: 0, sum: 0, strikes: 0 });
    w.t += dt; if (w.t < 0) return;
    w.n++; w.sum += dt;
    if (w.t < 3) return;
    // two slow 3-second windows in a row (after a warm-up while the art caches fill) before stepping down
    const avg = w.sum / w.n, target = 1 / this.fpsCap(); w.t = 0; w.n = 0; w.sum = 0;
    if (avg < target * 1.3) { w.strikes = 0; return; }
    if (++w.strikes < 2) return;
    w.strikes = 0;
    if (this.settings.quality === 'auto' && this.perf.scale > 1.01) { this.perf.scale = this.perf.scale > 1.3 ? 1.25 : 1; this.applyQuality(); }
    else if (this.settings.fps === 'auto' && this.perf.fps > 30) this.perf.fps = 30;
    else return;
    this.data.perf = this.perf; this.saveNow();
  }
  // ---------- save ----------
  loadSave() {
    let D = null;
    try { D = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { D = null; }
    if (!D || typeof D !== 'object') {
      let old = {}; try { old = JSON.parse(localStorage.getItem('zimnik.test.v1') || '{}') || {}; } catch (e) { old = {}; }
      D = { v: 2, cash: 3000 + (old.cash || 0), settings: old.settings, weather: old.weather, time: old.time, timeFlow: old.timeFlow, best: {}, secrets: old.secrets || {}, truck: 'cc' };
    }
    D.trucks = D.trucks || {}; D.found = D.found || {}; D.secrets = D.secrets || {}; D.best = D.best || {}; D.world = D.world || {};
    // you own the old Polaris and buy the rest
    D.ownedTrucks = D.ownedTrucks || {}; D.ownedTrucks.cc = 1;
    // 0.5.2 had the drawn 143H as a separate test truck; it is the Skinnerd tractor now, which keeps its own save
    if (D.truck === 'skx') D.truck = 'skt';
    delete D.trucks.skx;
    for (const id in TRUCKS) {
      const t = D.trucks[id] = D.trucks[id] || {};
      t.parts = Object.assign({}, TRUCKS[id].stock, t.parts || {});
      delete t.parts.transfer;   // 0.7: no more transfer-case low range, the gearboxes do it
      for (const cat in t.parts) { const P = PARTCATS[cat]; if (!P || !P[t.parts[cat]] || P[t.parts[cat]].trucks.indexOf(id) < 0) t.parts[cat] = TRUCKS[id].stock[cat]; }
      t.addons = t.addons || {}; t.owned = t.owned || {}; t.ownedAdd = t.ownedAdd || {}; t.pcond = t.pcond || {};
      for (const a in t.addons) if (!ADDONS[a] || ADDONS[a].trucks.indexOf(id) < 0) delete t.addons[a];
      t.paint = Object.assign({}, TRUCKS[id].paint, t.paint || {});
      if (t.body === undefined) t.body = 1; if (t.dirt === undefined) t.dirt = 0;
      if (!NODES[t.loc] || NODES[t.loc].kind !== 'yard') t.loc = 'camp';   // every truck is parked somewhere
      // fuel stays in the tank between drives (older saves start full); lpkm learns what this truck burns
      const cap = GEOM[geomKey(id, t.parts)].tank + TANKS[t.parts.tank].extra + addonFuel(t.addons);
      t.fuel = typeof t.fuel === 'number' && t.fuel >= 0 ? Math.min(t.fuel, cap) : cap;
      if (!(t.lpkm > 0)) t.lpkm = 8.5;
      if (t.road && !(EDGES[t.road.edge] && t.road.s >= 0 && t.road.s <= EDGES[t.road.edge].len)) t.road = null;
      if (t.road) t.road.dir = t.road.dir < 0 ? -1 : 1;
      const j = t.job;
      if (j && !(j.kind === 'haul' && CARGO[j.cargo] && NODES[j.to] && NODES[j.from] && j.pay && j.left > 0 && capOf(id, j.cargo, t.parts) && (id !== 'skt' || TRAILER_FOR[j.cargo]))) t.job = null;
      if (t.job) { const n = capOf(id, t.job.cargo, t.parts); t.job.kg = unitKg(id, t.job.cargo, t.parts); t.job.units = Math.min(t.job.units, n); t.job.left = Math.min(t.job.left, n); }
    }
    if (typeof D.clock !== 'number' || !(D.clock >= 0)) D.clock = 0;
    this.data = D; this.cash = D.cash || 0;
  }
  saveNow() {
    const D = this.data; D.cash = Math.round(this.cash); D.settings = this.settings; D.weather = this.weather; D.time = this.timeKey; D.timeFlow = this.timeFlow; D.truck = this.gid;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(D)); } catch (e) { }
  }
  secret(k) { return !!this.data.secrets[k]; }
  // wipe the save and boot fresh
  newGame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); }
  get truck() { return (this.scene() === 'garage' ? this.gsim : this.sim).truck; }
  get loc() { return this.cfg().loc; }
  cfg(id) { return this.data.trucks[id || this.gid]; }
  addons() { return this.cfg().addons; }
  envFor() {
    return { temp: -20, wind: 0, fresh: 0, extraSnow: 0, part: 0 };
  }
  // soft: the weather is changing under way (the clock and the lights stay as they are, fresh snow keeps building)
  applyConditions(soft) {
    // fixed weather: whatever is set is what it is; random weather is blended by wxStep
    if (this.settings.weatherMode !== 'random') this.W = WEATHER[this.weather] || WEATHER.clear;
    const W = this.W || WEATHER[this.weather];
    if (!soft) this.hour = TIMES[this.timeKey].h;
    this.env.wind = W.wind; this.env.fresh = W.fresh || 0; this.env.part = W.part || 0;
    if (!soft) this.env.extraSnow = W.accum ? 0.04 : 0;
    this.updateTemp();
    if (this.sim && this.sim.truck && this.state === 'drive') { if (!soft) this.truck.lights = sunElev(this.hour) < 2 || W.vis < 100; else if (W.vis < 100) this.truck.lights = true; }
    this.palDirty = true;
  }
  updateTemp() { const W = this.W || WEATHER[this.weather], e = sunElev(this.hour); this.env.temp = W.temp + (this.weather === 'thaw' ? 0 : e < -6 ? -6 : e < 2 ? -3 : 0); }
  // the flowing hour mapped back onto the four named times of day (pay, lights and the save all read timeKey)
  syncTimeKey() { const h = this.hour; this.timeKey = h >= 20 || h < 6 ? 'night' : h < 11.5 ? 'morning' : h < 15.5 ? 'noon' : 'dusk'; }
  setOption(k, v) {
    if (k === 'knob') this.settings.knobLook = v;
    else if (k === 'gear') this.settings.autoGear = v === 'auto';
    else if (k === 'sk12') {
      this.settings.sk12 = v; KNOB_PREF.sk12 = v;
      // the truck in hand changes gate at once (its reverse gears with it)
      const t = this.sim && this.sim.truck; if (t) { t.gate = gateOf(t.gb); t.revs = t.gate.revs || [t.gb.rev]; if (t.gear < -t.revs.length) t.gear = -t.revs.length; if (this.hud && this.hud.knob) this.hud.knob.attach(t); }
    }
    else if (k === 'sound') { this.settings.sound = v === 'on'; this.sound.setOn(this.settings.sound); }
    else if (k === 'quality') { this.settings.quality = v; if (v === 'auto') this.perf.scale = 1.5; this.applyQuality(); }
    else if (k === 'fps') { this.settings.fps = v; if (v === 'auto') this.perf.fps = 60; }
    else if (k === 'hold') { this.settings.autoHold = v === 'on'; if (this.state === 'drive' && this.truck) this.truck.autoHold = this.settings.autoHold; }
    this.saveNow();
  }
  ownsTruck(id) { id = id || this.gid; return !TRUCKS[id].price || !!(this.data.ownedTrucks && this.data.ownedTrucks[id]); }
  buyTruck(id) {
    id = id || this.gid; const T = TRUCKS[id], price = T.price || 0;
    if (this.ownsTruck(id)) return;
    if (this.cash < price) { this.hud.toast('Not enough put by for the ' + T.name + ' (' + money(price) + ')', 'warn', 3.2); return; }
    this.cash -= price; (this.data.ownedTrucks = this.data.ownedTrucks || {})[id] = 1;
    this.sound.sfx('good'); this.saveNow();
    this.hud.toast('The ' + T.name + ' is yours · −' + money(price), 'good', 3);
    this.buildHub(); this.hud.renderGarage();
  }
  payMult() { return (WEATHER_PAY[this.weather] || 1) * (TIME_PAY[this.timeKey] || 1); }
  // what a job pays this truck, before fuel (null: this truck can't do it)
  jobEstimate(j) {
    const m = this.payMult();
    if (j.kind === 'rescue' || j.kind === 'tow') return (j.kind === 'rescue' ? RESCUE_BASE : TOW_BASE) * (0.6 + 0.4 * j.dist / 1000) * m * (this.addons().beacon ? 1.1 : 1);
    if (j.kind !== 'haul') return 0;
    const pp = this.cfg().parts, n = capOf(this.gid, j.cargo, pp); if (!n) return null;
    const p = this.econ.pay(j.cargo, n * unitKg(this.gid, j.cargo, pp) / 1000, j.dist / 1000, j.dem, m);
    return p.base + p.perT * n * unitKg(this.gid, j.cargo, pp) / 1000;
  }
  // ---------- the hub: car and job selection always use the workshop backdrop (a cached bitmap, kind to the
  // frame rate wherever the truck is parked); the flag still says whether THIS place has a real workshop ----------
  scene() { return (this.state === 'hub' || this.state === 'jobs' || this.state === 'title') ? 'garage' : 'world'; }
  toHub() {
    this.state = 'hub'; this.job = null; this.trip = null; this.gSel = null; this.fuelSel = null; this.stranded = null; this.strandAt = null; this.roadside = []; this.mapOpen = false;
    this.buildHub(); this.hud.show('garage'); this.hud.renderGarage(); this.saveNow();
    // get the map ready while nothing is moving, so opening it later is quick
    if (!MAP_MODEL) setTimeout(() => { if (!MAP_MODEL && this.state !== 'drive') mapModel(); }, 2500);
  }
  buildHub() {
    const R = this.roadOf();
    this.hubGarage = !R && !!NODES[this.loc].garage;
    this.buildGarage();
  }
  buildGarage() {
    const c = buildFlatCourse();
    this.gsim = new Sim(c, { temp: 12, wind: 0, fresh: 0, extraSnow: 0, part: 0 });
    const cfg = this.cfg(), J = cfg.job, cargo = J && J.kind === 'haul' && this.gid !== 'skt' ? J.cargo : null;
    const gt = this.gsim.addTruck(TRUCKS[this.gid], cfg, 0, { player: true, cargo, state: { cargoLeft: J ? J.left : 0, fuel: cfg.fuel } });
    gt.inGarage = true; gt.snowBuild = 0; gt.lights = false; // indoors: engine quiet, snow melted off
    gt.mode = 'M'; gt.gear = 0; gt.autoHold = true;          // parked: no creeping through the workshop while you pick a truck
    for (let i = 0; i < 120; i++) this.gsim.step(H_STEP, NOINPUT);
    gt.chassis.setLinearVelocity(planck.Vec2(0, 0));
    this.R.wr.parts.length = 0;
  }
  switchTruck(d) {
    const ids = Object.keys(TRUCKS); this.gid = ids[(ids.indexOf(this.gid) + d + ids.length) % ids.length];
    this.gSel = null; this.fuelSel = null; this.buildHub(); this.hud.renderGarage(); this.saveNow();
  }
  workshopHere() { return !this.roadOf() && !!NODES[this.loc].garage; }
  // ---------- fuel: bought when you choose, as much as you choose ----------
  tankCap(id) { id = id || this.gid; const c = this.cfg(id); return GEOM[geomKey(id, c.parts)].tank + TANKS[c.parts.tank].extra + addonFuel(c.addons); }
  fuelType(id) { return ENGINES[this.cfg(id).parts.engine].fuel; }
  // litres a drive of d metres is likely to take, from what this truck has been burning, with a margin
  fuelNeed(d, id) { return Math.ceil(d / 1000 * this.cfg(id).lpkm * 1.1 / 5) * 5; }
  // what fuel costs here: the pump if it sells this truck's fuel, otherwise a fuel truck out from the depot
  fuelOffer() {
    const c = this.cfg(), type = this.fuelType(), cap = this.tankCap(), have = Math.min(c.fuel, cap);
    const road = !!this.roadOf(), price = road ? null : this.econ.fuelPrice(this.loc, type), pump = price !== null, any = !road && !!PUMPS[this.loc];
    const unit = pump ? price : Math.round(FUEL_BASE[type] * FUEL_TRUCK.k * 10) / 10, fee = pump ? 0 : FUEL_TRUCK.callout;
    const room = Math.max(0, Math.floor(cap - have)), max = pump ? room : Math.min(room, FUEL_TRUCK.max);
    const afford = Math.max(0, Math.floor((this.cash - fee) / unit)), credit = Math.max(0, Math.min(max, Math.ceil(FUEL_RESERVE - have)));
    return { type, cap, have, unit, fee, pump, other: any && !pump, max, room, buyMax: Math.max(Math.min(max, afford), credit), credit: credit > Math.min(max, afford) };
  }
  refuel(L) {
    const o = this.fuelOffer(); L = Math.round(clamp(L, 0, o.buyMax)); if (L <= 0) return 0;
    const cost = Math.round(o.fee + L * o.unit);
    this.cash -= cost; this.cfg().fuel = L >= o.room ? o.cap : Math.min(o.cap, o.have + L); this.fuelSel = 0;
    this.sound.sfx('fuel'); this.saveNow();
    this.hud.toast((o.pump ? 'Refuelled: +' : 'The fuel truck brought ') + L + ' L · −' + money(cost), 'good', 2.6);
    this.hud.renderGarage();
    return cost;
  }
  // the nearest pumps that sell this truck's fuel, by road
  nearestPumps(n) {
    const type = this.fuelType(), found = s => this.secret(s), out = [];
    const road = !!this.roadOf();
    for (const id in PUMPS) { if ((id === this.loc && !road) || !PUMPS[id][type]) continue; const d = this.distFrom(id); if (d < Infinity) out.push({ id, d, price: this.econ.fuelPrice(id, type) }); }
    return out.sort((a, b) => a.d - b.d).slice(0, n || 4);
  }
  openJobs() { if (!this.ownsTruck()) { this.hud.toast('Not your truck yet: buy it in the workshop first', 'warn', 3); return; } this.state = 'jobs'; this.hud.showJobs(); }
  // ---------- starting a drive ----------
  startJob(j) {
    if (!this.ownsTruck()) { this.hud.toast('Not your truck yet: buy it in the workshop first', 'warn', 3); return; }
    const J = Object.assign({}, j), id = this.gid;
    if (J.kind === 'haul') {
      const pp = this.cfg(id).parts; J.units = capOf(id, J.cargo, pp); if (!J.units) return;
      J.kg = unitKg(id, J.cargo, pp); J.left = J.units;
      J.pay = this.econ.pay(J.cargo, J.units * J.kg / 1000, J.dist / 1000, J.dem, this.payMult());
      J.t0 = Math.round(this.clock);
    }
    J.mult = this.payMult(); J.beacon = !!this.addons().beacon; J.from = this.loc;
    this.job = J;
    if (J.kind === 'haul') this.cfg().job = J;
    this.launch();
  }
  startTravel(to) {
    if (!this.ownsTruck()) { this.hud.toast('Not your truck yet: buy it in the workshop first', 'warn', 3); return; }
    if (this.cfg().job) { this.hud.toast('This truck has a load aboard: deliver it or give the job up first', 'warn', 3); return; }
    if (this.onItsSide()) return;
    this.job = { kind: to ? 'travel' : 'free', to: to || null, from: this.loc, mult: 1 }; this.launch();
  }
  // carry on with the job this truck has (from a yard on the way, or the road where it was left)
  continueJob() { const J = this.cfg().job; if (!J || this.onItsSide()) return; this.job = J; this.launch(); }
  onItsSide() { const R = this.roadOf(); if (R && R.crashed) { this.hud.toast('It is on its side out there: call a tow, or fetch it with another truck', 'warn', 3.4); return true; } return false; }
  // towed to its destination: drive in and unload
  unloadHere() { const J = this.cfg().job; if (!J) return; this.job = J; this.launch(true); }
  launch(inYard) {
    const J = this.job, cfg = this.cfg();
    if (cfg.body !== undefined && cfg.body <= 0.01) { this.hud.toast('The truck is wrecked — repair it in the workshop first', 'warn', 3.2); this.toHub(); return; }
    // a recover job goes to wherever that truck is now; once it is off the road there is nothing to fetch
    if (J.kind === 'recover') { const RR = this.roadOf(J.truck); if (!RR) { this.toHub(); return; } J.edge = RR.edge; J.s = RR.s; }
    let R = cfg.road; if (R && J.to) R = Object.assign({}, R, { dir: this.roadDir(R, J.to) });
    this.stranded = null; this.strandAt = null; this.roadside = []; this.mapOpen = false;
    this.legFrom = R ? null : this.loc;
    const rigNow = this.gid === 'skt' && J.kind === 'haul' ? TRAILER_FOR[J.cargo] : null;
    // road events: about one drive in ten has something waiting out there — a road snowed in and closed,
    // or a driver stuck in a drift who could use a pull
    this.closed = null; this.closedEdge = null; this.stuck = null; this.stuckEvent = null; this.eventAt = null;
    if (!R && !inYard && J.to && (J.kind === 'haul' || J.kind === 'tow' || J.kind === 'travel') && Math.random() < 0.10) {
      const f = s => this.secret(s), r0 = route(this.loc, J.to, null, f);
      if (r0.edges.length) {
        const pick = r0.edges[Math.floor(Math.random() * r0.edges.length)];
        if (Math.random() < 0.5 && route(this.loc, J.to, new Set([pick]), f).d < Infinity) { this.closed = new Set([pick]); this.closedEdge = pick; }
        else this.stuckEvent = { edge: pick, s: Math.round(60 + Math.random() * Math.max(10, EDGES[pick].len - 120)) };
      }
    }
    const T = this.trip = new Trip(R ? null : this.loc, {
      dest: J.to, mode: J.kind === 'free' ? 'free' : J.kind === 'travel' ? 'travel' : 'job', onRoad: R ? { edge: R.edge, s: R.s, dir: R.dir } : null, inYard: !!inYard, tail: rigNow ? 16 : 0,
      rescue: J.kind === 'rescue' || J.kind === 'recover' ? { edge: J.edge, s: J.s } : null, found: s => this.secret(s), closed: this.closed, onEdge: (o, r, tp) => this.onEdge(o, r, tp),
    });
    this.course = T.c;
    this.env = this.envFor(); this.applyConditions();
    this.sim = new Sim(T.c, this.env);
    const cargo = J.kind === 'haul' ? J.cargo : null, rig = this.gid === 'skt' && cargo ? TRAILER_FOR[cargo] : null, left = J.kind === 'haul' ? (J.left !== undefined ? J.left : J.units) : 0;
    const tr = this.sim.addTruck(TRUCKS[this.gid], cfg, T.spawnX, { player: true, cargo: rig ? null : cargo, state: { autoHold: this.settings.autoHold, fuel: cfg.fuel, cargoLeft: left } });
    if (rig) this.sim.attachTrailer(tr, rig, cargo, { cargoLeft: left });
    // AUTO on (as you left it) or the knob in neutral, yours to put in gear
    if (!this.settings.autoGear) { tr.mode = 'M'; tr.gear = 0; }
    this.R.bg.setZones(T.c); this.R.wr.parts.length = 0;
    this.runT = 0; this.iceCrack = 0; this.iceWarned = false; this.thawWarned = false;
    this.tows = 0; this.towCost = 0; this.fuelCost = 0; this.feeCost = 0; this.secretT = 0; this.hinted = {}; this.lostWarn = 0; this.zoneHinted = false; this.parkHint = null; this.leftAt = null; this.forkHold = false;
    this.applyConditions();
    for (let i = 0; i < 90; i++) this.sim.step(H_STEP, NOINPUT);
    if (J.kind === 'tow') this.hookBroken();
    this.placeStranded(); this.placeRoadside();
    const p = tr.chassis.getPosition();
    this.cam.x = p.x; this.cam.y = p.y + 0.6; this.camRefY = this.cam.y; this.cam.ppm = VIEW.h / 12.5; this.vSm = 0;
    this.state = 'drive'; this.hud.show('drive'); this.sound.init();
    const to = J.to ? NODES[J.to].name : '';
    const dist = J.dist || (J.to ? route(T.start, J.to, null, s => this.secret(s)).d : 0), need = dist && !inYard ? this.fuelNeed(dist) : 0, tight = need && tr.fuel < need;
    this.hud.toast((inYard ? 'Drive in and unload: ' + CARGO[J.cargo].name + ' for ' + to : J.kind === 'rescue' ? 'A truck broke down on the ' + EDGES[J.edge].name + '. Tow it to ' + to
      : J.kind === 'recover' ? 'Your ' + TRUCKS[J.truck].name + ' is on the ' + EDGES[J.edge].name + '. Tow it to ' + to
        : J.kind === 'tow' ? 'Tow the broken truck to ' + to : J.kind === 'haul' ? CARGO[J.cargo].name + ' for ' + to : J.kind === 'travel' ? 'Driving empty to ' + to : 'Free drive. Park in any yard you like')
      + (tight ? ' · Fuel is tight: about ' + need + ' L needed, ' + Math.round(tr.fuel) + ' L in the tank' : ''), tight ? 'warn' : '', tight ? 5 : 3.6);
    if (this.closedEdge) this.hud.toast('Word in the yard: the ' + EDGES[this.closedEdge].name + ' is snowed in — closed. You will have to go round', 'warn', 5);
    else if (this.stuckEvent) this.hud.toast('A driver on the CB is stuck in a drift on the ' + EDGES[this.stuckEvent.edge].name + '. Stop and pull them out, or drive on by', '', 5);
    this.saveNow();
  }
  onEdge(o, r, T) {
    const c = T.c;
    for (const f of FINDS) if (f.edge === o.edge && !this.data.found[f.id]) c.add('crate', r.X(f.s), { find: f, z: 0 });
    if (this.job && (this.job.kind === 'rescue' || this.job.kind === 'recover') && o.edge === this.job.edge && this.strandAt === null) this.strandAt = r.X(this.job.s);
    if (this.stuckEvent && o.edge === this.stuckEvent.edge && this.eventAt === null) this.eventAt = r.X(this.stuckEvent.s);
    for (const id in TRUCKS) {
      const R = this.data.trucks[id].road;
      if (id === this.gid || !R || R.edge !== o.edge || (this.job && this.job.kind === 'recover' && this.job.truck === id)) continue;
      (this.roadside || (this.roadside = [])).push({ id, x: r.X(R.s), truck: null });
    }
    if (this.sim && this.state === 'drive') { this.placeStranded(); this.placeRoadside(); }
  }
  restartJob() { if (!this.job) { this.toHub(); return; } this.launch(); }
  pause() { if (this.state !== 'drive') return; this.state = 'pause'; this.hud.showPause(); }
  resume() { if (this.state !== 'pause') return; this.state = 'drive'; this.hud.show('drive'); }
  // 100% damage out on the road: one way home — the tow truck, flat 5,000 to the nearest workshop
  wreck() {
    if (this.state !== 'drive') return;
    this.state = 'pause';
    let best = null; const sp = this.spotHere();
    for (const id in NODES) if (NODES[id].garage) { const d = this.spotDist(sp, id); if (d < Infinity && (!best || d < best.d)) best = { node: id, d }; }
    if (!best) for (const id in NODES) if (NODES[id].garage) { best = { node: id, d: 0 }; break; }
    this.hud.showWreck(best.node);
  }
  wreckTow(node) {
    const cfg = this.cfg(), tr = this.truck;
    this.cash -= WRECK_TOW;                       // on tick if you are short — the tow always comes
    this.addTime(Math.round(this.towQuote(this.spotDist(this.spotHere(), node), !!tr.semi).time));
    this.applyWear(cfg, tr);
    cfg.body = clamp(1 - tr.damage / 100, 0, 1);  // still a wreck: the workshop repairs it
    cfg.fuel = clamp(tr.fuel, 0, this.tankCap());
    cfg.road = null; cfg.loc = node;
    this.saveNow();
    this.toHub();
    this.hud.toast('Towed to ' + NODES[node].name + ' — repair the truck in the workshop', 'warn', 4);
  }
  abandon() { this.abandonJob(); }
  // the Map button on the road: the drive waits while the map is open, with a "you are here" marker
  openDriveMap() { if (this.state !== 'drive') return; this.state = 'pause'; this.openMap('drive'); }
  // the district map: from the hub, or from a drive with a "you are here" marker
  openMap(from) {
    this.mapFrom = from; this.mapOpen = true;
    let here = null;
    if ((from === 'pause' || from === 'drive') && this.trip) {
      const T = this.trip, x = this.truck.x, J = this.job;
      here = { at: T.locate(x), legs: T.c.legs, trip: T, job: J };
      if (this.stranded && this.stranded.ditch) { here.stranded = T.locate(this.stranded.x); here.strandName = this.stranded.own ? 'Your ' + TRUCKS[this.stranded.id].name.split(' ')[0] : 'Stranded truck'; }
    }
    this.hud.showMap(here);
  }
  closeMap() {
    this.mapOpen = false; this.hud.mapResize = null;
    if (this.mapFrom === 'drive' && this.state === 'pause') { this.state = 'drive'; this.hud.show('drive'); }
    else if (this.mapFrom === 'pause' && this.state === 'pause') this.hud.showPause();
    else if (this.state === 'jobs') this.hud.showJobs();
    else { this.hud.show('garage'); this.hud.renderGarage(); }
  }
  // ---------- garage actions ----------
  // a part counts as owned if it is stock on this truck or was bought (or salvaged) before
  owns(cat, pid) { const s = TRUCKS[this.gid].stock[cat] === pid; return s || !!this.cfg().owned[cat + ':' + pid]; }
  ownsAddon(k) { return !!this.cfg().ownedAdd[k]; }
  // a new body (the Polaris's cab part) carries a different load: a haul aboard is cut down to what fits now
  refitJob(id) {
    const c = this.cfg(id), J = c.job; if (!J || J.kind !== 'haul') return;
    const n = capOf(id, J.cargo, c.parts); if (!n) { c.job = null; return; }
    J.kg = unitKg(id, J.cargo, c.parts); J.units = Math.min(J.units, n); J.left = Math.min(J.left, n);
  }
  // add-ons that sit on others: fitting the loaded rack fits the cage under it, taking the cage off takes the rack too
  addonLinks(c, id) {
    const a = ADDONS[id];
    if (c.addons[id] && a && a.needs) c.addons[a.needs] = true;
    if (!c.addons[id]) for (const k in ADDONS) if (ADDONS[k].needs === id) c.addons[k] = false;
  }
  isFound(cat, pid) { return FINDS.some(f => f.cat === cat && f.part === pid && this.data.found[f.id]); }
  partState(cat, pid) {
    const c = this.cfg();
    if (c.parts[cat] === pid) return 'fitted';
    if (this.owns(cat, pid)) return 'owned';
    const p = PARTCATS[cat][pid]; if (p.needs && !this.owns(cat, p.needs)) return 'locked';
    return 'buy';
  }
  partCond(cat) { const c = this.cfg(), v = c.pcond[cat + ':' + c.parts[cat]]; return v === undefined ? 1 : v; }
  repairCost(cat) {
    const c = this.cfg();
    const cond = cat === 'body' ? c.body : this.partCond(cat);
    const base = cat === 'body' ? REPAIR_BASE.body : Math.max(REPAIR_BASE[cat], PARTCATS[cat][c.parts[cat]].price || 0);
    return cond >= 0.995 ? 0 : Math.max(20, Math.round(base * (1 - cond) * 0.55 / 10) * 10);
  }
  garageAct(act, cat, id) {
    const c = this.cfg(); let rebuild = false;
    if (act === 'buytruck') { this.buyTruck(); return; }
    if (!this.ownsTruck(this.gid)) return;
    if (act !== 'paint' && act !== 'num' && act !== 'wash' && !this.workshopHere()) { this.hud.toast('No workshop here. Parts and repairs at Camp No 7 or Sawmill No 3', 'warn', 3); return; }
    if (act === 'buy') { const p = PARTCATS[cat][id]; if (this.cash < p.price) return; this.cash -= p.price; c.owned[cat + ':' + id] = 1; c.pcond[cat + ':' + id] = 1; c.parts[cat] = id; if (cat === 'cab') this.refitJob(this.gid); rebuild = true; this.sound.sfx('good'); }
    else if (act === 'fit') { c.parts[cat] = id; if (cat === 'cab') this.refitJob(this.gid); rebuild = true; this.sound.sfx('clunk'); }
    else if (act === 'addon') { c.addons[id] = !c.addons[id]; this.addonLinks(c, id); rebuild = true; this.sound.sfx('clunk'); }
    else if (act === 'buyaddon') { const a = ADDONS[id]; if (this.cash < a.price || (a.needs && !this.ownsAddon(a.needs))) return; this.cash -= a.price; c.ownedAdd[id] = 1; c.addons[id] = true; this.addonLinks(c, id); rebuild = true; this.sound.sfx('good'); }
    else if (act === 'paint') { c.paint[cat] = id; this.sound.sfx('click'); rebuild = !this.hubGarage; }
    else if (act === 'num') { c.paint.num = ((c.paint.num + (+id) - 1 + 99) % 99) + 1; rebuild = !this.hubGarage; }
    else if (act === 'repair' || act === 'repairall') {
      const cats = act === 'repairall' ? WEARCATS.concat(['body']) : [cat];
      const cost = cats.reduce((s, k) => s + this.repairCost(k), 0); if (this.cash < cost) return; this.cash -= cost;
      for (const k of cats) { if (k === 'body') c.body = 1; else c.pcond[k + ':' + c.parts[k]] = 1; }
      rebuild = true; this.sound.sfx('good');
    } else if (act === 'wash') { if (this.cash < 60) return; this.cash -= 60; c.dirt = 0; this.sound.sfx('unload'); rebuild = !this.hubGarage; }
    if (rebuild) this.buildHub();
    this.saveNow(); this.hud.renderGarage();
  }
  // ---------- junctions ----------
  junctionCard(p) {
    const T = this.trip, W = this.weather, N = NODES[p.node], loaded = this.job && this.job.kind === 'haul';
    const warn = E => {
      const st = edgePiece(E.id).stats, hz = edgePiece(E.id).haz || {};
      if (W === 'thaw' && st.ice > 60) return 'ice is soft in the thaw';
      if ((W === 'blizzard' || W === 'snow') && st.deep > 150) return 'deep drifts in this weather';
      if (st.maxG > 0.18 && TRUCKS[this.gid].awd === false && loaded) return 'very steep for a loaded ' + TRUCKS[this.gid].drive;
      if (st.ice > 300 && loaded) return 'long stretch on the ice: mind the weight';
      if (hz.gardens) return 'rock gardens on this road: crawl them';
      if (hz.rocks > 4) return 'boulders on the road';
      return '';
    };
    const opts = p.opts.map((o, i) => {
      const E = EDGES[o.edge];
      return { id: o.edge, name: E.name, toward: 'to ' + NODES[o.other].name, km: T.dest ? km(o.d) + ' km to ' + NODES[T.dest].name : km(E.len) + ' km', traits: E.traits || '', warn: warn(E), secret: !!E.secret, best: i === 0 && !!T.dest, target: !!o.towards,
        targetText: this.job && this.job.kind === 'recover' ? 'your ' + TRUCKS[this.job.truck].name.split(' ')[0] + ' is this way' : 'the stranded truck is this way' };
    });
    const first = N.kind === 'yard' && T.c.legs.length <= 1;
    return { title: first ? 'Leaving ' + N.name + ': pick your road' : N.kind === 'yard' ? 'Through ' + N.name + ': pick your road' : N.name + ' ahead: pick your road', sub: T.dest ? '· shortest first' : '· free drive', opts };
  }
  chooseRoad(edge, auto) {
    const T = this.trip; if (!T || !T.pending) return;
    if (!T.choose(edge)) return;
    this.forkHold = false;
    this.R.bg.setZones(T.c); this.hud.hideFork();
    this.hud.toast('Taking the ' + EDGES[edge].name, 'good');
    this.sound.sfx('click');
    this.placeStranded();
  }
  // ---------- breakdowns ----------
  otherTruck() { return this.gid === 'cc' ? 'bars' : 'cc'; }
  brokenCfg(oid) {
    const cfg = stockCfg(oid); cfg.body = 0.7; cfg.dirt = 0.7;
    if (oid === 'cc') { cfg.paint.c1 = '#b8322a'; cfg.paint.c2 = '#e6e2d6'; cfg.paint.livery = 'stripe'; }
    return cfg;
  }
  // who waits at the roadside: a driver's broken truck on a rescue, or one of yours on a recover job (with its load
  // and, for the tractor, its trailer)
  strandedWho() {
    const J = this.job;
    if (J && J.kind === 'recover') {
      const id = J.truck, c = this.data.trucks[id], cj = c.job && c.job.kind === 'haul' ? c.job : null;
      return { id, cfg: c, own: true, cargo: cj ? cj.cargo : null, rig: id === 'skt' && cj ? TRAILER_FOR[cj.cargo] || null : null, state: { fuel: c.fuel, cargoLeft: cj ? cj.left : 0 } };
    }
    const id = this.otherTruck(); return { id, cfg: this.brokenCfg(id), own: false, cargo: null, rig: null, state: undefined };
  }
  // a truck standing still at the roadside: no physics until it is hooked up (it is drawn pulled over, off the road)
  standTruck(id, cfg, x, cargo, rig, state) {
    const t = this.sim.addTruck(TRUCKS[id], cfg, x, { towed: true, cargo: rig ? null : cargo, state });
    const semi = rig ? this.sim.attachTrailer(t, rig, cargo, { cargoLeft: state ? state.cargoLeft : undefined }) : null;
    for (const v of semi ? [t, semi] : [t]) {
      for (const b of [v.chassis].concat(v.wheels.map(w => w.body), v.items.map(it => it.body))) { b.setType('static'); for (let f = b.getFixtureList(); f; f = f.getNext()) f.setFilterData({ groupIndex: v.group, categoryBits: 0, maskBits: 0 }); }
      v.ditch = true; v.snowBuild = 1; v.lights = false;
    }
    return { truck: t, semi, groundY: this.course.hAt(x), x };
  }
  placeStranded() {
    if (this.strandAt === null || this.stranded || !this.sim) return;
    const S = this.strandedWho(), q = this.standTruck(S.id, S.cfg, this.strandAt, S.cargo, S.rig, S.state);
    this.stranded = Object.assign(q, { ditch: true, id: S.id, cfg: S.cfg, own: S.own, cargo: S.cargo, rig: S.rig });
  }
  // a driver stuck in a drift (random road event): pulled over, dug in, hazard triangle out — help or drive by
  placeStuck() {
    if (this.eventAt === null || this.stuck || !this.sim) return;
    const id = Math.random() < 0.5 ? 'cc' : 'bars', x = this.eventAt;
    const q = this.standTruck(id, this.brokenCfg(id), x, null, null, undefined);
    this.stuck = Object.assign(q, { ditch: true, id, helped: false });
    this.eventAt = null;
    // the snow they dug out getting stuck
    for (let i = 0; i < 10; i++) this.R.wr.spawn({ x: x - 2 - Math.random() * 5, y: this.course.hAt(x) + 0.2, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, r: 0.12, gr: 0.4, life: 1.1, t: 0, k: 'snow', grav: 1 });
  }
  // pull them free with the tow bar: a few minutes on the clock and a thank-you in cash
  helpStuck() {
    const sk = this.stuck; if (!sk) return;
    const pay = Math.round((300 + Math.random() * 400) / 10) * 10;
    this.cash += pay; this.addTime(240);
    if (sk.semi) this.sim.removeTruck(sk.semi, false);
    this.sim.removeTruck(sk.truck, false);
    this.stuck = null;
    this.sound.sfx('good');
    this.hud.toast('You pull them out of the drift. They press ' + money(pay) + ' on you · +' + fmtTime(240) + ' on the clock', 'good', 4);
  }
  placeRoadside() {
    if (!this.sim || !this.roadside) return;
    for (const q of this.roadside) {
      if (q.truck) continue;
      const c = this.data.trucks[q.id], cj = c.job && c.job.kind === 'haul' ? c.job : null, rig = q.id === 'skt' && cj ? TRAILER_FOR[cj.cargo] : null;
      Object.assign(q, this.standTruck(q.id, c, q.x, cj ? cj.cargo : null, rig, { fuel: c.fuel, cargoLeft: cj ? cj.left : 0 }));
    }
  }
  // load: { cargo, rig, semiState } for a truck that comes with its load or its trailer
  spawnBehind(id, cfg, state, load) {
    const tr = this.truck, hx = tr.chassis.getWorldPoint(V2(tr.G.hitch[0], tr.G.hitch[1])).x, L = load || {};
    const nt = this.sim.addTruck(TRUCKS[id], cfg, hx - 1.7 - GEOM[geomKey(id, cfg.parts)].hook[0], { towed: true, state, cargo: L.rig ? null : L.cargo || null });
    if (L.rig) this.sim.attachTrailer(nt, L.rig, L.cargo, L.semiState);
    for (let i = 0; i < 12; i++) this.sim.step(H_STEP, NOINPUT);
    this.sim.hook(tr, nt);
    return nt;
  }
  hookStranded() {
    const st = this.stranded, bst = st.truck.snapshot(), sst = st.semi ? st.semi.snapshot() : undefined;
    if (st.semi) this.sim.removeTruck(st.semi);
    this.sim.removeTruck(st.truck);
    const nt = this.spawnBehind(st.id, st.cfg, st.own ? bst : undefined, { cargo: st.cargo, rig: st.rig, semiState: sst }); nt.snowBuild = 0.8;
    st.truck = nt; st.semi = nt.semi; st.ditch = false;
    this.hud.toast('Hooked up! Tow it to ' + NODES[this.trip.dest].name + (st.semi ? '. Trailer and all: take it easy' : ''), 'good', 3);
    this.sound.sfx('clunk');
    const hx = nt.x + nt.G.hook[0];
    for (let i = 0; i < 14; i++) this.R.wr.spawn({ x: hx - Math.random() * 6, y: this.course.hAt(hx) + 0.2, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, r: 0.12, gr: 0.4, life: 1.1, t: 0, k: 'snow', grav: 1 });
  }
  // a broken truck waiting in the yard, already on the bar
  hookBroken() {
    const oid = this.otherTruck(), cfg = this.brokenCfg(oid), nt = this.spawnBehind(oid, cfg);
    nt.snowBuild = 0.5; this.stranded = { truck: nt, semi: null, ditch: false, id: oid, cfg, own: false, cargo: null, rig: null };
  }
  // the bar snapped: back up to the truck and put it back on
  rehook() {
    const st = this.stranded, b = st.truck, bst = b.snapshot(), sst = b.semi ? b.semi.snapshot() : undefined;
    if (b.semi) this.sim.removeTruck(b.semi, true);
    this.sim.removeTruck(b, true);
    st.truck = this.spawnBehind(st.id, st.cfg, bst, { cargo: st.cargo, rig: st.rig, semiState: sst }); st.truck.snowBuild = b.snowBuild; st.semi = st.truck.semi;
    this.hud.toast('Tow bar back on', 'good'); this.sound.sfx('clunk');
  }
  hitchGap() {
    const st = this.stranded, tr = this.truck; if (!st || st.ditch || this.sim.tow) return Infinity;
    const a = tr.chassis.getWorldPoint(V2(tr.G.hitch[0], tr.G.hitch[1])), b = st.truck.chassis.getWorldPoint(V2(st.truck.G.hook[0], st.truck.G.hook[1]));
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  // ---------- driving: what the action button does here ----------
  nearFind() {
    const tr = this.truck, x = tr.x;
    if (Math.abs(tr.vF) > 1) return null;
    for (const d of this.course.decorIn(x - 8, x + 8)) if (d.t === 'crate' && d.find && Math.abs(d.x - x) < 7) return d;
    return null;
  }
  collect(d) {
    const f = d.find; this.data.found[f.id] = 1;
    const p = PARTCATS[f.cat][f.part], fits = [];
    for (const id of p.trucks) { const t = this.data.trucks[id]; const key = f.cat + ':' + f.part; if (!t.owned[key]) { t.owned[key] = 1; t.pcond[key] = f.cond; } fits.push(TRUCKS[id].name.split(' ')[0]); }
    this.course.removeDecor(d);
    this.hud.toast('Salvaged: ' + f.name + '. Fits ' + fits.join(', ') + '. Fit it in a workshop', 'good', 4);
    this.sound.sfx('good'); this.saveNow();
  }
  zoneHere() {
    const x = this.truck.x;
    for (const z of this.course.zones) if (x > z.x0 && x < z.x1) return z;
    return null;
  }
  stopped() { return Math.abs(this.truck.vF) < 0.6 && !this.truck.crashed; }
  actionLabel() {
    if (this.state !== 'drive') return null;
    const f = this.nearFind(); if (f) return 'Pick up: ' + f.find.name;
    const st = this.stranded, tr = this.truck, J = this.job, sk = this.stuck;
    if (sk && !sk.helped && Math.abs(tr.vF) < 0.8 && Math.abs(tr.x - sk.x) < 14) return 'Pull the stuck driver out';
    if (st && st.ditch && Math.abs(tr.vF) < 0.8) { const hx = tr.chassis.getWorldPoint(V2(tr.G.hitch[0], tr.G.hitch[1])).x; if (hx > st.x + 2 && hx < st.x + 16) return 'Hook up tow bar'; }
    const z = this.zoneHere(), stop = this.stopped(), atDest = z && J.to === z.node && z.role === 'end' && stop, inside = z && st && !st.ditch && st.truck.x > z.x0 - 12;
    // a rescued truck in the destination yard can be dropped off, on the bar or not; yours in any yard
    if ((J.kind === 'rescue' || J.kind === 'tow') && atDest && inside) return 'Drop off the truck';
    if (st && !st.ditch && !this.sim.tow && Math.abs(tr.vF) < 0.8 && this.hitchGap() < 2.6) return 'Re-attach tow bar';
    if (!z || !stop || z.role === 'start') return null;
    if (J.kind === 'rescue' || J.kind === 'tow') return null;
    if (J.kind === 'recover') return st && !st.ditch ? (inside ? 'Drop off the truck' : null) : 'Park here';
    // a load can be parked in any yard on the way; the job waits with the truck
    if (J.kind === 'haul') return atDest ? 'Unload cargo' : 'Park here';
    return 'Park here';
  }
  doAction() {
    const a = this.actionLabel(); if (!a) return;
    if (a.indexOf('Pick up') === 0) this.collect(this.nearFind());
    else if (a === 'Pull the stuck driver out') this.helpStuck();
    else if (a === 'Hook up tow bar') this.hookStranded();
    else if (a === 'Re-attach tow bar') this.rehook();
    else { this.sound.sfx('unload'); this.finish(true, '', this.zoneHere().node); }
  }
  discover(k) {
    if (this.data.secrets[k]) return;
    this.data.secrets[k] = true; this.saveNow();
    this.hud.toast(SECRETS[k].msg, 'good', 4); this.sound.sfx('good');
    if (this.trip && this.trip.refresh() && this.trip.pending) { const p = this.trip.pending; if (this.truck.x >= p.show) { p.shown = true; this.hud.showFork(this.junctionCard(p)); } }
  }
  progress() {
    const T = this.trip, x = this.truck.x, J = this.job, done = x - T.spawnX, rem = T.remaining(x), tot = Math.max(1, done + rem);
    const f = clamp(done / tot, 0, 1), marks = [];
    const at = X => clamp((X - T.spawnX) / tot, 0, 1);
    for (const l of T.c.legs) if (l.kind === 'pad' && l.x1 > x) marks.push({ k: 'fork', f: at(l.x1) });
    if (T.pending) marks.push({ k: 'fork', f: at(T.pending.x) });
    if (this.stranded && this.stranded.ditch) marks.push({ k: 'strand', f: at(this.stranded.x) });
    if (J.to || T.done) marks.push({ k: 'goal', f: T.done ? at(T.c.zones[T.c.zones.length - 1].x0 + 20) : 0.995 });
    const to = J.to ? NODES[J.to].name : '';
    const name = J.kind === 'haul' ? CARGO[J.cargo].name + ' → ' + to : J.kind === 'rescue' ? 'Rescue → ' + to : J.kind === 'tow' ? 'Tow → ' + to : J.kind === 'recover' ? TRUCKS[J.truck].name.split(' ')[0] + ' → ' + to : J.kind === 'travel' ? 'To ' + to : 'Free drive';
    return { f, marks, label: km(Math.max(0, done)) + ' / ' + (J.to ? km(tot) : '–') + ' km · ' + name + ' · ' + fmtTime(this.runT) };
  }
  // wear, damage and dirt stay with a truck until it is repaired in a workshop
  applyWear(cfg, tr) {
    const wl = [];
    for (const cat of WEARCATS) {
      const key = cat + ':' + cfg.parts[cat], before = cfg.pcond[key] === undefined ? 1 : cfg.pcond[key], w = tr.wear[cat] || 0;
      cfg.pcond[key] = clamp(before - w, 0, 1);
      if (w > 0.001) wl.push(CATNAME[cat].toLowerCase() + ' −' + (w * 100).toFixed(1) + '%');
    }
    return wl;
  }
  // ---------- how a drive ends ----------
  // how: none = parked, delivered or dropped off in the yard `at`; 'left' = left standing (in the yard `at`, or at the
  // roadside: this.leftAt); 'towed' = the tow truck took it to `at`. ok false: through the ice, pulled out and towed
  // back to where this drive started. A haul stays with its truck until it is delivered or given up.
  finish(ok, why, at, how) {
    const tr = this.truck, J = this.job, T = this.trip, cfg = this.cfg(), st = this.stranded, earn = [], C = J.cargo && CARGO[J.cargo];
    const arrived = ok && !how && !!at, atDest = arrived && at === J.to;
    let delivered = 0, tonnes = 0, note = why || '';
    // where your truck ends up
    if (!ok) {
      const back = this.legFrom || this.closestPlace().node, q = this.towQuote(this.spotDist(this.spotHere(), back), !!tr.semi);
      earn.push(['Pulled out, towed to ' + NODES[back].name, -(TOWBACK + q.cost)]);
      this.addTime(q.time); note += ' Pulled out and towed to ' + NODES[back].name + ': +' + fmtTime(q.time) + ' on the clock.';
      cfg.road = null; cfg.loc = back;
    } else if (how === 'left' && !at) cfg.road = this.leftAt;
    else { cfg.road = null; if (at) cfg.loc = at; }
    const endAt = cfg.road ? null : cfg.loc;
    // what the job pays, or how it carries on
    if (J.kind === 'haul') {
      const left = tr.loadCount();
      if (atDest) {
        delivered = left; tonnes = delivered * J.kg / 1000;
        if (delivered) {
          earn.push(['Delivery', J.pay.base], [delivered + ' ' + (delivered === 1 ? C.unit : C.units), J.pay.perT * tonnes]);
        }
        cfg.job = null;
      } else if (left > 0) { J.left = left; cfg.job = J; if (ok) note += (note ? ' ' : '') + 'The job carries on from ' + (endAt ? NODES[endAt].name : 'here') + '.'; }
      else { cfg.job = null; note += (note ? ' ' : '') + 'Nothing left aboard: the job is off.'; }
    } else if ((J.kind === 'rescue' || J.kind === 'tow') && atDest) {
      earn.push([J.kind === 'rescue' ? 'Rescue' : 'Tow job', (J.kind === 'rescue' ? RESCUE_BASE : TOW_BASE) * (0.6 + 0.4 * J.dist / 1000) * J.mult * (J.beacon ? 1.1 : 1)]);
    }
    // your other truck on the bar goes where you go; one still at the roadside stays there
    const rec = J.kind === 'recover' && st && !st.ditch ? this.settleTowed(st, endAt) : null;
    // costs paid on the way are shown with the rest; what is earned now goes in the till
    const paid = [];
    if (this.towCost) paid.push(['Tow truck' + (this.tows > 1 ? ' ×' + this.tows : ''), -this.towCost]);
    if (this.fuelCost) paid.push(['Fuel truck', -this.fuelCost]);
    if (this.feeCost) paid.push(['Abandon fee', -this.feeCost]);
    this.cash += earn.reduce((a, p) => a + p[1], 0);
    const pay = earn.concat(paid), total = pay.reduce((a, p) => a + p[1], 0);
    const wl = this.applyWear(cfg, tr);
    cfg.body = clamp(1 - tr.damage / 100, 0, 1);
    // what is left in the tank stays there; the estimate of what this truck burns follows each longer drive
    cfg.fuel = clamp(tr.fuel, 0, this.tankCap());
    if (tr.dist > 400 && tr.fuelUsed > 0.5) cfg.lpkm = clamp(lerp(cfg.lpkm, tr.fuelUsed / (tr.dist / 1000), 0.35), 2, 30);
    if (delivered) this.econ.delivered(J, tonnes);
    const roads = T.c.legs.filter(l => l.kind === 'edge').map(l => l.edge);
    let best = false;
    if (arrived && J.kind !== 'free' && this.legFrom && !this.tows) {
      const bk = J.kind + ':' + (J.cargo || '') + ':' + this.legFrom + '>' + at + ':' + roads.join(',');
      const b = this.data.best[bk]; if (!b || this.runT < b) { this.data.best[bk] = this.runT; best = true; }
    }
    this.econ.nextDay();
    this.saveNow();
    this.state = 'results';
    const W = this.W || WEATHER[this.weather], Tm = TIMES[this.timeKey];
    const names = []; for (const e of roads) { const n = EDGES[e].name; if (names[names.length - 1] !== n) names.push(n); }
    const place = n => NODES[n].name;
    const title = !ok ? 'Through the ice' : how === 'left' && !at ? 'Left on the road' : how === 'towed' ? 'Towed to ' + place(at)
      : J.kind === 'rescue' && atDest ? 'Rescue complete!' : J.kind === 'tow' && atDest ? 'Tow job done!' : J.kind === 'recover' && rec ? 'Truck recovered!'
        : J.kind === 'haul' && atDest ? (delivered < J.units ? (delivered ? 'Delivered, partly' : 'Nothing delivered') : 'Delivered!') : 'Parked at ' + place(endAt);
    const jobRow = J.kind === 'haul' ? C.name + ': ' + place(J.from) + ' → ' + place(J.to) : J.kind === 'recover' ? 'Fetch the ' + TRUCKS[J.truck].name + ' → ' + place(J.to)
      : J.kind === 'rescue' || J.kind === 'tow' ? (J.kind === 'rescue' ? 'Rescue' : 'Tow') + ' → ' + place(J.to) : endAt ? 'Drive to ' + place(endAt) : 'Drive';
    const rows = [['Job', jobRow], ['Roads', names.join(' · ') || '—'], ['Conditions', W.name + ' · ' + Tm.name + ' · ' + Math.round(this.env.temp) + '°C'], ['Time', fmtTime(this.runT) + (best ? '  ★ best' : '')]];
    if (J.kind === 'rescue' || J.kind === 'tow') rows.push(['Truck towed', atDest ? 'Delivered' : 'No']);
    else if (J.kind === 'recover') rows.push([TRUCKS[J.truck].name.split(' ')[0], (rec ? 'now ' : 'still ') + this.whereText(J.truck)]);
    else if (J.kind === 'haul' && atDest) rows.push([C.name + ' delivered', delivered + ' / ' + J.units + ' ' + C.units]);
    else if (J.kind === 'haul' && cfg.job) rows.push([C.name + ' aboard', J.left + ' / ' + J.units + ' ' + C.units]);
    else rows.push(['Salvage found', FINDS.filter(f => this.data.found[f.id]).length + ' / ' + FINDS.length]);
    rows.push(['Damage', Math.round(tr.damage) + '%'], ['Fuel', 'used ' + Math.round(tr.fuelUsed) + ' L · ' + Math.round(cfg.fuel) + ' L left'], ['Truck now', this.whereText()]);
    this.hud.showResults({ title, note: note.trim(), rows, pay, total, wear: wl.length ? 'Wear this run: ' + wl.join(', ') + '. Repair it in a workshop.' : '', ok });
    if (ok && (atDest || rec)) this.sound.sfx('good');
  }
  // ---------- loop ----------
  loop(ts) {
    requestAnimationFrame(this._loop);
    // frame cap: skip vsyncs that come sooner than the target interval (120 Hz screens, or the 30 fps saver)
    if (this.lastTs && ts - this.lastTs < 1000 / this.fpsCap() - 2.5) return;
    const dt = Math.min(0.05, this.lastTs ? (ts - this.lastTs) / 1000 : 0.016); this.lastTs = ts; this.t += dt;
    try { this.tick(dt); } catch (e) { console.error(e); }
    this.perfWatch(dt);
  }
  stepSim(sim, dt, input, accKey) {
    this[accKey] += dt; let n = 0;
    while (this[accKey] >= H_STEP && n < 8) { sim.step(H_STEP, input); this[accKey] -= H_STEP; n++; }
    if (n >= 8) this[accKey] = 0;
    IA = clamp(this[accKey] / H_STEP, 0, 1);
  }
  tick(dt) {
    const garage = this.scene() === 'garage';
    if (this.state === 'drive') this.update(dt);
    else if (garage) this.stepSim(this.gsim, dt, NOINPUT, 'gacc');
    if (this.state === 'drive' || this.state === 'pause' || this.state === 'results') this.updateCamera(dt);
    if (this.timeFlow && this.state === 'drive') { this.hour = (this.hour + dt / 60) % 24; this.updateTemp(); this.syncTimeKey(); }
    // the palette moves in 15-minute steps of game time, so cached art is redrawn every few seconds, not every frame
    const hq = Math.round(this.hour * 4) / 4;
    if (hq !== this.palHourQ) { this.palHourQ = hq; this.palDirty = true; }
    if (this.palDirty || !this.pal) { this.pal = computePalette(hq, this.weather, this.W); this.lit = makeLit(this.pal); this.palDirty = false; this.palVer++; }
    const sim = garage ? this.gsim : this.sim;
    if (this.state !== 'pause') this.R.wr.updateParticles(this.state === 'drive' ? dt : dt * 0.5, sim.vehicles, sim.env, sim.course);
    if (!this.mapOpen) this.R.frame(this, dt, this.t);
    this.hud.update(this.t);
    this.sound.update(sim.truck, sim.env, this.state !== 'drive');
  }
  updateCamera(dt) {
    const tr = this.truck, p = ipos(tr.chassis), v = tr.chassis.getLinearVelocity();
    this.vSm = lerp(this.vSm, v.x, 1 - Math.exp(-dt / 0.8));
    const towing = !!this.sim.tow, semi = !!tr.semi;
    const base = VIEW.h / 12.5 * (semi ? 0.7 : towing ? 0.82 : 1);
    const ox = this.cam.x;
    this.cam.x = p.x;                      // hard lock: the truck never leaves the centre of the screen
    const ty = p.y + (semi ? 1.2 : 0.7);
    this.cam.y += (ty - this.cam.y) * (1 - Math.exp(-dt * 2.6));
    const tp = base * (1 - clamp(Math.abs(this.vSm) / 50, 0, 0.16));
    this.cam.ppm += (tp - this.cam.ppm) * (1 - Math.exp(-dt * 0.8));
    this.camVx = lerp(this.camVx, dt > 0 ? (this.cam.x - ox) / dt : 0, 0.15);
  }
  update(dt) {
    const tp = this.trip;
    // the drive waits at a junction until a road is picked: no clock, no weather, no rolling on
    if (this.forkHold) { if (tp && tp.pending) return; this.forkHold = false; }
    // no road picked by the end of the pad: brake to a stop there and hold the drive for the choice
    // (never right at the spawn: leaving a yard, you get to roll up to the gate first)
    const pu = tp && tp.pending;
    if (pu && this.truck.x >= pu.auto - 30 && this.truck.x > tp.spawnX + 10) {
      this.stepSim(this.sim, dt, FORK_BRAKE, 'acc');
      if (Math.abs(this.truck.vF) < 0.4) {
        this.forkHold = true;
        if (!pu.shown) { pu.shown = true; this.hud.showFork(this.junctionCard(pu)); pu.opts.forEach((o, i) => setTimeout(() => edgePiece(o.edge), 120 + i * 90)); }
        this.hud.toast('Stopped at the junction — pick your road', '', 3);
        return;
      }
    } else this.stepSim(this.sim, dt, this.hud.readInput(), 'acc');
    this.runT += dt; this.clock += dt; this.wxStep(dt);
    const tr = this.truck, c = this.course, W = this.W, env = this.env, cfg = this.cfg(), T = this.trip;
    if (W.accum) env.extraSnow = Math.min(0.3, env.extraSnow + W.accum * dt);
    if (this.weather === 'blizzard') env.wind = W.wind * (0.75 + 0.35 * Math.sin(this.t * 0.37) + 0.15 * Math.sin(this.t * 1.7));
    // dirt and snow on the truck
    const spd = Math.abs(tr.vF), soft = c.softAt(tr.x) > 0.05 || c.surfAt(tr.x) === S_RUTS;
    if (spd > 1) cfg.dirt = Math.min(1, (cfg.dirt || 0) + dt * 0.0011 * (soft ? 1.6 : 0.5) * (this.weather === 'thaw' ? 2 : 1));
    // fresh snow settles on the truck only in real snowfall (not sleet in the thaw); speed blows it off, a thaw melts it
    if (env.part > 0 && !W.sleet && env.temp < -1 && spd < 7) tr.snowBuild = Math.min(1, (tr.snowBuild || 0) + dt * env.part * 0.006);
    else if (spd > 10) tr.snowBuild = Math.max(0, (tr.snowBuild || 0) - dt * 0.004 * (spd - 10));
    if (env.temp > -1 && tr.snowBuild > 0) tr.snowBuild = Math.max(0, tr.snowBuild - dt * 0.004);
    for (const e of this.sim.events) {
      if (e.type === 'sfx') { this.sound.sfx(e.msg); continue; }
      if (e.type === 'tow') { this.hud.toast('The tow bar snapped! Back up to the truck to put it back on', 'bad', 3.6); continue; }
      this.hud.toast(e.msg, e.cls);
    }
    this.sim.events.length = 0;
    // wrecked at 100% damage: the engine dies and stays dead until a workshop sees to it
    if (tr.damage >= 100 && !tr.dead) {
      tr.dead = true; tr.engineOn = false;
      this.sound.sfx('thud');
      this.hud.toast('The truck is wrecked — it will not run again', 'bad', 4);
    }
    if (tr.dead) { tr.engineOn = false; if (Math.abs(tr.vF) < 0.5 && this.state === 'drive') { this.wreck(); return; } }
    const x = tr.x;
    // junctions: the card comes up well before the pad; past it the truck stops and waits (above)
    const p = T.pending;
    if (p && !p.shown && x >= p.show) {
      p.shown = true; this.hud.showFork(this.junctionCard(p));
      // build the roads on offer now, a little at a time, so taking one later doesn't stall a frame
      p.opts.forEach((o, i) => setTimeout(() => edgePiece(o.edge), 120 + i * 90));
    }
    // a stuck driver (road event) appears once the bend ahead would hide them no longer
    if (this.eventAt !== null && !this.stuck && x > this.eventAt - 420) this.placeStuck();
    // secret roads: stop by the old sign, the fishing hut, the village notice board
    let near = null;
    for (const d of c.decorIn(x - 40, x + 12)) if (d.secret && !this.secret(d.secret)) {
      if (Math.abs(d.x - x) < 10) near = d;
      else if (x > d.x + 12 && !this.hinted[d.secret]) { this.hinted[d.secret] = 1; this.hud.toast(d.t === 'oldsign' ? 'An old sign back there… stop by it to read it' : d.t === 'fishhut' ? 'Smoke from the fishing hut. Someone is in. Stop by?' : 'A notice board back there. Worth a stop', '', 3.2); }
    }
    if (near && Math.abs(tr.vF) < 0.9) { this.secretT += dt; if (this.secretT > 0.8) { this.secretT = 0; this.discover(near.secret); } } else this.secretT = 0;
    // ice: everything on it counts
    let mass = 0, onIce = false;
    for (const v of this.sim.vehicles) {
      if (v.ditch) continue;
      let on = false;
      // anything over water counts, snow-covered or not (log crossings and bridges carry their own weight)
      for (const w of v.wheels) if (w.touch && w.surf !== S_WOOD) { const u = c.under[c.ii(w.body.getPosition().x)]; if (u === 1 || (u === 3 && w.surf === S_ICE)) on = true; }
      if (on) { onIce = true; mass += v.totalMass; }
    }
    if (onIce) {
      if (this.weather === 'thaw' && !this.thawWarned) { this.thawWarned = true; this.hud.toast('Soft ice in the thaw. Keep moving, don\'t stop!', 'warn', 3.2); }
      const cap = iceCapacity(env.temp), over = mass / 1000 / cap - 1;
      if (over > 0) {
        this.iceCrack += over * (Math.abs(tr.vF) < 3 ? 0.45 : 0.11) * dt;
        if (this.iceCrack > 0.25 && !this.iceWarned) { this.iceWarned = true; this.hud.toast('The ice is cracking!', 'bad'); this.sound.sfx('crack'); }
        if (Math.random() < this.iceCrack * dt * 2) this.sound.sfx('crack');
        if (this.iceCrack >= 1) { this.sound.sfx('crack'); this.finish(false, 'The ice gave way under ' + (mass / 1000).toFixed(1) + ' t. Right now it holds about ' + cap.toFixed(0) + ' t. A road on land would have been safer.'); return; }
      } else this.iceCrack = Math.max(0, this.iceCrack - dt * 0.2);
    } else this.iceCrack = Math.max(0, this.iceCrack - dt * 0.3);
    const J = this.job;
    if (J.kind === 'haul' && tr.loadAboard() === 0 && !this.lostWarn) { this.lostWarn = 1; this.hud.toast('All cargo lost. You can still finish the run', 'bad', 3.4); }
    const z = this.zoneHere();
    if (z && z.role !== 'start' && this.parkHint !== z && !((J.kind === 'rescue' || J.kind === 'tow') && J.to !== z.node)) { this.parkHint = z; if (this.actionLabel()) this.sound.sfx('click'); }
  }
}

window.__z = {
  get G() { return window.__game; },
  // test hook: o = { truck, job (cargo name, 'rescue', 'tow', 'travel', 'free'), to, at (start location), weather, time, roads: [edge ids to prefer], fuel (litres) }
  start(o) {
    const G = window.__game; o = o || {};
    if (o.truck) { G.gid = o.truck; (G.data.ownedTrucks = G.data.ownedTrucks || {})[o.truck] = 1; } // tests may drive any truck
    if (o.time) G.timeKey = o.time;
    if (o.weather) { G.weather = o.weather; G.settings.weatherMode = 'fixed'; G.data.wx = null; G.W = WEATHER[o.weather]; }
    if (o.at) G.cfg().loc = o.at;
    if (!o.keep) { G.cfg().road = null; G.cfg().job = null; }
    G.cfg().fuel = o.fuel !== undefined ? o.fuel : G.tankCap();   // tests start full unless told otherwise
    G.applyConditions();
    const from = G.loc, to = o.to || (from === 'mill' ? 'camp' : 'mill');
    const r = route(from, to, null, s => G.secret(s));
    if (o.job === 'travel' || o.job === 'free') G.startTravel(o.job === 'free' ? null : to);
    else if (o.job === 'rescue') { const edge = o.edge || 'e3'; G.startJob({ kind: 'rescue', cargo: 'tow', from, to, dist: r.d, dem: 0.6, edge, s: o.s || Math.round(EDGES[edge].len * 0.42) }); }
    else if (o.job === 'tow') G.startJob({ kind: 'tow', cargo: 'tow', from, to, dist: r.d, dem: 0.5 });
    else { const cargo = o.job || (capOf(G.gid, 'pulp') ? 'pulp' : 'logs'); G.startJob({ kind: 'haul', cargo, from, to, dist: r.d, dem: 0.6 }); }
    G.prefer = o.roads || [];
    // roads: take these where offered; auto: then take the default everywhere else (the whole drive is built now)
    if (o.roads || o.auto) for (let i = 0; i < 12 && G.trip.pending; i++) { const p = G.trip.pending, q = p.opts.find(q => (o.roads || []).includes(q.edge)) || (o.auto ? p.opts[0] : null); if (!q) break; G.chooseRoad(q.edge); }
    return true;
  },
  // x along a road of the current drive (edge id and metres from where that road starts in this drive)
  roadX(edge, s) { const l = window.__game.course.legs.find(l => l.edge === edge); return l ? l.x0 + (s || 0) : null; },
  teleport(x) { const G = window.__game; const t = G.sim.respawn(G.truck, x); if (G.stranded && G.sim.tow) { G.stranded.truck = G.sim.tow.b; G.stranded.semi = G.sim.tow.b.semi; } G.cam.x = x; G.cam.y = G.course.hAt(x) + 2; return !!t; },
  state() { const G = window.__game, t = G.truck; return { x: t.x, v: t.vF, gear: t.gear, rpm: t.rpm, items: t.itemsOn(), dmg: t.damage, fuel: t.fuel, state: G.state, coup: t.coup, loc: G.loc }; },
};
window.__SPR = SPR; // test hook: sprite cache stats
window.__w = { EDGES, NODES, YARDS, route, capOf, CARGO, ART_BOUNDS, artImg, GEARBOXES, GATES, gateOf, revLabel, KNOB_PREF, WEATHER, hasTransfers: typeof TRANSFERS !== 'undefined' }; // test hook: the world data
window.addEventListener('load', () => { window.__game = new Game(); });
