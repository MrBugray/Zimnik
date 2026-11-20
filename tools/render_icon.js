// Renders tools/icon.svg to PNG at the requested size: node render_icon.js out.png 192
const puppeteer = require('puppeteer-core'), fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2], size = +(process.argv[3] || 192);
  const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await p.setContent('<html><body style="margin:0;background:#000">' + svg.replace('width="192" height="192"', `width="${size}" height="${size}"`) + '</body></html>');
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: size, height: size } });
  await b.close(); console.log('icon', out, size);
})();
