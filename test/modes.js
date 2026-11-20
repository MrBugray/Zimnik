// Mode select + truck buying flow check (Windows: uses Edge)
const puppeteer = require('puppeteer-core'), path = require('path');
const EDGE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const fs = require('fs');
const exe = fs.existsSync(EDGE) ? EDGE : 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 900, height: 420, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const url = 'http://127.0.0.1:8931/index.html';
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.goto(url); await sleep(1200);
  const ev = (f, a) => p.evaluate(f, a);
  console.log('title state:', await ev(() => __game.state), 'mode:', await ev(() => __game.data.mode));
  // pick the normal way
  await p.tap('#oNorm'); await sleep(600);
  console.log('after oNorm: mode', await ev(() => __game.data.mode), 'state', await ev(() => __game.state), 'unlockAll', await ev(() => __game.settings.unlockAll),
    'owned', await ev(() => JSON.stringify(__game.data.ownedTrucks)), 'cash', await ev(() => __game.cash));
  // the Polaris is owned: parts cost money
  console.log('gGo:', await ev(() => document.getElementById('gGo').textContent));
  await ev(() => { __game.garageAct('buy', 'engine', 'i683'); });
  console.log('buy engine without cash: engine still', await ev(() => __game.cfg().parts.engine));
  // switch to the Bars: for sale
  await ev(() => __game.switchTruck(1)); await sleep(400);
  console.log('bars: gGo', await ev(() => document.getElementById('gGo').textContent), 'cls', await ev(() => document.getElementById('gCls').textContent));
  await ev(() => { __game.cash = 30000; __game.buyTruck(); }); await sleep(400);
  console.log('bought bars: owned', await ev(() => JSON.stringify(__game.data.ownedTrucks)), 'cash', await ev(() => __game.cash), 'gGo', await ev(() => document.getElementById('gGo').textContent));
  // jobs blocked for an unowned truck
  await ev(() => { __game.switchTruck(1); __game.openJobs(); });
  console.log('jobs on unowned sk: state', await ev(() => __game.state), 'gid', await ev(() => __game.gid));
  // reload: mode persists, title shows Continue
  await p.goto(url); await sleep(1200);
  console.log('after reload: mode', await ev(() => __game.data.mode), 'continue btn:', await ev(() => { const b = document.getElementById('oCont'); return b && b.textContent; }), 'owned', await ev(() => JSON.stringify(__game.data.ownedTrucks)));
  // new roads exist and route
  console.log('edges:', await ev(() => Object.keys(__w.EDGES).length), 'route camp>cut12:', await ev(() => __w.route('camp', 'cut12', null, () => true).edges.join(',')));
  console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
