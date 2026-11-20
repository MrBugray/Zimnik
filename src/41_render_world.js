// ===== world: terrain, decor, particles, weather, light =====
const OUT = 0.06;
function pathPts(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
function fs(ctx, fill, stroke, lw) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || OUT; ctx.stroke(); } }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); r = Math.min(r, w / 2, h / 2); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath(); }
const alignUp = (i, n) => i + ((n - (i % n)) % n); // first index >= i on a global grid of n
const TCW = 24, TDEPTH = 5.5; // terrain chunk width and how deep under the surface it is drawn (m)
const GROUND_DECOR = { bridge: 1, rbridge: 1, corduroy: 1 }; // baked into terrain chunks
let DECOR_UID = 0;
const DECOR_KEYS = ['h', 'z', 'w', 'n', 'r', 'x1', 'label', 'text', 'lean', 'kind', 'col', 'd', 'len', 'wall', 'sign', 'roof', 'door', 'win', 'lit', 'ice', 'icon', 'secret'];

class WorldRenderer {
  constructor() { this.parts = []; this.flakes = []; }
  // ---------- terrain: cached 24 m chunks blitted at whole pixels ----------
  drawTerrain(ctx, R, P, c, L, env) {
    const x0 = R.vx0 - 0.5, x1 = R.vx1 + 0.5, k0 = Math.floor(x0 / TCW), k1 = Math.floor(x1 / TCW);
    const ppm = SPR.ppmQ(R.ppm), ver = R.palVer + '@' + ppm.toFixed(2) + ':' + Math.round((env.extraSnow || 0) * 40);
    if (!c.uid) c.uid = ++DECOR_UID;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.tcol(P, 'soilDeep');
    for (let k = k0; k <= k1; k++) {
      const cx0 = k * TCW, cx1 = cx0 + TCW;
      const s = this.terrainSprite(R, P, c, L, env, k, ppm, ver);
      blitScreen(ctx, R, s, cx0, cx1);
      // plain deep soil under the chunk
      const sxL = Math.round((cx0 - R.camX) * R.ppm + R.W / 2), sxR = Math.round((cx1 - R.camX) * R.ppm + R.W / 2);
      const yb = Math.floor(R.ay - (s.y0 - R.camY) * R.ppm) - 1;
      if (yb < R.H) ctx.fillRect(sxL, yb, sxR - sxL, R.H - yb);
    }
    ctx.restore();
  }
  // a chunk is keyed by the course and by the last edit that touched it, so extending a drive only redraws its end
  chunkKey(c, k) { if (!c.uid) c.uid = ++DECOR_UID; return 'tc:' + c.uid + ':' + k + ':' + c.verAt(k * TCW, (k + 1) * TCW); }
  terrainSprite(R, P, c, L, env, k, ppm, ver) {
    const cx0 = k * TCW, cx1 = cx0 + TCW, key = this.chunkKey(c, k);
    if (this.cbFor !== c) { this.cbFor = c; this.cb = new Map(); }
    let b = this.cb.get(key); if (!b) { b = this.chunkBounds(c, cx0, cx1); this.cb.set(key, b); }
    return SPR.get(key, ver, b, ppm, g => this.terrainChunk(g, R, c, P, L, env, cx0, cx1, b[1]));
  }
  // render the chunk the camera is heading into while this frame still has budget left, so it never pops in mid-frame
  prefetch(R, P, c, L, env, dir) {
    if (SPR.spent > SPR.budgetMs * 0.5) return;
    const ppm = SPR.ppmQ(R.ppm), ver = R.palVer + '@' + ppm.toFixed(2) + ':' + Math.round((env.extraSnow || 0) * 40);
    const k = dir >= 0 ? Math.floor((R.vx1 + 0.5) / TCW) + 1 : Math.floor((R.vx0 - 0.5) / TCW) - 1;
    if (!SPR.has(this.chunkKey(c, k), ver)) this.terrainSprite(R, P, c, L, env, k, ppm, ver);
  }
  tcol(P, k) { return css(P.fogL.world > 0 ? mixc(P[k], P.fogc, P.fogL.world) : P[k]); }
  chunkBounds(c, cx0, cx1) {
    const i0 = Math.max(0, Math.floor(c.idx(cx0 - 1))), i1 = Math.min(c.n - 1, Math.ceil(c.idx(cx1 + 1)));
    let lo = 1e9, hi = -1e9;
    for (let i = i0; i <= i1; i++) { const y = c.y[i]; hi = Math.max(hi, y); lo = Math.min(lo, y, this.top(c, i)); }
    for (const d of c.decorIn(cx0 - 2, cx1 + 2)) if (GROUND_DECOR[d.t] && d.x1 > cx0 - 2 && d.x < cx1 + 2) { hi = Math.max(hi, c.hAt(clamp(cx0, d.x, d.x1)) + 1.2, c.hAt(clamp(cx1, d.x, d.x1)) + 1.2); const dd = d.t === 'rbridge' ? 13.5 : 9.5; lo = Math.min(lo, c.hAt(d.x) - dd, c.hAt(d.x1) - dd); }
    return [cx0 - 0.6, lo - TDEPTH, cx1 + 0.6, hi + 0.7];
  }
  top(c, i) { const u = c.under[i]; if (u === 1 || u === 2) return isNaN(c.vis[i]) ? c.y[i] : c.vis[i]; if (u === 3) return c.y[i] - 0.9; return c.y[i]; }
  terrainChunk(ctx, R, c, P, L, env, cx0, cx1, yBot) {
    const i0 = Math.max(0, Math.floor(c.idx(cx0 - 0.6)) - 1), i1 = Math.min(c.n - 1, Math.ceil(c.idx(cx1 + 0.6)) + 1);
    const X = i => c.X0 + i * DX, T = k => this.tcol(P, k), top = i => this.top(c, i);
    yBot -= 0.5;
    // soil body
    ctx.beginPath(); ctx.moveTo(X(i0), yBot);
    for (let i = i0; i <= i1; i++) ctx.lineTo(X(i), top(i));
    ctx.lineTo(X(i1), yBot); ctx.closePath();
    ctx.fillStyle = T('soil'); ctx.fill();
    // deeper soil tint
    const e0 = i0 - (i0 % 2);
    ctx.beginPath(); ctx.moveTo(X(e0), yBot);
    for (let i = e0; i <= i1 + 2; i += 2) ctx.lineTo(X(i), top(Math.min(i, c.n - 1)) - 3.2 - 0.4 * noise1(X(i) / 9, 3));
    ctx.lineTo(X(i1 + 2), yBot); ctx.closePath(); ctx.fillStyle = T('soilDeep'); ctx.fill();
    // strata lines
    ctx.strokeStyle = T('soilLine'); ctx.lineWidth = 0.045;
    const depths = [0.62, 1.2, 1.85, 2.6, 3.5, 4.5];
    for (let d = 0; d < depths.length; d++) {
      const dd = depths[d]; ctx.globalAlpha = 0.62 - d * 0.05; ctx.beginPath();
      for (let i = e0; i <= i1 + 2; i += 2) { const ii = Math.min(i, c.n - 1), x = X(i), yy = top(ii) - dd - 0.16 * noise1(x / 6 + d * 3.1, 11) - 0.05 * noise1(x / 1.7 + d, 5); i === e0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // pebbles in the soil
    ctx.fillStyle = T('soilLine'); ctx.beginPath();
    for (let i = alignUp(i0, 3); i <= i1; i += 3) { const h = hashf(i, 21); if (h < 0.55) continue; const x = X(i) + hashf(i, 22) * 1.4, y = top(i) - 0.6 - hashf(i, 23) * 5.5, rx = 0.07 + 0.1 * h; ctx.moveTo(x + rx, y); ctx.ellipse(x, y, rx, 0.05 + 0.05 * h, 0, 0, TAU); }
    ctx.fill();
    // water under ice / bog
    for (let i = i0; i <= i1; i++) {
      const u = c.under[i]; if (u !== 1 && u !== 3) continue;
      let j = i; while (j + 1 <= i1 && c.under[j + 1] === u) j++;
      ctx.beginPath(); ctx.moveTo(X(i), c.y[i]);
      for (let k = i; k <= j; k++) ctx.lineTo(X(k), c.y[k]);
      for (let k = j; k >= i; k--) ctx.lineTo(X(k), top(k));
      ctx.closePath(); ctx.fillStyle = u === 3 ? css(mixc(P.water, P.soil, 0.55)) : T('water'); ctx.fill();
      ctx.strokeStyle = css(mixc(P.water, P.ice, 0.35), 0.6); ctx.lineWidth = 0.04; ctx.beginPath();
      for (let k = alignUp(i, 6); k <= j; k += 6) { const x = X(k), yy = c.y[k] - 0.55 - 0.5 * hashf(k, 3); ctx.moveTo(x, yy); ctx.lineTo(x + 0.9, yy); }
      ctx.stroke();
      i = j;
    }
    // surface bands
    for (let i = i0; i <= i1; i++) {
      const s = c.s[i]; let j = i; while (j + 1 <= i1 && c.s[j + 1] === s) j++;
      this.band(ctx, c, P, L, T, s, Math.max(i0, i - 1), Math.min(i1, j + 1), X);
      i = j;
    }
    const extra = env.extraSnow || 0;
    if (extra > 0.01) {
      ctx.beginPath(); ctx.moveTo(X(i0), c.y[i0]);
      for (let i = i0; i <= i1; i++) ctx.lineTo(X(i), c.y[i]);
      for (let i = i1; i >= i0; i--) ctx.lineTo(X(i), c.y[i] - Math.min(0.25, extra) * (c.s[i] === S_ICE ? 0.4 : 1));
      ctx.closePath(); ctx.fillStyle = T('snow'); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(X(i0), c.y[i0]);
    for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(X(i), c.y[i]);
    ctx.strokeStyle = css(P.outline); ctx.lineWidth = OUT * 1.15; ctx.lineJoin = 'round'; ctx.stroke();
    // bridges and corduroy belong to the ground
    const Rk = { ol: css(P.outline), snow: css(P.fogL.world > 0 ? mixc(P.snow, P.fogc, P.fogL.world) : P.snow), ppm: R.ppm };
    for (const d of c.decorIn(cx0 - 2, cx1 + 2)) if (GROUND_DECOR[d.t] && d.x1 > cx0 - 2 && d.x < cx1 + 2) DECOR[d.t](ctx, d, c.hAt(d.x), L, P, c, 0, [], Rk);
  }
  band(ctx, c, P, L, T, s, a, b, X) {
    const S = SURF[s], th = S.band;
    const poly = (thk, off) => { ctx.beginPath(); ctx.moveTo(X(a), c.y[a] - (off || 0)); for (let k = a; k <= b; k++) ctx.lineTo(X(k), c.y[k] - (off || 0)); for (let k = b; k >= a; k--) ctx.lineTo(X(k), c.y[k] - thk - 0.04 * noise1(X(k) * 1.3, s)); ctx.closePath(); };
    if (s === S_SNOW || s === S_DEEP || s === S_RUTS) {
      poly(th + 0.08); ctx.fillStyle = T('snowShade'); ctx.fill();
      poly(th); ctx.fillStyle = T('snow'); ctx.fill();
      if (s === S_RUTS) {
        ctx.strokeStyle = L('#6b5646'); ctx.lineWidth = 0.05; ctx.globalAlpha = 0.6; ctx.beginPath();
        for (let k = alignUp(a, 3); k < b; k += 3) { const x = X(k); if (hashf(k, 41) < 0.35) continue; ctx.moveTo(x, c.y[k] - 0.1); ctx.lineTo(x + 1.1, c.y[k + 2 < c.n ? k + 2 : k] - 0.12); }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (s === S_DEEP) { ctx.fillStyle = T('snowShade'); ctx.beginPath(); for (let k = alignUp(a, 4); k < b; k += 4) { const x = X(k) + hashf(k, 9); ctx.moveTo(x + 0.35, c.y[k] - 0.38); ctx.ellipse(x, c.y[k] - 0.38, 0.35, 0.05, 0, 0, TAU); } ctx.fill(); }
      ctx.strokeStyle = css(mixc(P.snow, [255, 255, 255], 0.6), 0.85); ctx.lineWidth = 0.035; ctx.beginPath();
      for (let k = a; k <= b; k++) { const yy = c.y[k] - 0.055; k === a ? ctx.moveTo(X(k), yy) : ctx.lineTo(X(k), yy); } ctx.stroke();
    } else if (s === S_ICE) {
      poly(th); ctx.fillStyle = T('ice'); ctx.fill();
      ctx.strokeStyle = css(mixc(P.ice, [255, 255, 255], 0.55)); ctx.lineWidth = 0.04; ctx.beginPath();
      for (let k = alignUp(a, 5); k < b; k += 5) { const x = X(k) + hashf(k, 5) * 2; ctx.moveTo(x, c.y[k] - 0.06); ctx.lineTo(x + 0.6 + hashf(k, 6), c.y[k] - 0.2); }
      ctx.stroke();
      ctx.strokeStyle = T('iceDeep'); ctx.lineWidth = 0.03; ctx.beginPath();
      for (let k = alignUp(a, 9); k < b; k += 9) { const x = X(k); ctx.moveTo(x, c.y[k] - th); ctx.lineTo(x + 0.25, c.y[k] - th * 0.5); ctx.lineTo(x + 0.15, c.y[k] - 0.05); }
      ctx.stroke();
    } else if (s === S_GRAVEL) {
      poly(th); ctx.fillStyle = L('#8a8177'); ctx.fill();
      ctx.fillStyle = L('#5f5850'); ctx.beginPath();
      for (let k = a; k < b; k++) { if (hashf(k, 3) < 0.4) continue; ctx.rect(X(k) + hashf(k, 4) * 0.4, c.y[k] - 0.07 - hashf(k, 5) * (th - 0.1), 0.08, 0.06); }
      ctx.fill();
      poly(0.06); ctx.fillStyle = T('snow'); ctx.fill();
    } else if (s === S_ROCK) {
      poly(th); ctx.fillStyle = L('#7b7671'); ctx.fill();
      ctx.strokeStyle = L('#4b4743'); ctx.lineWidth = 0.035; ctx.beginPath();
      for (let k = alignUp(a, 3); k < b; k += 3) { const x = X(k) + hashf(k, 8); ctx.moveTo(x, c.y[k] - 0.02); ctx.lineTo(x + 0.15, c.y[k] - th * 0.6); ctx.lineTo(x + 0.4, c.y[k] - th); }
      ctx.stroke();
      ctx.fillStyle = T('snow'); ctx.beginPath(); for (let k = alignUp(a, 5); k < b; k += 5) { const x = X(k) + 0.3; ctx.moveTo(x + 0.3, c.y[k] - 0.02); ctx.ellipse(x, c.y[k] - 0.02, 0.3, 0.06, 0, 0, TAU); } ctx.fill();
    } else if (s === S_WOOD) {
      poly(th); ctx.fillStyle = L('#7a5739'); ctx.fill();
      ctx.strokeStyle = L('#3f2b1c'); ctx.lineWidth = 0.035; ctx.beginPath();
      for (let k = a; k <= b; k++) { const x = X(k); ctx.moveTo(x, c.y[k]); ctx.lineTo(x, c.y[k] - th); }
      ctx.stroke();
      poly(0.045); ctx.fillStyle = T('snow'); ctx.fill();
    } else if (s === S_SLABS) {
      poly(th); ctx.fillStyle = L('#a19e96'); ctx.fill();
      ctx.strokeStyle = L('#55524c'); ctx.lineWidth = 0.05; ctx.beginPath();
      for (let k = a; k <= b; k++) { const x = X(k); if (Math.abs(x / 6 - Math.round(x / 6)) < 0.04) { ctx.moveTo(x, c.y[k]); ctx.lineTo(x, c.y[k] - th); } }
      ctx.stroke();
      ctx.fillStyle = L('#7d7a73'); ctx.fillRect(X(a), c.y[a] - th - 0.08, X(b) - X(a), 0.08);
      poly(0.04); ctx.fillStyle = T('snow'); ctx.fill();
    }
  }
  // ---------- decor: one sprite per item, plus its moving bits and lights ----------
  drawDecor(ctx, R, P, c, L, t, lights) {
    const x0 = R.vx0 - 16, x1 = R.vx1 + 16, poles = [];
    const ppm = SPR.ppmQ(R.ppm), ver = R.palVer + '@' + ppm.toFixed(2);
    for (const d of c.decorIn(x0 - 50, x1 + 50)) {
      if (GROUND_DECOR[d.t]) continue;
      if (d.t === 'pole') poles.push(d);
      if ((d.x1 !== undefined ? Math.max(d.x, d.x1) : d.x) < x0 || Math.min(d.x, d.x1 === undefined ? d.x : d.x1) > x1) continue;
      const fn = DECOR[d.t]; if (!fn) continue;
      const y = c.hAt(d.x);
      // decor is keyed by what it is, so the same tree in a rebuilt course reuses its sprite
      if (!d.key) d.key = d.t + '|' + d.x.toFixed(2) + '|' + d.seed + '|' + JSON.stringify(d, DECOR_KEYS) + (d.find ? d.find.id : '');
      const vk = d.t === 'fsign' ? ver + '|' + (d.optKey || '') : d.secret ? ver + (R.secrets && R.secrets[d.secret] ? 'S' : '') : ver;
      const s = SPR.get('d:' + d.key, vk, decorBox(d, y, c), ppm, g => { const cap = []; fn(g, d, y, L, P, c, 0, cap, R); this._cap = cap; });
      if (this._cap) { s.lights = this._cap; this._cap = null; }
      blit(ctx, s);
      if (s.lights) for (const l of s.lights) lights.push(l);
      const dy = DECOR_DYN[d.t]; if (dy) dy(ctx, d, y, L, P, c, t, R);
    }
    // wires between poles
    poles.sort((a, b) => a.x - b.x);
    ctx.strokeStyle = L('#2a2522'); ctx.lineWidth = 0.025; ctx.beginPath();
    for (let i = 0; i + 1 < poles.length; i++) {
      const a = poles[i], b = poles[i + 1]; if (b.x - a.x > 60) continue;
      const ya = c.hAt(a.x) + a.h - 0.15, yb = c.hAt(b.x) + b.h - 0.15;
      for (let w = -1; w <= 1; w += 2) { ctx.moveTo(a.x + w * 0.55, ya); ctx.quadraticCurveTo((a.x + b.x) / 2 + w * 0.55, (ya + yb) / 2 - 1.3, b.x + w * 0.55, yb); }
    }
    ctx.stroke();
  }
  // ---------- particles ----------
  spawn(p) { if (this.parts.length < 320) this.parts.push(p); }
  updateParticles(dt, trucks, env, c) {
    const wind = env.wind || 0, cold = clamp(-(env.temp === undefined ? -15 : env.temp) / 25, 0, 1);
    for (const tr of trucks) {
      const ch = tr.chassis, v = ch.getLinearVelocity(), spd = Math.hypot(v.x, v.y);
      if (tr.engineOn && !tr.inGarage) {
        // exhaust: leaves the stack upwards with the truck's speed, then the air takes it. Fast air mixes it quickly,
        // so the visible plume is short at speed and lazy at idle. Diesel carries soot under load; in the cold every
        // engine also makes white vapour that vanishes fast.
        const load = clamp(tr.power / Math.max(1, tr.pmax), 0, 1), lug = tr.rpm < tr.eng.idle * 1.9 && tr.thr > 0.7 ? 1 : 0, diesel = tr.eng.fuel === 'diesel';
        const soot = clamp((diesel ? 0.22 + 0.62 * load : 0.04 + 0.2 * load) + lug * 0.3 + (1 - tr.cond.engine) * 0.4 + (tr.temp < 45 ? 0.1 : 0), 0, 1);
        const steam = cold * (tr.temp < 70 ? 1 : 0.65);
        const dens = clamp(soot * 0.75 + steam * 0.32, 0.06, 0.85);
        // a truck with a second, low outlet (the drawn 143H): when the throttle comes on it coughs a dark puff out
        // of the low pipe first, and the stack takes over as that dies away (about a second)
        const E2 = tr.G.exhaust2;
        if (E2) {
          if (tr.thr < 0.25) tr._arm = 1; else if (tr._arm && tr.thr > 0.5) { tr._arm = 0; tr._puff = 1; }
          tr._puff = Math.max(0, (tr._puff || 0) - dt / 1.1);
        }
        const puff = E2 ? tr._puff : 0;
        tr._smk = (tr._smk || 0) + dt * (8 + 20 * load + spd * 1.6) * (1 - 0.5 * puff);
        // spawn at the stack where it is drawn this frame (interpolated, not the physics body that runs ahead).
        // A puff released a fraction f of the frame ago has moved with the stack since, plus its own jet, so it
        // sits just past the outlet; it is not integrated again this frame. Each outlet can set the size of a fresh
        // puff (its bore) and how hard it jets, so the smoke starts at the opening rather than above it.
        const ex = tr.G.exhaust[0], en = Math.hypot(ex[2] || 0, 1), up = iwv(ch, (ex[2] || 0) / en, 1 / en), ep0 = iwp(ch, ex[0], ex[1]);
        const r0 = ex[3] || 0.07, jk = ex[4] || 1, dark = clamp(soot / Math.max(0.05, soot + steam * 0.6), 0, 1);
        while (tr._smk > 1) {
          tr._smk -= 1;
          const jet = (1.6 + 3.2 * load + Math.random() * 0.8) * jk, f = Math.random() * dt;
          const life = (0.9 + 1.2 * (1 - load) * 0.6 + 0.5 * soot) / (1 + spd / 7) * (0.75 + 0.5 * Math.random());
          this.spawn({ k: 'smoke', x: ep0.x + up.x * jet * f, y: ep0.y + up.y * jet * f, vx: v.x + up.x * jet, vy: v.y + up.y * jet, r: r0, r0, gr: (0.28 + 0.5 * load) * (1 + spd / 10), life, t: 0, skip: 1, a: dens * (0.7 + 0.3 * Math.random()), dark, drag: 3.2 + spd * 0.08, buoy: 0.9 });
        }
        if (E2 && puff > 0) {
          tr._smk2 = (tr._smk2 || 0) + dt * 28 * puff * (0.5 + 0.5 * load);
          const dn = Math.hypot(E2[2], E2[3]), d2 = iwv(ch, E2[2] / dn, E2[3] / dn), ep2 = iwp(ch, E2[0], E2[1]);
          while (tr._smk2 > 1) {
            tr._smk2 -= 1;
            const jet = (1.8 + 2.4 * puff) * (0.8 + 0.4 * Math.random()), f = Math.random() * dt;
            this.spawn({ k: 'smoke', x: ep2.x + d2.x * jet * f, y: ep2.y + d2.y * jet * f, vx: v.x + d2.x * jet, vy: v.y + d2.y * jet, r: 0.08, r0: 0.08, gr: 0.45 + 0.3 * puff, life: (0.7 + 0.5 * Math.random()) / (1 + spd / 9), t: 0, skip: 1, a: clamp(0.35 + 0.45 * puff, 0, 0.85) * (0.7 + 0.3 * Math.random()), dark: Math.max(dark, diesel ? 0.75 : 0.4), drag: 3.6 + spd * 0.08, buoy: 0.7 });
          }
        }
      }
      // tire spray: material leaves the tread behind the contact patch with the tread's own velocity (up, and back
      // only when the wheel spins faster than the truck moves), then fine snow is caught by the air
      for (const w of tr.wheels) {
        if (!w.touch) continue;
        const S = w.surf, sp = Math.abs(w.slip), om = w.body.getAngularVelocity(), wr = tr.r, tread = Math.abs(om) * wr;
        const soft = S === S_SNOW || S === S_DEEP || S === S_RUTS, loose = soft || S === S_GRAVEL || S === S_ICE;
        if (!loose) continue;
        const rate = (soft ? Math.max(0, tread - 1.5) * 1.6 : 0) + (sp > 0.8 ? sp * 7 : 0) + (S === S_DEEP && tread > 0.6 ? 8 : 0);
        w._sp = (w._sp || 0) + rate * dt;
        const wp = ipos(w.body), wv = w.body.getLinearVelocity();
        while (w._sp > 1) {
          w._sp -= 1;
          const dir = sgn(om) || -1; // om < 0: rolling forward (+x)
          const th = (0.35 + 0.8 * Math.random()), rx = dir * Math.sin(th) * wr, ry = -Math.cos(th) * wr; // point behind and below the hub
          const tvx = -om * ry, tvy = om * rx; // tread velocity from rotation
          const eff = 0.45 + 0.4 * Math.random(), fine = soft && Math.random() < 0.55;
          const col = S === S_GRAVEL ? 'gravel' : S === S_ICE ? 'ice' : 'snow';
          if (S === S_GRAVEL && !fine && Math.random() < 0.5) continue;
          this.spawn({ k: fine ? 'mist' : col, x: wp.x + rx * 0.9, y: wp.y + ry * 0.9, vx: wv.x + tvx * eff + (Math.random() - 0.5), vy: Math.max(0.4, wv.y + tvy * eff * 0.9) + Math.random(),
            r: fine ? 0.12 + Math.random() * 0.1 : 0.035 + Math.random() * 0.05, gr: fine ? 0.7 : 0, life: fine ? 0.5 + Math.random() * 0.5 : 0.6 + Math.random() * 0.5, t: 0,
            a: fine ? 0.5 : 1, grav: fine ? 2.5 : 9.8, drag: fine ? 4.5 : 0.6, skip: 1 });
        }
      }
    }
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      if (p.skip) { p.skip = 0; continue; }
      p.t += dt;
      if (p.t > p.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
      const k = Math.min(1, p.drag * dt);
      p.vx += (wind - p.vx) * k; p.vy += (0 - p.vy) * k;
      if (p.grav) p.vy -= p.grav * dt; else if (p.buoy) p.vy += p.buoy * dt;
      if (p.k === 'smoke') { p.vx += (Math.random() - 0.5) * 3 * dt; p.vy += (Math.random() - 0.5) * 3 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.gr * dt;
      if (p.grav > 5) { const gy = c.hAt(p.x); if (p.y < gy) { p.y = gy; p.vy = 0; p.vx *= 0.4; } }
    }
  }
  drawParticles(ctx, P, L) {
    const ps = this.parts; if (!ps.length) return;
    const amb = P.amb, fog = P.fogc;
    const smokeLight = mulc(mixc(hex('#e4e2de'), fog, 0.2), amb), smokeDark = mulc(mixc(hex('#2a2724'), fog, 0.12), amb);
    const snowC = rgbKey(P.snow, 4), mistC = rgbKey(mixc(P.snow, [255, 255, 255], 0.2), 4);
    // puffs: one soft sprite per colour step
    for (const p of ps) {
      if (p.k !== 'smoke' && p.k !== 'mist') continue;
      // exhaust is thickest at the outlet and thins as the puff spreads, so the plume starts at the pipe's mouth
      const f = p.t / p.life, a = p.a * (1 - f) * (1 - f) * (p.k === 'mist' ? 0.9 : p.r0 ? 0.7 + 0.8 * Math.min(1, p.r0 / p.r) : 1);
      if (a < 0.01) continue;
      const img = PUFF.get(p.k === 'mist' ? mistC : rgbKey(mixc(smokeLight, smokeDark, Math.round(p.dark * 6) / 6), 6), true);
      ctx.globalAlpha = Math.min(1, a); ctx.drawImage(img, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    ctx.globalAlpha = 1;
    // clumps: flat squares batched per material
    for (const [kind, col] of [['snow', 'rgb(' + snowC + ')'], ['ice', css(mixc(P.ice, [255, 255, 255], 0.4))], ['gravel', css(mulc(hex('#6d655b'), amb))]]) {
      let any = false;
      for (const p of ps) { if (p.k !== kind) continue; if (!any) { ctx.beginPath(); any = true; } const s = p.r * (1 - 0.5 * p.t / p.life); ctx.rect(p.x - s, p.y - s, s * 2, s * 2); }
      if (any) { ctx.fillStyle = col; ctx.fill(); }
    }
  }
  // ---------- weather + light (screen space) ----------
  drawWeather(ctx, R, P, env, dt, t, vxCam) {
    const W = R.W, H = R.H, w = P.w;
    // one haze pass: a light overall wash in thick weather, merged with the fog walls when visibility is short
    const wash = P.fog >= 0.4 ? P.fog * 0.16 : 0;
    if (w.vis < 200) {
      const tx = R.truckSX, vis = w.vis * R.ppm;
      const g = ctx.createLinearGradient(0, 0, W, 0);
      const a = d => 1 - (1 - clamp((Math.abs(d) - 7 * R.ppm) / vis, 0, 1) * 0.92) * (1 - wash);
      for (let i = 0; i <= 8; i++) { const x = i / 8 * W; g.addColorStop(i / 8, css(P.fogc, a(x - tx))); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (wash > 0) { ctx.fillStyle = css(P.fogc, wash); ctx.fillRect(0, 0, W, H); }
    const want = Math.round(w.part * 300 * R.quality);
    const F = this.flakes; while (F.length < want) F.push({ x: Math.random() * W, y: Math.random() * H, z: 0.25 + Math.random() * 0.75, ph: Math.random() * TAU }); if (F.length > want) F.length = want;
    if (!F.length) return;
    const wind = (env.wind || 0), sleet = !!w.sleet;
    ctx.fillStyle = sleet ? 'rgba(220,232,240,0.75)' : css(mixc([255, 255, 255], P.fogc, 0.1 + P.dark * 0.5), 0.85);
    ctx.strokeStyle = ctx.fillStyle;
    const streak = Math.abs(wind) > 8;
    ctx.lineWidth = 1.2 * R.k;
    ctx.beginPath();
    for (const f of F) {
      const sp = (sleet ? 260 : 55 + 70 * f.z) * R.k, vx = (wind * 18 * f.z - vxCam * f.z * 0.9) * R.k + Math.sin(t * 1.7 + f.ph) * 12 * R.k;
      f.x += vx * dt; f.y += sp * dt;
      if (f.y > H) { f.y -= H + 10; f.x = Math.random() * W; } if (f.x < -20) f.x += W + 40; if (f.x > W + 20) f.x -= W + 40;
      const sz = (1 + 2.2 * f.z) * R.k;
      if (streak || sleet) { ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - vx * 0.035, f.y - sp * 0.035); }
      else ctx.rect(f.x, f.y, sz, sz);
    }
    if (streak || sleet) ctx.stroke(); else ctx.fill();
  }
  drawLight(ctx, R, P, lights) {
    const dark = P.dark;
    if (dark < 0.03) { this.glows(ctx, R, P, lights, true, null); return; }
    const W = R.W, H = R.H, s = 0.4;
    if (!this.lc) this.lc = document.createElement('canvas');
    const lc = this.lc, lw = Math.ceil(W * s), lh = Math.ceil(H * s); if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
    const g = lc.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, lw, lh);
    const dc = mixc([4, 6, 16], P.fogc, P.fog * 0.3), da = Math.min(0.93, dark * 1.15);
    const vg = g.createLinearGradient(0, 0, 0, lh); vg.addColorStop(0, css(dc, 0)); vg.addColorStop(0.22, css(dc, 0)); vg.addColorStop(0.55, css(dc, da * 0.85)); vg.addColorStop(0.75, css(dc, da)); vg.addColorStop(1, css(dc, da));
    g.fillStyle = vg; g.fillRect(0, 0, lw, lh);
    // the terrain line across the view, sampled once and shared by every light below
    const T = R.course && lights.length ? this.lightSamples(R, R.course) : null;
    g.globalCompositeOperation = 'destination-out';
    const hole = GLOW.get('0,0,0'), cone = GLOW.cone('0,0,0');
    for (const l of lights) {
      const [sx, sy] = R.toScreen(l.x, l.y);
      if (l.type === 'beam') {
        const len = l.len * R.ppm * s, ang = Math.atan2(-l.dy, l.dx);
        g.save(); if (T) { g.beginPath(); this.beamClip(g, R, T, l, s); g.clip(); }
        g.translate(sx * s, sy * s); g.rotate(ang); g.globalAlpha = 0.98; g.drawImage(cone, -len * CONE_X, -len * CONE_Y, len, len * CONE_H); g.restore();
        const rr2 = 4.5 * R.ppm * s; g.globalAlpha = 0.6; g.drawImage(hole, sx * s - rr2, sy * s - rr2, rr2 * 2, rr2 * 2);
      } else if (l.r > 0) {
        const rr2 = l.r * R.ppm * s * (l.big ? 3 : 1.6); g.globalAlpha = l.soft ? 0.5 : 0.85; g.drawImage(hole, sx * s - rr2, sy * s - rr2, rr2 * 2, rr2 * 2);
      }
    }
    // the ground is solid: light stops at the surface, so under it the darkness comes back (with a short soft edge,
    // the lit top of the snow), and a beam pointing into a rise does not show on the far side of it
    if (T) {
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = css(dc, da);
      g.beginPath(); this.groundPath(g, R, T, s, 0.45, R.H * s + 4); g.fill();
      g.globalAlpha = 0.5; g.beginPath(); this.groundPath(g, R, T, s, 0.18, R.H * s + 4); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    ctx.drawImage(lc, 0, 0, W, H);
    this.glows(ctx, R, P, lights, false, T);
  }
  lightSamples(R, c) {
    const step = 0.6, x0 = Math.floor((R.vx0 - 5) / step) * step, n = Math.ceil((R.vx1 + 5 - x0) / step) + 1;
    let T = this._ls; if (!T || T.cap < n) T = this._ls = { cap: n + 64, xs: new Float64Array(n + 64), hs: new Float64Array(n + 64) };
    T.n = n; for (let i = 0; i < n; i++) { const x = x0 + i * step; T.xs[i] = x; T.hs[i] = c.hAt(x); }
    return T;
  }
  // the part of the world a beam can reach: above the ground, and above the line of sight over any crest in front
  // of the lamp (the hill's shadow). A path in screen pixels times s.
  beamClip(g, R, T, l, s) {
    const dir = l.dx >= 0 ? 1 : -1, span = l.len * Math.abs(l.dx) + 2, k = R.ppm * s, ox = (R.W / 2 - R.camX * R.ppm) * s, oy = (R.ay + R.camY * R.ppm) * s;
    let m = -1e9, first = -1, last = -1;
    const n = T.n, i0 = dir > 0 ? 0 : n - 1, i1 = dir > 0 ? n : -1;
    for (let i = i0; i !== i1; i += dir) {
      const x = T.xs[i], dd = (x - l.x) * dir;
      if (dd < -4) continue; if (dd > span) break;
      const h = T.hs[i]; let y = h - 0.18;
      if (dd > 0.25) { if (m > -1e8) y = Math.max(y, l.y + m * dd - 0.05); m = Math.max(m, (h - l.y) / dd); }
      const px = ox + x * k, py = oy - y * k;
      if (first < 0) { g.moveTo(px, py); first = px; } else g.lineTo(px, py);
      last = px;
    }
    if (first < 0) return;
    g.lineTo(last, -8); g.lineTo(first, -8); g.closePath();
  }
  // closed path of everything below the terrain surface minus depth (bottom = edge) or above it (edge = -8)
  groundPath(g, R, T, s, depth, edge) {
    const k = R.ppm * s, ox = (R.W / 2 - R.camX * R.ppm) * s, oy = (R.ay + R.camY * R.ppm) * s, n = T.n;
    g.moveTo(ox + T.xs[0] * k, oy - (T.hs[0] - depth) * k);
    for (let i = 1; i < n; i++) g.lineTo(ox + T.xs[i] * k, oy - (T.hs[i] - depth) * k);
    g.lineTo(ox + T.xs[n - 1] * k, edge); g.lineTo(ox + T.xs[0] * k, edge); g.closePath();
  }
  glows(ctx, R, P, lights, day, T) {
    if (!lights.length) return;
    ctx.save();
    // additive light only above the ground: clip the glow pass to the sky side of the terrain
    if (T && !day) { ctx.beginPath(); this.groundPath(ctx, R, T, 1, 0.12, -8); ctx.clip(); }
    ctx.globalCompositeOperation = 'lighter';
    const night = Math.max(0.25, P.dark * 1.3), c = R.course;
    for (const l of lights) {
      const [sx, sy] = R.toScreen(l.x, l.y);
      if (l.type === 'beam') {
        if (day) continue; // headlight beams do not show in daylight
        const len = l.len * R.ppm, ang = Math.atan2(-l.dy, l.dx);
        ctx.save(); if (T) { ctx.beginPath(); this.beamClip(ctx, R, T, l, 1); ctx.clip(); }
        // where the beam lands the snow lights up: a warm band along the surface, from where the lower edge of the
        // cone meets the ground out to the end of the throw, fading with distance
        if (T && c) {
          const dir = l.dx >= 0 ? 1 : -1, hl = Math.max(0.3, l.y - c.hAt(l.x)), a0 = Math.atan2(-l.dy, Math.abs(l.dx)) + 0.34;
          const d0 = a0 > 0.05 ? Math.min(12, hl / Math.tan(a0)) : 12, d1 = l.len * 0.8;
          const [gx0] = R.toScreen(l.x + dir * d0, 0), [gx1] = R.toScreen(l.x + dir * d1, 0), [gxm] = R.toScreen(l.x + dir * (d0 + 2), 0);
          const gr = ctx.createLinearGradient(gx0, 0, gx1, 0), fm = clamp((gxm - gx0) / ((gx1 - gx0) || 1), 0.01, 0.9);
          const ga = clamp(0.32 * Math.max(0.4, P.dark * 1.2), 0, 0.45);
          gr.addColorStop(0, 'rgba(255,236,196,0)'); gr.addColorStop(fm, 'rgba(255,236,196,' + ga.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,236,196,0)');
          ctx.globalAlpha = 1; ctx.strokeStyle = gr; ctx.lineWidth = 0.42 * R.ppm; ctx.lineCap = 'butt'; ctx.beginPath();
          const k = R.ppm, ox = R.W / 2 - R.camX * k, oy = R.ay + R.camY * k; let any = false;
          for (let i = 0; i < T.n; i++) { const dd = (T.xs[i] - l.x) * dir; if (dd < d0 || dd > d1) continue; const px = ox + T.xs[i] * k, py = oy - T.hs[i] * k; any ? ctx.lineTo(px, py) : ctx.moveTo(px, py); any = true; }
          if (any) ctx.stroke();
        }
        ctx.translate(sx, sy); ctx.rotate(ang);
        ctx.globalAlpha = clamp((0.13 + 0.25 * P.fog + 0.15 * P.w.part) * Math.max(0.3, P.dark * 1.4), 0, 1);
        ctx.drawImage(GLOW.cone('255,236,190'), -len * CONE_X, -len * CONE_Y, len, len * CONE_H); ctx.restore();
        const fr = 0.6 * R.ppm; ctx.globalAlpha = clamp(0.9 * Math.max(0.35, P.dark), 0, 1); ctx.drawImage(GLOW.get('255,248,220'), sx - fr, sy - fr, fr * 2, fr * 2);
      } else if (l.r > 0) {
        // in daylight only small lamps (brake lights, beacon) show, as a faint tinted glow
        if (day && !l.small) continue;
        const rr2 = l.r * R.ppm * (day ? 0.45 : 0.9), cc = hex(l.col || '#ffd38a');
        ctx.globalAlpha = clamp(day ? 0.22 : (l.soft ? 0.25 : 0.55) * night, 0, 1);
        ctx.drawImage(GLOW.get(cc[0] + ',' + cc[1] + ',' + cc[2]), sx - rr2, sy - rr2, rr2 * 2, rr2 * 2);
      }
    }
    ctx.restore();
  }
  // film grain + vignette baked into one half-resolution overlay
  drawGrade(ctx, R, P) {
    const W = R.W, H = R.H, ds = P.w.desat || 0, grain = R.scaleCap >= 1.9;
    const key = W + 'x' + H + ':' + ds.toFixed(2) + (grain ? 'g' : '');
    if (this.vigKey !== key) {
      const vc = this.vig || (this.vig = document.createElement('canvas')), w = Math.ceil(W / 2), h = Math.ceil(H / 2);
      vc.width = w; vc.height = h; const vx = vc.getContext('2d');
      const vg = vx.createRadialGradient(w / 2, h * 0.45, h * 0.35, w / 2, h * 0.5, w * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,6,4,' + (0.28 + 0.12 * ds).toFixed(3) + ')');
      vx.fillStyle = vg; vx.fillRect(0, 0, w, h);
      if (grain) {
        const id = vx.getImageData(0, 0, w, h), d = id.data, r = mulberry32(5), ga = (0.028 + 0.04 * ds) * 255;
        for (let i = 0; i < d.length; i += 4) {
          const v = r() < 0.5 ? 0 : 255, a = r() * ga, A = d[i + 3] + a * (1 - d[i + 3] / 255);
          if (A > 0) { for (let ch = 0; ch < 3; ch++) d[i + ch] = (d[i + ch] * d[i + 3] * (1 - a / 255) + v * a) / A; d[i + 3] = A; }
        }
        vx.putImageData(id, 0, 0);
      }
      this.vigKey = key;
    }
    ctx.drawImage(this.vig, 0, 0, W, H);
  }
}
