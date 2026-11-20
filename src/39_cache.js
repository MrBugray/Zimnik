// ===== cached bitmaps of vector art =====
// Static art is drawn once into an offscreen canvas at the current pixel scale, then blitted every frame.
// A sprite has a base (what it shows) and a version (palette + pixel scale). When the version changes, the
// newest older version keeps being drawn until the per-frame render budget allows a re-render.
const SPR = {
  map: new Map(), latest: new Map(), pool: [], pending: [],
  px: 0, maxPx: 10e6, budgetMs: 3, spent: 0, renders: 0,
  qs: 1.06,
  ppmQ(ppm) { return Math.pow(this.qs, Math.round(Math.log(ppm) / Math.log(this.qs))); },
  beginFrame(budgetMs) {
    this.budgetMs = budgetMs; this.spent = 0; this.renders = 0;
    // canvases dropped last frame may still have been drawn in it, so they rejoin the pool one frame later
    for (const c of this.pending) if (this.pool.length < 32) this.pool.push(c);
    this.pending.length = 0;
  },
  // b = [x0, y0, x1, y1] in metres (y up); draw(g) draws in those coordinates
  get(base, ver, b, ppm, draw, force) {
    const key = base + '#' + ver;
    let s = this.map.get(key);
    if (s) { this.map.delete(key); this.map.set(key, s); return s; }
    const lk = this.latest.get(base), old = lk ? this.map.get(lk) : null;
    if (old && !force && this.spent > this.budgetMs) { this.map.delete(lk); this.map.set(lk, old); return old; }
    const t0 = performance.now();
    s = this.render(b, ppm, draw);
    this.spent += performance.now() - t0; this.renders++;
    s.key = key; s.base = base;
    if (old) this.drop(lk, old);
    this.map.set(key, s); this.px += s.w * s.h; this.latest.set(base, key);
    if (this.px > this.maxPx) this.evict();
    return s;
  },
  has(base, ver) { return this.map.has(base + '#' + ver); },
  render(b, ppm, draw) {
    const pad = 2, w = Math.max(2, Math.ceil((b[2] - b[0]) * ppm) + pad * 2), h = Math.max(2, Math.ceil((b[3] - b[1]) * ppm) + pad * 2);
    const cv = this.canvas(w, h), g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.setTransform(ppm, 0, 0, -ppm, pad - b[0] * ppm, pad + b[3] * ppm);
    g.lineJoin = 'round'; g.lineCap = 'round';
    draw(g);
    return { cv, w, h, ppm, x0: b[0] - pad / ppm, y1: b[3] + pad / ppm, y0: b[3] + pad / ppm - h / ppm, x1: b[0] - pad / ppm + w / ppm };
  },
  canvas(w, h) {
    let best = -1, bd = 1e18;
    for (let i = 0; i < this.pool.length; i++) { const c = this.pool[i], d = c.width * c.height - w * h; if (c.width >= w && c.height >= h && d < bd && d < w * h) { bd = d; best = i; } }
    if (best >= 0) { const c = this.pool.splice(best, 1)[0]; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; }
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  },
  drop(key, s) { if (this.map.delete(key)) { this.px -= s.w * s.h; this.pending.push(s.cv); } if (this.latest.get(s.base) === key) this.latest.delete(s.base); },
  evict() { for (const [k, s] of this.map) { if (this.px <= this.maxPx * 0.85) break; this.drop(k, s); } },
  clear() { for (const [k, s] of this.map) this.drop(k, s); },
};
// draw a sprite in the current (metre, y-up) frame
function blit(ctx, s) { ctx.save(); ctx.scale(1 / s.ppm, -1 / s.ppm); ctx.drawImage(s.cv, s.x0 * s.ppm, -s.y1 * s.ppm); ctx.restore(); }
// draw a sprite axis-aligned in screen space, snapped to whole device pixels (seamless chunk rows)
function blitScreen(ctx, R, s, cx0, cx1) {
  const k = R.ppm / s.ppm;
  const sxL = Math.round((cx0 - R.camX) * R.ppm + R.W / 2), sxR = Math.round((cx1 - R.camX) * R.ppm + R.W / 2);
  const syT = R.ay - (s.y1 - R.camY) * R.ppm;
  const srcX = (cx0 - s.x0) * s.ppm, srcW = (cx1 - cx0) * s.ppm;
  if (sxR <= 0 || sxL >= R.W || srcW <= 0) return;
  ctx.drawImage(s.cv, srcX, 0, srcW, s.h, sxL, syT, sxR - sxL, s.h * k);
}
// round puffs used by smoke and spray, one small canvas per colour ('r,g,b'); soft = blurry rim for vapour
const PUFF = {
  cache: new Map(),
  get(rgb, soft) {
    const key = rgb + (soft ? 's' : '');
    let c = this.cache.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    if (soft) { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.5, 'rgba(' + rgb + ',0.8)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
    else { g.fillStyle = 'rgb(' + rgb + ')'; g.beginPath(); g.arc(32, 32, 31, 0, TAU); g.fill(); }
    if (this.cache.size > 160) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, c); return c;
  },
};
const rgbKey = (c, q) => { q = q || 6; return (Math.round(clamp(c[0], 0, 255) / q) * q | 0) + ',' + (Math.round(clamp(c[1], 0, 255) / q) * q | 0) + ',' + (Math.round(clamp(c[2], 0, 255) / q) * q | 0); };
const CONE_X = 14 / 256, CONE_Y = 60 / 256, CONE_H = 160 / 256; // cone sprite: apex at (14, 60) of a 256x160 canvas
// radial glow sprites for lights: colour -> canvas (alpha falls off smoothly)
const GLOW = {
  cache: new Map(),
  get(rgb, shape) {
    const key = rgb + (shape || ''); let c = this.cache.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    const mid = shape === 'sun' ? [0.25, 0.33] : shape === 'lin' ? [0.5, 0.5] : [0.35, 0.45];
    gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(mid[0], 'rgba(' + rgb + ',' + mid[1] + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); if (this.cache.size > 80) this.cache.delete(this.cache.keys().next().value); this.cache.set(key, c); return c;
  },
  // a headlight cone pointing along +x from the left-middle, fading with distance
  cone(rgb) {
    const key = 'cone' + rgb; let c = this.cache.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
    const gr = g.createRadialGradient(14, 60, 0, 14, 60, 242);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.5, 'rgba(' + rgb + ',0.75)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    // soft edges: the cone is blurred where the browser can, otherwise built from nested wedges
    const wedge = (k) => { g.beginPath(); g.moveTo(14, 60 - 4 * k); g.lineTo(256, 60 - 242 * 0.22 * k); g.lineTo(256, 60 + 242 * 0.36 * k); g.lineTo(14, 60 + 6 * k); g.closePath(); g.fill(); };
    g.fillStyle = gr;
    if ('filter' in g) { g.filter = 'blur(7px)'; wedge(0.92); g.filter = 'none'; }
    else { g.globalAlpha = 0.3; for (const k of [1.12, 1.0, 0.88, 0.76]) wedge(k); g.globalAlpha = 1; }
    this.cache.set(key, c); return c;
  },
};
