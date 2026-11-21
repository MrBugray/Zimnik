// Fork hold (the drive waits at a junction for a choice) and the random road events (Windows: Chrome/Edge)
const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const fs = require('fs');
const exe = fs.existsSync(CHROME) ? CHROME : 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 900, height: 420, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const url = 'http://127.0.0.1:8931/index.html';
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.goto(url); await sleep(1200);
  const ev = (f, a) => p.evaluate(f, a);
  await p.tap('#oCont'); await sleep(500);

  // ---- 1) fork hold: no road picked, the truck brakes to a stop at the pad and the drive waits ----
  await ev(() => { __z.start({ truck: 'cc', job: 'travel', to: 'mill', weather: 'clear' }); });
  const hold = await ev(async () => {
    const G = __game, pn = G.trip.pending, sleep = ms => new Promise(r => setTimeout(r, ms));
    __z.teleport(pn.auto - 8);
    G.hud.touchIn.throttle = 1;                       // rolling toward the pad without choosing
    for (let i = 0; i < 40 && !G.forkHold; i++) await sleep(100);
    G.hud.touchIn.throttle = 0;
    if (!G.forkHold) return { held: false };
    const c0 = G.clock, t0 = G.runT;
    await sleep(600);
    return { held: true, frozen: G.clock === c0 && G.runT === t0, v: G.truck.vF, card: !document.getElementById('fork').hidden, state: G.state };
  });
  console.log('fork hold:', JSON.stringify(hold));
  await p.tap('#forkOpts .fo'); await sleep(300);
  console.log('after pick: forkHold', await ev(() => __game.forkHold), 'decision', await ev(() => __game.trip.decisions.map(d => d.edge).join(',')));

  // ---- 2) closed road event: rolled at launch, the road is not on offer and routes go round it ----
  const closed = await ev(() => {
    const G = __game, rnd = Math.random;
    Math.random = () => 0.05;                          // event roll fires, closed branch taken
    let out = null;
    // find a job pair whose shortest route has a detour
    G.gid = 'cc'; G.cfg().loc = 'camp'; G.cfg().road = null; G.cfg().job = null;
    G.startTravel('mill');
    Math.random = rnd;
    out = { closedEdge: G.closedEdge, opts: G.trip.pending ? G.trip.pending.opts.map(o => o.edge) : [], alt: G.closedEdge ? __w.route('camp', 'mill', new Set([G.closedEdge]), () => true).d : 0 };
    G.pause(); G.toHub();
    return out;
  });
  console.log('closed road:', JSON.stringify(closed));

  // ---- 3) stuck driver: appears on the road, stop by it, pull them out for cash ----
  const stuck = await ev(async () => {
    const G = __game, sleep = ms => new Promise(r => setTimeout(r, ms));
    __z.start({ truck: 'cc', job: 'travel', to: 'mill', weather: 'clear', roads: ['e1', 'e2', 'e3'], auto: true });
    G.eventAt = __z.roadX('e1', 250); G.placeStuck();
    if (!G.stuck) return { placed: false };
    __z.teleport(__z.roadX('e1', 244));
    G.hud.touchIn.brake = 1;
    for (let i = 0; i < 30 && Math.abs(G.truck.vF) > 0.5; i++) await sleep(100);
    G.hud.touchIn.brake = 0;
    const cash0 = G.cash, label = G.actionLabel();
    G.doAction(); await sleep(200);
    return { placed: true, label, gained: Math.round(G.cash - cash0), gone: !G.stuck };
  });
  console.log('stuck driver:', JSON.stringify(stuck));

  console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
