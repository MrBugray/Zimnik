// Game flow in a real browser: secrets, salvage, deliveries, trucks staying where they finish, travel, rescue with a
// snapped and re-attached tow bar, ice failure, workshops, the tractor, persistence. node test/flow.js
const puppeteer = require('puppeteer-core'), path = require('path');
const OUT = '/tmp/claude-0/-home-claude/936babd9-14ae-5cd0-b1bf-6401ea6ac088/scratchpad/shots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PROFILE = '/tmp/claude-0/-home-claude/936babd9-14ae-5cd0-b1bf-6401ea6ac088/scratchpad/chrome-profile';
(async () => {
  // fresh profile each run: the game saves when the page is hidden, so clearing storage and navigating would re-save the old state
  require('fs').rmSync(PROFILE, { recursive: true, force: true });
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader'], userDataDir: PROFILE });
  const p = await b.newPage();
  await p.setViewport({ width: 800, height: 360, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.goto(url); await sleep(900);
  const ev = (f, a) => p.evaluate(f, a);
  const settle = async ms => { await sleep(500); await ev(() => { __game.hud.touchIn.brake = 1; }); await sleep(ms || 700); await ev(() => { __game.hud.touchIn.brake = 0; }); await sleep(300); };
  const zone = dx => ev(dx => { const G = __game, z = G.course.zones[G.course.zones.length - 1]; __z.teleport((z.x0 + z.x1) / 2 + dx); }, dx || 0);
  console.log('start cash', await ev(() => __game.cash), 'state', await ev(() => __game.state), 'locs', await ev(() => Object.keys(__game.data.trucks).map(k => k + '@' + __game.data.trucks[k].loc).join(' ')));
  // 1) the old sign on the camp road reveals the zimnik; the fork then offers it
  await ev(() => { __z.start({ truck: 'cc', job: 'pulp', to: 'mill', weather: 'clear', time: 'noon', roads: ['e1'] }); __z.teleport(__z.roadX('e1', 297)); }); await sleep(2600);
  console.log('zimnik found:', await ev(() => __game.secret('zimnik')));
  await ev(() => __game.chooseRoad('e2'));
  console.log('fork options:', await ev(() => __game.trip.pending.opts.map(o => __w.EDGES[o.edge].name).join(', ')));
  // 2) salvage by the culvert
  await ev(() => { __z.start({ truck: 'cc', job: 'pulp', to: 'mill', roads: ['e1'] }); __z.teleport(__z.roadX('e1', 174)); }); await settle();
  console.log('action near crate:', await ev(() => __game.actionLabel()));
  await ev(() => __game.doAction()); await sleep(200);
  console.log('ctis owned:', await ev(() => !!__game.data.trucks.cc.owned['ctis:ctis']), 'bars owned:', await ev(() => !!__game.data.trucks.bars.owned['ctis:ctis']));
  // 3) pulpwood to the sawmill: the truck stays there
  await ev(() => { __z.start({ truck: 'cc', job: 'pulp', to: 'mill', auto: true }); }); await zone(-1); await settle(1600);
  console.log('zone action:', await ev(() => __game.actionLabel()));
  await ev(() => __game.doAction()); await sleep(300);
  console.log('after delivery:', await ev(() => __game.state), 'cash', await ev(() => Math.round(__game.cash)), 'title', await ev(() => document.querySelector('#ov h1').textContent), 'truck at', await ev(() => __game.loc));
  await p.screenshot({ path: OUT + '/flow_results.png' });
  await ev(() => __game.toHub()); await sleep(400);
  console.log('hub:', await ev(() => __game.state + ' ' + __game.scene()), 'loc chip:', await ev(() => document.getElementById('gLoc').textContent), 'board:', await ev(() => __game.econ.board(__game.loc, __game).map(j => j.kind + ':' + (j.cargo || '') + '>' + j.to).join(' ')));
  console.log('sawmill lumber stock after pulpwood:', await ev(() => __game.econ.stock('mill', 'planks').toFixed(1)));
  // 4) drive empty to the railway siding and park: an outdoor hub there
  await ev(() => { __game.startTravel('rail'); for (let i = 0; i < 8 && __game.trip.pending; i++) __game.chooseRoad(__game.trip.pending.opts[0].edge); }); await zone(); await settle(1200);
  console.log('park action:', await ev(() => __game.actionLabel()));
  await ev(() => __game.doAction()); await sleep(300); await ev(() => __game.toHub()); await sleep(600);
  console.log('now at', await ev(() => __game.loc), 'scene', await ev(() => __game.scene()), 'workshop here:', await ev(() => __game.workshopHere()));
  await p.screenshot({ path: OUT + '/flow_yardhub.png' });
  // 5) rescue on the siding road: hook up, the bar snaps, put it back on, drop it at the sawmill workshop
  await ev(() => { __z.start({ truck: 'cc', job: 'rescue', edge: 'e20', s: 420, to: 'mill', auto: true }); });
  await ev(() => { const st = __game.stranded; __z.teleport(st.x + 9); }); await settle(1000);
  console.log('rescue action:', await ev(() => __game.actionLabel()));
  await ev(() => __game.doAction()); await sleep(600);
  console.log('towing:', await ev(() => !!__game.sim.tow), 'vehicles', await ev(() => __game.sim.vehicles.length));
  await ev(() => { __game.sim.unhook(); }); await settle(800);
  console.log('after snap: towing', await ev(() => !!__game.sim.tow), 'gap', await ev(() => __game.hitchGap().toFixed(2)), 'action:', await ev(() => __game.actionLabel()));
  await ev(() => __game.doAction()); await sleep(400);
  console.log('re-attached:', await ev(() => !!__game.sim.tow));
  await zone(4); await settle(1600);
  console.log('drop action:', await ev(() => __game.actionLabel()));
  await ev(() => { __game.sim.unhook(); }); await sleep(200);
  console.log('drop action off the bar (truck in the zone):', await ev(() => __game.actionLabel()));
  await ev(() => __game.doAction()); await sleep(300);
  console.log('rescue result:', await ev(() => document.querySelector('#ov h1') && document.querySelector('#ov h1').textContent), 'cash', await ev(() => Math.round(__game.cash)), 'at', await ev(() => __game.loc));
  // 6) thaw: a loaded Skinnerd on the ice road breaks through and is towed back to the start
  await ev(() => { __game.data.trucks.sk.loc = 'port'; __z.start({ truck: 'sk', job: 'crates', to: 'sosn', weather: 'thaw', roads: ['e18'], auto: true }); __z.teleport(__z.roadX('e18', 500)); });
  let st = ''; for (let i = 0; i < 90 && st !== 'results'; i++) { await sleep(500); st = await ev(() => __game.state); }
  console.log('thaw ice:', st, await ev(() => (document.querySelector('#ov p') || {}).textContent), 'sk at', await ev(() => __game.data.trucks.sk.loc));
  // 7) the tractor: tanker of diesel from the depot to the mine
  await ev(() => { __game.data.trucks.skt.loc = 'depot'; __z.start({ truck: 'skt', job: 'fuel', to: 'mine', weather: 'clear', auto: true }); });
  console.log('rig:', await ev(() => __game.truck.semi ? __game.truck.semi.id + ' ' + __game.truck.semi.bulkUnits + ' t' : 'none'), 'vehicles', await ev(() => __game.sim.vehicles.length));
  await zone(); await settle(1600);
  console.log('tractor action:', await ev(() => __game.actionLabel()));
  await ev(() => __game.doAction()); await sleep(300);
  console.log('tractor result:', await ev(() => document.querySelector('#ov h1').textContent), await ev(() => [...document.querySelectorAll('.stats span')].map(e => e.textContent).slice(8, 10).join(' ')));
  // 8) workshops: parts at the camp garage; none in a village (with the test toggle off)
  await ev(() => { __game.gid = 'cc'; __game.cfg().loc = 'camp'; __game.cash = 30000; __game.toHub(); });
  await ev(() => { __game.garageAct('buy', 'engine', 'i683'); __game.garageAct('buy', 'gearbox', 'g6cc'); __game.garageAct('buyaddon', null, 'bullbar'); __game.garageAct('fit', 'ctis', 'ctis'); });
  console.log('fitted:', await ev(() => [__game.cfg().parts.engine, __game.cfg().parts.gearbox, __game.cfg().parts.ctis].join('/')), 'garage truck', await ev(() => __game.gsim.truck.eng.name));
  await ev(() => { __game.cfg().loc = 'sosn'; __game.toHub(); __game.garageAct('fit', 'engine', 'v862'); });
  console.log('in Sosnovka without a workshop, engine still:', await ev(() => __game.cfg().parts.engine), 'scene', await ev(() => __game.scene()));
  await ev(() => { __game.cfg().loc = 'camp'; __game.saveNow(); });
  // 9) persistence
  await p.reload(); await sleep(1200);
  console.log('after reload: cash', await ev(() => __game.cash), 'engine', await ev(() => __game.cfg('cc').parts.engine), 'secrets', await ev(() => JSON.stringify(__game.data.secrets)), 'found', await ev(() => JSON.stringify(__game.data.found)), 'locs', await ev(() => Object.keys(__game.data.trucks).map(k => k + '@' + __game.data.trucks[k].loc).join(' ')), 'day', await ev(() => __game.data.world.day));
  console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors');
  await b.close();
})();
