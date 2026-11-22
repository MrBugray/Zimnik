// ===== roadside decor (world space, y up) =====
function wtext(ctx, R, x, y, str, size, color, align, weight) {
  const px = size * R.ppm; if (px < 4) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1 / R.ppm, -1 / R.ppm);
  ctx.font = (weight || 700) + ' ' + px.toFixed(1) + 'px "Barlow Condensed","Arial Narrow",sans-serif';
  ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(str, 0, 0); ctx.restore();
}
function box(ctx, x, y, w, h, fill, R, lw) { ctx.beginPath(); ctx.rect(x, y, w, h); fs(ctx, fill, R ? R.ol : null, lw || 0.045); }
function snowCap(ctx, R, x, y, w, h) { ctx.beginPath(); ctx.moveTo(x - 0.05, y); ctx.quadraticCurveTo(x + w * 0.5, y + h * 1.6, x + w + 0.05, y); ctx.lineTo(x + w, y - h * 0.4); ctx.lineTo(x, y - h * 0.4); ctx.closePath(); fs(ctx, R.snow, R.ol, 0.03); }
function puffs(ctx, R, x, y, t, k, n) {
  for (let i = 0; i < (n || 5); i++) {
    const f = ((t * 0.35 + i / (n || 5)) % 1);
    ctx.fillStyle = css(R.smokeC, 0.45 * (1 - f));
    ctx.beginPath(); ctx.arc(x + f * (1.6 + R.wind * 0.25) * k, y + f * 3.2 * k, (0.18 + f * 0.6) * k, 0, TAU); ctx.fill();
  }
}
const DECOR = {
  spruce(ctx, d, y, L, P, c, t, lights, R) {
    const z = d.z || 0, k = 1 - 0.28 * z, h = d.h * k, w = h * 0.44, fz = z * 0.22;
    ctx.save(); ctx.translate(d.x, y - 0.02); ctx.rotate(d.lean || 0);
    box(ctx, -h * 0.03, -0.05, h * 0.06, h * 0.2, L('#5b4636', fz), R, 0.035);
    const sp = sprucePoly(0, 0, h, w, 0.22, d.seed);
    pathPts(ctx, sp.body); fs(ctx, L(z > 0.5 ? '#4a5f52' : '#3e5447', fz), R.ol, 0.05);
    ctx.fillStyle = z > 0.5 ? css(mixc(P.snow, P.fogc, P.fogL.world + 0.15)) : R.snow;
    for (const s of sp.snow) { pathPts(ctx, s); ctx.fill(); }
    ctx.restore();
  },
  dwarf(ctx, d, y, L, P, c, t, lights, R) { DECOR.spruce(ctx, d, y, L, P, c, t, lights, R); },
  fir(ctx, d, y, L, P, c, t, lights, R) { DECOR.spruce(ctx, { x: d.x, h: 1.5, z: 0.1, seed: d.seed, lean: 0.08 }, y, L, P, c, t, lights, R); },
  birch(ctx, d, y, L, P, c, t, lights, R) {
    const z = d.z || 0, k = 1 - 0.28 * z, h = d.h * k, fz = z * 0.22;
    const b = new Path2D(), m = new Path2D(), cr = new Path2D(); addBirch(b, m, d.x, y - 0.05, h, d.seed, cr);
    ctx.globalAlpha = 0.3; ctx.fillStyle = L('#6f5f60', fz); ctx.fill(cr); ctx.globalAlpha = 1;
    ctx.fillStyle = L('#e8e3d7', fz); ctx.fill(b); ctx.strokeStyle = R.ol; ctx.lineWidth = 0.035; ctx.stroke(b);
    ctx.fillStyle = L('#2a2421', fz); ctx.fill(m);
  },
  pole(ctx, d, y, L, P, c, t, lights, R) {
    box(ctx, d.x - 0.09, y - 0.2, 0.18, d.h + 0.2, L('#5e4a39'), R);
    box(ctx, d.x - 0.7, y + d.h - 0.45, 1.4, 0.12, L('#5e4a39'), R, 0.035);
    for (const o of [-0.55, 0.55]) box(ctx, d.x + o - 0.05, y + d.h - 0.33, 0.1, 0.18, L('#cfd8d6'), R, 0.03);
    snowCap(ctx, R, d.x - 0.7, y + d.h - 0.33, 1.4, 0.06);
  },
  kmpost(ctx, d, y, L, P, c, t, lights, R) {
    box(ctx, d.x - 0.06, y - 0.1, 0.12, 1.15, L('#e9e6de'), R, 0.035);
    box(ctx, d.x - 0.06, y + 0.85, 0.12, 0.2, L('#222'), R, 0.03);
    box(ctx, d.x - 0.32, y + 1.05, 0.64, 0.36, L('#e9e6de'), R, 0.035);
    wtext(ctx, R, d.x, y + 1.23, d.label + ' km', 0.24, L('#222'));
  },
  sign(ctx, d, y, L, P, c, t, lights, R) {
    box(ctx, d.x - 1.0, y - 0.2, 0.12, 2.6, L('#5e4a39'), R); box(ctx, d.x + 0.88, y - 0.2, 0.12, 2.6, L('#5e4a39'), R);
    box(ctx, d.x - 1.25, y + 1.55, 2.5, 0.95, L('#2e5a84'), R);
    ctx.strokeStyle = L('#e9e6de'); ctx.lineWidth = 0.035; ctx.strokeRect(d.x - 1.18, y + 1.62, 2.36, 0.81);
    wtext(ctx, R, d.x, y + 2.18, d.text[0], 0.3, L('#f1ede2')); wtext(ctx, R, d.x, y + 1.85, d.text[1], 0.22, L('#cfe0ec'), 'center', 600);
    snowCap(ctx, R, d.x - 1.25, y + 2.5, 2.5, 0.07);
  },
  warn(ctx, d, y, L, P, c, t, lights, R) {
    box(ctx, d.x - 0.05, y - 0.1, 0.1, 2.2, L('#8b8c88'), R, 0.035);
    pathPts(ctx, [[d.x - 0.48, y + 1.65], [d.x + 0.48, y + 1.65], [d.x, y + 2.47]]); fs(ctx, L('#c8372c'), R.ol, 0.04);
    pathPts(ctx, [[d.x - 0.36, y + 1.72], [d.x + 0.36, y + 1.72], [d.x, y + 2.33]]); fs(ctx, L('#f1ede2'), null);
    wtext(ctx, R, d.x, y + 1.9, d.text, d.text.length > 4 ? 0.13 : 0.2, L('#222'));
  },
  icesign(ctx, d, y, L, P, c, t, lights, R) {
    box(ctx, d.x - 0.05, y - 0.1, 0.1, 2.3, L('#8b8c88'), R, 0.035);
    box(ctx, d.x - 0.75, y + 1.5, 1.5, 0.85, L('#2e5a84'), R);
    wtext(ctx, R, d.x, y + 2.06, 'ICE CROSSING', 0.22, L('#f1ede2')); wtext(ctx, R, d.x, y + 1.76, 'max 20 t · no stopping', 0.16, L('#cfe0ec'), 'center', 600);
  },
  fsign(ctx, d, y, L, P, c, t, lights, R) {
    const opts = d.opts || [], n = Math.max(1, opts.length), gap = n > 4 ? 0.5 : 0.62, top = y + 0.75 + n * gap + 0.35;
    box(ctx, d.x - 0.08, y - 0.2, 0.16, top - y + 0.2, L('#5e4a39'), R);
    opts.forEach((o, i) => {
      const yy = top - 0.42 - i * gap, tilt = ((i % 3) - 1) * 0.07, pick = d.pick === o.id, len = 2.3;
      ctx.save(); ctx.translate(d.x + 0.05, yy); ctx.rotate(tilt);
      pathPts(ctx, [[0, -0.21], [len - 0.3, -0.21], [len, 0], [len - 0.3, 0.21], [0, 0.21]]); fs(ctx, L(pick ? '#f0c14e' : o.secret ? '#8a7e6a' : '#e9e3d3'), R.ol, 0.04);
      ctx.restore();
      wtext(ctx, R, d.x + 0.05 + (len - 0.3) / 2 + 0.05, yy + tilt * 1.1, o.label, o.label.length > 10 ? 0.19 : 0.22, L(o.secret && !pick ? '#f3ead7' : '#2a2520'));
    });
    snowCap(ctx, R, d.x - 0.12, top, 0.24, 0.06);
  },
  sideroads(ctx, d, y, L, P, c, t, lights, R) {
    const draw = (ang, len, dim) => {
      const y2 = y + len * Math.sin(ang), x2 = d.x + len * Math.cos(ang);
      ctx.beginPath(); ctx.moveTo(d.x - 5, y - 0.05); ctx.lineTo(x2 - 0.6, y2); ctx.lineTo(x2 + 0.6, y2); ctx.lineTo(d.x + 7, y - 0.05); ctx.closePath();
      ctx.fillStyle = d.ice ? css(mixc(P.ice, P.snow, 0.35 + dim)) : css(mixc(P.snow, P.snowShade, 0.35 + dim), 1); ctx.fill();
      ctx.strokeStyle = css(mixc(d.ice ? P.iceDeep : P.snowShade, P.outline, 0.25)); ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(d.x - 2, y - 0.05); ctx.lineTo(x2 - 0.2, y2); ctx.moveTo(d.x + 4, y - 0.05); ctx.lineTo(x2 + 0.2, y2); ctx.stroke();
    };
    const A = [[0.62, 9], [0.2, 16], [0.36, 12], [0.48, 10]];
    for (let i = 0; i < Math.min(4, d.n || 0); i++) draw(A[i][0], A[i][1], i * 0.08);
  },
  oldsign(ctx, d, y, L, P, c, t, lights, R) {
    ctx.save(); ctx.translate(d.x, y - 0.3); ctx.rotate(-0.22);
    box(ctx, -0.06, 0, 0.12, 2.0, L('#4d3b2e'), R, 0.035);
    box(ctx, -0.95, 1.35, 1.9, 0.62, L('#8a5a3c'), R);
    ctx.fillStyle = L('#6b3f26'); ctx.fillRect(-0.9, 1.4, 0.5, 0.2); ctx.fillRect(0.3, 1.7, 0.5, 0.18);
    wtext(ctx, R, 0, 1.75, 'ZIMNIK', 0.3, L('#e3d7c0')); wtext(ctx, R, 0, 1.5, 'closed 1987', 0.15, L('#d6c8b0'), 'center', 600);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(d.x - 1.4, y); ctx.quadraticCurveTo(d.x, y + 0.9, d.x + 1.5, y); ctx.closePath(); fs(ctx, R.snow, R.ol, 0.035);
  },
  culvert(ctx, d, y, L, P, c, t, lights, R) {
    const cy = y - 1.25;
    ctx.beginPath(); ctx.arc(d.x, cy, 0.62, 0, TAU); fs(ctx, L('#8f8b84'), R.ol);
    ctx.beginPath(); ctx.arc(d.x, cy, 0.48, 0, TAU); fs(ctx, L('#1d1a18'), R.ol, 0.035);
    ctx.fillStyle = css(mixc(P.ice, [255, 255, 255], 0.3));
    for (let i = 0; i < 5; i++) { const x = d.x - 0.36 + i * 0.18; ctx.beginPath(); ctx.moveTo(x - 0.04, cy - 0.45); ctx.lineTo(x + 0.04, cy - 0.45); ctx.lineTo(x, cy - 0.7 - 0.12 * hashf(i, 3)); ctx.closePath(); ctx.fill(); }
  },
  cabin(ctx, d, y, L, P, c, t, lights, R) {
    const x = d.x - d.w / 2, h = d.h;
    box(ctx, x, y - 0.2, d.w, h, L('#7a5236'), R);
    ctx.strokeStyle = L('#4a311f'); ctx.lineWidth = 0.035;
    for (let yy = y + 0.1; yy < y + h - 0.2; yy += 0.3) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + d.w, yy); ctx.stroke(); }
    for (let yy = y; yy < y + h - 0.3; yy += 0.3) for (const xx of [x - 0.12, x + d.w + 0.12]) { ctx.beginPath(); ctx.arc(xx, yy + 0.15, 0.14, 0, TAU); fs(ctx, L('#c9a77c'), R.ol, 0.025); }
    pathPts(ctx, [[x - 0.6, y + h - 0.25], [d.x, y + h + d.w * 0.32], [x + d.w + 0.6, y + h - 0.25]]); fs(ctx, L('#4f4a45'), R.ol);
    pathPts(ctx, [[x - 0.6, y + h - 0.25], [d.x, y + h + d.w * 0.32], [x + d.w + 0.6, y + h - 0.25], [x + d.w + 0.3, y + h - 0.05], [d.x, y + h + d.w * 0.32 - 0.3], [x - 0.3, y + h - 0.05]]); fs(ctx, R.snow, R.ol, 0.035);
    box(ctx, d.x + d.w * 0.18, y + h - 0.2 + d.w * 0.12, 0.35, 0.9, L('#5a524a'), R, 0.035);
    const lit = P.dark > 0.08;
    box(ctx, x + 0.9, y + 0.8, 0.9, 0.85, lit ? '#ffcf7a' : L('#33414a'), R, 0.04);
    ctx.strokeStyle = L('#3f6fa0'); ctx.lineWidth = 0.09; ctx.strokeRect(x + 0.86, y + 0.76, 0.98, 0.93);
    box(ctx, x + d.w - 1.7, y - 0.2, 0.9, 1.9, L('#5b3d28'), R, 0.04);
    if (lit) lights.push({ type: 'glow', x: x + 1.35, y: y + 1.2, r: 2.2, col: '#ffcf7a' });
  },
  logpile(ctx, d, y, L, P, c, t, lights, R) {
    const r = 0.24, rows = 4; let cnt = 0;
    for (let row = 0; row < rows; row++) {
      const n = Math.max(1, Math.round(d.n / 2) - row);
      for (let i = 0; i < n; i++) {
        const x = d.x + (i - (n - 1) / 2) * r * 2.02, yy = y + r + row * r * 1.75 - 0.08;
        ctx.beginPath(); ctx.arc(x, yy, r, 0, TAU); fs(ctx, L('#d4b184'), R.ol, 0.04);
        ctx.beginPath(); ctx.arc(x, yy, r * 0.55, 0, TAU); ctx.strokeStyle = L('#ad8656'); ctx.lineWidth = 0.025; ctx.stroke();
        cnt++;
      }
    }
    ctx.beginPath(); ctx.ellipse(d.x, y + r * 1.75 * (rows - 1) + r * 2 - 0.05, r * 1.6, 0.1, 0, 0, TAU); ctx.fillStyle = R.snow; ctx.fill();
  },
  loader(ctx, d, y, L, P, c, t, lights, R) {
    box(ctx, d.x - 1.4, y - 0.2, 2.8, 1.0, L('#5b5852'), R);
    box(ctx, d.x - 0.25, y + 0.8, 0.5, 2.4, L('#c79b3a'), R);
    ctx.save(); ctx.translate(d.x, y + 3.1); ctx.rotate(0.35 + 0.04 * Math.sin(t * 0.4));
    box(ctx, -0.2, -0.15, 4.4, 0.3, L('#c79b3a'), R); ctx.restore();
    const bx = d.x + 4.4 * Math.cos(0.35), by = y + 3.1 + 4.4 * Math.sin(0.35);
    ctx.strokeStyle = L('#2b2926'); ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 1.2); ctx.stroke();
    pathPts(ctx, [[bx - 0.4, by - 1.2], [bx + 0.4, by - 1.2], [bx + 0.25, by - 1.75], [bx, by - 1.5], [bx - 0.25, by - 1.75]]); fs(ctx, L('#3a3733'), R.ol, 0.035);
    snowCap(ctx, R, d.x - 1.4, y + 0.8, 2.8, 0.08);
  },
  barrels(ctx, d, y, L, P, c, t, lights, R) {
    for (const [o, col] of [[-0.5, '#3d5c7a'], [0.25, '#8a3b2c']]) { box(ctx, d.x + o, y - 0.1, 0.6, 0.9, L(col), R); ctx.strokeStyle = L('#222'); ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(d.x + o, y + 0.2); ctx.lineTo(d.x + o + 0.6, y + 0.2); ctx.moveTo(d.x + o, y + 0.55); ctx.lineTo(d.x + o + 0.6, y + 0.55); ctx.stroke(); snowCap(ctx, R, d.x + o, y + 0.8, 0.6, 0.05); }
    ctx.beginPath(); ctx.ellipse(d.x + 1.4, y + 0.28, 0.2, 0.3, 0, 0, TAU); fs(ctx, L('#5c6b3e'), R.ol, 0.04);
    box(ctx, d.x + 1.4, y - 0.02, 0.8, 0.6, L('#5c6b3e'), R, 0.04);
  },
  lamp(ctx, d, y, L, P, c, t, lights, R) {
    box(ctx, d.x - 0.08, y - 0.2, 0.16, 5.2, L('#5e4a39'), R);
    ctx.strokeStyle = L('#2c2a27'); ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(d.x, y + 4.8); ctx.quadraticCurveTo(d.x + 0.6, y + 5.2, d.x + 1.0, y + 4.8); ctx.stroke();
    pathPts(ctx, [[d.x + 0.75, y + 4.8], [d.x + 1.25, y + 4.8], [d.x + 1.1, y + 4.6], [d.x + 0.9, y + 4.6]]); fs(ctx, L('#2c2a27'), R.ol, 0.03);
    if (P.dark > 0.05) { ctx.fillStyle = '#fff1c8'; ctx.fillRect(d.x + 0.88, y + 4.56, 0.24, 0.05); lights.push({ type: 'glow', x: d.x + 1.0, y: y + 4.4, r: 3.2, col: '#ffd99a', big: true }); }
  },
  rock(ctx, d, y, L, P, c, t, lights, R) {
    const z = d.z || 0, r = d.r * (1 - 0.3 * z), fz = z * 0.25, yy = y - 0.2;
    const pts = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; pts.push([d.x + Math.cos(a) * r * (1 + 0.25 * hashf(i, d.seed)), yy + Math.sin(a) * r * (0.7 + 0.3 * hashf(i + 9, d.seed))]); }
    pathPts(ctx, pts); fs(ctx, L('#77736e', fz), R.ol, 0.045);
    ctx.beginPath(); ctx.ellipse(d.x - r * 0.1, yy + r * 0.62, r * 0.6, r * 0.18, 0, 0, TAU); ctx.fillStyle = R.snow; ctx.fill();
  },
  cairn(ctx, d, y, L, P, c, t, lights, R) {
    for (let i = 0; i < 6; i++) { const row = i < 3 ? 0 : i < 5 ? 1 : 2, n = 3 - row, k = i - (row === 0 ? 0 : row === 1 ? 3 : 5); ctx.beginPath(); ctx.ellipse(d.x + (k - (n - 1) / 2) * 0.55, y + 0.22 + row * 0.38, 0.3, 0.22, 0, 0, TAU); fs(ctx, L('#7d7873'), R.ol, 0.035); }
    box(ctx, d.x - 0.04, y + 0.8, 0.08, 2.6, L('#5e4a39'), R, 0.03);
  },
  snowpole(ctx, d, y, L, P, c, t, lights, R) { for (let i = 0; i < 6; i++) box(ctx, d.x - 0.05, y - 0.2 + i * 0.45, 0.1, 0.45, L(i % 2 ? '#e9e6de' : '#c23a2c'), R, 0.025); },
  marker(ctx, d, y, L, P, c, t, lights, R) {
    box(ctx, d.x - 0.04, y - 0.1, 0.08, 1.6, L('#5e4a39'), R, 0.03);
  },
  fishhut(ctx, d, y, L, P, c, t, lights, R) {
    box(ctx, d.x - 1, y - 0.1, 2, 1.8, L('#6d5a45'), R);
    ctx.strokeStyle = L('#4a3b2d'); ctx.lineWidth = 0.03; for (let x = d.x - 0.8; x < d.x + 1; x += 0.35) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 1.7); ctx.stroke(); }
    pathPts(ctx, [[d.x - 1.2, y + 1.7], [d.x + 1.2, y + 2.1], [d.x + 1.2, y + 1.85], [d.x - 1.2, y + 1.5]]); fs(ctx, L('#4f4a45'), R.ol);
    box(ctx, d.x + 0.5, y + 1.95, 0.14, 0.6, L('#3a3733'), R, 0.03);
    if (P.dark > 0.08) lights.push({ type: 'glow', x: d.x, y: y + 1, r: 1.6, col: '#ffcf7a' });
  },
  bridge(ctx, d, y, L, P, c, t, lights, R) {
    const x0 = d.x, x1 = d.x1, wood = L('#5b4330');
    for (let x = x0 + 4; x < x1 - 2; x += 6) {
      const top = c.hAt(x) - 0.3, bot = c.visAt(x);
      if (isNaN(bot)) continue;
      box(ctx, x - 0.15, bot, 0.3, top - bot, wood, R); box(ctx, x + 1.6, bot, 0.3, top - bot, wood, R);
      ctx.strokeStyle = wood; ctx.lineWidth = 0.14; ctx.beginPath();
      for (let yy = bot; yy < top - 1; yy += 2.6) { ctx.moveTo(x, yy); ctx.lineTo(x + 1.75, Math.min(top, yy + 2.6)); ctx.moveTo(x + 1.75, yy); ctx.lineTo(x, Math.min(top, yy + 2.6)); }
      ctx.stroke();
    }
    for (const ax of [x0, x1]) { const top = c.hAt(ax), bot = top - 9; box(ctx, ax - 1.6, bot, 3.2, top - bot - 0.25, L('#8a857c'), R); ctx.strokeStyle = L('#5f5a52'); ctx.lineWidth = 0.035; for (let yy = bot + 0.6; yy < top; yy += 0.6) { ctx.beginPath(); ctx.moveTo(ax - 1.6, yy); ctx.lineTo(ax + 1.6, yy); ctx.stroke(); } }
    for (let x = x0; x <= x1; x += 2.5) box(ctx, x - 0.06, c.hAt(x), 0.12, 1.0, wood, R, 0.03);
    ctx.strokeStyle = wood; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.moveTo(x0, c.hAt(x0) + 0.95); for (let x = x0; x <= x1; x += 2.5) ctx.lineTo(x, c.hAt(x) + 0.95); ctx.stroke();
  },
  // steel girder bridge on concrete piers over the river: water under the span, frozen over (slushy in the thaw)
  rbridge(ctx, d, y, L, P, c, t, lights, R) {
    const x0 = d.x, x1 = d.x1, wl = d.wl || 6, fog = k => css(P.fogL.world > 0 ? mixc(k, P.fogc, P.fogL.world) : k);
    const deck = x => c.hAt(x), bed = x => { const v = c.visAt(x); return isNaN(v) ? deck(x) - 2 : v; }, wy = x => deck(x) - wl;
    const xs = []; for (let x = x0; x < x1; x += 1) xs.push(x); xs.push(x1);
    // the river: from the water line down to the bed, wherever the bed lies below it
    ctx.beginPath(); ctx.moveTo(xs[0], wy(xs[0]));
    for (const x of xs) ctx.lineTo(x, wy(x));
    for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], Math.min(bed(xs[i]), wy(xs[i])));
    ctx.closePath(); ctx.fillStyle = fog(P.water); ctx.fill();
    const thaw = P.wkey === 'thaw';
    ctx.beginPath(); let on = false;
    for (const x of xs) { const top = wy(x); if (bed(x) < top - 0.05) { if (!on) { ctx.moveTo(x, top); on = true; } else ctx.lineTo(x, top); } }
    if (on) { for (let i = xs.length - 1; i >= 0; i--) { const x = xs[i]; if (bed(x) < wy(x) - 0.05) ctx.lineTo(x, wy(x) + 0.32); } ctx.closePath(); ctx.fillStyle = fog(thaw ? mixc(P.ice, P.water, 0.45) : P.ice); ctx.fill(); }
    const conc = L('#8f8b84'), concD = L('#6f6b64'), steel = L('#56606a'), steelD = L('#3d454d');
    // piers from the river bed up to the girders, with a cutwater at the ice line
    for (let x = x0 + 22; x < x1 - 14; x += 24) {
      const top = deck(x) - 1.55, bot = bed(x) - 0.6;
      box(ctx, x - 0.85, bot, 1.7, top - bot, conc, R); box(ctx, x - 1.15, top - 0.35, 2.3, 0.35, concD, R, 0.03);
      if (bed(x) < wy(x)) box(ctx, x - 0.95, wy(x) - 0.5, 1.9, 0.9, concD, R, 0.03);
    }
    // abutments where the banks meet the deck
    for (const ax of [x0, x1]) { const top = deck(ax) - 0.25, bot = bed(ax) - 2.2, dir = ax === x0 ? -1 : 1; box(ctx, ax - 1.3 + dir * 1.0, bot, 2.6, top - bot, conc, R); ctx.strokeStyle = concD; ctx.lineWidth = 0.035; for (let yy = bot + 0.7; yy < top; yy += 0.7) { ctx.beginPath(); ctx.moveTo(ax - 1.3 + dir * 1.0, yy); ctx.lineTo(ax + 1.3 + dir * 1.0, yy); ctx.stroke(); } }
    // plate girders under the deck, stiffeners every two metres
    ctx.beginPath(); ctx.moveTo(x0, deck(x0) - 0.28); for (const x of xs) ctx.lineTo(x, deck(x) - 0.28); for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], deck(xs[i]) - 1.55); ctx.closePath(); fs(ctx, steel, R.ol, 0.05);
    ctx.strokeStyle = steelD; ctx.lineWidth = 0.05; ctx.beginPath(); for (let x = x0 + 1; x < x1; x += 2) { ctx.moveTo(x, deck(x) - 0.32); ctx.lineTo(x, deck(x) - 1.5); } ctx.stroke();
    ctx.lineWidth = 0.09; ctx.beginPath(); ctx.moveTo(x0, deck(x0) - 1.42); for (const x of xs) ctx.lineTo(x, deck(x) - 1.42); ctx.stroke();
    // railings
    const rail = L('#6b7076');
    for (let x = x0; x <= x1; x += 2.5) box(ctx, x - 0.05, deck(x), 0.1, 1.05, rail, R, 0.025);
    ctx.strokeStyle = rail; ctx.lineWidth = 0.1; for (const hgt of [1.0, 0.55]) { ctx.beginPath(); ctx.moveTo(x0, deck(x0) + hgt); for (const x of xs) ctx.lineTo(x, deck(x) + hgt); ctx.stroke(); }
  },
  corduroy(ctx, d, y, L, P, c, t, lights, R) { for (let x = d.x; x < d.x1; x += 0.3) { const yy = c.hAt(x) - 0.13; ctx.beginPath(); ctx.arc(x, yy, 0.12, 0, TAU); fs(ctx, L('#c9a57a'), R.ol, 0.02); } },
  wreck(ctx, d, y, L, P, c, t, lights, R) {
    ctx.save(); ctx.translate(d.x, y - 0.4); ctx.rotate(0.12);
    pathPts(ctx, [[-1.5, 0], [-1.5, 1.4], [-1.38, 1.55], [-0.3, 1.55], [0, 1.0], [1.4, 0.95], [1.5, 0]]); fs(ctx, L('#7b4f34'), R.ol);
    pathPts(ctx, [[-0.95, 0.95], [-0.95, 1.38], [-0.45, 1.38], [-0.2, 1.0]]); fs(ctx, L('#1f1d1b'), R.ol, 0.035);
    ctx.fillStyle = L('#5b3622'); ctx.beginPath(); ctx.ellipse(0.6, 0.5, 0.4, 0.2, 0, 0, TAU); ctx.ellipse(-1.1, 0.3, 0.3, 0.15, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(d.x - 2.4, y); ctx.quadraticCurveTo(d.x, y + 1.0, d.x + 2.4, y); ctx.closePath(); fs(ctx, R.snow, R.ol, 0.035);
  },
  shed(ctx, d, y, L, P, c, t, lights, R) {
    const x = d.x - d.w / 2, h = d.h;
    box(ctx, x, y - 0.2, d.w, h, L('#7f7a70'), R);
    ctx.strokeStyle = L('#625d55'); ctx.lineWidth = 0.035; for (let xx = x + 0.4; xx < x + d.w; xx += 0.45) { ctx.beginPath(); ctx.moveTo(xx, y - 0.2); ctx.lineTo(xx, y + h - 0.2); ctx.stroke(); }
    box(ctx, x + 4, y - 0.2, 7, 4.8, L('#221e1b'), R);
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + 5.2 + i * 1.4, y + 0.3, 0.32, 0, TAU); fs(ctx, L('#c9a57a'), R.ol, 0.03); }
    pathPts(ctx, [[x - 0.6, y + h - 0.2], [x + 2, y + h + 1.6], [x + d.w - 2, y + h + 1.6], [x + d.w + 0.6, y + h - 0.2]]); fs(ctx, L('#55524c'), R.ol);
    pathPts(ctx, [[x + 1.6, y + h + 1.35], [x + 2, y + h + 1.6], [x + d.w - 2, y + h + 1.6], [x + d.w - 1.6, y + h + 1.35]]); fs(ctx, R.snow, null);
    box(ctx, x + d.w * 0.55, y + h - 1.6, 6.5, 1.1, L('#2e5a84'), R);
    wtext(ctx, R, x + d.w * 0.55 + 3.25, y + h - 1.05, 'SAWMILL No 3', 0.62, L('#f1ede2'));
    if (P.dark > 0.05) for (let i = 0; i < 3; i++) lights.push({ type: 'glow', x: x + 5 + i * 2.5, y: y + 3.6, r: 2.2, col: '#ffd99a' });
  },
  stack(ctx, d, y, L, P, c, t, lights, R) {
    for (let i = 0; i < 6; i++) { box(ctx, d.x - 1.6, y - 0.15 + i * 0.32, 3.2, 0.22, L('#c9a46e'), R, 0.03); box(ctx, d.x - 1.4, y + 0.07 + i * 0.32, 0.12, 0.1, L('#7a5a3a'), R, 0.02); box(ctx, d.x + 1.28, y + 0.07 + i * 0.32, 0.12, 0.1, L('#7a5a3a'), R, 0.02); }
    snowCap(ctx, R, d.x - 1.6, y + 1.77, 3.2, 0.09);
  },
  zone(ctx, d, y, L, P, c, t, lights, R) {
    const x0 = d.x, x1 = d.x1, h = 5.0;
    ctx.strokeStyle = L('#e2b33b'); ctx.lineWidth = 0.08; ctx.setLineDash([0.6, 0.4]); ctx.beginPath(); ctx.moveTo(x0, c.hAt(x0) + 0.05); ctx.lineTo(x1, c.hAt(x1) + 0.05); ctx.stroke(); ctx.setLineDash([]);
    if (d.kind !== 'gantry') {
      // two striped posts and a small board
      for (const x of [x0, x1]) { const yy = c.hAt(x); for (let i = 0; i < 4; i++) box(ctx, x - 0.08, yy - 0.2 + i * 0.45, 0.16, 0.45, L(i % 2 ? '#2a2724' : '#e2b33b'), R, 0.025); }
      const yy = c.hAt(x0); box(ctx, x0 + 0.1, yy + 1.35, 1.9, 0.5, L('#2e5a84'), R, 0.03); wtext(ctx, R, x0 + 1.05, yy + 1.6, 'LOADING', 0.24, L('#f1ede2'));
      return;
    }
    for (const x of [x0, x1]) { for (let i = 0; i < 7; i++) box(ctx, x - 0.18, y - 0.2 + i * 0.75, 0.36, 0.75, L(i % 2 ? '#2a2724' : '#e2b33b'), R, 0.03); }
    box(ctx, x0 - 0.3, y + h, x1 - x0 + 0.6, 0.55, L('#e2b33b'), R);
    ctx.strokeStyle = L('#2a2724'); ctx.lineWidth = 0.05; for (let x = x0; x < x1; x += 0.9) { ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + 0.5, y + h + 0.55); ctx.stroke(); }
    box(ctx, (x0 + x1) / 2 - 2.6, y + h + 0.65, 5.2, 0.9, L('#2e5a84'), R);
    wtext(ctx, R, (x0 + x1) / 2, y + h + 1.1, 'LOAD · UNLOAD', 0.42, L('#f1ede2'));
  },
  crate(ctx, d, y, L, P, c, t, lights, R) {
    ctx.save(); ctx.translate(d.x, y - 0.18); ctx.rotate(-0.07);
    box(ctx, -0.72, 0, 1.44, 0.92, L('#7d5c3c'), R);
    ctx.strokeStyle = L('#4f3824'); ctx.lineWidth = 0.045; ctx.beginPath(); ctx.moveTo(-0.72, 0.46); ctx.lineTo(0.72, 0.46); ctx.moveTo(-0.72, 0.02); ctx.lineTo(0.72, 0.9); ctx.stroke();
    box(ctx, -0.56, 0.58, 0.56, 0.24, L('#c9b48a'), R, 0.03);
    wtext(ctx, R, -0.28, 0.70, 'PARTS', 0.13, L('#3a2a1c'));
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(d.x - 1.3, y); ctx.quadraticCurveTo(d.x - 0.2, y + 0.75, d.x + 1.4, y); ctx.closePath(); fs(ctx, R.snow, R.ol, 0.035);
    if (P.dark > 0.1) lights.push({ type: 'glow', x: d.x + 0.5, y: y + 1.15, r: 1.2, col: '#fff4c8', soft: 1 });
  },
  // ----- yard ends: what stops you -----
  barrier(ctx, d, y, L, P, c, t, lights, R) {
    const x = d.x, k = d.kind;
    if (k === 'logs') {
      const r = 0.3; for (let row = 0; row < 4; row++) for (let i = 0; i < 2; i++) { const cx = x - 0.3 + i * 0.6 + (row % 2) * 0.12, cy = y + r + row * r * 1.75 - 0.15; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); fs(ctx, L('#c9a77c'), R.ol, 0.04); ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TAU); ctx.strokeStyle = L('#a5825a'); ctx.lineWidth = 0.025; ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(x, y + 2.35, 0.75, 0.12, 0, 0, TAU); ctx.fillStyle = R.snow; ctx.fill();
    } else if (k === 'fence') {
      box(ctx, x - 0.55, y - 0.2, 1.1, 2.4, L('#7d5a3c'), R);
      ctx.strokeStyle = L('#5a3f29'); ctx.lineWidth = 0.035; for (let yy = y + 0.2; yy < y + 2.1; yy += 0.3) { ctx.beginPath(); ctx.moveTo(x - 0.55, yy); ctx.lineTo(x + 0.55, yy); ctx.stroke(); }
      box(ctx, x - 0.7, y + 2.15, 1.4, 0.12, L('#5a3f29'), R, 0.03);
      ctx.beginPath(); ctx.arc(x, y + 1.35, 0.36, 0, TAU); fs(ctx, L('#c8372c'), R.ol, 0.035); ctx.fillStyle = L('#f1ede2'); ctx.fillRect(x - 0.24, y + 1.3, 0.48, 0.1);
      snowCap(ctx, R, x - 0.7, y + 2.27, 1.4, 0.07);
    } else if (k === 'concrete' || k === 'blocks') {
      const n = k === 'blocks' ? 2 : 4, bh = 2.4 / n;
      for (let i = 0; i < n; i++) { if (k === 'blocks') { pathPts(ctx, [[x - 0.6, y - 0.2 + i * bh], [x + 0.6, y - 0.2 + i * bh], [x + 0.32, y - 0.2 + (i + 1) * bh], [x - 0.32, y - 0.2 + (i + 1) * bh]]); fs(ctx, L(i % 2 ? '#c9c4b8' : '#b9b4a8'), R.ol, 0.04); ctx.fillStyle = L(i % 2 ? '#c8372c' : '#f1ede2'); ctx.fillRect(x - 0.4, y + i * bh + bh * 0.35, 0.8, 0.12); }
        else { box(ctx, x - 0.6, y - 0.2 + i * bh, 1.2, bh, L(i % 2 ? '#a9a49a' : '#9a958b'), R, 0.04); } }
      if (k === 'concrete') { box(ctx, x - 0.05, y + 2.2, 0.1, 0.8, L('#8b8c88'), R, 0.03); ctx.beginPath(); ctx.arc(x, y + 3.2, 0.32, 0, TAU); fs(ctx, L('#c8372c'), R.ol, 0.035); wtext(ctx, R, x, y + 3.2, 'STOP', 0.16, L('#f1ede2')); }
      snowCap(ctx, R, x - 0.6, y + 2.2, 1.2, 0.07);
    } else if (k === 'rock') {
      const rs = [[-0.5, 0.45, 0.65], [0.45, 0.4, 0.6], [0, 1.2, 0.62], [-0.35, 1.85, 0.45], [0.35, 1.8, 0.4], [0, 2.3, 0.3]];
      for (const [dx, dy, r] of rs) { const pts = []; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; pts.push([x + dx + Math.cos(a) * r * (0.85 + 0.25 * hashf(i, d.seed + dx * 10)), y - 0.2 + dy + Math.sin(a) * r * 0.8]); } pathPts(ctx, pts); fs(ctx, L(dy > 1 ? '#7d7873' : '#6f6a65'), R.ol, 0.04); }
      ctx.beginPath(); ctx.ellipse(x, y + 2.45, 0.4, 0.1, 0, 0, TAU); ctx.fillStyle = R.snow; ctx.fill();
    } else if (k === 'buffer') {
      ctx.strokeStyle = L('#3a3834'); ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(x - 0.9, y + 0.1); ctx.lineTo(x + 0.6, y + 0.1); ctx.stroke();
      pathPts(ctx, [[x - 0.6, y], [x + 0.5, y], [x + 0.5, y + 1.3], [x + 0.25, y + 1.3]]); fs(ctx, L('#4a4743'), R.ol, 0.04);
      box(ctx, x - 0.7, y + 0.75, 0.25, 0.5, L('#d9d4c8'), R, 0.03); for (let i = 0; i < 3; i++) box(ctx, x - 0.62, y + 0.8 + i * 0.16, 0.12, 0.08, L('#c8372c'), null);
      box(ctx, x - 0.45, y + 0.9, 0.95, 0.3, L('#c8372c'), R, 0.035); ctx.fillStyle = L('#f1ede2'); for (let xx = x - 0.35; xx < x + 0.5; xx += 0.3) ctx.fillRect(xx, y + 0.92, 0.12, 0.26);
    }
  },
  // ----- buildings -----
  bldg(ctx, d, y, L, P, c, t, lights, R) {
    const w = d.w, h = d.h, x = d.x - w / 2, wall = L(d.wall || '#7f7a70'), lit = d.lit && P.dark > 0.08;
    box(ctx, x, y - 0.2, w, h + 0.2, wall, R);
    ctx.strokeStyle = L(shadeHex(d.wall || '#7f7a70', -0.2)); ctx.lineWidth = 0.03; for (let xx = x + 0.45; xx < x + w; xx += 0.45) { ctx.beginPath(); ctx.moveTo(xx, y - 0.2); ctx.lineTo(xx, y + h); ctx.stroke(); }
    if (d.roof === 'flat') { box(ctx, x - 0.2, y + h, w + 0.4, 0.3, L('#55524c'), R); snowCap(ctx, R, x - 0.2, y + h + 0.3, w + 0.4, 0.1); }
    else if (d.roof === 'shed') { pathPts(ctx, [[x - 0.4, y + h], [x + w + 0.4, y + h], [x + w + 0.4, y + h + 0.5], [x - 0.4, y + h + 1.3]]); fs(ctx, L('#55524c'), R.ol); pathPts(ctx, [[x - 0.4, y + h + 1.3], [x + w + 0.4, y + h + 0.5], [x + w + 0.4, y + h + 0.68], [x - 0.4, y + h + 1.5]]); fs(ctx, R.snow, R.ol, 0.03); }
    else { const rh = Math.min(2.4, w * 0.3); pathPts(ctx, [[x - 0.5, y + h - 0.1], [d.x, y + h + rh], [x + w + 0.5, y + h - 0.1]]); fs(ctx, L('#4f4a45'), R.ol); pathPts(ctx, [[x - 0.5, y + h - 0.1], [d.x, y + h + rh], [x + w + 0.5, y + h - 0.1], [x + w + 0.2, y + h + 0.12], [d.x, y + h + rh - 0.3], [x - 0.2, y + h + 0.12]]); fs(ctx, R.snow, R.ol, 0.035); }
    if (d.door === 'big') { const dw = Math.min(w * 0.5, 5.2), dh = Math.min(h - 0.6, 4.4); box(ctx, d.x - dw / 2, y - 0.2, dw, dh + 0.2, L('#6a6c69'), R); ctx.strokeStyle = L('#4c4e4b'); ctx.lineWidth = 0.035; for (let yy = y + 0.2; yy < y + dh; yy += 0.3) { ctx.beginPath(); ctx.moveTo(d.x - dw / 2, yy); ctx.lineTo(d.x + dw / 2, yy); ctx.stroke(); } }
    else if (d.door === 'small') box(ctx, x + w - 1.6, y - 0.2, 0.9, 2.0, L('#5b3d28'), R, 0.04);
    const nw = d.win || 0;
    for (let i = 0; i < nw; i++) { const wx = x + (i + 0.5) * w / (nw + (d.door === 'small' ? 0.6 : 0)) - 0.4, wy = y + Math.min(1.0, h * 0.35); box(ctx, wx, wy, 0.8, 0.75, lit ? '#ffcf7a' : L('#33414a'), R, 0.035); if (lit) lights.push({ type: 'glow', x: wx + 0.4, y: wy + 0.35, r: 1.6, col: '#ffcf7a' }); }
    if (d.sign) { const sw = Math.min(w - 0.6, d.sign.length * 0.36 + 0.6); box(ctx, d.x - sw / 2, y + h - 1.0, sw, 0.7, L('#2e5a84'), R, 0.035); wtext(ctx, R, d.x, y + h - 0.65, d.sign, 0.36, L('#f1ede2')); }
    if (lit) lights.push({ type: 'glow', x: d.x, y: y + h - 1.4, r: 2.4, col: '#ffd99a', big: true });
  },
  izba(ctx, d, y, L, P, c, t, lights, R) {
    const w = d.w || 6.5, h = 3.0, x = d.x - w / 2, lit = P.dark > 0.08;
    box(ctx, x, y - 0.2, w, h + 0.2, L('#7a5236'), R);
    ctx.strokeStyle = L('#4a311f'); ctx.lineWidth = 0.035; for (let yy = y + 0.1; yy < y + h - 0.1; yy += 0.28) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
    for (let yy = y; yy < y + h - 0.2; yy += 0.28) for (const xx of [x - 0.1, x + w + 0.1]) { ctx.beginPath(); ctx.arc(xx, yy + 0.14, 0.13, 0, TAU); fs(ctx, L('#c9a77c'), R.ol, 0.022); }
    pathPts(ctx, [[x - 0.6, y + h - 0.2], [d.x, y + h + w * 0.36], [x + w + 0.6, y + h - 0.2]]); fs(ctx, L('#5a5550'), R.ol);
    pathPts(ctx, [[x - 0.6, y + h - 0.2], [d.x, y + h + w * 0.36], [x + w + 0.6, y + h - 0.2], [x + w + 0.3, y + h], [d.x, y + h + w * 0.36 - 0.28], [x - 0.3, y + h]]); fs(ctx, R.snow, R.ol, 0.035);
    box(ctx, d.x + w * 0.22 - 0.17, y + h + w * 0.1, 0.34, w * 0.26, L('#6a625a'), R, 0.03);
    for (const wx of [x + w * 0.22, x + w * 0.62]) { box(ctx, wx - 0.12, y + 0.85, 0.94, 0.95, L('#3f6fa0'), R, 0.035); box(ctx, wx, y + 0.95, 0.7, 0.75, lit ? '#ffcf7a' : L('#33414a'), null); ctx.fillStyle = L('#3f6fa0'); ctx.fillRect(wx + 0.33, y + 0.95, 0.04, 0.75); if (lit) lights.push({ type: 'glow', x: wx + 0.35, y: y + 1.3, r: 1.6, col: '#ffcf7a' }); }
    pathPts(ctx, [[d.x - 0.4, y + h + 0.3], [d.x, y + h + 0.9], [d.x + 0.4, y + h + 0.3]]); fs(ctx, L('#e9e3d3'), R.ol, 0.025);
  },
  church(ctx, d, y, L, P, c, t, lights, R) {
    const x = d.x;
    box(ctx, x - 2.4, y - 0.2, 4.8, 3.6, L('#8a6040'), R);
    ctx.strokeStyle = L('#5a3f29'); ctx.lineWidth = 0.035; for (let yy = y + 0.1; yy < y + 3.3; yy += 0.28) { ctx.beginPath(); ctx.moveTo(x - 2.4, yy); ctx.lineTo(x + 2.4, yy); ctx.stroke(); }
    pathPts(ctx, [[x - 2.8, y + 3.4], [x, y + 4.6], [x + 2.8, y + 3.4]]); fs(ctx, L('#4f6a5a'), R.ol); snowCap(ctx, R, x - 2.6, y + 3.5, 5.2, 0.08);
    box(ctx, x - 0.8, y + 4.2, 1.6, 2.0, L('#8a6040'), R);
    ctx.beginPath(); ctx.moveTo(x - 0.95, y + 6.2); ctx.bezierCurveTo(x - 1.3, y + 7.0, x - 0.3, y + 7.4, x, y + 8.1); ctx.bezierCurveTo(x + 0.3, y + 7.4, x + 1.3, y + 7.0, x + 0.95, y + 6.2); ctx.closePath(); fs(ctx, L('#4f7a8a'), R.ol, 0.04);
    ctx.strokeStyle = L('#c9a33a'); ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(x, y + 8.1); ctx.lineTo(x, y + 8.9); ctx.moveTo(x - 0.3, y + 8.6); ctx.lineTo(x + 0.3, y + 8.6); ctx.stroke();
    box(ctx, x - 0.45, y - 0.2, 0.9, 2.1, L('#4a311f'), R, 0.04);
    if (P.dark > 0.08) lights.push({ type: 'glow', x, y: y + 1.0, r: 2.0, col: '#ffcf7a' });
  },
  well(ctx, d, y, L, P, c, t, lights, R) {
    box(ctx, d.x - 0.6, y - 0.2, 1.2, 0.9, L('#7a5236'), R, 0.035);
    for (const o of [-0.5, 0.42]) box(ctx, d.x + o - 0.04, y + 0.7, 0.08, 1.2, L('#5e4a39'), R, 0.025);
    pathPts(ctx, [[d.x - 0.8, y + 1.8], [d.x, y + 2.35], [d.x + 0.8, y + 1.8]]); fs(ctx, L('#5a5550'), R.ol, 0.035); snowCap(ctx, R, d.x - 0.7, y + 1.85, 1.4, 0.05);
    ctx.strokeStyle = L('#2a2522'); ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(d.x, y + 1.6); ctx.lineTo(d.x, y + 1.1); ctx.stroke(); box(ctx, d.x - 0.1, y + 0.95, 0.2, 0.18, L('#6b7174'), R, 0.02);
  },
  vboard(ctx, d, y, L, P, c, t, lights, R) {
    for (const o of [-0.65, 0.55]) box(ctx, d.x + o, y - 0.2, 0.1, 2.0, L('#5e4a39'), R, 0.03);
    box(ctx, d.x - 0.8, y + 1.0, 1.6, 0.95, L('#7a5a3c'), R, 0.035);
    const pp = [['#efe9d6', -0.62, 1.15, 0.5, 0.6], ['#e4ddc6', -0.02, 1.32, 0.42, 0.5], ['#f3eedf', 0.38, 1.12, 0.3, 0.38]];
    for (const [col, ox, oy, w, h] of pp) { box(ctx, d.x + ox, y + oy, w, h, L(col), R, 0.02); ctx.fillStyle = L('#6b6152'); for (let k = 0; k < 3; k++) ctx.fillRect(d.x + ox + 0.06, y + oy + h - 0.12 - k * 0.12, w * 0.7, 0.03); }
    pathPts(ctx, [[d.x - 0.95, y + 1.95], [d.x, y + 2.25], [d.x + 0.95, y + 1.95]]); fs(ctx, L('#4f4a45'), R.ol, 0.03);
  },
  vagon(ctx, d, y, L, P, c, t, lights, R) {
    const x = d.x;
    box(ctx, x - 2.6, y - 0.1, 5.2, 0.25, L('#3a3834'), R, 0.035);
    rr(ctx, x - 2.5, y + 0.15, 5.0, 2.4, 0.2); fs(ctx, L('#b8322a'), R.ol);
    ctx.fillStyle = L('#e9e3d3'); ctx.fillRect(x - 2.5, y + 1.95, 5.0, 0.22);
    box(ctx, x - 1.9, y + 1.0, 1.1, 0.8, P.dark > 0.08 ? '#ffcf7a' : L('#33414a'), R, 0.035); box(ctx, x + 0.9, y + 0.15, 0.85, 1.8, L('#6b2a24'), R, 0.035);
    box(ctx, x + 1.6, y + 2.55, 0.16, 0.7, L('#3a3733'), R, 0.03); snowCap(ctx, R, x - 2.5, y + 2.55, 5.0, 0.09);
    if (P.dark > 0.08) lights.push({ type: 'glow', x: x - 1.35, y: y + 1.4, r: 1.7, col: '#ffcf7a' });
  },
  hut(ctx, d, y, L, P, c, t, lights, R) {
    box(ctx, d.x - 1.6, y - 0.2, 3.2, 2.0, L('#6d5a45'), R);
    ctx.strokeStyle = L('#4a3b2d'); ctx.lineWidth = 0.03; for (let yy = y + 0.1; yy < y + 1.7; yy += 0.25) { ctx.beginPath(); ctx.moveTo(d.x - 1.6, yy); ctx.lineTo(d.x + 1.6, yy); ctx.stroke(); }
    pathPts(ctx, [[d.x - 2, y + 1.7], [d.x, y + 2.8], [d.x + 2, y + 1.7]]); fs(ctx, L('#4f4a45'), R.ol); snowCap(ctx, R, d.x - 1.8, y + 1.8, 3.6, 0.1);
    box(ctx, d.x + 0.5, y - 0.2, 0.7, 1.5, L('#3f2b1c'), R, 0.03);
    ctx.strokeStyle = L('#c9c2b2'); ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(d.x - 1.2, y + 1.0); ctx.lineTo(d.x - 0.2, y + 1.0); ctx.moveTo(d.x - 0.9, y + 1.0); ctx.lineTo(d.x - 0.95, y + 0.7); ctx.moveTo(d.x - 0.5, y + 1.0); ctx.lineTo(d.x - 0.45, y + 0.7); ctx.stroke();
  },
  ruin(ctx, d, y, L, P, c, t, lights, R) {
    ctx.save(); ctx.translate(d.x, y); ctx.rotate(-0.06);
    pathPts(ctx, [[-2.6, -0.2], [-2.6, 1.6], [-1.2, 2.0], [0.4, 1.2], [1.8, 1.4], [2.4, -0.2]]); fs(ctx, L('#6a4a33'), R.ol);
    ctx.strokeStyle = L('#3f2b1c'); ctx.lineWidth = 0.035; for (let yy = 0.1; yy < 1.4; yy += 0.28) { ctx.beginPath(); ctx.moveTo(-2.6, yy); ctx.lineTo(2.4, yy); ctx.stroke(); }
    pathPts(ctx, [[-2.9, 1.5], [-0.8, 2.6], [1.4, 1.3], [1.6, 1.5], [-0.8, 2.85], [-3.0, 1.7]]); fs(ctx, L('#4f4a45'), R.ol, 0.04);
    box(ctx, -1.6, 0.6, 0.7, 0.6, L('#1f1d1b'), R, 0.03);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(d.x - 3.2, y); ctx.quadraticCurveTo(d.x, y + 1.1, d.x + 3.0, y); ctx.closePath(); fs(ctx, R.snow, R.ol, 0.035);
  },
  // ----- industry -----
  tank(ctx, d, y, L, P, c, t, lights, R) {
    const r = d.d / 2, h = d.h, x = d.x;
    box(ctx, x - r, y - 0.2, d.d, h + 0.2, L('#d9d7d0'), R);
    ctx.strokeStyle = L('#a9a69e'); ctx.lineWidth = 0.035; for (let yy = y + 0.8; yy < y + h; yy += 1.1) { ctx.beginPath(); ctx.moveTo(x - r, yy); ctx.lineTo(x + r, yy); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + r * 0.4, y - 0.2, r * 0.6, h + 0.2);
    ctx.beginPath(); ctx.moveTo(x - r - 0.1, y + h); ctx.quadraticCurveTo(x, y + h + r * 0.35, x + r + 0.1, y + h); ctx.closePath(); fs(ctx, R.snow, R.ol, 0.04);
    ctx.strokeStyle = L('#5e5c57'); ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(x - r + 0.4, y); ctx.lineTo(x - r + 0.4, y + h); ctx.moveTo(x - r + 0.75, y); ctx.lineTo(x - r + 0.75, y + h); for (let yy = y + 0.3; yy < y + h; yy += 0.35) { ctx.moveTo(x - r + 0.4, yy); ctx.lineTo(x - r + 0.75, yy); } ctx.stroke();
    box(ctx, x - 1.4, y + h * 0.45, 2.8, 0.7, L('#c8372c'), R, 0.03); wtext(ctx, R, x, y + h * 0.45 + 0.35, 'DIESEL', 0.38, L('#f1ede2'));
  },
  pump(ctx, d, y, L, P, c, t, lights, R) {
    box(ctx, d.x - 2.2, y - 0.2, 4.4, 0.35, L('#9a958b'), R, 0.035);
    for (const o of [-1.2, 0.6]) { box(ctx, d.x + o, y + 0.15, 0.6, 1.5, L('#c9a33a'), R, 0.035); box(ctx, d.x + o + 0.1, y + 1.0, 0.4, 0.4, L('#33414a'), R, 0.025); ctx.strokeStyle = L('#2a2522'); ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(d.x + o + 0.6, y + 0.9); ctx.quadraticCurveTo(d.x + o + 0.95, y + 0.6, d.x + o + 0.7, y + 0.35); ctx.stroke(); }
    for (const o of [-2.0, 1.9]) box(ctx, d.x + o, y + 0.15, 0.14, 3.6, L('#7d7a73'), R, 0.03);
    box(ctx, d.x - 2.6, y + 3.7, 5.2, 0.4, L('#c8372c'), R, 0.035); snowCap(ctx, R, d.x - 2.6, y + 4.1, 5.2, 0.08);
    if (P.dark > 0.05) lights.push({ type: 'glow', x: d.x, y: y + 3.3, r: 3.0, col: '#fff1c8', big: true });
  },
  crane(ctx, d, y, L, P, c, t, lights, R) {
    const x = d.x, col = L('#d9a62e'), dk = L('#8a6a1e');
    for (const o of [-2.2, 1.6]) { box(ctx, x + o, y - 0.2, 0.5, 8.2, col, R, 0.04); ctx.strokeStyle = dk; ctx.lineWidth = 0.035; ctx.beginPath(); for (let yy = y; yy < y + 7.8; yy += 0.8) { ctx.moveTo(x + o, yy); ctx.lineTo(x + o + 0.5, yy + 0.8); } ctx.stroke(); }
    box(ctx, x - 2.4, y + 7.8, 4.4, 0.6, col, R, 0.04);
    box(ctx, x - 1.0, y + 8.4, 2.2, 1.6, L('#3a5a7a'), R, 0.04); box(ctx, x - 0.7, y + 9.0, 0.8, 0.6, L('#9ec0cc'), R, 0.025);
    ctx.save(); ctx.translate(x + 0.6, y + 9.4); ctx.rotate(0.42); box(ctx, 0, -0.18, 11, 0.36, col, R, 0.04); ctx.strokeStyle = dk; ctx.lineWidth = 0.03; ctx.beginPath(); for (let xx = 0; xx < 10.8; xx += 0.7) { ctx.moveTo(xx, -0.18); ctx.lineTo(xx + 0.35, 0.18); ctx.lineTo(xx + 0.7, -0.18); } ctx.stroke(); ctx.restore();
    const tx = x + 0.6 + 10.6 * Math.cos(0.42), ty = y + 9.4 + 10.6 * Math.sin(0.42);
    ctx.strokeStyle = L('#2a2522'); ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - 6); ctx.stroke(); box(ctx, tx - 0.25, ty - 6.4, 0.5, 0.45, L('#3a3834'), R, 0.03);
    snowCap(ctx, R, x - 2.4, y + 8.4, 4.4, 0.08);
  },
  bollard(ctx, d, y, L, P, c, t, lights, R) { box(ctx, d.x - 0.2, y - 0.2, 0.4, 0.75, L('#3a3834'), R, 0.035); box(ctx, d.x - 0.3, y + 0.5, 0.6, 0.12, L('#3a3834'), R, 0.03); snowCap(ctx, R, d.x - 0.3, y + 0.62, 0.6, 0.05); },
  crates(ctx, d, y, L, P, c, t, lights, R) {
    const cs = [[-1.1, 0, 1.0, '#b08a5c'], [0, 0, 1.0, '#9c7748'], [1.1, 0, 1.0, '#5d6b45'], [-0.55, 0.8, 1.0, '#9c7748'], [0.55, 0.8, 1.0, '#b08a5c']];
    for (const [ox, oy, w, col] of cs) { box(ctx, d.x + ox - w / 2, y - 0.15 + oy, w, 0.8, L(col), R, 0.04); ctx.strokeStyle = L(shadeHex(col, -0.3)); ctx.lineWidth = 0.03; ctx.strokeRect(d.x + ox - w / 2 + 0.06, y - 0.09 + oy, w - 0.12, 0.68); }
    snowCap(ctx, R, d.x - 1.05, y + 1.45, 2.1, 0.07);
  },
  heap(ctx, d, y, L, P, c, t, lights, R) {
    const w = d.w, h = d.h, pts = [];
    for (let i = 0; i <= 16; i++) { const u = i / 16, xx = d.x - w / 2 + u * w; pts.push([xx, y - 0.2 + h * Math.pow(Math.sin(Math.PI * u), 0.8) * (0.92 + 0.08 * hashf(i, d.seed))]); }
    pathPts(ctx, pts); fs(ctx, L(d.col), R.ol, 0.045);
    ctx.fillStyle = L(shadeHex(d.col, 0.25)); for (let i = 0; i < 30; i++) { const u = 0.1 + 0.8 * hashf(i, d.seed + 3), hh = h * Math.pow(Math.sin(Math.PI * u), 0.8) * hashf(i, d.seed + 4) * 0.9; ctx.fillRect(d.x - w / 2 + u * w, y - 0.2 + hh, 0.1, 0.07); }
    ctx.beginPath(); ctx.moveTo(d.x - w * 0.3, y - 0.2 + h * 0.86); ctx.quadraticCurveTo(d.x, y + h + 0.05, d.x + w * 0.3, y - 0.2 + h * 0.86); ctx.closePath(); ctx.fillStyle = R.snow; ctx.fill();
  },
  excavator(ctx, d, y, L, P, c, t, lights, R) {
    const x = d.x, col = L('#d9a62e');
    rr(ctx, x - 2.0, y - 0.2, 4.0, 0.85, 0.42); fs(ctx, L('#2b2926'), R.ol); for (const o of [-1.55, -0.5, 0.5, 1.55]) { ctx.beginPath(); ctx.arc(x + o, y + 0.22, 0.26, 0, TAU); fs(ctx, L('#4a4743'), R.ol, 0.025); }
    box(ctx, x - 1.8, y + 0.75, 3.4, 1.1, col, R); box(ctx, x - 0.2, y + 1.85, 1.6, 1.4, col, R); box(ctx, x + 0.05, y + 2.1, 1.1, 0.9, L('#9ec0cc'), R, 0.03);
    ctx.strokeStyle = R.ol; ctx.lineWidth = 0.32; ctx.beginPath(); ctx.moveTo(x + 1.3, y + 1.4); ctx.lineTo(x + 3.4, y + 3.6); ctx.lineTo(x + 4.6, y + 1.0); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 0.22; ctx.stroke();
    pathPts(ctx, [[x + 4.2, y + 1.1], [x + 5.0, y + 1.0], [x + 4.9, y + 0.2], [x + 4.4, y + 0.3]]); fs(ctx, L('#4a4743'), R.ol, 0.035);
    snowCap(ctx, R, x - 0.2, y + 3.25, 1.6, 0.07);
  },
  wagon(ctx, d, y, L, P, c, t, lights, R) {
    const x = d.x;
    ctx.strokeStyle = L('#3a3834'); ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(x - 7, y + 0.05); ctx.lineTo(x + 7, y + 0.05); ctx.stroke();
    for (const o of [-4.2, -3.1, 3.1, 4.2]) { ctx.beginPath(); ctx.arc(x + o, y + 0.48, 0.45, 0, TAU); fs(ctx, L('#2b2926'), R.ol, 0.035); }
    box(ctx, x - 6, y + 0.9, 12, 0.3, L('#3a3834'), R, 0.04);
    box(ctx, x - 6, y + 1.2, 12, 2.0, L('#7a3b2c'), R);
    ctx.strokeStyle = L('#5a2a1f'); ctx.lineWidth = 0.04; for (let xx = x - 5.4; xx < x + 6; xx += 1.2) { ctx.beginPath(); ctx.moveTo(xx, y + 1.2); ctx.lineTo(xx, y + 3.2); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(x, y + 3.25, 5.6, 0.25, 0, 0, TAU); ctx.fillStyle = R.snow; ctx.fill();
  },
  barge(ctx, d, y, L, P, c, t, lights, R) {
    const x = d.x;
    pathPts(ctx, [[x - 9, y + 1.6], [x + 9, y + 1.6], [x + 8, y - 0.4], [x - 8.4, y - 0.4]]); fs(ctx, L('#5a5f63'), R.ol);
    ctx.fillStyle = L('#c8372c'); ctx.fillRect(x - 8.6, y + 1.2, 17.4, 0.22);
    box(ctx, x + 4, y + 1.6, 3.2, 2.0, L('#e9e3d3'), R, 0.04); box(ctx, x + 4.4, y + 2.4, 0.8, 0.6, L('#33414a'), R, 0.03); box(ctx, x + 5.6, y + 2.4, 0.8, 0.6, L('#33414a'), R, 0.03);
    snowCap(ctx, R, x - 9, y + 1.6, 13, 0.12); snowCap(ctx, R, x + 4, y + 3.6, 3.2, 0.08);
  },
  // ----- along the roads -----
  stump(ctx, d, y, L, P, c, t, lights, R) { const z = d.z || 0, k = 1 - 0.28 * z; box(ctx, d.x - 0.25 * k, y - 0.15, 0.5 * k, 0.5 * k, L('#5b4636', z * 0.2), R, 0.03); ctx.beginPath(); ctx.ellipse(d.x, y + 0.35 * k, 0.3 * k, 0.08, 0, 0, TAU); ctx.fillStyle = R.snow; ctx.fill(); },
  fallen(ctx, d, y, L, P, c, t, lights, R) {
    const z = d.z || 0, k = 1 - 0.28 * z, len = d.len * k, a = 0.12;
    ctx.save(); ctx.translate(d.x - len / 2, y + 0.1); ctx.rotate(a);
    rr(ctx, 0, -0.18 * k, len, 0.36 * k, 0.15 * k); fs(ctx, L('#5d4331', z * 0.2), R.ol, 0.035);
    ctx.strokeStyle = L('#3e2d20', z * 0.2); ctx.lineWidth = 0.05; ctx.beginPath(); for (let u = 0.6; u < len - 0.5; u += 0.9) { ctx.moveTo(u, 0.15 * k); ctx.lineTo(u + 0.3, 0.55 * k); } ctx.stroke();
    ctx.fillStyle = R.snow; ctx.fillRect(0.2, 0.12 * k, len - 0.4, 0.07);
    ctx.restore();
  },
  boat(ctx, d, y, L, P, c, t, lights, R) {
    ctx.beginPath(); ctx.moveTo(d.x - 2.4, y); ctx.quadraticCurveTo(d.x - 2.2, y + 0.9, d.x - 0.6, y + 0.95); ctx.lineTo(d.x + 1.8, y + 0.9); ctx.quadraticCurveTo(d.x + 2.5, y + 0.6, d.x + 2.4, y); ctx.closePath(); fs(ctx, L('#3f6a5a'), R.ol);
    ctx.strokeStyle = L('#2b4a3f'); ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(d.x - 2.2, y + 0.45); ctx.lineTo(d.x + 2.3, y + 0.45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d.x - 2.0, y + 0.9); ctx.quadraticCurveTo(d.x, y + 1.25, d.x + 1.9, y + 0.88); ctx.lineTo(d.x + 1.8, y + 0.78); ctx.lineTo(d.x - 1.9, y + 0.8); ctx.closePath(); ctx.fillStyle = R.snow; ctx.fill();
  },
  pipe(ctx, d, y, L, P, c, t, lights, R) {
    const h = 1.1, ya = c.hAt(d.x) + h, yb = c.hAt(d.x1) + h;
    for (const xx of [d.x, (d.x + d.x1) / 2]) { const gy = c.hAt(xx); box(ctx, xx - 0.07, gy - 0.2, 0.14, h + 0.1, L('#5e5c57'), R, 0.025); }
    ctx.strokeStyle = R.ol; ctx.lineWidth = 0.42; ctx.beginPath(); ctx.moveTo(d.x - 0.1, ya + 0.15); ctx.lineTo(d.x1 + 0.1, yb + 0.15); ctx.stroke();
    ctx.strokeStyle = L('#8d9396'); ctx.lineWidth = 0.32; ctx.stroke();
    ctx.strokeStyle = R.snow; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(d.x, ya + 0.33); ctx.lineTo(d.x1, yb + 0.33); ctx.stroke();
  },
  fence(ctx, d, y, L, P, c, t, lights, R) {
    for (let i = 0; i < 6; i++) box(ctx, d.x + i * 1.2 - 0.06, y - 0.2, 0.12, 1.6, L('#6b5440'), R, 0.03);
    box(ctx, d.x - 0.2, y + 0.5, 6.6, 0.14, L('#6b5440'), R, 0.03); box(ctx, d.x - 0.2, y + 1.1, 6.6, 0.14, L('#6b5440'), R, 0.03);
  },
};

