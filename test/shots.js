// Headless Chrome screenshots of scenarios. node test/shots.js [names...]
const puppeteer = require('puppeteer-core'), path = require('path'), fs = require('fs');
const OUT = process.env.SHOTS || '/tmp/claude-0/-home-claude/936babd9-14ae-5cd0-b1bf-6401ea6ac088/scratchpad/shots';
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
  await sleep(1200);
  await page.evaluate(() => { const D = __game.data; D.secrets = { zimnik: true, forest: true, south: true }; for (const id in D.trucks) D.trucks[id].loc = 'camp'; });
  const shot = async name => { await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('shot', name); };
  const want = n => process.argv.length <= 2 || process.argv.includes(n);
  // drive scene: o for __z.start, then put the truck at road `edge`, `s` metres in (or at an absolute x)
  const drive = async (name, o, at, wait, extra) => {
    if (!want(name)) return;
    await page.evaluate((o, at) => {
      const G = __game; G.hud.touchIn.throttle = 0; G.hud.touchIn.brake = 0; if (G.mapOpen) G.closeMap();
      __z.start(o);
      if (at) { const x = at.edge ? __z.roadX(at.edge, at.s) : at.zone !== undefined ? G.course.zones[at.zone === -1 ? G.course.zones.length - 1 : at.zone].x0 + (at.dx || 0) : at.x; if (x !== null) __z.teleport(x); }
    }, o, at);
    if (extra) await page.evaluate(extra);
    await sleep(wait || 1500);
    await shot(name);
  };
  if (want('title')) await shot('title');
  if (want('garage')) { await page.evaluate(() => __game.toHub()); await sleep(900); await shot('garage'); }
  if (want('jobs')) { await page.evaluate(() => { __game.toHub(); __game.openJobs(); }); await sleep(500); await shot('jobs'); }
  if (want('jobs_sk')) { await page.evaluate(() => { const G = __game; G.gid = 'sk'; G.cfg().loc = 'mill'; G.toHub(); G.openJobs(); }); await sleep(500); await shot('jobs_sk'); await page.evaluate(() => { __game.gid = 'cc'; }); }
  if (want('yard_hub')) { await page.evaluate(() => { const G = __game; G.gid = 'bars'; G.cfg().loc = 'depot'; G.weather = 'snow'; G.toHub(); }); await sleep(1500); await shot('yard_hub'); await page.evaluate(() => { const G = __game; G.cfg().loc = 'camp'; G.gid = 'cc'; G.weather = 'clear'; }); }
  if (want('map')) { await page.evaluate(() => { __game.toHub(); __game.openMap('garage'); }); await sleep(1500); await shot('map'); }
  if (want('map_place')) { await page.evaluate(() => { const H = __game.hud, mv = H.mapView; const p = mv.M.places.find(q => q.id === 'pulp'); const [x, y] = mv.toPx(p.mx, p.my); const cv = document.getElementById('mapCv'), r = cv.getBoundingClientRect(); const sel = mv.pick(x, y); H._sel = sel; }); await page.evaluate(() => { const H = __game.hud, mv = H.mapView; mv.sel = H._sel; mv.render(); const info = document.getElementById('mInfo'); info.innerHTML = mv.infoHTML(H._sel); info.hidden = false; }); await sleep(600); await shot('map_place'); }
  if (want('map_zoom')) { await page.evaluate(() => { const mv = __game.hud.mapView; document.getElementById('mInfo').hidden = true; mv.sel = null; mv.padR = 0; mv.cx = 1450; mv.cy = -250; mv.setZoom(2.6); mv.render(); }); await sleep(700); await shot('map_zoom'); }
  if (want('map_nw')) { await page.evaluate(() => { const mv = __game.hud.mapView; mv.cx = -350; mv.cy = 350; mv.setZoom(2.2); mv.render(); }); await sleep(700); await shot('map_nw'); }
  if (want('map_se')) { await page.evaluate(() => { const mv = __game.hud.mapView; mv.cx = 2600; mv.cy = -400; mv.setZoom(2.2); mv.render(); }); await sleep(700); await shot('map_se'); }
  await page.evaluate(() => { if (__game.mapOpen) __game.closeMap(); });
  await drive('start_card', { truck: 'cc', job: 'pulp', to: 'mill', weather: 'clear', time: 'morning' }, null, 1500);
  await drive('junction', { truck: 'cc', job: 'pulp', to: 'mill', weather: 'clear', time: 'noon', roads: ['e1'] }, { edge: 'e1', s: 150 }, 1500, () => { __game.hud.touchIn.throttle = 0.5; });
  await drive('pass_climb', { truck: 'cc', job: 'pulp', to: 'mill', weather: 'clear', time: 'morning', roads: ['e1', 'e2', 'e3'] }, { edge: 'e3', s: 175 }, 2500, () => { __game.truck.awd = true; __game.truck.diff = true; __game.hud.touchIn.throttle = 1; });
  await drive('icej', { truck: 'cc', job: 'drums', to: 'zar', weather: 'clear', time: 'dusk', roads: ['e1', 'e2', 'e4'] }, { edge: 'e4', s: 850 }, 1600);
  await drive('mill_end', { auto: true, truck: 'sk', job: 'logs', to: 'mill', at: 'camp', weather: 'overcast', time: 'noon', roads: ['e1', 'e2', 'e3', 'e8'] }, { zone: -1, dx: 30 }, 1800);
  await drive('mill_wall', { auto: true, truck: 'sk', job: 'logs', to: 'mill', at: 'camp', weather: 'overcast', time: 'noon', roads: ['e1', 'e2', 'e3', 'e8'] }, { zone: -1, dx: 64 }, 1800);
  await drive('depot_end', { auto: true, truck: 'bars', job: 'travel', to: 'depot', at: 'camp', weather: 'clear', time: 'noon' }, { zone: -1, dx: 46 }, 1800);
  await drive('port_end', { auto: true, truck: 'cc', job: 'travel', to: 'port', at: 'camp', weather: 'clear', time: 'noon' }, { zone: -1, dx: 52 }, 1800);
  await drive('mine_end', { auto: true, truck: 'bars', job: 'logs', to: 'mine', at: 'camp', weather: 'snow', time: 'noon' }, { zone: -1, dx: 40 }, 1800);
  await drive('pulp_end', { auto: true, truck: 'sk', job: 'pulp', to: 'pulp', at: 'camp', weather: 'clear', time: 'noon' }, { zone: -1, dx: 52 }, 1800);
  await drive('village', { auto: true, truck: 'cc', job: 'crates', to: 'sosn', at: 'camp', weather: 'clear', time: 'dusk' }, { zone: -1, dx: -10 }, 1800);
  await drive('zar_end', { auto: true, truck: 'cc', job: 'travel', to: 'zar', at: 'pulp', weather: 'clear', time: 'noon' }, { zone: -1, dx: -20 }, 1800);
  await drive('rail_end', { auto: true, truck: 'sk', job: 'planks', to: 'rail', at: 'mill', weather: 'clear', time: 'noon' }, { zone: -1, dx: 40 }, 1800);
  await drive('pit_end', { auto: true, truck: 'bars', job: 'travel', to: 'pit', at: 'mill', weather: 'clear', time: 'noon' }, { zone: -1, dx: 30 }, 1800);
  await drive('cut12', { auto: true, truck: 'bars', job: 'travel', to: 'cut12', at: 'camp', weather: 'clear', time: 'morning' }, { zone: -1, dx: 10 }, 1800);
  await drive('lesnoy', { auto: true, truck: 'cc', job: 'travel', to: 'lesnoy', at: 'depot', weather: 'clear', time: 'noon' }, { zone: -1, dx: 0 }, 1800);
  await drive('load_cc', { auto: true, truck: 'cc', job: 'pulp', to: 'mill', at: 'camp', weather: 'clear', time: 'noon' }, null, 1500);
  await drive('load_cc_drums', { auto: true, truck: 'cc', job: 'drums', to: 'cut12', at: 'depot', weather: 'clear', time: 'noon' }, null, 1500);
  await drive('load_bars', { auto: true, truck: 'bars', job: 'logs', to: 'mill', at: 'camp', weather: 'clear', time: 'noon' }, null, 1500);
  await drive('load_bars_crates', { auto: true, truck: 'bars', job: 'crates', to: 'sosn', at: 'port', weather: 'clear', time: 'noon' }, null, 1500);
  await drive('load_sk', { auto: true, truck: 'sk', job: 'pulp', to: 'pulp', at: 'camp', weather: 'clear', time: 'noon' }, null, 1500);
  await drive('load_sk_drums', { auto: true, truck: 'sk', job: 'drums', to: 'mine', at: 'depot', weather: 'clear', time: 'noon' }, null, 1500);
  await drive('load_sk_planks', { auto: true, truck: 'sk', job: 'planks', to: 'rail', at: 'mill', weather: 'clear', time: 'noon' }, null, 1500);
  await drive('load_sk_crates', { auto: true, truck: 'sk', job: 'crates', to: 'zar', at: 'port', weather: 'clear', time: 'noon' }, null, 1500);
  await drive('semi_flat', { truck: 'skt', job: 'planks', to: 'rail', at: 'mill', weather: 'clear', time: 'noon', auto: true }, { edge: 'e20', s: 300 }, 1800);
  await drive('semi_logs', { truck: 'skt', job: 'logs', to: 'mill', at: 'camp', weather: 'overcast', time: 'noon', auto: true }, { edge: 'e2', s: 250 }, 1800);
  await drive('semi_tank', { truck: 'skt', job: 'fuel', to: 'mine', at: 'depot', weather: 'clear', time: 'morning', auto: true }, { edge: 'e9', s: 300 }, 1800);
  await drive('semi_tip', { truck: 'skt', job: 'coal', to: 'rail', at: 'mine', weather: 'clear', time: 'noon', auto: true }, { edge: 'e10', s: 300 }, 1800);
  await drive('semi_climb', { truck: 'skt', job: 'logs', to: 'mill', at: 'camp', weather: 'clear', time: 'noon', roads: ['e1', 'e2', 'e3'] }, { edge: 'e3', s: 60 }, 6000, () => { __game.hud.touchIn.throttle = 1; });
  await drive('rescue', { truck: 'cc', job: 'rescue', edge: 'e3', s: 585, to: 'mill', at: 'camp', weather: 'overcast', time: 'noon', roads: ['e1', 'e2', 'e3'] }, { edge: 'e3', s: 600 }, 1800, () => { setTimeout(() => { __game.hud.touchIn.brake = 1; }, 400); setTimeout(() => { __game.hud.touchIn.brake = 0; }, 1200); });
  if (want('towing')) { await page.evaluate(() => { __game.doAction(); __game.hud.touchIn.throttle = 0.8; }); await sleep(3500); await shot('towing'); await page.evaluate(() => { __game.hud.touchIn.throttle = 0; }); }
  if (want('rehook')) {
    await page.evaluate(() => { const G = __game; G.sim.unhook(); G.sim.emit('tow', 'The tow bar snapped!', 'bad'); G.hud.touchIn.brake = 1; });
    await sleep(1500); await page.evaluate(() => { const G = __game; G.hud.touchIn.brake = 0; window.__gap = G.hitchGap(); window.__lbl = G.actionLabel(); });
    await shot('rehook');
    console.log('  gap after snap', await page.evaluate(() => window.__gap.toFixed(2)), 'action:', await page.evaluate(() => window.__lbl));
  }
  await drive('night', { truck: 'cc', job: 'pulp', to: 'mill', weather: 'clear', time: 'night', roads: ['e1', 'e2', 'e3'] }, { edge: 'e3', s: 140 }, 1500, () => { const c = __game.cfg(); c.addons = { lightbar: true, beacon: true }; __game.truck.lights = true; });
  await drive('blizzard', { auto: true, truck: 'sk', job: 'logs', to: 'mill', at: 'camp', weather: 'blizzard', time: 'noon' }, { edge: 'e2', s: 200 }, 2500);
  await drive('sk_day', { truck: 'sk', job: 'pulp', to: 'mill', weather: 'clear', time: 'noon' }, { edge: 'e1', s: 40 }, 1500);
  if (want('map_pause')) { await page.evaluate(() => { __z.start({ truck: 'cc', job: 'rescue', edge: 'e17', s: 900, to: 'camp', at: 'mill', weather: 'clear', roads: ['e17'] }); __z.teleport(__z.roadX('e17', 300)); }); await sleep(800); await page.evaluate(() => { __game.pause(); __game.openMap('pause'); }); await sleep(1500); await shot('map_pause'); await page.evaluate(() => { __game.closeMap(); __game.resume(); }); }
  if (want('garage_sk')) { await page.evaluate(() => { __game.gid = 'sk'; __game.cfg().loc = 'camp'; __game.toHub(); }); await sleep(900); await shot('garage_sk'); }
  if (want('garage_sk_mod')) { await page.evaluate(() => { const G = __game; G.gid = 'sk'; const c = G.cfg(); c.addons = { bullbar: true, lightbar: true, beacon: true, stakes: true, snorkel: true }; G.toHub(); }); await sleep(900); await shot('garage_sk_mod'); await page.evaluate(() => { const c = __game.cfg(); c.addons = {}; __game.gid = 'cc'; }); }
  if (want('results')) { await page.evaluate(() => { const G = __game; __z.start({ truck: 'cc', job: 'pulp', to: 'mill', at: 'camp' }); G.finish(true, '', 'mill'); }); await sleep(600); await shot('results'); }
  console.log(errs.length ? errs.slice(0, 20).join('\n') : 'no console errors');
  await browser.close();
})();
