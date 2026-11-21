// Headless physics checks: node test/sim_node.js <scenario> [args]
const fs = require('fs'), path = require('path'), vm = require('vm');
const planck = require('planck');
const ctx = { planck, console, Math, performance: { now: () => Date.now() }, localStorage: { getItem() { return null; }, setItem() {} }, process };
vm.createContext(ctx);
for (const f of ['00_util.js', '05_data.js', '10_course.js', '11_world.js', '12_economy.js', '15_geom.js', '20_physics.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename: f });
vm.runInContext(`
var fmt = (n, d) => (n).toFixed(d === undefined ? 1 : d);
var ROUTES = { pass: ['e3'], river: ['e4', 'e5', 'e6'], zimnik: ['e7'], north: ['e15', 'e17'], ice: ['e14', 'e18', 'e5', 'e6'], forest: ['e14', 'e18', 'e25'] };
// a trip from start to dest; prefer = road ids to take where there is a choice (else the shortest)
var makeTrip = function (start, dest, truck, parts, cargo, env, prefer) {
  const T = new Trip(start, { dest, mode: 'job', found: () => true });
  const s = new Sim(T.c, Object.assign({ temp: -18, wind: 0, fresh: 0, extraSnow: 0, part: 0 }, env || {}));
  const cfg = stockCfg(truck); Object.assign(cfg.parts, parts || {});
  const t = s.addTruck(TRUCKS[truck], cfg, T.spawnX, { player: true, cargo: truck === 'skt' ? null : cargo, state: process.env.FUEL ? { fuel: +process.env.FUEL } : undefined });
  if (truck === 'skt' && cargo) s.attachTrailer(t, TRAILER_FOR[cargo], cargo);
  s.trip = T; s.prefer = prefer || [];
  return s;
};
var makeSim = function (branch, truck, parts, cargo, env) { return makeTrip('camp', 'mill', truck, parts, cargo, env, ROUTES[branch] || []); };
var decide = function (s) {
  const T = s.trip, p = T.pending; if (!p || s.truck.x < p.auto) return;
  const o = p.opts.find(q => s.prefer.includes(q.edge)) || p.opts[0]; T.choose(o.edge);
};
// simple driver: autopilot that uses AWD/diff/low/pressure like a careful player
var autopilot = function (s, opts) {
  opts = opts || {};
  const t = s.truck, dt = 1 / 120, verbose = opts.verbose;
  let lastLog = 0, maxX = 0, stuck = 0, shifts = 0, lastGear = t.gear, minV = 99, slipT = 0;
  for (let i = 0; i < 120 * 1500; i++) {
    if (s.trip) decide(s);
    const z = s.trip && s.trip.done ? s.course.zones[s.course.zones.length - 1] : null, goal = z ? z.x0 + 15 : 1e9;
    const x = t.x, sl = s.course.slopeAt(x + 3);
    const steep = s.course.slopeAt(x + 8) > 0.15 || sl > 0.15;
    if (steep && !t.awd && t.def.awd !== false) t.awd = true;
    if (steep && !t.diff) t.diff = true;
    if (!steep && sl < 0.05 && t.diff && x - (t._ls || 0) > 60) { t.diff = false; }
    if (!steep && sl < 0.05 && t.awd && x - (t._ls || 0) > 60 && s.course.softAt(x + 4) < 0.15) { t.awd = false; }
    if (steep) t._ls = x;
    t.setPressure(s.course.softAt(x + 4) > 0.2 ? 1.0 : 2.8);
    let thr = 1, brk = 0;
    const spin = Math.max(...t.wheels.map(w => Math.abs(w.slip)));
    if (spin > 0.8) thr = 0.55;
    if (spin > 1.5 && Math.abs(t.vF) < 0.5 && stuck > 2 && !t.diff) { t.diff = true; t._ls = x; } // dug in: lock up
    const ahead = s.course.slopeAt(x + 6);
    if ((ahead < -0.08 && t.vF > 5.5) || (ahead < -0.15 && t.vF > 3.5)) { thr = 0; brk = 0.55; }
    if (s.course.surfAt(x) === S_ICE && t.vF > 8) thr = 0;
    if (t.vF * 3.6 > (opts.vmax || 50)) thr = 0.25;
    if (x > goal) { thr = 0; brk = 1; }
    s.step(dt, { throttle: thr, brake: brk });
    if (t.gear !== lastGear) { shifts++; lastGear = t.gear; }
    if (opts.dmg && t.damage - (t._ld || 0) > 0.5) { console.log('  damage', fmt(t.damage), 'at x', fmt(t.x, 0), 'kmh', fmt(t.vF * 3.6), 'surf', SURF[t.wheels[0].surf].id); t._ld = t.damage; }
    if (t.x > maxX + 0.5) { maxX = t.x; stuck = 0; } else stuck += dt;
    if (verbose && s.time - lastLog >= (opts.every || 5)) { lastLog = s.time; console.log('t', fmt(s.time, 0), 'x', fmt(t.x, 0), 'kmh', fmt(t.vF * 3.6), 'g', t.gearLabel(), t.coup, 'rpm', fmt(t.rpm, 0), 'slope', fmt(sl * 100, 0) + '%', 'surf', SURF[t.wheels[t.wheels.length - 1].surf].id, 'slip', t.wheels.map(w => fmt(w.slip, 1)).join(','), 'p', fmt(t.pressure, 1), 'T', fmt(t.temp, 0), 'items', t.loadAboard()); }
    if (stuck > 30) { console.log('STUCK at', fmt(t.x, 0), 'surf', SURF[t.wheels[0].surf].id, 'slope', fmt(sl * 100, 0)); break; }
    if (t.x > goal && Math.abs(t.vF) < 0.3) { console.log('ARRIVED', s.trip ? s.trip.c.legs.filter(l => l.kind === 'edge').map(l => l.edge).join('>') + ' ' + (t.x / 1000).toFixed(2) + 'km' : '', fmt(s.time, 0) + 's', 'fuel', fmt(t.fuelUsed), 'items', t.loadAboard() + (t.semi ? ' (trailer)' : '/' + t.items.length), 'dmg', fmt(t.damage), 'shifts', shifts, 'maxT', fmt(t.temp, 0), 'wear', JSON.stringify(Object.fromEntries(Object.entries(t.wear).map(([k, v]) => [k, +(v * 100).toFixed(2)])))); break; }
  }
  const ev = s.events.filter(e => e.type !== 'sfx').map(e => e.type + ':' + e.msg);
  if (ev.length) console.log('events', ev.slice(0, 12).join(' | '));
};
`, ctx);
const run = code => vm.runInContext(code, ctx);
const scen = process.argv[2] || 'all';
if (scen === 'route') {
  const [br, truck, cargo, parts, flags] = process.argv.slice(3);
  run(`autopilot(makeSim('${br}', '${truck}', ${parts || '{}'}, ${cargo === 'none' ? 'null' : "'" + cargo + "'"}), ${flags || '{}'})`);
} else if (scen === 'trip') {
  // node test/sim_node.js trip camp zar sk logs "{}" "e7,e6" "{verbose:1}"
  const [a, b, truck, cargo, parts, pref, flags] = process.argv.slice(3);
  run(`autopilot(makeTrip('${a}', '${b}', '${truck}', ${parts || '{}'}, ${cargo === 'none' ? 'null' : "'" + cargo + "'"}, null, ${JSON.stringify((pref || '').split(',').filter(Boolean))}), ${flags || '{}'})`);
} else if (scen === 'wall') {
  // drive into the closed end of a yard at speed: the truck must stop at the wall
  const [truck, kmh] = process.argv.slice(3);
  run(`
  const s = makeTrip('camp', 'mill', '${truck}', {}, null, null, ['e3']);
  const T = s.trip; while (T.pending) T.choose(T.pending.opts[0].edge);
  const z = s.course.zones[s.course.zones.length - 1], wall = s.course.solids[s.course.solids.length - 1];
  s.respawn(s.truck, z.x0 - 10); const tr = s.truck; let maxX = 0;
  for (let i = 0; i < 120 * 30; i++) { s.step(1 / 120, { throttle: tr.vF * 3.6 < ${kmh || 30} ? 1 : 0, brake: 0 }); maxX = Math.max(maxX, tr.x); }
  console.log('wall at', fmt(wall.x0), 'truck front reached', fmt(maxX + tr.G.hook[0]), 'damage', fmt(tr.damage), 'v', fmt(tr.vF * 3.6));
  `);
} else if (scen === 'hazards') {
  // every road has potholes; rough roads have boulders and hard stretches; a boulder taken fast hurts, slowly not
  run(`
  let noHoles = [];
  for (const id of Object.keys(EDGES)) {
    const hz = edgePiece(id).haz || {};
    if (!hz.holes) noHoles.push(id);
    console.log(id, EDGES[id].name, JSON.stringify(hz));
  }
  console.log(noHoles.length ? 'FAIL no potholes: ' + noHoles.join(',') : 'ok: every road has potholes');
  for (const vmax of [3.5, 12]) {
    const c = new Course(9); c.X0 = 0; c.start(0);
    c.sec(140, 0, S_GRAVEL, { amp: 0, rough: 0, shape: 'l', bumps: [[90, 0.26, 0.7]] });
    const s = new Sim(c, { temp: -18, wind: 0, fresh: 0, extraSnow: 0, part: 0 });
    const cfg = stockCfg('cc'); const t = s.addTruck(TRUCKS.cc, cfg, 10, { player: true, cargo: null });
    let mb = 0, mbs = 0; for (let i = 0; i < 120 * 60 && t.x < 130; i++) { s.step(1 / 120, { throttle: t.vF < vmax ? 1 : 0, brake: 0 }); for (const w of t.wheels) { mb = Math.max(mb, Math.abs(w.bump)); mbs = Math.max(mbs, w.bumpSp || 0); } }
    console.log('rock at', vmax, 'm/s: hit at', (t.vF * 1).toFixed(1), 'm/s, damage', t.damage.toFixed(1), 'maxBump', (mb / 1e5).toFixed(2), 'maxSp', mbs.toFixed(2), vmax > 8 ? (t.damage > 0.3 ? 'ok: hurt' : 'FAIL no damage') : (t.damage < 0.3 ? 'ok: unharmed' : 'FAIL hurt at crawl'));
  }
  for (const vmax of [3.5, 12]) {
    const c = new Course(9); c.X0 = 0; c.start(0);
    c.sec(140, 0, S_GRAVEL, { amp: 0, rough: 0, shape: 'l' });
    // a game-style pothole at x = 90: gentle roll-in, sharp lip out, broken edge past it
    for (let q = 0; q < c.n; q++) { let d = (q * DX - 90) / 1.2; if (d > -1 && d < 0.55) { if (d > 0) d = Math.min(1, d * 1.8); c.y[q] -= 0.24 * 0.5 * (1 + Math.cos(Math.PI * d)); } const dl = (q * DX - 90.84) / 0.28; if (Math.abs(dl) < 1) c.y[q] += 0.10 * 0.5 * (1 + Math.cos(Math.PI * dl)); }
    const s = new Sim(c, { temp: -18, wind: 0, fresh: 0, extraSnow: 0, part: 0 });
    const cfg = stockCfg('cc'); const t = s.addTruck(TRUCKS.cc, cfg, 10, { player: true, cargo: null });
    let mb = 0, mbs = 0, mt = 0, msd = 0; for (let i = 0; i < 120 * 60 && t.x < 130; i++) { s.step(1 / 120, { throttle: t.vF < vmax ? 1 : 0, brake: 0 }); for (const w of t.wheels) { mb = Math.max(mb, Math.abs(w.bump)); mbs = Math.max(mbs, w.bumpSp || 0); mt = Math.max(mt, Math.abs(w.trav)); msd = Math.max(msd, w.spd || 0); } }
    const hurt = t.damage + t.wear.springs * 100 + t.wear.tires * 100;
    console.log('pothole at', vmax, 'm/s: damage', t.damage.toFixed(1), 'springWear', (t.wear.springs * 100).toFixed(2), 'maxSpd', msd.toFixed(2), vmax > 8 ? (hurt > 0.1 ? 'ok: hurt' : 'FAIL no damage') : (hurt < 0.1 ? 'ok: unharmed' : 'FAIL hurt at crawl'));
    if (vmax > 8) { let prof = []; for (let q = Math.round(86 / DX); q <= Math.round(94 / DX); q++) prof.push((q * DX).toFixed(1) + ':' + c.y[q].toFixed(2)); console.log('  profile', prof.join(' ')); }
  }
  `);
} else if (scen === 'launch') {
  // standing start on a steep grade: does the clutch bite smoothly, does the auto box hold the gear?
  const [truck, parts, low] = process.argv.slice(3); const lowOn = low === '1'; const tag = (truck + ' ' + (parts || '') + ' low=' + (lowOn ? 1 : 0)).replace(/'/g, '');
  run(`
  const s = makeSim('pass', '${truck}', ${parts || '{}'}, '${truck === 'cc' ? 'pulp' : 'logs'}');
  const dt = 1/120, T = s.trip;
  while (T.pending) { const p = T.pending; T.choose((p.opts.find(q => s.prefer.includes(q.edge)) || p.opts[0]).edge); }
  // put the truck on the first 26% section of the pass
  const leg = s.course.legs.find(l => l.edge === 'e3');
  s.respawn(s.truck, leg.x0 + 155); const tr = s.truck; tr.awd = tr.def.awd !== false; tr.diff = true;
  for (let i = 0; i < 240; i++) s.step(dt, { throttle: 0, brake: 1 });
  let log = [], shifts = 0, lg = tr.gear, x0 = tr.x;
  for (let i = 0; i < 120 * 25; i++) { s.step(dt, { throttle: 1, brake: 0 }); if (tr.gear !== lg) { shifts++; lg = tr.gear; } if (i % 120 === 0) log.push(fmt(tr.vF * 3.6) + 'km/h ' + tr.gearLabel() + ' ' + fmt(tr.rpm, 0) + 'rpm ' + tr.coup); }
  console.log('${tag}: climbed', fmt(tr.x - x0), 'm in 25s, shifts', shifts);
  console.log('  ' + log.join(' | '));
  `);
}
