// 0.9 checks in a browser: the Polaris in Lucas's flat art, as the single-cab pickup or the crew-cab flatbed (the cab
// part): garage and yard, liveries and rims, the cage, the loaded rack (needs the cage), rock sliders with their tank,
// the bull bar, the off-road wheels with a lift, the beacon on every truck, cargo in the bed and on the deck, night.
// node test/v09.js   (pictures go to $SHOTS or the scratchpad)
const puppeteer = require('puppeteer-core'), path = require('path'), fs = require('fs');
const OUT = process.env.SHOTS || '/tmp/claude-0/-home-claude/936babd9-14ae-5cd0-b1bf-6401ea6ac088/scratchpad/shots09';
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
  const shot = (n, clip) => p.screenshot({ path: OUT + '/' + n + '.png', clip });
  await p.goto(url); await ev(() => localStorage.clear()); await p.reload(); await sleep(1500);
  await ev(() => { const G = __game; G.cash = 90000; G.toHub(); G.R.scaleCap = 2; G.R.resize(); });
  await sleep(1200);
  // the art decodes in the background
  for (let i = 0; i < 20 && !(await ev(() => !!__w.artImg('cc'))); i++) await sleep(250);
  check('Polaris art decoded', await ev(() => !!__w.artImg('cc') && __game.gid === 'cc'));
  check('class says pickup', /pickup/.test(await ev(() => document.getElementById('gCls').textContent)));
  // the flatbed body: its own geometry and picture, the class line follows
  const fbk = await ev(() => { const G = __game, c = G.cfg('cc'); c.parts.cab = 'cf'; G.buildHub(); G.hud.renderGarage(); const r = [G.gsim.truck.gk, document.getElementById('gCls').textContent, __w.capOf('cc', 'drums', c.parts)]; c.parts.cab = 'sc'; G.buildHub(); G.hud.renderGarage(); return r; });
  check('crew-cab flatbed body', fbk[0] === 'ccf' && /flatbed/.test(fbk[1]) && fbk[2] === 6, fbk);
  await shot('garage_stock');
  // hold the camera on the truck at a zoom (k times the drive view), offset ox, oy metres from the chassis origin
  const cam = (k, ox, oy) => ev(([k, ox, oy]) => {
    const G = __game; if (!G._uc) G._uc = G.updateCamera; if (!G._base) G._base = G.cam.ppm;
    document.getElementById('hud').style.visibility = k ? 'hidden' : '';
    if (!k) { G.updateCamera = G._uc; return; }
    G.updateCamera = function () { const q = this.truck.chassis.getPosition(); this.cam.x = q.x + ox; this.cam.y = q.y + oy; this.cam.ppm = G._base * k; };
  }, [k, ox, oy]);
  const go = async (o, wait) => { await ev(o => { const G = __game; G.hud.touchIn.throttle = 0; G.hud.touchIn.brake = 0; if (G.mapOpen) G.closeMap(); __z.start(o); }, o); await sleep(wait || 1200); };
  const paint = (o) => ev(o => { const c = __game.cfg('cc'); Object.assign(c.paint, o.paint || {}); c.addons = Object.assign({}, o.addons || {}); c.parts.cab = o.cab || 'sc'; if (o.parts) Object.assign(c.parts, o.parts); }, o);
  // ---------- garage: liveries, rims, add-ons
  await ev(() => { __game._base = null; });
  const looks = [
    ['two_white_roof', { paint: { c1: '#2d5d9a', c2: '#e6e2d6', livery: 'two', rims: 'white' } }],
    ['lower_mustard', { paint: { c1: '#c9a227', c2: '#2a2a2c', livery: 'lower', rims: 'black' } }],
    ['band_forest', { paint: { c1: '#2f5d3a', c2: '#e6e2d6', livery: 'band', rims: 'polished' } }],
    ['stripe_red', { paint: { c1: '#b8322a', c2: '#e6e2d6', livery: 'stripe', rims: 'polished', num: 7 } }],
    ['company_teal', { paint: { c1: '#2f8f8a', c2: '#e6e2d6', livery: 'company', rims: 'white' } }],
    ['rescue_white', { paint: { c1: '#e6e2d6', c2: '#b8322a', livery: 'rescue', rims: 'black' } }],
    ['cage_copper', { paint: { c1: '#b56e3e', c2: '#e6e2d6', livery: 'plain', rims: 'bronze', num: 18 }, addons: { cage: true, beacon: true } }],
    ['rack_forest', { paint: { c1: '#2f5d3a', c2: '#e6e2d6', livery: 'plain', rims: 'black' }, addons: { cage: true, rack: true, lightbar: true } }],
    ['sliders_bullbar_army', { paint: { c1: '#6b7552', c2: '#545d40', livery: 'plain', rims: 'army' }, addons: { bullbar: true, sliders: true, snorkel: true } }],
    ['expedition_lift', { paint: { c1: '#b56e3e', c2: '#e6e2d6', livery: 'plain', rims: 'bronze' }, addons: { cage: true, rack: true, sliders: true, bullbar: true, beacon: true }, parts: { lift: 'l4' } }],
    ['mud_tyres', { paint: { c1: '#2d5d9a', c2: '#e6e2d6', livery: 'two', rims: 'white' }, addons: {}, parts: { lift: 'l0', tires: 'mt' } }],
    ['fb_stock', { cab: 'cf', paint: { c1: '#b56e3e', c2: '#e6e2d6', livery: 'plain', rims: 'bronze', num: 18 }, addons: {}, parts: { lift: 'l0', tires: 'at' } }],
    ['fb_lower_white', { cab: 'cf', paint: { c1: '#e6e2d6', c2: '#2f5d3a', livery: 'lower', rims: 'black' }, addons: { beacon: true } }],
    ['fb_band_red', { cab: 'cf', paint: { c1: '#b8322a', c2: '#e6e2d6', livery: 'band', rims: 'white', num: 5 }, addons: { bullbar: true } }],
    ['fb_stripe_blue', { cab: 'cf', paint: { c1: '#2d5d9a', c2: '#e6e2d6', livery: 'stripe', rims: 'polished' }, addons: { snorkel: true, lightbar: true } }],
    ['fb_company_teal', { cab: 'cf', paint: { c1: '#2f8f8a', c2: '#e6e2d6', livery: 'company', rims: 'white' }, addons: {} }],
    ['fb_expedition', { cab: 'cf', paint: { c1: '#6b7552', c2: '#545d40', livery: 'two', rims: 'army' }, addons: { cage: true, rack: true, sliders: true, bullbar: true, beacon: true, lightbar: true }, parts: { lift: 'l2' } }],
  ];
  for (const [n, o] of looks) { await paint(o); await ev(() => { __game.buildHub(); __game.hud.renderGarage(); }); await sleep(900); await shot('garage_' + n); }
  await paint({ parts: { lift: 'l0', tires: 'at' } });
  // the loaded rack sits on the cage: fitting it fits the cage, taking the cage off takes the rack
  const link = await ev(() => { const G = __game, c = G.cfg('cc'); c.addons = { rack: true }; G.addonLinks(c, 'rack'); const a = c.addons.cage; c.addons.cage = false; G.addonLinks(c, 'cage'); const b = c.addons.rack; c.addons = {}; return [a, b]; });
  check('rack fits the cage, cage off takes the rack', link[0] === true && link[1] === false, link);
  // fuel: the rack's jerry cans and the sliders' side tank
  const fuel = await ev(() => { const G = __game, c = G.cfg('cc'); c.addons = {}; const t0 = G.tankCap('cc'); c.addons = { cage: true, rack: true, sliders: true }; const t1 = G.tankCap('cc'); c.addons = {}; return [t0, t1]; });
  check('rack and sliders add 140 L', fuel[1] - fuel[0] === 140, fuel);
  // ---------- outdoors in a yard, the cage on
  await paint({ paint: { c1: '#b56e3e', livery: 'plain', rims: 'bronze' }, addons: { cage: true, rack: true, sliders: true, bullbar: true } });
  await ev(() => { const G = __game; G.cfg('cc').loc = 'mill'; G.toHub(); }); await sleep(1500);
  await shot('yard_kit');
  // ---------- driving: cargo in the bed (pulp, drums, crates), seen up close
  for (const [cab, cargo] of [['sc', 'pulp'], ['sc', 'drums'], ['sc', 'crates'], ['cf', 'pulp'], ['cf', 'drums'], ['cf', 'crates']]) {
    await paint({ cab, paint: { c1: '#b56e3e', livery: 'plain' }, addons: {} });
    await go({ truck: 'cc', job: cargo, at: 'camp', to: 'mill', weather: 'clear', time: 'noon', auto: true }, 900);
    await cam(2.0, -0.5, 0.6); await sleep(1600);
    const it = await ev(() => ({ items: __game.truck.itemsOn(), cargo: __game.truck.cargoType, mass: Math.round(__game.truck.totalMass) }));
    check('bed holds ' + cargo, it.items > 0 && it.cargo === cargo, it);
    await shot('bed_' + cab + '_' + cargo);
    await cam(0);
  }
  // drive a bit with drums: do they stay in the bed?
  await paint({ paint: { c1: '#b56e3e', livery: 'plain' }, addons: {} });
  await go({ truck: 'cc', job: 'drums', at: 'camp', to: 'mill', weather: 'clear', time: 'noon', auto: true }, 600);
  await ev(() => { __game.hud.touchIn.throttle = 0.7; }); await sleep(6000); await ev(() => { __game.hud.touchIn.throttle = 0; });
  const run = await ev(() => ({ v: Math.round(__game.truck.vF * 3.6), x: Math.round(__game.truck.x - __game.trip.spawnX), items: __game.truck.itemsOn(), onBed: __game.truck.loadCount() }));
  check('drums ride in the bed', run.onBed === run.items && run.items === 8 && run.x > 20, run);
  await shot('drive_drums');
  // ---------- night: lamps, beacon flashing on the cage's rack
  await paint({ paint: { c1: '#e6e2d6', c2: '#b8322a', livery: 'rescue', rims: 'black' }, addons: { cage: true, rack: true, beacon: true, bullbar: true, lightbar: true } });
  await go({ truck: 'cc', job: 'free', at: 'camp', weather: 'clear', time: 'night' }, 900);
  await ev(() => { __game.truck.lights = true; });
  await cam(1.6, 0.0, 0.9); await sleep(1500);
  await shot('night_cage_beacon');
  await cam(0);
  // ---------- the beacon on the other trucks
  for (const id of ['bars', 'sk', 'skt']) {
    await ev(id => { const c = __game.cfg(id); c.addons = Object.assign({}, c.addons, { beacon: true }); }, id);
    await go({ truck: id, job: 'free', at: 'camp', weather: 'overcast', time: 'dusk' }, 900);
    await ev(() => { __game.truck.lights = true; });
    await cam(1.7, 0.8, 1.2); await sleep(1400);
    await shot('beacon_' + id);
    await cam(0);
  }
  // ---------- lift kit: the tyres grow with it
  await paint({ paint: { c1: '#2a2a2c', livery: 'plain', rims: 'polished' }, addons: { cage: true }, parts: { lift: 'l4' } });
  await go({ truck: 'cc', job: 'free', at: 'camp', weather: 'clear', time: 'noon' }, 900);
  await cam(1.6, 0.0, 0.6); await sleep(1500);
  const lr = await ev(() => ({ r: __game.truck.r, art: __w.artImg('cc').wheels[0].r, off: !!__w.artImg('cc').owheel }));
  check('lift kit: bigger off-road tyres', lr.r > lr.art + 0.04 && lr.off, lr);
  await shot('lift_l4');
  await cam(0);
  await paint({ parts: { lift: 'l0' } });
  console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
})();
