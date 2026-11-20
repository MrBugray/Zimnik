// Fuel in a real browser: the tank carries over between drives, nothing is charged at the end of a job, refuelling
// at a pump (presets, the slider), a fuel truck where the pump doesn't sell your fuel, credit for a nearly empty
// tank, running dry on the road, job board estimates, and saving. node test/fuel.js [16x9]
const puppeteer = require('puppeteer-core'), path = require('path');
const OUT = '/tmp/claude-0/-home-claude/936babd9-14ae-5cd0-b1bf-6401ea6ac088/scratchpad/shots';
const PROFILE = '/tmp/claude-0/-home-claude/936babd9-14ae-5cd0-b1bf-6401ea6ac088/scratchpad/chrome-fuel';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').rmSync(PROFILE, { recursive: true, force: true });
  const narrow = process.argv[2] === '16x9';
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader'], userDataDir: PROFILE });
  const p = await b.newPage();
  await p.setViewport(narrow ? { width: 640, height: 360, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true } : { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.goto(url); await sleep(900);
  const ev = (f, a) => p.evaluate(f, a);
  const shot = n => p.screenshot({ path: OUT + '/' + n + (narrow ? '_16x9' : '') + '.png' });
  const settle = async ms => { await sleep(500); await ev(() => { __game.hud.touchIn.brake = 1; }); await sleep(ms || 700); await ev(() => { __game.hud.touchIn.brake = 0; }); await sleep(300); };
  const zone = dx => ev(dx => { const G = __game, z = G.course.zones[G.course.zones.length - 1]; __z.teleport((z.x0 + z.x1) / 2 + dx); }, dx || 0);
  const fuelTab = () => ev(() => { __game.gTab = 'fuel'; __game.fuelSel = null; __game.hud.renderGarage(); });
  const ui = () => ev(() => ({ txt: document.getElementById('fTxt').textContent, buy: document.getElementById('fBuy').textContent, dis: document.getElementById('fBuy').disabled, tab: document.querySelector('.gtab[data-k=fuel]').textContent, head: document.querySelector('.gcard.fuel b').textContent }));
  await ev(() => __game.toHub()); await sleep(500);
  console.log('start: cash', await ev(() => __game.cash), 'cc fuel', await ev(() => __game.cfg('cc').fuel), 'cap', await ev(() => __game.tankCap('cc')), 'lpkm', await ev(() => __game.cfg('cc').lpkm));
  // 1) a delivery with 60 L aboard: the fuel stays in the tank, nothing is charged for it
  await ev(() => { __z.start({ truck: 'cc', job: 'pulp', to: 'mill', auto: true, fuel: 60 }); });
  console.log('drive start fuel', await ev(() => __game.truck.fuel.toFixed(1)), 'mass with 60 L', await ev(() => Math.round(__game.truck.mass)));
  await ev(() => { __game.hud.touchIn.throttle = 1; }); await sleep(2500); await ev(() => { __game.hud.touchIn.throttle = 0; });
  await zone(-1); await settle(1600);
  const cash0 = await ev(() => __game.cash);
  await ev(() => __game.doAction()); await sleep(300);
  console.log('results:', await ev(() => document.querySelector('#ov h1').textContent), '| pay lines', await ev(() => [...document.querySelectorAll('.stats')][1].textContent.replace(/\s+/g, ' ').slice(0, 120)));
  console.log('fuel row:', await ev(() => { const s = [...document.querySelectorAll('.stats span')]; const i = s.findIndex(e => e.textContent === 'Fuel'); return i >= 0 ? s[i + 1].textContent : 'missing'; }), '| cfg fuel', await ev(() => __game.cfg('cc').fuel.toFixed(1)), '| lpkm now', await ev(() => __game.cfg('cc').lpkm.toFixed(2)), '| cash change', Math.round(await ev(() => __game.cash) - cash0));
  await shot('fuel_results');
  // 2) at the sawmill pump: presets, the slider, buying
  await ev(() => __game.toHub()); await sleep(500); await fuelTab(); await sleep(300);
  console.log('mill offer', JSON.stringify(await ev(() => { const o = __game.fuelOffer(); return { pump: o.pump, unit: o.unit, have: Math.round(o.have), max: o.max, buyMax: o.buyMax }; })), JSON.stringify(await ui()));
  await shot('fuel_tab');
  await ev(() => document.querySelector('.fp[data-fl]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  console.log('after +25 preset:', JSON.stringify(await ui()));
  // drag the slider to three quarters of the tank
  const box = await ev(() => { const r = document.getElementById('fSl').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await p.mouse.move(box.x + box.w * 0.2, box.y + box.h / 2); await p.mouse.down(); await p.mouse.move(box.x + box.w * 0.6, box.y + box.h / 2, { steps: 4 }); await p.mouse.move(box.x + box.w * 0.75, box.y + box.h / 2, { steps: 4 }); await p.mouse.up();
  console.log('after slider to 75%:', JSON.stringify(await ui()), 'sel', await ev(() => __game.fuelSel));
  await shot('fuel_slider');
  const c1 = await ev(() => __game.cash), f1 = await ev(() => __game.cfg().fuel);
  await ev(() => document.getElementById('fBuy').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await sleep(300);
  console.log('bought:', Math.round(await ev(() => __game.cfg().fuel) - f1), 'L for', Math.round(c1 - await ev(() => __game.cash)), '₽ | tab', await ev(() => document.querySelector('.gtab[data-k=fuel]').textContent));
  // fill up
  await fuelTab(); await ev(() => document.getElementById('fBuy').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await sleep(300);
  console.log('filled:', await ev(() => __game.cfg().fuel), '| ui', JSON.stringify(await ui()));
  // 3) the mine sells only diesel: a petrol truck gets the fuel truck
  await ev(() => { __game.cfg().loc = 'mine'; __game.cfg().fuel = 30; __game.toHub(); }); await sleep(600); await fuelTab();
  console.log('mine offer', JSON.stringify(await ev(() => { const o = __game.fuelOffer(); return { pump: o.pump, other: o.other, unit: o.unit, fee: o.fee, max: o.max }; })), JSON.stringify(await ui()));
  await shot('fuel_truck');
  const c2 = await ev(() => __game.cash);
  await ev(() => __game.refuel(40)); await sleep(200);
  console.log('fuel truck 40 L cost', Math.round(c2 - await ev(() => __game.cash)), 'fuel', await ev(() => __game.cfg().fuel));
  // diesel truck at the mine: the pump works, its price follows the mine's supply
  await ev(() => { __game.data.trucks.sk.loc = 'mine'; __game.gid = 'sk'; __game.toHub(); }); await sleep(600); await fuelTab();
  console.log('sk at mine', JSON.stringify(await ev(() => { const o = __game.fuelOffer(); return { pump: o.pump, unit: o.unit, word: __game.econ.fuelWord('mine'), short: +__game.econ.fuelShort('mine').toFixed(2) }; })));
  const before = await ev(() => __game.econ.fuelPrice('mine', 'diesel'));
  await ev(() => __game.econ.delivered({ kind: 'haul', cargo: 'fuel', to: 'mine', from: 'depot' }, 14));
  console.log('mine diesel', before, '→', await ev(() => __game.econ.fuelPrice('mine', 'diesel')), 'after 14 t delivered');
  // 4) broke with a nearly empty tank: enough to move on, on credit
  await ev(() => { __game.gid = 'cc'; __game.cfg().loc = 'camp'; __game.cfg().fuel = 4; __game.cash = 50; __game.toHub(); }); await sleep(600); await fuelTab();
  console.log('credit offer', JSON.stringify(await ev(() => { const o = __game.fuelOffer(); return { buyMax: o.buyMax, credit: o.credit }; })), JSON.stringify(await ui()));
  await ev(() => document.getElementById('fBuy').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await sleep(200);
  console.log('after credit: fuel', await ev(() => __game.cfg().fuel), 'cash', await ev(() => Math.round(__game.cash)));
  // 5) job board with too little fuel
  await ev(() => { __game.cash = 9000; __game.cfg().fuel = 12; __game.toHub(); __game.openJobs(); }); await sleep(500);
  console.log('board: low-fuel notes', await ev(() => document.querySelectorAll('.job small.lowf').length), '/', await ev(() => document.querySelectorAll('.job').length), '| first card', await ev(() => document.querySelector('.job span').textContent));
  await shot('fuel_jobs');
  // 6) run dry on the road: the help button brings 40 L
  await ev(() => { __z.start({ truck: 'cc', job: 'travel', to: 'mill', auto: true, fuel: 0.4 }); __game.hud.touchIn.throttle = 1; });
  let off = false; for (let i = 0; i < 60 && !off; i++) { await sleep(250); off = await ev(() => !__game.truck.engineOn); }
  await ev(() => { __game.hud.touchIn.throttle = 0; });
  console.log('engine off', off, 'fuel', await ev(() => __game.truck.fuel.toFixed(2)));
  await ev(() => __game.fuelHelp()); await sleep(300);
  console.log('after help: fuel', await ev(() => __game.truck.fuel.toFixed(1)), 'engine', await ev(() => __game.truck.engineOn), 'fuelCost', await ev(() => __game.fuelCost), 'toast', await ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).pop()));
  await ev(() => __game.towToClosest()); await sleep(300);
  console.log('tow pay', await ev(() => [...document.querySelectorAll('.stats')][1].textContent.replace(/\s+/g, ' ').slice(0, 140)));
  // 7) saved
  await ev(() => { __game.toHub(); __game.cfg('cc').fuel = 77; __game.saveNow(); });
  await p.reload(); await sleep(1200);
  console.log('after reload: cc fuel', await ev(() => __game.cfg('cc').fuel), 'sk fuel', await ev(() => Math.round(__game.cfg('sk').fuel)), 'lpkm', await ev(() => __game.cfg('cc').lpkm.toFixed(2)));
  console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors');
  await b.close();
})();
