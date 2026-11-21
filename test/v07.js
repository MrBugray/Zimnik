// 0.7 checks in a browser: the gear knob (both looks, both Skinnerd layouts, split reverse gears, the double push to
// force a downshift), the pause menu (leave, tow, fuel truck, abandon), trucks left on the roads and fetched with
// another truck, deliveries on the district clock (no deadlines: the clock moves time, weather and pay), random weather, the drive map.
// node test/v07.js   (pictures go to $SHOTS or the scratchpad)
const puppeteer = require('puppeteer-core'), path = require('path'), fs = require('fs');
const OUT = process.env.SHOTS || '/tmp/claude-0/-home-claude/936babd9-14ae-5cd0-b1bf-6401ea6ac088/scratchpad/shots07';
const PROFILE = OUT + '/.chrome';
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra !== undefined ? ' · ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); };
(async () => {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader'], userDataDir: PROFILE });
  const p = await b.newPage();
  await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
  const ev = (f, a) => p.evaluate(f, a);
  const shot = n => p.screenshot({ path: OUT + '/' + n + '.png' });
  const cdp = await p.target().createCDPSession();
  const box = sel => ev(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: q[2] === undefined ? i : q[2] })) });
  const tap = async sel => { const r = await box(sel); if (!r) { console.log('MISSING', sel); return false; } await touch('touchStart', [[r[0], r[1]]]); await touch('touchEnd', []); await sleep(180); return true; };
  // wait until the truck stands still (or give up after a while)
  const settle = async () => { for (let i = 0; i < 40; i++) { await sleep(150); if (await ev(() => Math.abs(__game.truck.vF) < 0.3)) break; } };
  await p.goto(url); await ev(() => localStorage.clear()); await p.reload(); await sleep(1200);
  await ev(() => { const G = __game; G.cash = 50000; G.toHub(); G.R.scaleCap = 2; G.R.resize(); });

  // ---------- 1) the knob: gates, reverse gears, looks ----------
  const revs = await ev(() => {
    const G = __game, out = {}, { KNOB_PREF, gateOf, GEARBOXES, revLabel } = __w;
    for (const [id, gb, lay] of [['cc', 'g10cc', 'a'], ['bars', 'g10kz', 'a'], ['sk', 'g12sk', 'a'], ['sk', 'g12sk', 'b'], ['skt', 'g14sk', 'a'], ['skt', 'g14sk', 'b'], ['bars', 'g5zil', 'a']]) {
      KNOB_PREF.sk12 = lay; const g = gateOf(GEARBOXES[gb]); out[gb + (gb.indexOf('sk') > 0 ? '_' + lay : '')] = (g.revs || [GEARBOXES[gb].rev]).map((r, i) => revLabel(g, i) + ' ' + r).join(', ');
    }
    KNOB_PREF.sk12 = 'a'; return out;
  });
  console.log('reverse gears:', JSON.stringify(revs));
  check('split reverse gears', revs.g10cc.split(',').length === 2 && revs.g12sk_a.split(',').length === 3 && revs.g12sk_b.split(',').length === 4 && revs.g5zil.split(',').length === 1, revs.g10cc);
  check('no low range left', await ev(() => !__w.hasTransfers && !document.getElementById('tLow') && !('transfer' in __game.cfg().parts)));
  const knobShot = async (truck, n, opts) => {
    await ev(([truck, o]) => { const G = __game; if (o.look) G.setOption('knob', o.look); if (o.lay) G.setOption('sk12', o.lay); G.hud.touchIn.throttle = 0; __z.start({ truck, job: 'free', at: 'camp', weather: 'clear', time: 'noon' }); }, [truck, opts || {}]);
    await sleep(900); await shot(n);
    return ev(() => { const t = __game.truck; return t.gate === __game.hud.knob.gate && t.mode + t.gearLabel(); });
  };
  check('knob on the 5-speed + axle (Polaris)', !!await knobShot('cc', 'knob_cc_face'));
  check('knob on the Skinnerd 12, LO/INT/DIR', !!await knobShot('sk', 'knob_sk_a', { lay: 'a' }));
  check('knob on the Skinnerd 12, range + splitter', !!await knobShot('sk', 'knob_sk_b', { lay: 'b' }));
  check('knob as a lever in a gate', !!await knobShot('sk', 'knob_sk_gate', { look: 'gate' }));
  check('knob on the 13-speed tractor', !!await knobShot('skt', 'knob_skt_gate'));
  await ev(() => { __game.setOption('knob', 'face'); __game.setOption('sk12', 'a'); });
  // manual from neutral: the start setting
  await ev(() => { __game.setOption('gear', 'man'); __z.start({ truck: 'cc', job: 'free', at: 'camp' }); }); await sleep(500);
  check('starts in neutral in manual', await ev(() => __game.truck.gear === 0 && __game.truck.mode === 'M'));
  await ev(() => __game.setOption('gear', 'auto'));
  // over-rev: get going in AUTO, then try to throw it into first: refused, then forced with a second push
  await ev(() => { __z.start({ truck: 'cc', job: 'travel', at: 'camp', to: 'mill', roads: ['e1', 'e2'], auto: true }); __z.teleport(__z.roadX('e2', 300)); __game.hud.touchIn.throttle = 1; });
  for (let i = 0; i < 40; i++) { await sleep(250); if (await ev(() => __game.truck.vF * 3.6 > 38)) break; }
  const ovr = await ev(() => { const G = __game, t = G.truck, K = G.hud.knob; G.hud.touchIn.throttle = 0; t.mode = 'M'; const w0 = t.wear.engine, g0 = t.gear, v = t.vF * 3.6; K.toGear(1); return { w0, g0, v: Math.round(v) }; });
  await sleep(900);
  const ovr1 = await ev(() => ({ gear: __game.truck.gear, next: __game.truck.nextGear, arm: !!__game.hud.knob.K.arm, toast: [...document.querySelectorAll('#toasts div')].map(d => d.textContent).join(' | ') }));
  await ev(() => __game.hud.knob.toGear(1)); await sleep(900);
  const ovr2 = await ev(() => ({ gear: __game.truck.gear, wear: __game.truck.wear.engine }));
  console.log('over-rev:', JSON.stringify(ovr), JSON.stringify(ovr1), JSON.stringify(ovr2));
  check('first push into 1st at speed is refused', ovr1.gear !== 1 && ovr1.arm, ovr1.toast.slice(0, 80));
  check('second push forces it and hurts the engine', ovr2.gear === 1 && ovr2.wear > ovr.w0 + 0.01, ovr2.wear.toFixed(3));

  // ---------- 2) a job on the clock, left on the road ----------
  const job = await ev(() => {
    const G = __game; G.gid = 'cc'; G.cfg().loc = 'camp'; G.cfg().road = null; G.cfg().job = null; G.cfg().fuel = G.tankCap();
    const r = __w.route('camp', 'mill', null, s => G.secret(s));
    G.startJob({ id: 'test', kind: 'haul', cargo: 'pulp', from: 'camp', to: 'mill', dist: r.d, dem: 0.9 });
    for (let i = 0; i < 12 && G.trip.pending; i++) { const p = G.trip.pending; G.chooseRoad((p.opts.find(q => q.edge === 'e3') || p.opts[0]).edge); }
    const J = G.cfg().job; return { left: J.left, units: J.units, saved: !!G.data.trucks.cc.job, due: J.due, tier: J.tier, bonus: J.bonus };
  });
  console.log('job:', JSON.stringify(job));
  check('job saved on the truck, no deadline fields', job.saved && job.units > 0 && job.left === job.units && job.due === undefined && job.tier === undefined && job.bonus === undefined);
  await ev(() => { __z.teleport(__z.roadX('e3', 420)); }); await settle(); await sleep(400);
  await shot('drive_job');
  check('progress shows the run timer, no countdown', await ev(() => { const t = document.getElementById('progLbl').textContent; return /km/.test(t) && /\d+:\d\d/.test(t) && !/left/.test(t); }), await ev(() => document.getElementById('progLbl').textContent));
  await tap('#bMenu'); await sleep(300);
  const menu = await ev(() => [...document.querySelectorAll('.pacts .job b')].map(b => b.textContent));
  console.log('pause menu:', menu.join(' / '));
  check('pause: leave, tow, abandon', menu[0] === 'Leave it here' && /^Tow to /.test(menu[1]) && menu.includes('Abandon the job'));
  await shot('pause_menu');
  await ev(() => { document.querySelector('#ov .panel').scrollTop = 9999; }); await sleep(150); await shot('pause_settings');
  await ev(() => { document.querySelector('#ov .panel').scrollTop = 0; }); await sleep(150);
  await tap('#oLeave'); await sleep(400);
  const left = await ev(() => ({ title: document.querySelector('#ov h1').textContent, road: __game.cfg('cc').road, job: !!__game.cfg('cc').job, left: __game.cfg('cc').job && __game.cfg('cc').job.left }));
  console.log('left:', JSON.stringify(left));
  check('left on the road with the load', left.title === 'Left on the road' && left.road && left.road.edge === 'e3' && left.job && left.left > 0);
  await shot('results_left');
  await tap('#oGar'); await sleep(700);
  check('hub at the roadside', await ev(() => __game.state === 'hub' && !__game.hubGarage && /On the road/.test(document.getElementById('gGo').textContent)), await ev(() => document.getElementById('gLoc').textContent));
  await shot('hub_roadside');
  await tap('#gGo'); await sleep(400);
  const panel = await ev(() => [...document.querySelectorAll('.jobs .job b')].map(b => b.textContent));
  console.log('on-the-road panel:', panel.join(' / '));
  check('road panel: carry on, tow, abandon', /^Carry on to /.test(panel[0]) && panel.some(t => /^Call a tow/.test(t)) && panel.includes('Abandon the job'));
  await shot('jobs_onroad');
  // reload: the spot, the job and the clock survive
  const before = await ev(() => { __game.saveNow(); return Math.round(__game.clock); });
  await p.reload(); await sleep(1200);
  const after = await ev(() => ({ road: __game.cfg('cc').road, job: !!__game.cfg('cc').job, clock: Math.round(__game.clock) }));
  check('saved: road spot, job and clock', after.road && after.road.edge === 'e3' && after.job && after.clock === before, JSON.stringify(after));

  // ---------- 3) fetch it with the Bars: a recover job ----------
  await ev(() => { const G = __game; G.cash = 50000; G.gid = 'bars'; G.cfg().loc = 'camp'; G.cfg().road = null; G.cfg().job = null; G.cfg().fuel = G.tankCap(); G.toHub(); G.openJobs(); }); await sleep(500);
  const rec = await ev(() => [...document.querySelectorAll('.job[data-k^="rc:"]')].map(b => b.dataset.k + ' :: ' + b.querySelector('b').textContent));
  console.log('recover cards:', rec.join(' / '));
  check('board offers to fetch the Polaris', rec.length >= 1);
  await shot('jobs_recover');
  const rj = await ev(() => {
    const G = __game, j = G.recoverJobs('camp').find(q => q.to === 'mill') || G.recoverJobs('camp')[0];
    G.startJob(j);
    for (let i = 0; i < 12 && G.trip.pending; i++) G.chooseRoad(G.trip.pending.opts[0].edge);
    return { to: j.to, strandAt: G.strandAt, edge: j.edge };
  });
  console.log('recover job:', JSON.stringify(rj));
  check('your truck stands at the roadside on the drive', await ev(() => !!(__game.stranded && __game.stranded.own && __game.stranded.ditch && __game.stranded.id === 'cc')));
  await ev(x => { __z.teleport(x + 10); }, rj.strandAt); await settle(); await sleep(300);
  await shot('recover_roadside');
  const lbl = await ev(() => __game.actionLabel());
  check('hook up offered next to it', lbl === 'Hook up tow bar', lbl);
  await ev(() => __game.doAction()); await sleep(500);
  const hooked = await ev(() => ({ tow: !!__game.sim.tow, items: __game.stranded.truck.itemsOn(), cargo: __game.stranded.truck.cargoType }));
  check('on the bar with its load', hooked.tow && hooked.items > 0 && hooked.cargo === 'pulp', JSON.stringify(hooked));
  await ev(() => { __game.hud.touchIn.throttle = 0.6; }); await sleep(2500); await ev(() => { __game.hud.touchIn.throttle = 0; });
  await shot('recover_towing');
  // into the mill yard with it
  await ev(() => { const G = __game, z = G.course.zones.find(q => q.role === 'end'); __z.teleport(z.x0 + 24); }); await settle(); await sleep(400);
  const dl = await ev(() => __game.actionLabel());
  check('drop off in the yard', dl === 'Drop off the truck', dl);
  await ev(() => __game.doAction()); await sleep(400);
  const recd = await ev(() => ({ title: document.querySelector('#ov h1').textContent, cc: { road: __game.cfg('cc').road, loc: __game.cfg('cc').loc, left: __game.cfg('cc').job && __game.cfg('cc').job.left }, bars: __game.cfg('bars').loc }));
  console.log('recovered:', JSON.stringify(recd));
  check('Polaris now in the mill yard, load aboard', recd.title === 'Truck recovered!' && !recd.cc.road && recd.cc.loc === 'mill' && recd.cc.left > 0);
  await shot('results_recovered');

  // ---------- 4) unload where it was towed: inside the yard ----------
  await ev(() => { const G = __game; G.gid = 'cc'; G.toHub(); }); await sleep(500);
  check('garage says unload here', await ev(() => /Unload here/.test(document.getElementById('gGo').textContent)));
  await tap('#gGo'); await sleep(300); await shot('jobs_unload');
  await tap('#oStart'); await sleep(700);
  check('drive starts outside the gate', await ev(() => __game.state === 'drive' && __game.trip.done && __game.course.zones.length === 1));
  await ev(() => { const z = __game.course.zones[0]; __z.teleport(z.x0 + 22); }); await settle(); await sleep(300);
  const ul = await ev(() => __game.actionLabel());
  check('unload offered', ul === 'Unload cargo', ul);
  await ev(() => __game.doAction()); await sleep(400);
  const paid = await ev(() => [...document.querySelectorAll('.stats')][1].textContent.replace(/\s+/g, ' '));
  console.log('delivery pay:', paid.slice(0, 200));
  check('delivery pays base + rate, no bonus or late rows', /Delivery/.test(paid) && !/bonus|late|Late|Urgent/i.test(paid), paid.slice(0, 80));
  check('job done', await ev(() => !__game.cfg('cc').job && __game.cfg('cc').loc === 'mill'));
  await shot('results_delivered');

  // ---------- 6) tows ----------
  // near the start: towed back to the closest yard, the job carries on from there
  const t1 = await ev(() => {
    const G = __game; G.toHub(); G.gid = 'cc'; G.cfg().loc = 'camp'; G.cfg().fuel = G.tankCap(); const cash = G.cash, c0 = G.clock;
    const r = __w.route('camp', 'mill', null, s => G.secret(s));
    G.startJob({ id: 'tow1', kind: 'haul', cargo: 'pulp', from: 'camp', to: 'mill', dist: r.d, dem: 0.3 });
    for (let i = 0; i < 12 && G.trip.pending; i++) { const p = G.trip.pending; G.chooseRoad((p.opts.find(q => q.edge === 'e3') || p.opts[0]).edge); }
    __z.teleport(__z.roadX('e3', 200)); const q = G.closestPlace(); G.towToClosest();
    return { node: q.node, cost: q.cost, time: q.time, paid: cash - G.cash, clock: Math.round(G.clock - c0), title: document.querySelector('#ov h1') && document.querySelector('#ov h1').textContent, loc: G.cfg().loc, job: !!G.cfg().job };
  });
  console.log('tow near the start:', JSON.stringify(t1));
  check('towed to the closest yard, job kept', t1.title === 'Towed to ' + await ev(n => __w.NODES[n].name, t1.node) && t1.loc === t1.node && t1.job && t1.paid === t1.cost && t1.clock >= t1.time);
  await shot('results_towed');
  // near the destination: dropped at the gate, the drive goes on
  const t2 = await ev(() => {
    const G = __game; G.toHub(); G.gid = 'cc'; G.cfg().loc = 'camp'; G.cfg().job = null; G.cfg().fuel = G.tankCap();
    const r = __w.route('camp', 'mill', null, s => G.secret(s));
    G.startJob({ id: 'tow2', kind: 'haul', cargo: 'pulp', from: 'camp', to: 'mill', dist: r.d, dem: 0.3 });
    for (let i = 0; i < 12 && G.trip.pending; i++) G.chooseRoad(G.trip.pending.opts[0].edge);
    const leg = G.course.legs.filter(l => l.kind === 'edge').pop(); __z.teleport(leg.x1 - 60);
    const q = G.closestPlace(); G.towToClosest();
    const z = G.course.zones.find(q => q.role === 'end');
    return { node: q.node, state: G.state, x: Math.round(G.truck.x - z.x0) };
  });
  console.log('tow near the end:', JSON.stringify(t2));
  check('dropped at the destination gate', t2.node === 'mill' && t2.state === 'drive' && t2.x > -30 && t2.x < 0);
  // abandon mid-drive: the fee, the load gone, a free drive on
  const ab = await ev(() => {
    const G = __game, cash = G.cash, fee = Math.round(G.jobValue(G.job) * __w.ABANDON_FEE / 10) * 10; G.abandonJob();
    return { kind: G.job.kind, cargo: G.truck.cargoType, items: G.truck.itemsOn(), paid: cash - G.cash, fee, saved: G.cfg().job };
  });
  check('abandon: fee, empty, free drive', ab.kind === 'free' && !ab.cargo && ab.items === 0 && ab.paid === ab.fee && ab.fee > 0 && !ab.saved, JSON.stringify(ab));
  // run dry: the fuel truck from the menu
  await ev(() => { __game.truck.fuel = 0.2; __game.truck.engineOn = false; __game.pause(); }); await sleep(300);
  check('fuel truck in the menu when dry', await ev(() => !!document.getElementById('oFuel')));
  await tap('#oFuel'); await tap('#oFuel'); await sleep(300);
  check('fuel brought out', await ev(() => __game.state === 'drive' && __game.truck.fuel > 20 && __game.truck.engineOn));

  // ---------- 7) the map from the drive ----------
  await tap('#bMap'); await sleep(900);
  check('map opens from the drive', await ev(() => __game.mapOpen && __game.state === 'pause'));
  await shot('map_drive');
  await tap('#mClose'); await sleep(300);
  check('back to the drive', await ev(() => !__game.mapOpen && __game.state === 'drive'));

  // ---------- 8) random weather ----------
  const wx = await ev(() => {
    const G = __game; G.settings.weatherMode = 'random'; G.data.wx = null; G.wxInit();
    const w = G.data.wx, cur = w.cur, nxt = w.next; G.clock = w.at + 45; G.wxStep(0);
    return { cur, nxt, f: G.wxF, vis: Math.round(G.W.vis), visA: __w.WEATHER[cur].vis, visB: __w.WEATHER[nxt].vis, weather: G.weather };
  });
  console.log('weather blend:', JSON.stringify(wx));
  check('weather blends from one to the next', wx.f > 0.4 && wx.f < 0.6 && wx.vis >= Math.min(wx.visA, wx.visB) && wx.vis <= Math.max(wx.visA, wx.visB));
  await sleep(500); await shot('weather_blend');
  const wx2 = await ev(() => { const G = __game, w = G.data.wx, at0 = w.at; G.clock = w.at + 2000; G.wxStep(0); return { cur: w.cur, weather: G.weather, f: G.wxF, moved: w.at > at0 + 90 }; });
  check('and moves on with the clock', wx2.moved, JSON.stringify(wx2));
  await ev(() => { __game.pause(); }); await sleep(300);
  check('weather readout in the menu', await ev(() => !!document.querySelector('.wxnow') && !document.querySelector('.seg[data-k="weather"]')));
  await ev(() => { const G = __game; G.resume(); G.settings.weatherMode = 'fixed'; G.weather = 'clear'; G.W = __w.WEATHER.clear; G.data.wx = null; G.applyConditions(); });

  // ---------- 9) the map in the hub shows trucks out on the roads ----------
  await ev(() => { const G = __game; G.data.trucks.sk.road = { edge: 'e7', s: 900, dir: 1, at: 0 }; G.toHub(); G.openMap('garage'); }); await sleep(1200);
  await shot('map_trucks');
  await ev(() => __game.closeMap());
  // ---------- 10) the tractor and its trailer: left near the start of a road, fetched, unloaded in the yard ----------
  const rigOk = () => ev(() => { const t = __game.truck, s = t.semi; return !!s && isFinite(s.x) && s.x > 1 && Math.abs(s.chassis.getAngle()) < 0.5 && Math.abs(t.chassis.getAngle()) < 0.5; });
  const sk1 = await ev(() => {
    const G = __game; G.data.trucks.sk.road = null; G.gid = 'skt'; G.cfg().loc = 'camp'; G.cfg().road = null; G.cfg().job = null; G.cfg().fuel = G.tankCap();
    const r = __w.route('camp', 'mill', null, s => G.secret(s));
    G.startJob({ id: 'rig', kind: 'haul', cargo: 'logs', from: 'camp', to: 'mill', dist: r.d, dem: 0.6 });
    for (let i = 0; i < 12 && G.trip.pending; i++) { const p = G.trip.pending; G.chooseRoad((p.opts.find(q => q.edge === 'e2') || p.opts[0]).edge); }
    __z.teleport(__z.roadX('e2', 30)); return { semi: !!G.truck.semi, cargo: G.truck.semi && G.truck.semi.cargoType };
  });
  await settle(); await sleep(300);
  check('tractor with a log trailer on the road', sk1.semi && await rigOk(), JSON.stringify(sk1));
  await ev(() => __game.leaveHere()); await sleep(300);
  const skLeft = await ev(() => __game.cfg('skt').road);
  await ev(() => __game.toHub()); await sleep(1200);
  check('roadside hub has room for the trailer', await rigOk(), JSON.stringify(skLeft));
  await shot('skt_roadside_hub');
  await ev(() => __game.continueJob()); await sleep(1500);
  check('drives on from the road, trailer and all', await ev(() => __game.state === 'drive') && await rigOk());
  await ev(() => __game.leaveHere()); await sleep(300);
  // the Bars fetches it: tractor and loaded trailer on the bar
  const rj2 = await ev(() => {
    const G = __game; G.toHub(); G.gid = 'bars'; G.cfg().loc = 'camp'; G.cfg().road = null; G.cfg().job = null; G.cfg().fuel = G.tankCap();
    const j = G.recoverJobs('camp').find(q => q.truck === 'skt' && q.to === 'mill'); if (!j) return null;
    G.startJob(j); for (let i = 0; i < 12 && G.trip.pending; i++) G.chooseRoad(G.trip.pending.opts[0].edge);
    return { strandAt: G.strandAt, semi: !!(G.stranded && G.stranded.semi) };
  });
  check('recover job for the tractor', rj2 && rj2.semi, JSON.stringify(rj2));
  if (rj2) {
    await ev(x => __z.teleport(x + 10), rj2.strandAt); await settle(); await sleep(300);
    await ev(() => { if (__game.actionLabel() === 'Hook up tow bar') __game.doAction(); }); await sleep(600);
    const hk = await ev(() => { const st = __game.stranded, t = st.truck; return { tow: !!__game.sim.tow, semi: !!t.semi, ok: isFinite(t.semi && t.semi.x), load: t.loadCount() }; });
    check('tractor and trailer on the bar', hk.tow && hk.semi && hk.ok && hk.load > 0, JSON.stringify(hk));
    await ev(() => { __game.hud.touchIn.throttle = 1; }); await sleep(3000); await ev(() => { __game.hud.touchIn.throttle = 0; });
    await shot('skt_on_the_bar');
    await ev(() => { const z = __game.course.zones.find(q => q.role === 'end'); __z.teleport(z.x0 + 30); }); await settle(); await sleep(400);
    const hk2 = await ev(() => { const t = __game.stranded.truck; return { semi: !!t.semi, x: Math.round(t.x), sx: t.semi && Math.round(t.semi.x), lbl: __game.actionLabel() }; });
    check('it comes along on a respawn, trailer too', hk2.semi && hk2.lbl === 'Drop off the truck', JSON.stringify(hk2));
    await ev(() => __game.doAction()); await sleep(400);
    const sk2 = await ev(() => ({ loc: __game.cfg('skt').loc, road: __game.cfg('skt').road, left: __game.cfg('skt').job && __game.cfg('skt').job.left }));
    check('tractor dropped at the mill with its load', sk2.loc === 'mill' && !sk2.road && sk2.left > 0, JSON.stringify(sk2));
    // and it unloads there, starting outside the gate with room for the trailer
    await ev(() => { const G = __game; G.gid = 'skt'; G.toHub(); G.unloadHere(); }); await sleep(1500);
    check('unload drive: trailer clear of the barrier', await rigOk());
    await shot('skt_unload_gate');
    await ev(() => { const z = __game.course.zones[0]; __z.teleport(z.x0 + 30); }); await settle(); await sleep(400);
    const ul2 = await ev(() => __game.actionLabel());
    check('tractor unloads in the yard', ul2 === 'Unload cargo', ul2);
  }
  console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
})();
