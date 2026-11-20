// 0.6 checks in a browser: an old save with the test truck, the drawn Skinnerd tractor's lamps at night, its two
// exhaust outlets, the tyre shading, snow at the contact point on a slope, the two bridge roads and the map.
// node test/v06.js   (pictures go to $SHOTS or the scratchpad)
const puppeteer = require('puppeteer-core'), path = require('path'), fs = require('fs');
const OUT = process.env.SHOTS || '/tmp/claude-0/-home-claude/936babd9-14ae-5cd0-b1bf-6401ea6ac088/scratchpad/shots06';
const PROFILE = OUT + '/.chrome';
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader'], userDataDir: PROFILE });
  const p = await b.newPage();
  await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
  const ev = (f, a) => p.evaluate(f, a);
  const shot = (n, clip) => p.screenshot({ path: OUT + '/' + n + '.png', clip });
  // a save from 0.5.2 with the drawn truck selected and the old tractor parked at the mill in blue
  await p.goto(url); await sleep(600);
  await ev(() => { __game.saveNow = () => { }; }); // the page saves on the way out; keep the old save as it is
  await ev(() => localStorage.setItem('zimnik.v2', JSON.stringify({ v: 2, cash: 5000, truck: 'skx', trucks: { skx: { loc: 'camp', paint: { c1: '#b8322a' } }, skt: { loc: 'mill', paint: { c1: '#2d5d9a' }, fuel: 120 } }, secrets: { zimnik: true, forest: true, south: true } })));
  await p.goto(url); await sleep(1000);
  console.log('old save:', JSON.stringify(await ev(() => ({ gid: __game.gid, skx: 'skx' in __game.data.trucks, loc: __game.cfg('skt').loc, paint: __game.cfg('skt').paint.c1, fuel: __game.cfg('skt').fuel }))));
  await ev(() => { __game.R.scaleCap = 2; __game.R.resize(); });
  // hold the camera on the truck at a zoom (k times the drive view), offset ox, oy metres from the chassis origin
  const cam = (k, ox, oy) => ev(([k, ox, oy]) => {
    const G = __game; if (!G._uc) G._uc = G.updateCamera; if (!G._base) G._base = G.cam.ppm;
    document.getElementById('hud').style.visibility = k ? 'hidden' : '';
    if (!k) { G.updateCamera = G._uc; return; }
    G.updateCamera = function () { const q = this.truck.chassis.getPosition(); this.cam.x = q.x + ox; this.cam.y = q.y + oy; this.cam.ppm = G._base * k; };
  }, [k, ox, oy]);
  const go = async (o, wait) => { await ev(o => { const G = __game; G.hud.touchIn.throttle = 0; G.hud.touchIn.brake = 0; if (G.mapOpen) G.closeMap(); __z.start(o); }, o); await sleep(wait || 1200); };
  await go({ truck: 'skt', job: 'travel', at: 'camp', to: 'mill', weather: 'clear', time: 'noon', auto: true }, 900);
  await ev(() => { __game.R.scaleCap = 2; __game.R.resize(); });
  // lamps at night: headlamp, indicator and roof marker, beam from the front of the lamp
  await go({ truck: 'skt', job: 'travel', at: 'camp', to: 'mill', weather: 'clear', time: 'night', auto: true }, 600);
  await cam(2.4, 1.2, 0.6); await sleep(1500);
  console.log('lights on', await ev(() => __game.truck.lights));
  await shot('lamps_night');
  await go({ truck: 'skt', job: 'travel', at: 'camp', to: 'mill', weather: 'fog', time: 'dusk', auto: true }, 600);
  await cam(2.4, 1.2, 0.6); await sleep(1500);
  await shot('lamps_fog');
  // exhaust: idle, then the throttle comes on: the low pipe coughs, the stack takes over
  await go({ truck: 'skt', job: 'travel', at: 'camp', to: 'mill', weather: 'overcast', time: 'morning', auto: true }, 600);
  await cam(2.0, -0.2, 0.9); await sleep(2500);
  await shot('smoke_0_idle');
  await ev(() => { __game.hud.touchIn.throttle = 1; });
  for (const [n, ms] of [['smoke_1_onset', 250], ['smoke_2_cough', 350], ['smoke_3_stack', 700], ['smoke_4_pulling', 1500]]) { await sleep(ms); await shot(n); }
  console.log('puff', await ev(() => (__game.truck._puff || 0).toFixed(2)), 'thr', await ev(() => __game.truck.thr.toFixed(2)), 'v', await ev(() => __game.truck.vF.toFixed(1)));
  // release, wait, then throttle again: a second cough
  await ev(() => { __game.hud.touchIn.throttle = 0; }); await sleep(1500);
  await ev(() => { __game.hud.touchIn.throttle = 1; }); await sleep(300); await shot('smoke_5_again');
  await ev(() => { __game.hud.touchIn.throttle = 0; });
  // the tyre shading stays put while the tyre turns: two frames a little apart, zoomed on the bogie
  await cam(3.2, -1.7, -0.3);
  await ev(() => { __game.hud.touchIn.throttle = 1; }); await sleep(1200); await shot('tyres_a'); await sleep(170); await shot('tyres_b');
  console.log('wheel angle', await ev(() => __game.truck.wheels[1].body.getAngle().toFixed(2)));
  await ev(() => { __game.hud.touchIn.throttle = 0; __game.hud.touchIn.brake = 1; }); await sleep(800); await ev(() => { __game.hud.touchIn.brake = 0; });
  // snow at the contact point: deep snow on a slope (forest track, bottomless drifts) and the pass
  await go({ truck: 'cc', job: 'travel', at: 'mill', to: 'sosn', weather: 'snow', time: 'noon', roads: ['e8', 'e25', 'e19'], auto: true }, 600);
  const deep = await ev(() => { const G = __game, c = G.course, l = c.legs.find(l => l.edge === 'e25'); if (!l) return null; for (let x = l.x0 + 60; x < l.x1 - 60; x += 2) { if (c.s[c.ii(x)] === 1 && Math.abs(c.slopeAt(x)) > 0.06) return x; } return null; });
  console.log('deep snow on a slope at', deep, await ev(() => { const c = __game.course; return c.legs.map(l => l.edge + ':' + Math.round(l.x0) + '-' + Math.round(l.x1)).join(' '); }));
  if (deep) { await ev(x => __z.teleport(x - 6), deep); await cam(2.6, 0.3, -0.2); await ev(() => { __game.hud.touchIn.throttle = 0.6; }); await sleep(2200); await shot('snow_slope'); await ev(() => { __game.hud.touchIn.throttle = 0; }); }
  await cam(0);
  // the bridge roads, clear and in the thaw
  for (const [n, o, edge, s] of [
    ['bridge_e27', { truck: 'skt', job: 'crates', at: 'mill', to: 'sosn', weather: 'clear', time: 'noon', roads: ['e8', 'e6', 'e27'], auto: true }, 'e27', 625],
    ['bridge_e27_thaw', { truck: 'skt', job: 'crates', at: 'mill', to: 'sosn', weather: 'thaw', time: 'morning', roads: ['e8', 'e6', 'e27'], auto: true }, 'e27', 600],
    ['bridge_e28_dusk', { truck: 'skt', job: 'travel', at: 'pulp', to: 'zar', weather: 'overcast', time: 'dusk', roads: ['e28'], auto: true }, 'e28', 790],
  ]) {
    await go(o, 600);
    const x = await ev(([e, s]) => __z.roadX(e, s), [edge, s]);
    if (x === null) { console.log(n, 'road not in this drive'); continue; }
    await ev(x => __z.teleport(x), x); await cam(0.5, -14, 2.0); await sleep(1600); await shot(n);
    console.log(n, 'legs', await ev(() => __game.course.legs.map(l => l.edge).join('>')), 'deck clear of water', await ev(x => { const c = __game.course; return (c.hAt(x) - c.visAt(x)).toFixed(1); }, x));
  }
  await cam(0);
  // the map: the south, both bridge roads labelled
  await ev(() => { __game.toHub(); }); await sleep(600);
  await ev(() => { __game.openMap('garage'); }); await sleep(1200);
  await shot('map');
  // frame time with the tractor and smoke on screen
  await ev(() => __game.closeMap && __game.closeMap());
  await go({ truck: 'skt', job: 'travel', at: 'camp', to: 'mill', weather: 'snow', time: 'dusk', auto: true }, 800);
  await ev(() => { __game.hud.touchIn.throttle = 1; }); await sleep(1500);
  const ft = await ev(async () => { const t = []; let last = performance.now(); for (let i = 0; i < 90; i++) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); t.push(n - last); last = n; } t.sort((a, b) => a - b); return t[45].toFixed(1); });
  console.log('median frame ms (software GL, 2x canvas):', ft, '| particles', await ev(() => __game.R.wr.parts.length));
  console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors');
  await b.close();
})();
