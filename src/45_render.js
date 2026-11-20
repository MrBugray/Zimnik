// ===== frame orchestration =====
class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.bg = new BgRenderer(); this.wr = new WorldRenderer(); this.art = new TruckArt();
    this.k = 1; this.scaleCap = 1.5; this.quality = 1; this.W = 1; this.H = 1; this.palVer = 0;
    this.bgLights = []; this.bgBlink = [];
  }
  resize() {
    const w = VIEW.w, h = VIEW.h;
    let dpr = Math.min(window.devicePixelRatio || 1, this.scaleCap);
    if (w * h * dpr * dpr > 2.4e6) dpr = Math.sqrt(2.4e6 / (w * h));
    this.k = dpr; this.cssW = w; this.cssH = h;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    this.W = W; this.H = H;
  }
  toScreen(x, y) { return [(x - this.camX) * this.ppm + this.W / 2, this.ay - (y - this.camY) * this.ppm]; }
  view(cam, ayFrac) {
    const W = this.W, H = this.H;
    this.ppm = cam.ppm * this.k; this.camX = cam.x; this.camY = cam.y; this.ay = H * ayFrac;
    this.vx0 = cam.x - W / 2 / this.ppm; this.vx1 = cam.x + W / 2 / this.ppm; this.vy0 = cam.y - (H - this.ay) / this.ppm; this.vy1 = cam.y + this.ay / this.ppm;
  }
  worldTf(ctx) { ctx.setTransform(this.ppm, 0, 0, -this.ppm, this.W / 2 - this.camX * this.ppm, this.ay + this.camY * this.ppm); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
  frame(G, dt, t) {
    SPR.beginFrame(G.state === 'drive' ? 2.5 : 6);
    if (G.scene() === 'garage') return this.frameGarage(G, dt, t);
    this.palVer = G.palVer;
    const ctx = this.ctx, P = G.pal, L = G.lit, cam = G.cam, W = this.W, H = this.H;
    const sim = G.sim, tr = sim.truck, course = sim.course; this.course = course;
    this.view(cam, G.state === 'drive' || G.state === 'pause' || G.state === 'results' ? 0.47 : 0.565); this.camDy = cam.y - G.camRefY;
    this.snow = css(P.fogL.world > 0 ? mixc(P.snow, P.fogc, P.fogL.world) : P.snow);
    this.ol = css(P.outline);
    this.smokeC = mulc(mixc(hex('#d9d5cf'), P.fogc, P.fogL.world), P.amb);
    this.wind = sim.env.wind || 0;
    this.secrets = G.data.secrets;
    this.truckSX = (ipos(tr.chassis).x - cam.x) * this.ppm + W / 2;
    this.bgLights.length = 0; this.bgBlink.length = 0;
    this.camDir = G.camVx < -0.5 ? -1 : 1;
    // lowest point of the ground on screen: the parallax ground fills never need to reach below it. Under a bridge
    // that is the bed of the river, not the deck: the far bank shows between the deck and the water.
    let lo = 1e9;
    for (let x = this.vx0; x <= this.vx1 + 2; x += 2) { const i = course.ii(x); lo = Math.min(lo, course.under[i] === 2 && course.vis[i] < course.y[i] ? course.vis[i] : course.hAt(x)); }
    this.groundY = Math.ceil(this.ay - (lo - 0.2 - cam.y) * this.ppm) + 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    this.bg.drawSky(ctx, this, P, t);
    this.bg.drawLayers(ctx, this, P, t);
    this.worldTf(ctx);
    const lights = [];
    if (G.stranded && G.stranded.ditch) this.drawDitch(ctx, P, L, t, lights, G.stranded);
    if (G.roadside) for (const q of G.roadside) if (q.truck) this.drawDitch(ctx, P, L, t, lights, q);
    this.wr.drawTerrain(ctx, this, P, course, L, sim.env);
    if (G.iceCrack > 0.05) this.drawCracks(ctx, G, P, tr);
    this.wr.drawDecor(ctx, this, P, course, L, t, lights);
    for (const b of sim.debris) this.art.cargo(ctx, this, P, b, L, this.ol);
    for (const v of sim.vehicles) for (const it of v.items) if (it.lost) this.art.cargo(ctx, this, P, it, L, this.ol);
    for (const v of sim.vehicles) if (v !== tr && !v.ditch) this.art.draw(ctx, this, P, v, L, t, lights);
    if (sim.tow) this.drawTowBar(ctx, P, L, sim.tow);
    this.art.draw(ctx, this, P, tr, L, t, lights);
    this.wr.drawParticles(ctx, P, L);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.wr.drawWeather(ctx, this, P, sim.env, dt, t, G.camVx * this.ppm);
    this.wr.drawLight(ctx, this, P, lights);
    if (this.bgBlink.length && P.dark > 0.05 && (t % 1.6) < 0.5) { const gl = GLOW.get('255,70,50'), r = 7 * this.k; ctx.globalAlpha = 0.95; for (const b of this.bgBlink) ctx.drawImage(gl, b[0] - r, b[1] - r, r * 2, r * 2); ctx.globalAlpha = 1; }
    this.wr.drawGrade(ctx, this, P);
    this.wr.prefetch(this, P, course, L, sim.env, this.camDir);
    this.bg.prefetch();
  }
  drawDitch(ctx, P, L, t, lights, st) {
    const tr = st.truck, p = ipos(tr.chassis), y0 = st.groundY;
    const Lf = (h, f) => L(h, (f || 0) + 0.12);
    ctx.save(); ctx.translate(p.x, y0); ctx.scale(0.86, 0.86); ctx.translate(-p.x, -y0 - 0.55);
    if (st.semi) this.art.draw(ctx, this, P, st.semi, Lf, t, [], 'f');
    this.art.draw(ctx, this, P, tr, Lf, t, [], 'f');
    ctx.restore();
    ctx.fillStyle = this.snow; ctx.beginPath(); ctx.moveTo(p.x - 5.5, y0 - 0.1); ctx.quadraticCurveTo(p.x - 2, y0 + 0.9, p.x + 0.5, y0 + 0.35); ctx.quadraticCurveTo(p.x + 3, y0 + 0.75, p.x + 5, y0 - 0.1); ctx.closePath(); ctx.fill();
    // hazard triangle
    const hx = p.x + 6.5, hy = y0;
    ctx.strokeStyle = L('#3a3834'); ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(hx - 0.3, hy); ctx.lineTo(hx, hy + 0.55); ctx.lineTo(hx + 0.3, hy); ctx.stroke();
    pathPts(ctx, [[hx - 0.32, hy + 0.5], [hx + 0.32, hy + 0.5], [hx, hy + 1.05]]); fs(ctx, L('#d23a2c'), this.ol, 0.04);
    pathPts(ctx, [[hx - 0.2, hy + 0.57], [hx + 0.2, hy + 0.57], [hx, hy + 0.92]]); fs(ctx, L('#f1ede2'), null);
    if (P.dark > 0.1 || (t % 1.2) < 0.6) lights.push({ type: 'glow', x: p.x + 3.2, y: y0 + 0.9, r: (t % 1.2) < 0.6 ? 1.6 : 0, col: '#ffb43a' });
  }
  drawTowBar(ctx, P, L, tw) {
    const a = iwp(tw.a.chassis, tw.a.G.hitch[0], tw.a.G.hitch[1]), b = iwp(tw.b.chassis, tw.b.G.hook[0], tw.b.G.hook[1]);
    ctx.strokeStyle = this.ol; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = L('#c9a33a'); ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    for (const q of [a, b]) { ctx.beginPath(); ctx.arc(q.x, q.y, 0.07, 0, TAU); fs(ctx, L('#3a3834'), this.ol, 0.03); }
  }
  drawCracks(ctx, G, P, tr) {
    const x = ipos(tr.chassis).x, c = G.sim.course, k = G.iceCrack;
    ctx.strokeStyle = css(mixc(P.ice, [255, 255, 255], 0.7)); ctx.lineWidth = 0.05;
    const r = mulberry32(Math.round(x / 3));
    for (let i = 0; i < Math.round(4 + k * 18); i++) {
      let px = x + (r() - 0.5) * 12 * k + 2, py = c.hAt(px) - 0.04;
      ctx.beginPath(); ctx.moveTo(px, py);
      for (let s = 0; s < 4; s++) { px += (r() - 0.5) * 1.4; py = Math.min(c.hAt(px) - 0.03, py - 0.04 - r() * 0.07); ctx.lineTo(px, py); }
      ctx.stroke();
    }
  }
  // ---------- workshop ----------
  frameGarage(G, dt, t) {
    const ctx = this.ctx, W = this.W, H = this.H, gs = G.gsim, tr = gs.truck; this.course = null;
    const P = G.gpal, L = G.glit;
    // fit whichever truck is on the floor: its art bounds plus a little air
    const B = ART_BOUNDS[tr.gk || tr.id], len = B[2] - B[0] + 0.98, hh = B[3] - B[1] + 0.07;
    const ppm = Math.min(W * 0.52 / len, H * 0.42 / hh) / this.k;
    const cam = { x: (B[0] + B[2]) / 2 + 0.29 + (0.5 - 0.37) * W / (ppm * this.k), y: 0, ppm };
    this.view(cam, 0.565);
    this.palVer = 'g' + G.palVer;
    this.ol = css(P.outline); this.snow = css(P.snow); this.smokeC = [200, 196, 190]; this.wind = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // the workshop is static: one screen-sized bitmap, redrawn only when the screen or the weather outside changes
    const key = W + 'x' + H + ':' + G.palVer + ':' + tr.id;
    if (this.shopKey !== key) {
      const c = this.shopCv || (this.shopCv = document.createElement('canvas')); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.fillStyle = '#201a16'; g.fillRect(0, 0, W, H); this.worldTf(g); this.workshop(g, G, 0);
      const o = this.shopOv || (this.shopOv = document.createElement('canvas')); o.width = Math.ceil(W / 2); o.height = Math.ceil(H / 2);
      const q = o.getContext('2d'); q.setTransform(0.5, 0, 0, 0.5, 0, 0); q.globalCompositeOperation = 'lighter';
      for (const lx of [-5.2, 0.4, 6.0]) {
        const [sx, sy] = this.toScreen(lx, 7.05), [, fy] = this.toScreen(lx, 0);
        const gr = q.createLinearGradient(0, sy, 0, fy); gr.addColorStop(0, 'rgba(255,214,150,0.20)'); gr.addColorStop(1, 'rgba(255,214,150,0.03)');
        q.fillStyle = gr; q.beginPath(); q.moveTo(sx - 0.3 * this.ppm, sy); q.lineTo(sx + 0.3 * this.ppm, sy); q.lineTo(sx + 3.4 * this.ppm, fy); q.lineTo(sx - 3.4 * this.ppm, fy); q.closePath(); q.fill();
      }
      const v = this.shopVig || (this.shopVig = document.createElement('canvas')); v.width = Math.ceil(W / 4); v.height = Math.ceil(H / 4);
      const vq = v.getContext('2d'), vg = vq.createRadialGradient(v.width * 0.38, v.height * 0.5, v.height * 0.3, v.width * 0.5, v.height * 0.5, v.width * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,5,3,0.55)'); vq.fillStyle = vg; vq.fillRect(0, 0, v.width, v.height);
      this.shopKey = key;
    }
    ctx.drawImage(this.shopCv, 0, 0);
    this.worldTf(ctx);
    // snow drifting past the window
    if (G.pal && G.pal.w.part > 0) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); for (let i = 0; i < 40 * G.pal.w.part; i++) { const fx = 3.6 + hashf(i, 5) * 4.8, fy = 5.7 - ((hashf(i, 7) * 2.8 + t * (0.6 + hashf(i, 9))) % 2.8); ctx.rect(fx, fy, 0.04, 0.04); } ctx.fill(); }
    const lights = [];
    this.art.draw(ctx, this, P, tr, L, t, lights);
    this.wr.drawParticles(ctx, P, L);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(this.shopOv, 0, 0, W, H); ctx.restore();
    ctx.drawImage(this.shopVig, 0, 0, W, H);
    this.wr.drawGrade(ctx, this, P);
  }
  workshop(ctx, G, t) {
    const ol = '#1d1814', x0 = this.vx0 - 1, x1 = this.vx1 + 1, top = this.vy1 + 1;
    // plank wall
    for (let y = 0, i = 0; y < top; y += 0.42, i++) { ctx.fillStyle = i % 2 ? '#5a4535' : '#523f31'; ctx.fillRect(x0, y, x1 - x0, 0.42); }
    ctx.strokeStyle = 'rgba(25,18,13,0.55)'; ctx.lineWidth = 0.03;
    for (let y = 0.42; y < top; y += 0.42) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
    for (let y = 0, i = 0; y < top; y += 0.42, i++) for (let x = Math.floor(x0 / 3) * 3 + (i % 2) * 1.5; x < x1; x += 3) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 0.42); ctx.stroke(); }
    for (let x = Math.floor(x0 / 4.5) * 4.5; x < x1; x += 4.5) { ctx.beginPath(); ctx.rect(x - 0.16, 0, 0.32, top); fs(ctx, '#3f3026', ol, 0.04); }
    // window with the real weather outside
    const P = G.pal, wx0 = 3.6, wx1 = 8.4, wy0 = 2.9, wy1 = 5.7;
    const sg = ctx.createLinearGradient(0, wy1, 0, wy0); sg.addColorStop(0, css(P.skyTop)); sg.addColorStop(1, css(P.skyHor));
    ctx.fillStyle = sg; ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    ctx.fillStyle = css(P.ridge); ctx.beginPath(); ctx.moveTo(wx0, wy0 + 0.9); for (let x = wx0; x <= wx1; x += 0.2) ctx.lineTo(x, wy0 + 0.9 + 0.35 * Math.sin(x * 1.7) + 0.2 * Math.sin(x * 4.1)); ctx.lineTo(wx1, wy0); ctx.lineTo(wx0, wy0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = css(P.nearTree); for (let x = wx0 + 0.3; x < wx1; x += 0.55) { const h = 0.7 + 0.5 * hashf(Math.round(x * 10), 3); ctx.beginPath(); ctx.moveTo(x - 0.18, wy0 + 0.4); ctx.lineTo(x, wy0 + 0.4 + h); ctx.lineTo(x + 0.18, wy0 + 0.4); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = css(P.snow); ctx.fillRect(wx0, wy0, wx1 - wx0, 0.45);
    if (P.dark > 0.1) { ctx.fillStyle = 'rgba(10,14,30,' + (P.dark * 0.6).toFixed(2) + ')'; ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0); }
    ctx.strokeStyle = '#3f3026'; ctx.lineWidth = 0.16; ctx.strokeRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo((wx0 + wx1) / 2, wy0); ctx.lineTo((wx0 + wx1) / 2, wy1); ctx.moveTo(wx0, (wy0 + wy1) / 2); ctx.lineTo(wx1, (wy0 + wy1) / 2); ctx.stroke();
    ctx.strokeStyle = ol; ctx.lineWidth = 0.04; ctx.strokeRect(wx0 - 0.08, wy0 - 0.08, wx1 - wx0 + 0.16, wy1 - wy0 + 0.16);
    ctx.fillStyle = '#e9edef'; ctx.fillRect(wx0 - 0.1, wy0 - 0.14, wx1 - wx0 + 0.2, 0.1);
    // roller door on the left
    ctx.beginPath(); ctx.rect(-14.6, 0, 5.2, 5.6); fs(ctx, '#6a6c69', ol, 0.06);
    ctx.strokeStyle = '#4c4e4b'; ctx.lineWidth = 0.04; for (let y = 0.3; y < 5.6; y += 0.3) { ctx.beginPath(); ctx.moveTo(-14.6, y); ctx.lineTo(-9.4, y); ctx.stroke(); }
    ctx.beginPath(); ctx.rect(-14.9, 5.6, 5.8, 0.4); fs(ctx, '#3f3026', ol, 0.05);
    ctx.fillStyle = '#d9b23a'; for (let x = -14.6; x < -9.4; x += 0.5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 0.25, 0); ctx.lineTo(x + 0.5, 0.25); ctx.lineTo(x + 0.25, 0.25); ctx.closePath(); ctx.fill(); }
    // map poster
    ctx.beginPath(); ctx.rect(-6.6, 3.2, 3.1, 2.1); fs(ctx, '#d8cfb6', ol, 0.04);
    ctx.fillStyle = '#9fb7c1'; ctx.beginPath(); ctx.moveTo(-6.4, 3.4); ctx.bezierCurveTo(-5.6, 4.9, -4.9, 3.6, -3.7, 5.1); ctx.lineTo(-3.7, 5.2); ctx.bezierCurveTo(-4.9, 3.9, -5.6, 5.1, -6.4, 3.7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7a4a2c'; ctx.lineWidth = 0.035; ctx.setLineDash([0.1, 0.06]); ctx.beginPath(); ctx.moveTo(-6.3, 4.6); ctx.lineTo(-5.3, 4.3); ctx.lineTo(-4.6, 4.8); ctx.lineTo(-3.9, 4.4); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#b8322a'; ctx.beginPath(); ctx.arc(-6.3, 4.6, 0.07, 0, TAU); ctx.arc(-3.9, 4.4, 0.07, 0, TAU); ctx.fill();
    // tool board + bench
    ctx.beginPath(); ctx.rect(9.4, 2.2, 3.4, 2.2); fs(ctx, '#7a6a52', ol, 0.04);
    ctx.fillStyle = '#2b2825';
    ctx.fillRect(9.8, 2.6, 0.08, 1.3); ctx.beginPath(); ctx.arc(9.84, 3.95, 0.14, 0, TAU); ctx.fill();
    ctx.fillRect(10.4, 2.7, 0.1, 1.0); ctx.fillRect(10.25, 3.6, 0.4, 0.22);
    ctx.beginPath(); ctx.moveTo(11.0, 2.6); ctx.lineTo(11.9, 2.6); ctx.lineTo(11.9, 2.85); ctx.lineTo(11.0, 3.0); ctx.closePath(); ctx.fill(); ctx.fillRect(11.9, 2.55, 0.25, 0.35);
    ctx.beginPath(); ctx.arc(12.4, 3.4, 0.28, 0, TAU); ctx.lineWidth = 0.07; ctx.strokeStyle = '#2b2825'; ctx.stroke();
    ctx.beginPath(); ctx.rect(9.0, 0.9, 4.4, 0.14); fs(ctx, '#6b5440', ol, 0.04);
    ctx.fillStyle = '#3f3026'; ctx.fillRect(9.15, 0, 0.12, 0.9); ctx.fillRect(13.1, 0, 0.12, 0.9);
    ctx.beginPath(); ctx.rect(9.6, 1.04, 0.5, 0.25); fs(ctx, '#3f5d78', ol, 0.03);
    // barrels and tires
    for (const [bx, c] of [[-8.6, '#3d5c7a'], [-7.85, '#8a3b2c']]) { ctx.beginPath(); ctx.rect(bx, 0, 0.66, 0.96); fs(ctx, c, ol, 0.04); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(bx, 0.32); ctx.lineTo(bx + 0.66, 0.32); ctx.moveTo(bx, 0.66); ctx.lineTo(bx + 0.66, 0.66); ctx.stroke(); }
    for (let i = 0; i < 4; i++) { rr(ctx, 14.0, i * 0.34, 1.3, 0.34, 0.1); fs(ctx, '#272523', ol, 0.04); }
    // beam, hoist and lamps
    ctx.beginPath(); ctx.rect(x0, 7.5, x1 - x0, 0.32); fs(ctx, '#4a4a48', ol, 0.05);
    ctx.fillStyle = '#3a3a38'; for (let x = Math.floor(x0); x < x1; x += 1.2) ctx.fillRect(x, 7.55, 0.06, 0.22);
    ctx.strokeStyle = '#2b2a28'; ctx.lineWidth = 0.035; ctx.setLineDash([0.06, 0.04]); ctx.beginPath(); ctx.moveTo(-2.6, 7.5); ctx.lineTo(-2.6, 4.9 + 0.05 * Math.sin(t * 0.8)); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.rect(-2.8, 7.1, 0.4, 0.32); fs(ctx, '#c9a33a', ol, 0.035);
    ctx.strokeStyle = '#2b2a28'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.arc(-2.6, 4.75 + 0.05 * Math.sin(t * 0.8), 0.13, Math.PI * 0.1, Math.PI * 1.3); ctx.stroke();
    for (const lx of [-5.2, 0.4, 6.0]) {
      ctx.strokeStyle = '#2b2a28'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(lx, 7.5); ctx.lineTo(lx, 7.15); ctx.stroke();
      pathPts(ctx, [[lx - 0.38, 6.92], [lx + 0.38, 6.92], [lx + 0.16, 7.18], [lx - 0.16, 7.18]]); fs(ctx, '#3e4a44', ol, 0.035);
      ctx.fillStyle = '#ffe6b0'; ctx.beginPath(); ctx.ellipse(lx, 6.92, 0.22, 0.05, 0, 0, TAU); ctx.fill();
    }
    // floor
    ctx.fillStyle = '#5d5a55'; ctx.fillRect(x0, this.vy0 - 1, x1 - x0, -this.vy0 + 1);
    ctx.fillStyle = '#4c4945'; ctx.fillRect(x0, -0.22, x1 - x0, 0.22);
    ctx.strokeStyle = '#3f3c38'; ctx.lineWidth = 0.03; for (let x = Math.floor(x0 / 4) * 4; x < x1; x += 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 0.6, this.vy0); ctx.stroke(); }
    ctx.fillStyle = 'rgba(25,22,20,0.45)'; ctx.beginPath(); ctx.ellipse(0.6, -0.05, 3.2, 0.08, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = ol; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();
  }
}
