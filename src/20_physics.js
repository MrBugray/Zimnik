// ===== physics: world, vehicles, drivetrain, cargo, towing =====
const G = 9.81;
const CAT_GROUND = 1, CAT_TRUCK = 2, CAT_WHEEL = 4, CAT_CARGO = 8;
const V2 = (x, y) => planck.Vec2(x, y);
const FUEL_SCALE = 10;
const G_R0 = 0.575;
const WM_SCRATCH = new planck.WorldManifold();   // reused for wheel contact points
const NOINPUT = { throttle: 0, brake: 0 };
function curveAt(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const a = t[i - 1], b = t[i]; return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])); }
  return t[t.length - 1][1];
}
function curveMax(t) { let m = 0; for (const p of t) m = Math.max(m, p[1]); return m; }
function peakPower(t) { let m = 0; for (let r = 500; r <= t[t.length - 1][0]; r += 50) m = Math.max(m, curveAt(t, r) * r / RPM); return m; }
function makeLogs(k) {
  const r = mulberry32(31 + k * 17), out = [];
  for (let i = 0; i < 3; i++) out.push({ dx: (r() - 0.5) * 0.5, len: 4.25 + r() * 0.5, d: 0.36 + r() * 0.08, dy: (i - 1) * 0.06, tone: r() });
  return out;
}
function makeEnds(k, hw, hh) {
  // short logs loaded crosswise: from the side you see a stack of log ends, packed to the top of the bundle
  const r = mulberry32(57 + k * 23), out = [], n = 5, rad = hw / n, rows = Math.max(1, Math.floor((2 * hh - 2 * rad) / (rad * 1.7)) + 1), step = rows > 1 ? (2 * hh - 2 * rad) / (rows - 1) : 0;
  for (let ri = 0; ri < rows; ri++) {
    const off = ri % 2 ? 0.5 : 0, cnt = off ? n - 1 : n, y = -hh + rad + ri * step;
    for (let i = 0; i < cnt; i++) out.push({ x: -hw + rad + (i + off) * rad * 2 + (r() - 0.5) * 0.02, y: y + (r() - 0.5) * 0.02, r: rad * (0.88 + r() * 0.12), tone: r() });
  }
  return out;
}

