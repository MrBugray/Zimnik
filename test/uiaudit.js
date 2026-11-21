// throwaway UI audit: screenshots of the main screens at S24-Ultra landscape size
const puppeteer = require('puppeteer-core');
const exe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 915, height: 412, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true });
  const url = 'http://127.0.0.1:8931/index.html';
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.goto(url); await sleep(1500);
  const shot = n => p.screenshot({ path: '/tmp/uishots/' + n + '.png' });
  const vis = id => p.evaluate(i => { const e = document.getElementById(i); if (!e) return 'missing'; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight, visible: r.bottom <= window.innerHeight && r.top >= 0 }; }, id);
  await shot('01_title');
  await p.tap('#oSet'); await sleep(500); await shot('02_settings');
  // scroll the settings panel to the bottom; everything must become reachable
  await p.evaluate(() => { const f = document.querySelector('.panel.full'); f.scrollTop = f.scrollHeight; });
  await sleep(300); await shot('02b_settings_bottom');
  console.log('oBack after scroll:', JSON.stringify(await vis('oBack')));
  console.log('seg buttons unreachable by scroll:', await p.evaluate(() => {
    const f = document.querySelector('.panel.full'); let bad = 0;
    document.querySelectorAll('.seg button').forEach(q => { if (q.offsetTop < 0 || q.offsetTop + q.offsetHeight > f.scrollHeight) bad++; });
    return bad + ' / ' + document.querySelectorAll('.seg button').length;
  }));
  await p.tap('#oBack'); await sleep(300);
  await p.tap('#oCont'); await sleep(800); await shot('03_hub');
  await p.tap('#gGo'); await sleep(800); await shot('04_jobs');
  await p.evaluate(() => { __z.start({ truck: 'cc', job: 'pulp', to: 'mill', weather: 'snow' }); });
  await sleep(1200); await shot('05_fork');
  await p.evaluate(() => __game.pause()); await sleep(500); await shot('06_pause');
  await p.evaluate(() => __game.resume());
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