// glint that marks something worth stopping for
function glint(ctx, sx, sy, t, ph) {
  const a = 0.5 + 0.5 * Math.sin(t * 3 + ph), r = 0.13 + 0.1 * a;
  ctx.fillStyle = 'rgba(255,250,215,' + (0.75 * a).toFixed(2) + ')'; ctx.beginPath(); ctx.moveTo(sx, sy + r * 2); ctx.lineTo(sx + r * 0.4, sy); ctx.lineTo(sx, sy - r * 2); ctx.lineTo(sx - r * 0.4, sy); ctx.closePath(); ctx.moveTo(sx - r * 2, sy); ctx.lineTo(sx, sy + r * 0.4); ctx.lineTo(sx + r * 2, sy); ctx.lineTo(sx, sy - r * 0.4); ctx.closePath(); ctx.fill();
}
// the moving parts of decor, drawn live over the cached sprite
const DECOR_DYN = {
  cabin(ctx, d, y, L, P, c, t, R) { puffs(ctx, R, d.x + d.w * 0.18 + 0.17, y + d.h + 0.75 + d.w * 0.12, t, 1, 5); },
  fishhut(ctx, d, y, L, P, c, t, R) { puffs(ctx, R, d.x + 0.57, y + 2.6, t, 0.7, 4); if (d.secret && !(R.secrets && R.secrets[d.secret])) glint(ctx, d.x - 0.6, y + 1.2, t, 2); },
  oldsign(ctx, d, y, L, P, c, t, R) { if (d.secret && !(R.secrets && R.secrets[d.secret])) glint(ctx, d.x + 0.55, y + 1.95, t, 0); },
  vboard(ctx, d, y, L, P, c, t, R) { if (d.secret && !(R.secrets && R.secrets[d.secret])) glint(ctx, d.x + 0.6, y + 2.0, t, 1); },
  izba(ctx, d, y, L, P, c, t, R) { const w = d.w || 6.5; puffs(ctx, R, d.x + w * 0.22, y + 3.0 + w * 0.36 + 0.5, t, 0.9, 5); },
  church(ctx, d, y, L, P, c, t, R) { },
  vagon(ctx, d, y, L, P, c, t, R) { puffs(ctx, R, d.x + 1.7, y + 3.4, t, 0.7, 4); },
  bldg(ctx, d, y, L, P, c, t, R) { if (d.chim) puffs(ctx, R, d.x + d.w * 0.3, y + d.h + 2.4, t, 1, 5); },
  crate(ctx, d, y, L, P, c, t, R) { glint(ctx, d.x + 0.5, y + 1.15, t, d.x); },
  cairn(ctx, d, y, L, P, c, t, R) {
    const cols = ['#c8372c', '#2e5a84', '#e3c14a', '#3f8a52'];
    for (let i = 0; i < 4; i++) { const f = Math.sin(t * 4 + i) * 0.08; pathPts(ctx, [[d.x, y + 3.3 - i * 0.28], [d.x + 0.55, y + 3.2 - i * 0.28 + f], [d.x, y + 3.1 - i * 0.28]]); fs(ctx, L(cols[i]), R.ol, 0.02); }
  },
  marker(ctx, d, y, L, P, c, t, R) { const f = Math.sin(t * 3 + d.x) * 0.06; pathPts(ctx, [[d.x, y + 1.45], [d.x + 0.4, y + 1.38 + f], [d.x + 0.35, y + 1.22 + f], [d.x, y + 1.27]]); fs(ctx, L('#c23a2c'), R.ol, 0.02); },
  zone(ctx, d, y, L, P, c, t, R) {
    if (d.kind !== 'gantry') return;
    const h = 5.0, hx = (d.x + d.x1) / 2 + 6 * Math.sin(t * 0.3);
    ctx.strokeStyle = L('#2a2724'); ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(hx, y + h); ctx.lineTo(hx, y + h - 1.6); ctx.stroke();
    pathPts(ctx, [[hx - 0.5, y + h - 1.6], [hx + 0.5, y + h - 1.6], [hx + 0.3, y + h - 2.2], [hx, y + h - 1.9], [hx - 0.3, y + h - 2.2]]); fs(ctx, L('#c79b3a'), R.ol, 0.035);
  },
};
// world-space box [x0, y0, x1, y1] that holds everything a decor item draws (y = ground at d.x)
function decorBox(d, y, c) {
  const x = d.x, z = d.z || 0, k = 1 - 0.28 * z;
  switch (d.t) {
    case 'spruce': case 'dwarf': { const h = d.h * k; return [x - h * 0.3 - 0.35, y - 0.35, x + h * 0.3 + 0.35, y + h + 0.35]; }
    case 'fir': return [x - 0.6, y - 0.3, x + 0.8, y + 1.9];
    case 'birch': { const h = d.h * k; return [x - h * 0.4, y - 0.25, x + h * 0.4, y + h * 1.06 + 0.1]; }
    case 'pole': return [x - 0.8, y - 0.3, x + 0.8, y + d.h + 0.15];
    case 'kmpost': return [x - 0.45, y - 0.2, x + 0.45, y + 1.5];
    case 'sign': return [x - 1.35, y - 0.3, x + 1.35, y + 2.72];
    case 'warn': return [x - 0.55, y - 0.2, x + 0.55, y + 2.55];
    case 'icesign': return [x - 0.8, y - 0.2, x + 0.8, y + 2.45];
    case 'fsign': { const n = Math.max(1, (d.opts || []).length); return [x - 0.3, y - 0.3, x + 2.6, y + 0.75 + n * (n > 4 ? 0.5 : 0.62) + 0.5]; }
    case 'sideroads': return [x - 5.3, y - 0.2, x + 16.5, y + 7.0];
    case 'oldsign': return [x - 1.6, y - 0.5, x + 1.6, y + 2.3];
    case 'culvert': return [x - 0.75, y - 2.0, x + 0.75, y - 0.55];
    case 'cabin': return [x - d.w / 2 - 0.75, y - 0.3, x + d.w / 2 + 0.75, y + d.h + d.w * 0.32 + 0.25];
    case 'logpile': { const n = Math.max(1, Math.round(d.n / 2)); return [x - n * 0.25 - 0.35, y - 0.15, x + n * 0.25 + 0.35, y + 1.85]; }
    case 'loader': return [x - 1.5, y - 0.3, x + 4.7, y + 5.0];
    case 'barrels': return [x - 0.6, y - 0.2, x + 2.3, y + 1.0];
    case 'lamp': return [x - 0.2, y - 0.3, x + 1.35, y + 5.3];
    case 'rock': { const r = d.r * (1 - 0.3 * z); return [x - r * 1.35, y - 0.3, x + r * 1.35, y + r]; }
    case 'cairn': return [x - 0.95, y - 0.1, x + 0.7, y + 3.5];
    case 'snowpole': return [x - 0.12, y - 0.3, x + 0.12, y + 2.6];
    case 'marker': return [x - 0.1, y - 0.2, x + 0.1, y + 1.6];
    case 'fishhut': return [x - 1.3, y - 0.2, x + 1.3, y + 2.65];
    case 'wreck': return [x - 2.5, y - 0.65, x + 2.5, y + 1.95];
    case 'shed': return [x - d.w / 2 - 0.7, y - 0.3, x + d.w / 2 + 0.7, y + d.h + 1.8];
    case 'stack': return [x - 1.7, y - 0.25, x + 1.7, y + 2.0];
    case 'zone': { const ya = Math.min(y, c.hAt(d.x1)), yb = Math.max(y, c.hAt(d.x1)); return [d.x - 0.5, ya - 0.3, d.x1 + 0.5, yb + (d.kind === 'gantry' ? 6.7 : 2.0)]; }
    case 'crate': return [x - 1.4, y - 0.35, x + 1.5, y + 1.0];
    case 'fence': return [x - 0.3, y - 0.3, x + 6.5, y + 1.6];
    case 'barrier': return [x - 1.0, y - 0.4, x + 0.9, y + 3.6];
    case 'bldg': { const rh = d.roof === 'flat' ? 0.5 : d.roof === 'shed' ? 1.6 : Math.min(2.4, d.w * 0.3) + 0.2; return [x - d.w / 2 - 0.7, y - 0.3, x + d.w / 2 + 0.7, y + d.h + rh + (d.chim ? 2.5 : 0.3)]; }
    case 'izba': { const w = d.w || 6.5; return [x - w / 2 - 0.75, y - 0.3, x + w / 2 + 0.75, y + 3.2 + w * 0.36 + 0.4]; }
    case 'church': return [x - 3.0, y - 0.3, x + 3.0, y + 9.0];
    case 'well': return [x - 0.9, y - 0.3, x + 0.9, y + 2.45];
    case 'vboard': return [x - 1.05, y - 0.3, x + 1.05, y + 2.35];
    case 'vagon': return [x - 2.7, y - 0.2, x + 2.7, y + 3.4];
    case 'hut': return [x - 2.1, y - 0.3, x + 2.1, y + 2.95];
    case 'ruin': return [x - 3.3, y - 0.4, x + 3.1, y + 3.0];
    case 'tank': return [x - d.d / 2 - 0.2, y - 0.3, x + d.d / 2 + 0.2, y + d.h + d.d * 0.2 + 0.2];
    case 'pump': return [x - 2.7, y - 0.3, x + 2.7, y + 4.3];
    case 'crane': return [x - 2.6, y - 0.3, x + 11.0, y + 14.4];
    case 'bollard': return [x - 0.4, y - 0.3, x + 0.4, y + 0.75];
    case 'crates': return [x - 1.7, y - 0.25, x + 1.7, y + 1.6];
    case 'heap': return [x - d.w / 2 - 0.1, y - 0.3, x + d.w / 2 + 0.1, y + d.h + 0.2];
    case 'excavator': return [x - 2.1, y - 0.3, x + 5.1, y + 3.8];
    case 'wagon': return [x - 7.1, y - 0.1, x + 7.1, y + 3.55];
    case 'barge': return [x - 9.1, y - 0.5, x + 9.1, y + 3.8];
    case 'stump': return [x - 0.35, y - 0.25, x + 0.35, y + 0.5];
    case 'fallen': { const len = d.len * (1 - 0.28 * (d.z || 0)); return [x - len / 2 - 0.2, y - 0.3, x + len / 2 + 0.2, y + len * 0.13 + 0.8]; }
    case 'boat': return [x - 2.5, y - 0.2, x + 2.6, y + 1.3];
    case 'pipe': { const ya = c.hAt(d.x), yb = c.hAt(d.x1); return [d.x - 0.3, Math.min(ya, yb) - 0.3, d.x1 + 0.3, Math.max(ya, yb) + 1.8]; }
  }
  return [x - 3, y - 1, x + 3, y + 6];
}