class Sim {
  constructor(course, env) {
    this.course = course; this.env = env;
    this.world = planck.World({ gravity: V2(0, -G) });
    this.ground = null; this.buildGround();
    this.vehicles = []; this.player = null; this.debris = []; this.events = []; this.time = 0; this.tow = null; this.groupN = 0;
    this.world.on('pre-solve', c => this.preSolve(c));
    this.world.on('post-solve', (c, imp) => this.postSolve(c, imp));
  }
  get truck() { return this.player; }
  emit(type, msg, cls) { this.events.push({ type, msg, cls: cls || '' }); }
  // the ground is a row of chain shapes, 200 m each, so a drive that grows only rebuilds its far end
  buildGround() {
    if (this.ground) this.world.destroyBody(this.ground);
    this.ground = this.world.createBody({ type: 'static' }); this.gsegs = []; this.gsolF = []; this.gSol = null;
    this.course.dirtyFrom = 0; this.syncGround();
  }
  syncGround() {
    const c = this.course, b = this.ground, SEG = 400, from = c.dirtyFrom;
    if (from !== Infinity) {
      let start = 0;
      while (this.gsegs.length) {
        const s = this.gsegs[this.gsegs.length - 1];
        if (s.i1 + 1 < from && s.next) { start = s.i1; break; }
        b.destroyFixture(s.f); this.gsegs.pop();
      }
      for (let i0 = start; i0 < c.n - 1; i0 += SEG) {
        const i1 = Math.min(c.n - 1, i0 + SEG), verts = [];
        for (let i = i0; i <= i1; i++) verts.push(V2(c.X0 + i * DX, c.y[i]));
        const sh = planck.Chain(verts, false);
        if (i0 > 0) sh.setPrevVertex(V2(c.X0 + (i0 - 1) * DX, c.y[i0 - 1]));
        if (i1 < c.n - 1) sh.setNextVertex(V2(c.X0 + (i1 + 1) * DX, c.y[i1 + 1]));
        const f = b.createFixture(sh, { friction: 0.9, filterCategoryBits: CAT_GROUND, userData: { k: 'ground' } });
        this.gsegs.push({ i0, i1, f, next: i1 < c.n - 1 });
      }
      c.dirtyFrom = Infinity;
    }
    // walls, fences and barriers at the closed end of a yard
    if (this.gSol !== c.solids || this.gSolN !== c.solids.length) {
      for (const f of this.gsolF) b.destroyFixture(f);
      this.gsolF = c.solids.map(q => b.createFixture(planck.Box((q.x1 - q.x0) / 2, (q.y1 - q.y0) / 2, V2((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2), 0), { friction: 0.6, filterCategoryBits: CAT_GROUND, userData: { k: 'ground', solid: q.k } }));
      this.gSol = c.solids; this.gSolN = c.solids.length;
    }
  }
  setCourse(course) { this.course = course; this.buildGround(); }
  preSolve(contact) {
    const ua = contact.getFixtureA().getUserData(), ub = contact.getFixtureB().getUserData();
    if (!ua || !ub) return;
    if (ua.k === 'wheel' && ub.k === 'ground') ua.tr.wheelContact(ua.i, contact);
    else if (ub.k === 'wheel' && ua.k === 'ground') ub.tr.wheelContact(ub.i, contact);
  }
  postSolve(contact, imp) {
    const ua = contact.getFixtureA().getUserData(), ub = contact.getFixtureB().getUserData();
    if (!ua || !ub) return;
    if (ua.k === 'chassis' && ub.k === 'ground') ua.tr.impact(ua, imp);
    else if (ub.k === 'chassis' && ua.k === 'ground') ub.tr.impact(ub, imp);
  }
  addTruck(def, cfg, x, opts) {
    opts = Object.assign({}, opts || {}); opts.group = opts.group || -(++this.groupN);
    const t = new Truck(this, def, cfg, x, opts);
    this.vehicles.push(t); if (opts.player) this.player = t;
    return t;
  }
  removeTruck(t, keepLost) {
    if (this.tow && (this.tow.a === t || this.tow.b === t)) this.unhook();
    if (t.semi) { const b = t.semi; t.semi = null; b.towedBy = null; this.semiJ = null; }
    if (t.isTrailer && t.towedBy) { t.towedBy.semi = null; t.towedBy = null; this.semiJ = null; }
    t.destroy(keepLost ? this.debris : null);
    this.vehicles = this.vehicles.filter(v => v !== t);
    if (this.player === t) this.player = null;
  }
  respawn(t, x) {
    const st = t.snapshot(), wasTow = this.tow && this.tow.a === t ? this.tow.b : null, semi = t.semi;
    const opts = { player: t === this.player, towed: t.towed, cargo: t.cargoType, state: st };
    let sst = null; if (semi) { sst = { id: semi.id, cargo: semi.cargoType, state: semi.snapshot() }; this.removeTruck(semi, true); }
    this.removeTruck(t, true);
    const nt = this.addTruck(t.def, t.cfg, x, opts);
    if (sst) this.attachTrailer(nt, sst.id, sst.cargo, sst.state);
    if (wasTow) {
      // the truck on the bar comes along, with its load and its own trailer if it has one
      const b = wasTow, bst = b.snapshot(), bs = b.semi ? { id: b.semi.id, cargo: b.semi.cargoType, state: b.semi.snapshot() } : null;
      if (b.semi) this.removeTruck(b.semi, true);
      this.removeTruck(b, true);
      const hx = nt.chassis.getWorldPoint(V2(nt.G.hitch[0], nt.G.hitch[1])).x;
      const nb = this.addTruck(b.def, b.cfg, hx - 1.6 - b.G.hook[0], { towed: true, cargo: b.cargoType, state: bst });
      if (bs) this.attachTrailer(nb, bs.id, bs.cargo, bs.state);
      this.hook(nt, nb);
    }
    return nt;
  }
  // a semi-trailer: kingpin on the tractor's fifth wheel, free to pitch over crests and dips (within limits)
  attachTrailer(tr, id, cargo, state) {
    const kp = tr.chassis.getWorldPoint(V2(tr.G.fifth[0], tr.G.fifth[1] + 0.03));
    const t = this.addTruck(TRAILERS[id], trailerCfg(id), kp.x, { towed: true, trailer: true, cargo, group: tr.group, kingpin: kp, state });
    this.semiJ = this.world.createJoint(planck.RevoluteJoint({ enableLimit: true, lowerAngle: -0.45, upperAngle: 0.45, collideConnected: false }, tr.chassis, t.chassis, kp));
    tr.semi = t; t.towedBy = tr;
    return t;
  }
  hook(a, b) {
    const pa = a.chassis.getWorldPoint(V2(a.G.hitch[0], a.G.hitch[1])), pb = b.chassis.getWorldPoint(V2(b.G.hook[0], b.G.hook[1]));
    const j = this.world.createJoint(planck.DistanceJoint({ frequencyHz: 4.5, dampingRatio: 0.8, collideConnected: true }, a.chassis, b.chassis, pa, pb));
    const len = Math.hypot(pa.x - pb.x, pa.y - pb.y);
    this.tow = { j, a, b, len, comp: 0, force: 0 };
    a.towing = b; b.towedBy = a;
  }
  unhook() {
    if (!this.tow) return;
    this.world.destroyJoint(this.tow.j); this.tow.a.towing = null; this.tow.b.towedBy = null; this.tow.b.extBrake = 0; this.tow = null;
  }
  step(dt, input) {
    if (this.course.dirtyFrom !== Infinity || this.gSol !== this.course.solids) this.syncGround();
    for (let b = this.world.getBodyList(); b; b = b.getNext()) {
      if (!b.isDynamic()) continue;
      const p = b.getPosition(); b._px = p.x; b._py = p.y; b._pa = b.getAngle();
    }
    const tw = this.tow;
    if (tw) {
      const a = tw.a; tw.b.extBrake = Math.max(a.holding ? 1 : 0, a.brk * 0.85, tw.comp);
    }
    // a towed truck off the bar stands on its own brakes instead of rolling away; trailers brake with the tractor
    for (const v of this.vehicles) {
      if (v.isTrailer) { const a = v.towedBy; v.extBrake = a ? Math.max(a.holding ? 1 : 0, a.brk) : 1; }
      else if (v.towed && !v.towedBy && !v.ditch) v.extBrake = 1;
    }
    for (const v of this.vehicles) v.preStep(dt, v === this.player ? input : NOINPUT, this.env);
    this.world.step(dt, 10, 5);
    for (const v of this.vehicles) v.postStep(dt);
    if (tw && this.tow) {
      const pa = tw.a.chassis.getWorldPoint(V2(tw.a.G.hitch[0], tw.a.G.hitch[1])), pb = tw.b.chassis.getWorldPoint(V2(tw.b.G.hook[0], tw.b.G.hook[1]));
      const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      tw.comp = lerp(tw.comp, clamp((tw.len - d) / 0.06, 0, 1), 0.3);
      tw.force = tw.j.getReactionForce(1 / dt).length();
      if (tw.force > 190000) { this.unhook(); this.emit('tow', 'The tow bar snapped!', 'bad'); this.emit('sfx', 'snap'); }
    }
    this.time += dt;
  }
}

class Truck {
  constructor(sim, def, cfg, x, opts) {
    opts = opts || {};
    this.sim = sim; this.def = def; this.id = def.id; this.cfg = cfg; this.gk = geomKey(def.id, cfg.parts); this.G = GEOM[this.gk];
    this.towed = !!opts.towed; this.group = opts.group || -1; this.isPlayer = !!opts.player; this.isTrailer = !!opts.trailer; this.reports = !!(opts.player || opts.trailer);
    const st = opts.state || {};
    this.applyParts(st.fuel);
    this.fuel = st.fuel !== undefined ? clamp(st.fuel, 0, this.tank) : this.tank; this.fuelUsed = st.fuelUsed || 0;
    this.damage = st.damage !== undefined ? st.damage : Math.round((1 - (cfg.body !== undefined ? cfg.body : 1)) * 100);
    this.temp = st.temp !== undefined ? st.temp : 55;
    this.gear = this.towed ? 0 : 1; this.mode = 'A'; this.awd = !!st.awd && def.awd !== false; this.diff = false; this.lights = !!st.lights;
    this.pressure = st.pressure || 3.0; this.pTarget = st.pTarget || this.pressure;
    this.autoHold = st.autoHold !== false && !this.towed; this.engineOn = !this.towed;
    this.we = this.eng.idle / RPM; this.rpm = this.eng.idle; this.coup = 'slip'; this.wf = 0;
    this.thr = 0; this.brk = 0; this.thrIn = 0; this.brkIn = 0; this.extBrake = 0;
    this.shiftT = 0; this.shiftCd = 0; this.shifting = false; this.nextGear = null; this.upBlock = 0; this.derate = 1; this.tq = 1;
    this.Te = 0; this.Tw = 0; this.power = 0; this.vF = 0; this.acc = 0; this.speed = 0; this.dist = st.dist || 0;
    this.sinkAvg = 0; this.bellyDrag = 0; this.crashT = 0; this.crashed = false; this.cabHit = false; this.stuckT = 0; this.windup = 0; this.tireHeat = 0; this.ctisDir = 0;
    this.overRevT = 0; this.warned = {}; this.holding = false; this.holdT = 0; this.intake = st.intake || 0; this.hitT = 0; this.chainT = 0; this.bottomT = 0; this.joltT = 0;
    this.wear = st.wear || { engine: 0, gearbox: 0, tires: 0, springs: 0 };
    this.towing = null; this.towedBy = null; this.semi = null;
    this.build(x, opts.cargo, st.cargoLeft, opts.kingpin);
  }
  // fuelL: litres aboard at the start (full when not given); the fuel's weight rides in the tanks
  applyParts(fuelL) {
    const p = this.cfg.parts, a = this.cfg.addons || {}, pc = this.cfg.pcond || {}, G = this.G;
    this.eng = ENGINES[p.engine]; this.gb = GEARBOXES[p.gearbox]; this.tire = TIRES[p.tires];
    // the knob's gate for this gearbox, and its reverse gears (split ones on a splitter or range box)
    this.gate = gateOf(this.gb); this.revs = this.gate.revs || [this.gb.rev];
    const lift = LIFTS[p.lift], spr = SPRINGS[p.springs];
    this.addons = a; this.tuneP = TUNES[p.tune];
    this.r = G.r + (lift.dr || 0); this.lift = lift.lift; this.anchorY = G.anchorY - lift.lift;
    // where each axle hangs (a drawn truck sets them one by one, so the wheels rest where the picture has them)
    this.anchorYs = G.axles.map((_, i) => (G.anchorYs ? G.anchorYs[i] : G.anchorY) - lift.lift);
    this.clearance = G.clearance + (this.r - G.r) + lift.lift * 0.5;
    this.hz = G.hz.map(h => Math.max(2.5, h + spr.hz)); this.damp = Math.max(0.3, G.damp + spr.damp);
    this.up = G.up * spr.travel; this.down = G.down * spr.travel;
    this.brakeT = G.brakeT * BRAKES[p.brakes].k; this.radK = RADIATORS[p.radiator].k;
    this.hasCtis = p.ctis === 'ctis'; this.tank = G.tank + TANKS[p.tank].extra + addonFuel(a);   // jerry cans on the rack, the sliders' side tank
    const c = k => { const v = pc[k + ':' + p[k]]; return v === undefined ? 1 : clamp(v, 0, 1); };
    this.cond = { engine: c('engine'), gearbox: c('gearbox'), tires: c('tires'), springs: c('springs') };
    const cs = this.cond.springs; this.damp *= 0.65 + 0.35 * cs; this.hz = this.hz.map(h => h * (0.9 + 0.1 * cs));
    let m = G.mass, mx = G.mass * G.com[0], my = G.mass * G.com[1];
    const add = (mass, x, y) => { m += mass; mx += mass * x; my += mass * y; };
    if (this.eng.mass) add(this.eng.mass, G.engineAt[0], G.engineAt[1]);
    if (TANKS[p.tank].mass) add(TANKS[p.tank].mass, -0.3, -0.3);
    const fl = fuelL !== undefined ? clamp(fuelL, 0, this.tank) : this.tank;
    if (fl > 0) add(fl * FUEL_KG[this.eng.fuel], -0.3, -0.3);
    if (a.bullbar) add(ADDONS.bullbar.mass, G.bullbar[0], 0.3);
    if (a.lightbar) add(ADDONS.lightbar.mass, (G.roof[0] + G.roof[1]) / 2, G.roof[2]);
    if (a.stakes) add(ADDONS.stakes.mass, (G.bed.x0 + G.bed.x1) / 2, G.bed.y + 0.3);
    if (a.snorkel) add(ADDONS.snorkel.mass, G.snorkel[0], 1.4);
    if (a.cage) add(ADDONS.cage.mass, -0.9, 1.05);   // tubes over the cab and bed
    if (a.rack) add(ADDONS.rack.mass, -0.4, 2.0);    // the load up on top: the centre of gravity goes up
    if (a.sliders) add(ADDONS.sliders.mass, 0.55, -0.45);
    this.mass = m; this.com = [mx / m, my / m]; this.Icom = G.Icom * m / G.mass;
    this.wheelMass = G.wheelMass * Math.pow(this.r / G.r, 2);
    this.tmax = curveMax(this.eng.torque); this.pmax = peakPower(this.eng.torque);
    this.final = G.final; this.eff = G.eff;
    if (this.gb.type === 'tc') { const st = this.eng.stall; this.K = (st / RPM) / Math.sqrt(curveAt(this.eng.torque, st)); }
  }
  build(x, cargo, cargoLeft, kp) {
    const s = this.G, w = this.sim.world, c = this.sim.course, r = this.r, ay = this.anchorY;
    let ang, y, px = x;
    if (kp) {
      // a trailer: kingpin on the fifth wheel, axles on the ground; solve the pitch that puts them there
      const xa = s.axles.reduce((a, b) => a + b, 0) / s.axles.length, k = s.kingpin; ang = 0;
      for (let it = 0; it < 8; it++) {
        const ca = Math.cos(ang), sa = Math.sin(ang), ox = kp.x - (ca * k[0] - sa * k[1]), oy = kp.y - (sa * k[0] + ca * k[1]);
        const axx = ox + ca * xa - sa * ay, axy = oy + sa * xa + ca * ay;
        ang += (axy - (c.hAt(axx) + r + 0.04)) / Math.abs(xa - k[0]);
      }
      const ca = Math.cos(ang), sa = Math.sin(ang); px = kp.x - (ca * k[0] - sa * k[1]); y = kp.y - (sa * k[0] + ca * k[1]);
    } else {
      const ax0 = s.axles[0], axN = s.axles[s.axles.length - 1];
      ang = Math.atan2(c.hAt(x + ax0) - c.hAt(x + axN), ax0 - axN);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      y = -1e9;
      s.axles.forEach((ax, i) => { const ayi = this.anchorYs[i], wx = x + ca * ax - sa * ayi, need = c.hAt(wx) + r - (sa * ax + ca * ayi); y = Math.max(y, need); });
      y += 0.07;
    }
    const ch = w.createBody({ type: 'dynamic', position: V2(px, y), angle: ang });
    const fd = p => ({ density: 1, friction: 0.6, restitution: 0.05, filterGroupIndex: this.group, filterCategoryBits: CAT_TRUCK, filterMaskBits: CAT_GROUND | CAT_CARGO | CAT_TRUCK, userData: { k: 'chassis', p, tr: this } });
    for (const f of s.fixtures) ch.createFixture(shapeOf(f), fd(f[f.length - 1]));
    if (this.addons.stakes && s.gate) ch.createFixture(shapeOf(s.gate), fd('gate'));
    ch.setMassData({ mass: this.mass, center: V2(this.com[0], this.com[1]), I: this.Icom + this.mass * (this.com[0] * this.com[0] + this.com[1] * this.com[1]) });
    this.chassis = ch;
    const axis = ch.getWorldVector(V2(0, 1));
    this.wheels = s.axles.map((axx, i) => {
      const p = ch.getWorldPoint(V2(axx, this.anchorYs[i]));
      const wb = w.createBody({ type: 'dynamic', position: p });
      wb.createFixture(planck.Circle(r), { density: this.wheelMass / (Math.PI * r * r), friction: 0.9, restitution: 0, filterGroupIndex: this.group, filterCategoryBits: CAT_WHEEL, filterMaskBits: CAT_GROUND, userData: { k: 'wheel', i, tr: this } });
      const j = w.createJoint(planck.WheelJoint({ frequencyHz: this.hz[i], dampingRatio: this.damp, enableMotor: false }, ch, wb, p, axis));
      const mass = wb.getMass(), I0 = wb.getInertia();
      return { body: wb, joint: j, ax: axx, front: i === 0, touch: false, surf: S_SNOW, load: this.mass * G / s.axles.length, sink: 0, bc: 0, slip: 0, rollT: 0, omega: 0, vt: 0, vg: 0, bump: 0, mu: 0.4, trav: 0, mass, I0, Icur: I0, flat: false };
    });
    this.drivenAll = this.wheels; this.drivenRear = this.wheels.filter(q => !q.front); this.driven = this.drivenRear;
    this.buildCargo(cargo, cargoLeft);
  }
  buildCargo(type, left) {
    this.cargoType = type || null; this.items = [];
    if (!type || type === 'tow') return;
    const ch = this.chassis, w = this.sim.world, s = this.G, ang = ch.getAngle();
    const make = (lp, shape, mass, kind, brk, extra) => {
      const p = ch.getWorldPoint(lp);
      const b = w.createBody({ type: 'dynamic', position: p, angle: ang });
      b.createFixture(shape, { density: 1, friction: kind === 'drum' ? 0.5 : 0.55, restitution: kind === 'drum' ? 0.12 : 0.02, filterCategoryBits: CAT_CARGO, filterMaskBits: CAT_GROUND | CAT_TRUCK | CAT_CARGO, userData: { k: 'cargo' } });
      const md = { mass: 0, center: V2(0, 0), I: 0 }; b.getMassData(md);
      const k = mass / md.mass; b.setMassData({ mass, center: V2(0, 0), I: md.I * k });
      const j = w.createJoint(planck.WeldJoint({ frequencyHz: 0, dampingRatio: 0 }, ch, b, p));
      const it = Object.assign({ body: b, joint: j, mass, kind, brk, lost: false, stress: 0, k: this.items.length }, extra || {});
      this.items.push(it); return it;
    };
    const K = s.cargo && s.cargo[type]; if (!K) return;
    if (K.bulk) {
      // fuel, coal, gravel: one load that moves with the trailer (it can't fall off)
      const n = left !== undefined ? Math.min(left, K.units) : K.units, m2 = n * K.mass, md = { mass: 0, center: V2(0, 0), I: 0 }; ch.getMassData(md);
      const M = md.mass + m2, cx = (md.mass * md.center.x + m2 * K.at[0]) / M, cy = (md.mass * md.center.y + m2 * K.at[1]) / M;
      ch.setMassData({ mass: M, center: V2(cx, cy), I: md.I + m2 * (K.at[0] * K.at[0] + K.at[1] * K.at[1] + 7) });
      this.bulkUnits = n; this.bulkMass = m2; return;
    }
    const n = left !== undefined ? Math.min(left, K.slots.length) : K.slots.length;
    for (let k = 0; k < n; k++) {
      const [x, y] = K.slots[k], extra = { hw: K.hw, hh: K.hh };
      if (K.kind === 'logs') extra.logs = makeLogs(k);
      else if (K.kind === 'pulp') extra.ends = makeEnds(k, K.hw, K.hh);
      else if (K.kind === 'drum') extra.tone = k % 2;
      else if (K.kind === 'crate') extra.tone = hashf(k, 13);
      make(V2(x, y + 0.005), planck.Box(K.hw, K.hh), K.mass, K.kind, K.brk, extra);
    }
  }
  get x() { return this.chassis.getPosition().x; }
  get totalMass() { let m = this.mass + this.wheelMass * this.wheels.length + (this.bulkMass || 0); for (const it of this.items) if (!it.lost) m += it.mass; return m; }
  massEff() { return this.totalMass + (this.towing ? this.towing.totalMass : 0) + (this.semi ? this.semi.totalMass : 0); }
  // what is aboard right now, wherever it rides (bed, trailer, or bulk in a tank or box)
  loadCount() { if (this.semi) return this.semi.loadCount(); if (this.bulkUnits !== undefined) return this.bulkUnits; return this.itemsOnBed(); }
  loadAboard() { if (this.semi) return this.semi.loadAboard(); if (this.bulkUnits !== undefined) return this.bulkUnits; return this.itemsOn(); }
  rotMass(free) { let s = 0; for (const w of this.wheels) s += free ? w.I0 : w.Icur; return s / (this.r * this.r); }
  // what the truck is pushing against right now: grade, rolling resistance, air, deep snow, and whatever it tows
  resistance() {
    let F = this.massEff() * G * Math.sin(this.chassis.getAngle()) + this.bellyDrag + 0.5 * 1.25 * this.G.cd * this.G.area * this.vF * Math.abs(this.vF);
    for (const w of this.wheels) F += w.rollT / this.r;
    for (const o of [this.towing, this.semi]) if (o) { for (const w of o.wheels) F += w.rollT / o.r; F += o.bellyDrag; }
    return F;
  }
  itemsOn() { let n = 0; for (const it of this.items) if (!it.lost) n++; return n; }
  itemsOnBed() {
    const ch = this.chassis, b = this.G.bed; let n = 0;
    for (const it of this.items) { if (it.lost) continue; const lp = ch.getLocalPoint(it.body.getPosition()); if (lp.x > b.x0 - 0.3 && lp.x < b.x1 + 0.3 && lp.y > b.y - 0.1 && lp.y < b.y + 2.6) n++; }
    return n;
  }
  snapshot() {
    return { fuel: this.fuel, fuelUsed: this.fuelUsed, damage: this.damage, temp: this.temp, awd: this.awd, lights: this.lights,
      pressure: this.pressure, pTarget: this.pTarget, autoHold: this.autoHold, dist: this.dist, cargoLeft: this.bulkUnits !== undefined ? this.bulkUnits : this.itemsOn(), wear: this.wear, intake: this.intake };
  }
  destroy(debris) {
    const w = this.sim.world;
    for (const it of this.items) { if (it.joint) { w.destroyJoint(it.joint); it.joint = null; } if (it.lost && debris) debris.push(it); else w.destroyBody(it.body); }
    for (const wh of this.wheels) w.destroyBody(wh.body);
    w.destroyBody(this.chassis);
  }
  // ---------- gearbox ----------
  ratioFor(g) { if (!g) return 0; const b = g < 0 ? this.revs[Math.min(this.revs.length, -g) - 1] : this.gb.ratios[g - 1]; return b * this.final; }
  ratio() { return this.ratioFor(this.gear); }
  gearLabel(g) { g = g === undefined ? this.gear : g; if (g < 0) return revLabel(this.gate, Math.min(this.revs.length, -g) - 1); if (g === 0) return 'N'; return this.gb.labels ? this.gb.labels[g - 1] : String(g); }
  shiftTime() { return this.gb.shift * (1 + (1 - this.cond.gearbox) * 0.8); }
  // k: share of the full shift time (coming out of neutral the knob already took part of it)
  startShift(g, k) {
    if (g < 1 || g > this.gb.ratios.length) return false;
    if (this.shifting) { if (g !== this.nextGear) { this.nextGear = g; if (this.gb.type === 'tc') this.gear = g; this.shiftT = Math.max(this.shiftT, 0.15); } return true; }
    if (g === this.gear) return false;
    this.nextGear = g; this.shifting = true; this.shiftT = this.shiftTime() * (k || 1); this.shiftCd = this.gb.type === 'tc' ? 0.8 : 1.1;
    if (this.gb.type === 'tc') this.gear = g;
    const cg = this.cond.gearbox;
    if (this.gb.type !== 'tc' && cg < 0.45 && Math.random() < (0.45 - cg) * 0.9) { this.shiftT += 0.9; this.sim.emit('gear', 'Missed a gear! The gearbox is worn', 'warn'); this.sim.emit('sfx', 'grind'); }
    this.wear.gearbox += 0.00012 * (1 + this.thr);
    this.sim.emit('sfx', 'shift');
    return true;
  }
  endShift() { this.shifting = false; if (this.nextGear !== null && this.gb.type !== 'tc') { this.gear = this.nextGear; this.coup = 'slip'; } this.nextGear = null; }
  rpmIfGear(g) { return Math.abs(this.wf) * this.ratioFor(g) * RPM; }
  // A gear from the knob (negative: reverse gears, 0: neutral). Returns null when it goes in, otherwise why not:
  // 'over' when it would over-rev the engine. force puts it in anyway: the wheels spin the engine up and it is hurt.
  selectGear(g, force) {
    if (this.towed) return 'towed';
    if (!g) { this.toNeutral(); return null; }
    if (g === (this.shifting ? this.nextGear : this.gear)) return null;
    if (g < 0) {
      if (-g > this.revs.length) return 'none';
      if (this.vF > 1.2) return 'Stop before reverse';
      this.shifting = false; this.nextGear = null; this.gear = g; this.coup = 'slip'; this.sim.emit('sfx', 'shift'); return null;
    }
    if (g > this.gb.ratios.length) return 'none';
    if (this.vF < -1.2) return 'Stop before going forward';
    const rpm = Math.max(0, this.vF) / this.r * this.ratioFor(g) * RPM;
    if (rpm > this.eng.red * 1.05) {
      if (!force) return 'over';
      const ex = rpm / this.eng.red - 1, hit = clamp(0.02 + 0.3 * ex, 0.02, 0.35);
      this.wear.engine += hit;
      this.sim.emit('rev', 'Over-revved to ' + (Math.round(rpm / 50) * 50).toLocaleString('en-US') + ' rpm · engine −' + Math.round(hit * 100) + '%', 'bad'); this.sim.emit('sfx', 'grind');
    }
    if (this.gear <= 0 && Math.abs(this.vF) < 0.3 && !this.shifting) { this.gear = g; this.coup = 'slip'; this.sim.emit('sfx', 'shift'); if (this.gb.type === 'tc') this.nextGear = null; return null; }
    this.startShift(g, this.gear === 0 ? 0.6 : 1);
    return null;
  }
  toNeutral() { if (this.towed) return; this.shifting = false; this.nextGear = null; if (this.gear !== 0) this.sim.emit('sfx', 'shift'); this.gear = 0; }
  // AUTO: the truck shifts for itself; from neutral it takes the gear that suits the speed
  setAuto(on) {
    if (this.towed) return;
    this.mode = on ? 'A' : 'M';
    if (on && this.gear === 0 && this.vF > -0.8) { let g = 1; for (let k = this.gb.ratios.length; k >= 1; k--) if (this.rpmIfGear(k) >= this.eng.down[0] + 120) { g = k; break; } if (this.rpmIfGear(g) > this.eng.red * 0.95) g = 1; this.selectGear(g); }
  }
  cmdUp() { if (this.towed) return; this.mode = 'M'; const g = this.shifting ? this.nextGear : this.gear; if (g < 0) this.toNeutral(); else if (g < this.gb.ratios.length) this.selectGear(g + 1); }
  cmdDown(force) { if (this.towed) return 'towed'; this.mode = 'M'; const g = this.shifting ? this.nextGear : this.gear; if (g > 1) return this.selectGear(g - 1, force); if (g === 1) { this.toNeutral(); return null; } if (g === 0) return this.selectGear(-1); return null; }
  cmdGear(k) {
    if (this.towed) return;
    if (k === 'R') { const w = this.selectGear(-1); if (w) this.sim.emit('gear', w, 'warn'); }
    else if (k === 'N') this.toNeutral();
    else if (k === 'D') { if (this.vF < -1.2) { this.sim.emit('gear', 'Stop before going forward', 'warn'); return; } if (this.gear < 1) this.selectGear(1); this.mode = 'A'; }
  }
  cmdAwd() { if (this.def.awd === false) { this.awd = false; this.sim.emit('info', 'No front drive on this truck (' + this.def.drive + ')'); return; } this.awd = !this.awd; this.sim.emit('sfx', 'clunk'); this.sim.emit('info', this.awd ? 'Front axle engaged (' + this.def.drive + ')' : 'Rear drive only'); }
  cmdDiff() { this.diff = !this.diff; this.sim.emit('sfx', 'clunk'); this.sim.emit('info', this.diff ? 'Diff lock ON' : 'Diff lock off'); }
  cmdLights() { this.lights = !this.lights; this.sim.emit('sfx', 'click'); }
  setPressure(p) { this.pTarget = clamp(p, 0.5, 3.2); }
  updatePressure(dt) {
    const dp = this.pTarget - this.pressure;
    if (Math.abs(dp) < 0.01) { this.ctisDir = 0; return; }
    if (this.hasCtis) { this.ctisDir = sgn(dp); this.pressure += clamp(dp, -0.30 * dt, 0.09 * dt); }
    else if (Math.abs(this.vF) < 0.3) { this.ctisDir = sgn(dp); this.pressure += clamp(dp, -0.25 * dt, 0.05 * dt); }
    else this.ctisDir = 0;
  }
  // ---------- contacts ----------
  wheelContact(i, contact) {
    const w = this.wheels[i], c = this.sim.course, env = this.sim.env;
    // the ground the tyre actually touches: on a slope, a crest or an edge that is not the ground straight below the axle
    let x = w.body.getPosition().x;
    if (contact.getManifold().pointCount > 0) { const wm = contact.getWorldManifold(WM_SCRATCH); if (wm && wm.points[0]) x = wm.points[0].x; }
    w.cpx = x;
    const si = c.surfAt(x), env2 = env, pr = (3.2 - this.pressure) / 2.7, soft = c.softAt(x);
    const muOf = k => {
      const S = SURF[k]; let mu = S.mu;
      if (k === S_ICE) mu = 0.055 + 0.0026 * clamp(-env2.temp, 0, 32);
      if (env2.fresh && k !== S_ICE && k !== S_WOOD && k !== S_SLABS) mu -= 0.035 * env2.fresh;
      if ((k === S_WOOD || k === S_SLABS) && env2.fresh) mu -= 0.12 * env2.fresh;
      mu *= this.tire.grip[k];
      mu *= soft > 0.05 ? 1 + 0.30 * pr : 1 - 0.04 * pr;
      if (!this.diff && (!w.front || this.awd) && this.thr > 0.05) mu *= 1 - 0.30 * S.uneven;
      return mu;
    };
    let mu = muOf(si);
    // deep snow lies on a firm base: a tyre heavy enough to press through to it grips like packed snow (see postStep)
    if (si === S_DEEP && w.bc > 0) mu = lerp(mu, Math.max(mu, muOf(S_SNOW)), w.bc);
    if (w.flat) mu *= 0.75;
    mu *= 0.86 + 0.14 * this.cond.tires;
    mu = Math.max(0.03, mu);
    w.touch = true; w.surf = si; w.mu = mu;
    contact.setFriction(mu);
  }
  impact(part, imp) {
    let n = 0; const ni = imp.normalImpulses; for (let i = 0; i < ni.length; i++) n += ni[i];
    const dv = n / this.mass;
    if (part.p === 'cab' && dv > 0.08) this.cabHit = true;
    if (dv > 0.6) {
      const front = part.p === 'hood' || part.p === 'bumper' || part.p === 'nose' || part.p === 'head';
      let d = (dv - 0.6) * (part.p === 'cab' ? (this.addons.cage ? 4 : 10) : 4.5);   // a roll cage takes the blow off the cab
      if (front && this.addons.bullbar) d *= 0.35;
      this.damage = Math.min(100, this.damage + d); this.hitT = 0.35;
      if (d > 1.2 && this.isPlayer) this.sim.emit('hit', 'Hard hit! Damage ' + Math.round(this.damage) + '%', 'warn');
      if (this.isPlayer) this.sim.emit('sfx', 'thud');
    }
  }
  // ---------- per-step ----------
  updateHold(dt, thrIn, brkIn) {
    if (!this.autoHold || this.towed || !this.engineOn) { this.holding = false; return; }
    const slow = Math.abs(this.vF) < 0.3;
    if (!this.holding) {
      if (slow && brkIn > 0.1) this.holding = true;
      else if (thrIn < 0.04 && brkIn < 0.04 && this.coup !== 'lock' && ((this.gear > 0 && this.vF < -0.25) || (this.gear < 0 && this.vF > 0.25))) this.holding = true;
      else if (this.gear === 0 && slow && thrIn < 0.04 && brkIn < 0.04) this.holding = true;
    } else if (thrIn > 0.04 && this.gear !== 0) {
      this.holdT += dt;
      const dir = this.gear < 0 ? -1 : 1;
      const need = this.massEff() * G * Math.sin(this.chassis.getAngle()) * dir;
      const have = this.Tw / this.r;
      if (need <= 0 || have >= need * 0.9 || this.holdT > 1.4) { this.holding = false; this.holdT = 0; }
    } else this.holdT = 0;
  }
  engT(we, thr) {
    const E = this.eng, rpm = we * RPM;
    const full = curveAt(E.torque, rpm) * this.tq, fric = E.f0 + E.f1 * rpm;
    let T = thr * full - (1 - thr) * fric;
    if (rpm < E.idle) { const g = clamp((E.idle - rpm) / (E.idle * 0.12), 0, 1); T += g * (0.6 * full + fric) * (1 - thr * 0.5); }
    if (rpm > E.red) T = Math.min(T, -fric * 1.2);
    return T;
  }
  autoShift(wf) {
    if (this.gear < 1 || this.shifting || this.shiftCd > 0) return;
    const E = this.eng, GB = this.gb, N = GB.ratios.length, g = this.gear, thr = this.thr;
    const rpmFor = gi => wf * this.ratioFor(gi) * RPM;
    const cur = rpmFor(g);
    const tc = GB.type === 'tc';
    const up = lerp(E.up[0], E.up[1], thr), down = tc ? lerp(E.down[0] * 0.85, E.down[1] * 0.75, thr) : lerp(E.down[0], E.down[1], thr);
    let spin = 0; for (const w of this.driven) spin = Math.max(spin, Math.abs(w.vt - this.vF));
    const m = this.massEff() + this.rotMass(), mGap = this.massEff() + this.rotMass(true);
    const Fres = this.resistance();
    const curUp = GB.type === 'tc' ? Math.max(cur, this.rpm * 0.97) : cur;   // a slipping converter revs the engine above the output speed
    if (g < N && curUp > up && spin < 1.6 && this.vF > 0.4 && !(this.upBlock > 0 && curUp < E.red * 0.97)) {
      const gap = GB.type === 'tc' ? 0.05 : this.shiftTime();
      const vA = Math.max(0.05, this.vF - Math.max(0, Fres / mGap) * gap);
      const nr = rpmFor(g + 1) * vA / Math.max(0.05, this.vF);
      const Fn = curveAt(E.torque, nr) * this.tq * Math.max(thr, 0.05) * this.ratioFor(g + 1) * this.eff / this.r * (tc ? 1.3 : 1);
      // normally only shift up if the next gear can still pull; bouncing on the governor, take it once it at least holds speed
      const atLimit = cur >= E.red * 0.97 && thr > 0.5;
      if ((nr > down + 120 && (thr < 0.35 || Fn > Fres * 1.04 + m * 0.03)) || (atLimit && nr > E.down[0] + 150 && Fn > Fres * 1.02)) this.startShift(g + 1);
    } else if (g > 1) {
      const pr = rpmFor(g - 1);
      const lug = thr > 0.8 && this.acc < -0.1 && pr < E.red * 0.88;
      if ((cur < down && pr < E.red * 0.95) || lug) {
        let tg = g - 1; while (tg > 1 && cur < down * 0.7 && rpmFor(tg - 1) < (up + down) * 0.5) tg--;
        this.startShift(tg);
        if (thr > 0.6) this.upBlock = 2.5;
      }
    }
  }
  drive(dt, driven) {
    const E = this.eng, GB = this.gb, n = driven.length, idleW = E.idle / RPM;
    const dir = this.gear < 0 ? -1 : 1;
    let wf = 0; for (const w of driven) wf -= w.omega; wf = wf / n * dir;
    this.wf = wf;
    if (this.shiftCd > 0) this.shiftCd -= dt;
    if (this.upBlock > 0) this.upBlock -= dt;
    if (this.shifting) { this.shiftT -= dt; if (this.shiftT <= 0) this.endShift(); }
    if (this.mode === 'A' && this.engineOn && !this.towed) this.autoShift(wf);
    const R = this.ratio(), wt = wf * R, thr = this.thr;
    this.tq = this.tuneP.k * (0.72 + 0.28 * this.cond.engine) * this.derate * (1 - 0.15 * this.intake);
    let Tw = 0, Te = 0;
    if (!this.engineOn) { this.coup = 'open'; this.we = Math.max(0, this.we - this.we * Math.min(1, dt * 2.5)); }
    else if (this.gear === 0 || (this.shifting && GB.type !== 'tc')) {
      this.coup = 'open';
      if (this.shifting && this.nextGear) { const target = Math.max(idleW, wf * this.ratioFor(this.nextGear)); this.we += (target - this.we) * Math.min(1, dt * 10); }
      else { Te = this.engT(this.we, thr); this.we = Math.max(idleW * 0.6, this.we + Te / E.I * dt); }
    } else if (GB.type === 'tc' && this.coup !== 'lock') {
      // torque converter: multiplies torque while slipping, couples smoothly
      const we = Math.max(5, this.we), SR = wt / we;
      let Tp, Tt;
      if (SR < 1) { const f = Math.min(1, (1 - SR) / 0.06), q = we / this.K; Tp = q * q * f; Tt = Tp * (SR < 0.9 ? lerp(GB.stallTR, 1, SR / 0.9) : 1); }
      else { const f = Math.min(1, (SR - 1) / 0.1), q = Math.min(wt, we * 1.5) / this.K; Tp = -q * q * f * 0.5; Tt = Tp; }
      Te = this.engT(this.we, thr);
      this.we = Math.max(idleW * 0.5, this.we + (Te - Tp) / E.I * dt);
      if (this.shifting) Tt *= 0.6;
      Tw = Tt * R * this.eff;
      if (!this.shifting && this.gear >= 2 && SR > 0.93 && SR < 1.05 && wt > idleW * 1.4) { this.coup = 'lock'; this.we = wt; } else this.coup = 'tc';
    } else {
      // automated clutch (or converter lock-up)
      const rpmE = this.we * RPM;
      const e = thr > 0.02 ? clamp((rpmE - E.clutch[0] - thr * E.launch) / (E.clutch[1] - E.clutch[0]), 0, 1) : ((wt > idleW * 1.08 && this.brk < 0.3) ? 1 : 0);
      const cap = e * this.tmax * 1.6;
      if (this.coup === 'lock') {
        if (GB.type === 'tc') { if (wt < idleW * 1.25 || this.shifting || this.gear < 2) this.coup = 'tc'; }
        else if (wt < idleW * 0.86 || (wt < idleW * 1.05 && this.brk > 0.3 && thr < 0.05)) this.coup = 'slip';
      }
      if (this.coup === 'lock') { this.we = Math.max(0, wt); Te = this.engT(this.we, thr); Tw = Te * R * this.eff; }
      else if (this.coup === 'tc') { Te = this.engT(this.we, thr); }
      else {
        Te = this.engT(this.we, thr);
        const dw = this.we - wt;
        if (Math.abs(dw) < Math.max(4, this.we * 0.04) && cap > 0 && cap >= Math.abs(Te) * 0.9 && wt > idleW * 0.9) {
          this.coup = 'lock'; this.we = wt; Tw = Te * R * this.eff;            // synchronised: clutch closes
        } else {
          let Tc = sgn(dw) * cap;                                               // slipping: friction carries its full capacity
          const weNew = this.we + (Te - Tc) / E.I * dt;
          if ((dw > 0 && weNew < wt) || (dw < 0 && weNew > wt)) Tc = Te + dw * E.I / dt;   // don't let the engine fall through the wheel speed
          // nor fling spinning wheels past the engine: a slipping clutch can at most close the speed gap in one step.
          // (Matters for heavy drivelines: a big clutch on light, spinning wheels would otherwise overshoot and ring.
          // Wheels that grip carry the whole truck, so then there is nothing to limit.)
          let Iw = 0, spin = false; for (const w of driven) { Iw += w.Icur; if (Math.abs(w.slip) > 0.6) spin = true; }
          if (!spin) Iw += this.massEff() * this.r * this.r;
          Iw /= Math.max(1e-6, R * R * this.eff);
          const lim = Math.abs(dw) / dt / (1 / E.I + 1 / Math.max(1e-6, Iw));
          Tc = clamp(Tc, -Math.min(cap, lim), Math.min(cap, lim));
          this.we = Math.max(idleW * 0.5, this.we + (Te - Tc) / E.I * dt);
          Tw = Tc * R * this.eff;
        }
      }
    }
    if (Tw !== 0) { const sh = Tw / n; for (const w of driven) w.body.applyTorque(-sh * dir, true); this.chassis.applyTorque(Tw * dir, true); }
    this.Tw = Tw; this.Te = Te; this.rpm = this.we * RPM; this.power = Math.max(0, Te * this.we);
    // the engine's inertia is felt through a locked driveline (heavy, smooth crawling in low gears)
    const Iref = R > 0 ? (this.coup === 'lock' ? E.I * R * R / n : this.coup === 'tc' ? 0.35 * R * R / n : 0) : 0;
    for (const w of this.wheels) {
      const want = w.I0 + ((!w.front || this.awd) ? Iref : 0);
      if (Math.abs(want - w.Icur) > w.I0 * 0.02) { w.body.setMassData({ mass: w.mass, center: V2(0, 0), I: want }); w.Icur = want; }
    }
  }
  preStep(dt, inp, env) {
    const ch = this.chassis;
    const thrIn = this.engineOn ? clamp(inp.throttle, 0, 1) : 0;
    const brkIn = Math.max(clamp(inp.brake, 0, 1), this.extBrake || 0);
    this.thr += (thrIn - this.thr) * Math.min(1, dt * 10);
    this.brk += (brkIn - this.brk) * Math.min(1, dt * 14);
    this.thrIn = thrIn; this.brkIn = brkIn;
    this.updatePressure(dt);
    const v = ch.getLinearVelocity(), fwd = ch.getWorldVector(V2(1, 0));
    const vF = v.x * fwd.x + v.y * fwd.y;
    this.acc = lerp(this.acc, (vF - this.vF) / dt, 1 - Math.exp(-dt / 0.3)); this.vF = vF; this.speed = Math.hypot(v.x, v.y);
    for (const w of this.wheels) { w.omega = w.body.getAngularVelocity(); w.vt = -w.omega * this.r; }
    const driven = this.awd ? this.drivenAll : this.drivenRear; this.driven = driven;
    this.updateHold(dt, thrIn, brkIn);
    this.drive(dt, driven);
    // brakes and rolling resistance act through the axle (joint motor held at zero speed), so they can hold the truck still on a slope
    const bIn = this.holding ? 1 : this.brk;
    for (const w of this.wheels) {
      const Tb = bIn * this.brakeT + (w.touch ? w.rollT : 0);
      if (Tb > 1) { if (!w.motorOn) { w.joint.enableMotor(true); w.joint.setMotorSpeed(0); w.motorOn = true; } w.joint.setMaxMotorTorque(Tb); }
      else if (w.motorOn) { w.joint.enableMotor(false); w.motorOn = false; }
    }
    const rel = vF - (env.wind || 0) * fwd.x;
    const Fd = 0.5 * 1.25 * this.G.cd * this.G.area * rel * Math.abs(rel);
    ch.applyForceToCenter(V2(-fwd.x * Fd, -fwd.y * Fd), true);
    if (this.sinkAvg > this.clearance && Math.abs(vF) > 0.03) {
      let F = (this.sinkAvg - this.clearance) * 95000;
      F = Math.min(F, this.totalMass * Math.abs(vF) / dt * 0.4);
      ch.applyForceToCenter(V2(-fwd.x * F * sgn(vF), -fwd.y * F * sgn(vF)), true);
      this.bellyDrag = F;
    } else this.bellyDrag = 0;
    const axW = ch.getWorldVector(V2(0, 1));
    for (const w of this.wheels) {
      const t = w.joint.getJointTranslation();
      const pw = w.body.getPosition(), vw = w.body.getLinearVelocity(), va = ch.getLinearVelocityFromWorldPoint(pw);
      const sp = (vw.x - va.x) * axW.x + (vw.y - va.y) * axW.y;
      w.trav = t;
      let F = 0;
      if (t > this.up) F = -((t - this.up) * 420000 + Math.max(0, sp) * 26000);
      else if (t < -this.down) F = (-this.down - t) * 420000 + Math.max(0, -sp) * 26000;
      w.bump = F; w.bumpSp = F ? Math.abs(sp) : 0; w.spd = sp;
      if (F) { w.body.applyForceToCenter(V2(axW.x * F, axW.y * F), true); ch.applyForce(V2(-axW.x * F, -axW.y * F), pw, true); }
      w.touch = false;
    }
  }
  postStep(dt) {
    const s = this.G, ch = this.chassis, sim = this.sim, env = sim.env, inv = 1 / dt;
    if (this.diff) { const d = this.driven; let sum = 0; for (const w of d) sum += w.body.getAngularVelocity(); const avg = sum / d.length; for (const w of d) w.body.setAngularVelocity(avg); }
    if (this.coup === 'lock') { const dir = this.gear < 0 ? -1 : 1; let wf = 0; for (const w of this.driven) wf -= w.body.getAngularVelocity(); wf = wf / this.driven.length * dir; this.we = Math.max(0, wf * this.ratio()); this.rpm = this.we * RPM; }
    const axW = ch.getWorldVector(V2(0, 1)), fwd = ch.getWorldVector(V2(1, 0));
    let sinkSum = 0, nt = 0, hardGrip = 0, nd = 0, spin = 0, chainHard = 0;
    for (const w of this.wheels) {
      const rf = w.joint.getReactionForce(inv);
      const spring = Math.abs(rf.x * axW.x + rf.y * axW.y) + Math.abs(w.bump || 0);
      w.load = lerp(w.load, spring + this.wheelMass * G, 0.25);
      const vb = w.body.getLinearVelocity(), vg = vb.x * fwd.x + vb.y * fwd.y;
      w.vt = -w.body.getAngularVelocity() * this.r; w.slip = w.vt - vg; w.vg = vg;
      if (w.touch) {
        const S = SURF[w.surf], x = w.cpx !== undefined ? w.cpx : w.body.getPosition().x;
        let soft = sim.course.softAt(x);
        if (env.extraSnow && w.surf !== S_ICE) soft += env.extraSnow * (w.surf === S_WOOD || w.surf === S_SLABS || w.surf === S_ROCK ? 0.25 : 1);
        const pr = (3.2 - this.pressure) / 2.7, press = w.flat ? 0.8 : this.pressure;
        const sf = (0.38 + 0.62 * Math.pow(press / 3.2, 0.8)) * Math.pow(Math.max(0.2, w.load / 34000), 0.35) * Math.pow(G_R0 / this.r, 0.5);
        // loose snow lies on a firm base: a tyre sinks at most down to it (the most hidden roads have none within reach).
        // One that would sink further presses through and grips on the base; aired down, it floats on top instead.
        const want = soft * sf, depth = sim.course.botAt(x) ? 1.2 : 0.1 + 0.4 * soft;
        w.sink = lerp(w.sink, Math.min(want, depth), 0.2);
        w.bc = clamp((want - depth) / (0.6 * depth), 0, 1);
        const crr = S.roll * this.tire.roll * (soft > 0.05 ? 1 : 1 + 0.9 * pr) * (w.flat ? 1.8 : 1) + 0.12 * w.sink * (1 - 0.25 * w.bc);
        w.rollT = crr * w.load * this.r;
        sinkSum += w.sink; nt++;
        if (!w.front || this.awd) { nd++; if (S.mu > 0.5 && soft < 0.05) hardGrip++; }
        if (w.surf === S_ROCK || w.surf === S_SLABS) chainHard++;
        spin += Math.max(0, Math.abs(w.slip) - 1.5);
        if (!w.flat && this.cond.tires < 0.25 && w.surf === S_ROCK && Math.abs(w.vt) > 3 && Math.random() < dt * (0.25 - this.cond.tires) * 0.4) { w.flat = true; if (this.isPlayer) sim.emit('flat', 'Puncture! The tires are worn out', 'bad'); }
      } else { w.sink *= 0.92; w.rollT = 0; w.bc = 0; }
      if (Math.abs(w.bump) > 1e5) this.wear.springs += Math.abs(w.bump) / 1e5 * dt * 0.0005;
      // a bumpstop slammed home (a rock or a pothole taken too fast): that hurts the truck.
      // What damages is how fast the suspension is driven into its stops, not the force alone.
      const bh = Math.abs(w.bump), spd = w.bumpSp || 0;
      if (this.bottomT <= 0 && !this.isTrailer && (spd > 2.0 || bh > 1.7e5)) {
        const d = Math.min(6, Math.max(spd > 2.0 ? (spd - 2.0) * 1.9 : 0, bh > 1.7e5 ? (bh / 1e5 - 1.7) * 2.0 : 0));
        if (d > 0.4) {
          this.bottomT = 0.5; this.damage = Math.min(100, this.damage + d); this.hitT = 0.35;
          if (this.isPlayer) { sim.emit('hit', 'Bottomed out on the ' + (w.surf === S_ROCK ? 'rocks' : 'bumps') + '! Damage ' + Math.round(this.damage) + '%', 'warn'); sim.emit('sfx', 'thud'); }
          // a rock strike at speed can cut a tire, a pumped-up one more easily
          if (!w.flat && w.surf === S_ROCK && Math.abs(this.vF) > 5 && Math.random() < (this.pressure > 2.2 ? 0.2 : 0.1)) { w.flat = true; if (this.isPlayer) sim.emit('flat', 'Puncture! The tire hit a rock', 'bad'); }
        }
      }
      // a pothole or a washboard dip taken fast: the wheel slams up through its travel without reaching
      // the stops; tires and springs pay even when the body is spared (the sharp lip above is what really breaks things)
      const jolt = w.spd || 0;
      if (w.touch && !w.bump && jolt > 4.0 && this.joltT <= 0 && !this.isTrailer) {
        this.joltT = 0.5;
        this.wear.springs += (jolt - 4.0) * 0.0025; this.wear.tires += (jolt - 4.0) * 0.0015;
        if (this.isPlayer) { sim.emit('hit', 'A pothole at speed! Tires and springs suffer', 'warn'); sim.emit('sfx', 'thud'); }
        if (!w.flat && this.cond.tires < 0.5 && Math.random() < 0.08) { w.flat = true; if (this.isPlayer) sim.emit('flat', 'Puncture in a pothole! The tires are tired', 'bad'); }
      }
    }
    this.sinkAvg = nt ? sinkSum / nt : 0; this.onGround = nt;
    // chains, straps and cargo
    for (const it of this.items) {
      if (it.lost) continue;
      if (it.joint) {
        const f = it.joint.getReactionForce(inv).length();
        it.stress = lerp(it.stress, f / (it.mass * G), 0.15);
        if (f > it.mass * G * it.brk) { sim.world.destroyJoint(it.joint); it.joint = null; if (this.reports) { sim.emit('chain', it.kind === 'drum' || it.kind === 'crate' ? 'A strap snapped! The load is loose' : 'A chain snapped!', 'bad'); sim.emit('sfx', 'snap'); } }
      }
      const lp = ch.getLocalPoint(it.body.getPosition()), b = s.bed;
      if (lp.x < b.x0 - 1.6 || lp.x > b.x1 + 2.0 || lp.y < b.y - 1.0 || lp.y > b.y + 4.5) {
        it.lost = true; if (it.joint) { sim.world.destroyJoint(it.joint); it.joint = null; }
        if (this.reports) sim.emit('lost', { drum: 'A drum fell off the truck!', pulp: 'Pulpwood fell off the truck!', crate: 'A crate fell off the truck!', planks: 'A pack of lumber fell off!' }[it.kind] || 'Logs fell off the truck!', 'bad');
      }
    }
    if (!this.engineOn) { this.temp += (env.temp - this.temp) * 0.0012 * dt; this.dist += Math.abs(this.vF) * dt; return; }
    // fuel and temperature
    if (this.fuel > 0) {
      const lph = (this.eng.fuel === 'gas' ? 3.0 : 1.8) + this.power / 1000 * this.eng.lpk * this.tuneP.fuel * (this.awd ? 1.04 : 1);
      const used = lph / 3600 * dt * FUEL_SCALE;
      this.fuel = Math.max(0, this.fuel - used); this.fuelUsed += used;
      if (this.fuel <= 0) { this.engineOn = false; sim.emit('fuel', 'Out of fuel!', 'bad'); }
      else if (this.fuel < Math.max(15, this.tank * 0.12) && !this.warned.fuel) { this.warned.fuel = 1; sim.emit('fuel', 'Fuel low: ' + Math.round(this.fuel) + ' L left', 'warn'); }
    }
    const heat = 0.9 * (this.power / this.pmax) * this.tuneP.heat + 0.06;
    const cool = this.temp > 82 ? (this.temp - 82) * (0.05 + 0.004 * Math.abs(this.vF)) * this.radK : 0;
    this.temp += (heat - cool - (this.temp - env.temp) * 0.0012) * dt;
    this.derate = this.temp > 104 ? clamp(1 - (this.temp - 104) / 14, 0.4, 1) : 1;
    if (this.temp > 104 && !this.warned.hot) { this.warned.hot = 1; sim.emit('temp', 'Engine overheating!', 'bad'); }
    // snow in the air filter
    if (!this.addons.snorkel && (env.part || 0) > 0.3) {
      this.intake = Math.min(1, this.intake + dt * env.part * 0.0035);
      if (this.intake > 0.35 && !this.warned.intake) { this.warned.intake = 1; sim.emit('intake', 'Snow is clogging the air filter. Power down', 'warn'); }
    } else this.intake = Math.max(0, this.intake - dt * 0.01);
    // wear
    const rf = this.rpm / this.eng.red;
    this.wear.engine += dt * (rf > 0.92 ? 0.00022 : 0.000018 * this.thr) + (this.temp > 104 ? dt * 0.0011 : 0) + (this.intake > 0.5 ? dt * 0.00008 : 0);
    this.wear.tires += (Math.abs(this.vF) * dt * 0.0000035 + spin * dt * 0.00012) * this.tire.wear;
    if (this.coup === 'slip' && this.thr > 0.6) this.wear.gearbox += dt * 0.00004;
    // abuse warnings
    const fast = Math.abs(this.vF) > 8;
    if ((this.diff || this.awd) && fast && nd && hardGrip === nd) {
      this.windup += dt;
      if (this.windup > 2.5 && !this.warned.windup) { this.warned.windup = 1; sim.emit('windup', 'Driveline binding on hard ground. Unlock diff/AWD', 'warn'); }
      if (this.windup > 2.5) { this.damage = Math.min(100, this.damage + dt * 0.2); this.wear.gearbox += dt * 0.0002; }
    } else this.windup = Math.max(0, this.windup - dt);
    if (this.pressure < 1.3 && Math.abs(this.vF) > 11) {
      this.tireHeat += dt;
      if (this.tireHeat > 2 && !this.warned.tires) { this.warned.tires = 1; sim.emit('tires', 'Tires overheating. Inflate above 1.3 bar', 'warn'); }
      if (this.tireHeat > 4) this.wear.tires += dt * 0.0012;
    } else this.tireHeat = Math.max(0, this.tireHeat - dt);
    // chains rattle to pieces only on hard bare ground (rock, concrete); on snow and ice they last at any speed
    if (this.tire.maxKmh && chainHard && Math.abs(this.vF) * 3.6 > this.tire.maxKmh) {
      this.chainT += dt; this.wear.tires += dt * 0.0015;
      if (this.chainT > 1.5 && !this.warned.chains) { this.warned.chains = 1; sim.emit('chains', 'Too fast on chains on hard ground! Keep under ' + this.tire.maxKmh + ' km/h', 'warn'); }
    } else this.chainT = 0;
    if (this.rpm > this.eng.red * 1.12 && this.gear !== 0) {
      this.overRevT += dt; if (this.overRevT > 0.6) { this.damage = Math.min(100, this.damage + dt * 1.2); this.wear.engine += dt * 0.002; if (!this.warned.rev) { this.warned.rev = 1; sim.emit('rev', 'Over-revving! Shift up', 'bad'); } }
    } else { this.overRevT = 0; if (this.rpm < this.eng.red) this.warned.rev = 0; }
    // crash / stuck
    const up = Math.cos(ch.getAngle());
    if (up < 0.05 || this.cabHit) { this.crashT += dt; if (this.crashT > 1.2 && !this.crashed) { this.crashed = true; sim.emit('crash', 'Rolled over! Menu: tow to the closest place', 'bad'); } }
    else this.crashT = 0;
    this.cabHit = false;
    if (this.thrIn > 0.6 && Math.abs(this.vF) < 0.3) { this.stuckT += dt; if (this.stuckT > 7) { this.stuckT = -20; sim.emit('stuck', 'Stuck? Try AWD, diff lock, a lower gear or lower tire pressure', 'warn'); } }
    else if (this.stuckT > 0) this.stuckT = 0; else this.stuckT = Math.min(0, this.stuckT + dt);
    if (this.hitT > 0) this.hitT -= dt;
    if (this.bottomT > 0) this.bottomT -= dt;
    if (this.joltT > 0) this.joltT -= dt;
    this.dist += Math.abs(this.vF) * dt;
  }
}
