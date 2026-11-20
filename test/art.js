// The drawn Skinnerd 143H tractor in a real browser: garage, paint, driving, the pass, night, an outdoor yard, frame time.
// node test/art.js
const puppeteer = require('puppeteer-core'), path = require('path');
const OUT = '/tmp/claude-0/-home-claude/936babd9-14ae-5cd0-b1bf-6401ea6ac088/scratchpad/shots';
const PROFILE = '/tmp/claude-0/-home-claude/936babd9-14ae-5cd0-b1bf-6401ea6ac088/scratchpad/chrome-art';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').rmSync(PROFILE, { recursive: true, force: true });
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader'], userDataDir: PROFILE });
  const p = await b.newPage();
  await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.goto(url); await sleep(900);
  const ev = (f, a) => p.evaluate(f, a);
  const shot = n => p.screenshot({ path: OUT + '/' + n + '.png' });
  console.log('art ready', await ev(() => !!__w.artImg('skt')), 'bounds', JSON.stringify(await ev(() => __w.ART_BOUNDS.skt.map(v => +v.toFixed(2)))));
  // garage at the camp workshop
  await ev(() => { __game.toHub(); while (__game.gid !== 'skt') __game.switchTruck(1); }); await sleep(900);
  console.log('garage:', await ev(() => document.getElementById('gName').textContent + ' / ' + document.getElementById('gCls').textContent), 'stats', await ev(() => document.getElementById('gStats').textContent.replace(/\s+/g, ' ').slice(0, 120)));
  await shot('art_garage');
  await ev(() => { __game.garageAct('paint', 'c1', '#2d5d9a'); }); await sleep(600);
  await shot('art_garage_blue');
  console.log('paint tab:', await ev(() => document.getElementById('gCards').textContent.replace(/\s+/g, ' ').slice(0, 100)));
  await ev(() => { __game.gTab = 'engine'; __game.hud.renderGarage(); }); await sleep(200);
  console.log('engine tab cards', await ev(() => document.querySelectorAll('#gCards .gcard').length), '| body tab', await ev(() => { __game.gTab = 'body'; __game.hud.renderGarage(); return document.getElementById('gCards').textContent; }));
  // driving: flat start, then rolling
  await ev(() => { __game.garageAct('paint', 'c1', '#b8322a'); __z.start({ truck: 'skt', job: 'travel', to: 'mill', weather: 'clear', time: 'noon', auto: true }); }); await sleep(1500);
  await shot('art_drive_start');
  await ev(() => { __game.hud.touchIn.throttle = 1; }); await sleep(4000);
  console.log('rolling: v', await ev(() => __game.truck.vF.toFixed(1)), 'm/s, wheel angle', await ev(() => __game.truck.wheels[0].body.getAngle().toFixed(2)), 'pitch', await ev(() => (__game.truck.chassis.getAngle() * 57.3).toFixed(1)));
  await shot('art_drive_moving');
  await ev(() => { __game.hud.touchIn.throttle = 0; __game.hud.touchIn.brake = 1; }); await sleep(1500); await ev(() => { __game.hud.touchIn.brake = 0; });
  // on the pass, climbing
  await ev(() => { __z.teleport(__z.roadX('e3', 470)); }); await sleep(800);
  await ev(() => { __game.hud.touchIn.throttle = 1; }); await sleep(3000);
  console.log('on the pass: v', await ev(() => __game.truck.vF.toFixed(1)), 'pitch', await ev(() => (__game.truck.chassis.getAngle() * 57.3).toFixed(1)), 'gear', await ev(() => __game.truck.gearLabel()));
  await shot('art_pass');
  // frame time with the drawn truck on screen
  const ft = await ev(async () => { const t = []; let last = performance.now(); for (let i = 0; i < 90; i++) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); t.push(n - last); last = n; } t.sort((a, b) => a - b); return t[45].toFixed(1); });
  console.log('median frame ms (software GL):', ft);
  await ev(() => { __game.hud.touchIn.throttle = 0; });
  // night and a blizzard
  await ev(() => { __z.start({ truck: 'skt', job: 'travel', to: 'mill', weather: 'clear', time: 'night', auto: true }); __game.hud.touchIn.throttle = 1; }); await sleep(2500); await ev(() => { __game.hud.touchIn.throttle = 0; });
  await shot('art_night');
  await ev(() => { __z.start({ truck: 'skt', job: 'travel', to: 'mill', weather: 'blizzard', time: 'dusk', auto: true }); __game.hud.touchIn.throttle = 1; }); await sleep(2500); await ev(() => { __game.hud.touchIn.throttle = 0; });
  await shot('art_blizzard');
  // parked out in a yard without a workshop
  await ev(() => { __game.weather = 'overcast'; __game.timeKey = 'morning'; __game.cfg('skt').loc = 'depot'; __game.toHub(); }); await sleep(1200);
  await shot('art_yard');
  console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors');
  await b.close();
})();
