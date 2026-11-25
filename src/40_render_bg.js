// ===== background: sky + parallax layers =====
function sprucePoly(x, y, h, w, droop, seed) {
  // silhouette polygon (y up) and snow pillows
  const n = h > 4 ? 5 : 4, body = [], snow = [];
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const t = i / n, ty = y + h * (0.1 + 0.8 * t), tw = w * 0.5 * (1 - t * 0.8) * (0.9 + 0.2 * hashf(i, seed));
    const ny = ty + h * 0.8 / n * 0.42, nw = tw * 0.36;
    left.push([x - tw, ty - droop * tw], [x - nw, ny]);
    right.push([x + tw, ty - droop * tw], [x + nw, ny]);
    snow.push([[x - tw * 0.98, ty - droop * tw + h * 0.012], [x - nw * 0.9, ny + h * 0.022], [x - nw * 1.25, ny - h * 0.012], [x - tw * 0.8, ty - droop * tw * 0.7]]);
    snow.push([[x + tw * 0.98, ty - droop * tw + h * 0.012], [x + nw * 0.9, ny + h * 0.022], [x + nw * 1.25, ny - h * 0.012], [x + tw * 0.8, ty - droop * tw * 0.7]]);
  }
  for (const p of left) body.push(p);
  body.push([x, y + h]);
  for (let i = right.length - 1; i >= 0; i--) body.push(right[i]);
  const b0 = left[0][1];
  body.push([x + w * 0.16, b0 + h * 0.035], [x - w * 0.16, b0 + h * 0.035]);
  return { body, snow };
}
function addPoly(p, pts) { p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); }

const LAYERS = [
  { id: 'far', p: 0.03, s: 0.16, base: 0.60, cw: 160 },
  { id: 'ridge', p: 0.09, s: 0.30, base: 0.635, cw: 90 },
  { id: 'mid', p: 0.24, s: 0.48, base: 0.665, cw: 60 },
  { id: 'near', p: 0.52, s: 0.72, base: 0.70, cw: 42 },
];
function genChunk(L, k, zones) {
  const x0 = k * L.cw, x1 = x0 + L.cw, out = { paths: {}, lights: [], smoke: [], blink: [], y1: 2 };
  out.zk = zones.filter(z => z.layer === L.id && z.x1 > x0 - 1 && z.x0 < x1 + 1).map(z => z.kind[0] + Math.round(z.x0 * 10)).join('');
  const up = v => { if (v > out.y1) out.y1 = v; };
  const P = name => out.paths[name] || (out.paths[name] = new Path2D());
  const seed = 1000 + LAYERS.indexOf(L) * 977;
  if (L.id === 'far') {
    const ridge = x => 7 + 13 * Math.pow(1 - Math.abs(noise1(x / 46, seed)), 1.6) + 6 * Math.pow(1 - Math.abs(noise1(x / 17, seed + 3)), 2) + 1.2 * noise1(x / 4, seed + 5);
    const b = P('far'), sn = P('farSnow'), sh = P('farShade');
    b.moveTo(x0 - 1, -30); for (let x = x0 - 1; x <= x1 + 1; x += 1) { const ry = ridge(x); up(ry); b.lineTo(x, ry); } b.lineTo(x1 + 1, -30); b.closePath();
    // shaded faces: right side of each peak
    let prev = ridge(x0 - 1);
    for (let x = x0; x <= x1; x += 1) {
      const y = ridge(x), y2 = ridge(x + 1);
      if (y2 < y && y > 12) { sh.moveTo(x, y); sh.lineTo(x + 1, y2); sh.lineTo(x + 3.5, y2 - 6); sh.lineTo(x + 2.5, y - 7); sh.closePath(); }
      prev = y;
    }
    // snow caps
    const cap = x => Math.max(13.5 + 1.8 * noise1(x / 3, seed + 9), ridge(x) - 3.2 - 1.4 * noise1(x / 2.3, seed + 11));
    let run = null;
    for (let x = x0 - 1; x <= x1 + 1.01; x += 0.5) {
      const top = ridge(x), bot = cap(x);
      if (top > bot + 0.1) { if (!run) run = []; run.push([x, top, bot]); }
      else if (run) { flushCap(sn, run); run = null; }
    }
    if (run) flushCap(sn, run);
  } else if (L.id === 'ridge') {
    const hill = x => 3.5 + 3.2 * fbm1(x / 30, seed, 3) + 1.5 * noise1(x / 9, seed + 7);
    const b = P('ridge'), s = P('ridgeSnow');
    b.moveTo(x0 - 1, -30);
    for (let x = x0 - 1; x <= x1 + 1; x += 0.45) {
      const h = hill(x), tree = 0.55 + 0.9 * hashf(Math.round(x * 2.2), seed);
      b.lineTo(x, h); b.lineTo(x + 0.2, h + tree); b.lineTo(x + 0.42, h); up(h + tree);
    }
    b.lineTo(x1 + 1, -30); b.closePath();
    // snowy clearings (bands low on the hills)
    for (let x = x0; x < x1; x += 7) {
      if (hashf(Math.round(x), seed + 2) < 0.45) continue;
      const w = 3 + 5 * hashf(Math.round(x), seed + 4), h = hill(x + w / 2) - 1.4;
      s.moveTo(x, h - 0.4); s.quadraticCurveTo(x + w / 2, h + 0.9, x + w, h - 0.4); s.lineTo(x + w, h - 2.2); s.lineTo(x, h - 2.2); s.closePath();
    }
  } else if (L.id === 'mid' || L.id === 'near') {
    const near = L.id === 'near';
    const gl = x => (near ? 0.6 : 1.2) * fbm1(x / (near ? 18 : 26), seed, 2);
    const g = P(near ? 'near' : 'mid');
    g.moveTo(x0 - 1, -40); for (let x = x0 - 1; x <= x1 + 1; x += 1) g.lineTo(x, gl(x)); g.lineTo(x1 + 1, -40); g.closePath();
    const tb = P(near ? 'nearTree' : 'midTree'), ts = P(near ? 'nearSnow' : 'midSnow'), tr = P('trunk');
    const birch = P('birch'), bmark = P('birchMark'), bcrown = P('birchCrown');
    let x = x0 + hashf(k, seed) * 2;
    const zoneAt = xx => zones.find(z => z.layer === L.id && xx > z.x0 && xx < z.x1);
    while (x < x1) {
      const r1 = hashf(Math.round(x * 10), seed + 1), r2 = hashf(Math.round(x * 10), seed + 2), r3 = hashf(Math.round(x * 10), seed + 3);
      const z = zoneAt(x);
      if (z) { x = z.x1 + 0.5; continue; }
      const dens = 0.5 + 0.5 * fbm1(x / 20, seed + 21, 2);
      if (r3 < 0.86 * dens + 0.12) {
        const h = (near ? 5.2 : 3.2) * (0.6 + 0.8 * r1), w = h * (0.38 + 0.12 * r2); up(gl(x) + h);
        if (near && r2 > 0.85) { // birch
          addBirch(birch, bmark, x, gl(x) - 0.1, h * 0.9, seed + Math.round(x * 3), bcrown);
        } else {
          const sp = sprucePoly(x, gl(x) - 0.15, h, w, 0.18, Math.round(x * 7));
          addPoly(tb, sp.body); if (near || h > 3.5) for (const s of sp.snow) addPoly(ts, s);
          if (near) { tr.rect(x - h * 0.025, gl(x) - 0.2, h * 0.05, h * 0.14); }
        }
      }
      x += (near ? 1.4 : 0.9) + (near ? 3.2 : 1.6) * hashf(Math.round(x * 10), seed + 5);
    }
    // special zone structures
    for (const z of zones) {
      if (z.layer !== L.id || z.x1 < x0 || z.x0 > x1) continue;
      if (z.kind === 'village') { addVillage(out, P, z, gl, near, seed); up(gl((z.x0 + z.x1) / 2) + 3.8); }
      if (z.kind === 'sawmill') { addSawmillBg(out, P, z, gl); up(gl((z.x0 + z.x1) / 2) + 9.6); }
      if (z.kind === 'mast') { addMast(out, P, z, gl); up(gl((z.x0 + z.x1) / 2) + 14.4); }
      if (z.kind === 'tanks') { addTanks(out, P, z, gl); up(gl((z.x0 + z.x1) / 2) + 6.5); }
      if (z.kind === 'headframe') { addHeadframe(out, P, z, gl); up(gl((z.x0 + z.x1) / 2) + 13.5); }
      if (z.kind === 'chimney') { addPulpBg(out, P, z, gl); up(gl((z.x0 + z.x1) / 2) + 16.5); }
      if (z.kind === 'cranes') { addCranesBg(out, P, z, gl); up(gl((z.x0 + z.x1) / 2) + 10.5); }
      if (z.kind === 'train') { addTrain(out, P, z, gl); up(gl((z.x0 + z.x1) / 2) + 3.6); }
    }
  }
  return out;
}
function flushCap(sn, run) {
  if (run.length < 2) return;
  sn.moveTo(run[0][0], run[0][2]);
  for (const r of run) sn.lineTo(r[0], r[1]);
  for (let i = run.length - 1; i >= 0; i--) sn.lineTo(run[i][0], run[i][2]);
  sn.closePath();
}
function addBirch(b, m, x, y, h, seed, cr) {
  const w = h * 0.04;
  b.moveTo(x - w, y); b.lineTo(x - w * 0.3, y + h); b.lineTo(x + w * 0.3, y + h); b.lineTo(x + w, y); b.closePath();
  for (let i = 0; i < 8; i++) { const t = 0.1 + i * 0.105 + 0.04 * hashf(i, seed); m.rect(x - w * 0.95 + w * 0.4 * hashf(i, seed + 3), y + h * t, w * (0.5 + 0.9 * hashf(i, seed + 1)), h * 0.016); }
  for (let i = 0; i < 7; i++) {
    const t = 0.38 + i * 0.085, dir = i % 2 ? 1 : -1, len = h * (0.26 - i * 0.022) * (0.8 + 0.4 * hashf(i, seed + 5)), ang = 0.55 + 0.35 * hashf(i, seed + 6);
    const bx = x + dir * Math.sin(ang) * len, by = y + h * t + Math.cos(ang) * len, th = w * 0.22;
    b.moveTo(x, y + h * t - th); b.lineTo(bx, by); b.lineTo(x, y + h * t + th * 2); b.closePath();
    if (cr) { cr.moveTo(bx + h * 0.09, by); cr.ellipse(bx, by, h * 0.09, h * 0.07, 0, 0, TAU); }
  }
  if (cr) { cr.moveTo(x + h * 0.16, y + h * 0.9); cr.ellipse(x, y + h * 0.9, h * 0.16, h * 0.12, 0, 0, TAU); }
}
function addVillage(out, P, z, gl, near, seed) {
  const walls = P('house'), roofs = P('roof'), wins = P('win'), rsnow = P('roofSnow');
  const n = Math.max(1, Math.round((z.x1 - z.x0) / 5));
  for (let i = 0; i < n; i++) {
    const cx = z.x0 + (i + 0.5) * (z.x1 - z.x0) / n + (hashf(i, seed) - 0.5) * 1.5, y = gl(cx) - 0.1;
    const w = 2.4 + 1.2 * hashf(i, seed + 1), h = 1.3 + 0.4 * hashf(i, seed + 2);
    walls.rect(cx - w / 2, y, w, h);
    roofs.moveTo(cx - w / 2 - 0.3, y + h); roofs.lineTo(cx, y + h + w * 0.42); roofs.lineTo(cx + w / 2 + 0.3, y + h); roofs.closePath();
    rsnow.moveTo(cx - w / 2 - 0.3, y + h); rsnow.lineTo(cx, y + h + w * 0.42); rsnow.lineTo(cx + w / 2 + 0.3, y + h); rsnow.lineTo(cx + w / 2 + 0.1, y + h + 0.18); rsnow.lineTo(cx, y + h + w * 0.42 - 0.22); rsnow.lineTo(cx - w / 2 - 0.1, y + h + 0.18); rsnow.closePath();
    const wn = w > 3 ? 2 : 1;
    for (let j = 0; j < wn; j++) { const wx = cx - w / 2 + (j + 0.5) * w / wn - 0.25, wy = y + h * 0.35; wins.rect(wx, wy, 0.5, 0.45); out.lights.push([wx + 0.25, wy + 0.22, 1.6]); }
    if (hashf(i, seed + 7) < 0.7) out.smoke.push([cx + w * 0.22, y + h + w * 0.3]);
  }
}
function addSawmillBg(out, P, z, gl) {
  const wall = P('house'), roof = P('roof'), rs = P('roofSnow'), chim = P('chimney');
  const cx = (z.x0 + z.x1) / 2, y = gl(cx) - 0.1, w = z.x1 - z.x0 - 2;
  wall.rect(cx - w / 2, y, w, 2.6);
  roof.moveTo(cx - w / 2 - 0.3, y + 2.6); roof.lineTo(cx - w / 2 + 1, y + 3.6); roof.lineTo(cx + w / 2 - 1, y + 3.6); roof.lineTo(cx + w / 2 + 0.3, y + 2.6); roof.closePath();
  rs.moveTo(cx - w / 2 + 0.6, y + 3.4); rs.lineTo(cx - w / 2 + 1, y + 3.6); rs.lineTo(cx + w / 2 - 1, y + 3.6); rs.lineTo(cx + w / 2 - 0.6, y + 3.4); rs.closePath();
  chim.rect(cx + w / 2 - 2.2, y, 0.8, 9);
  out.smoke.push([cx + w / 2 - 1.8, y + 9.2, 1]);
  for (let i = 0; i < 4; i++) out.lights.push([cx - w / 2 + 1.5 + i * (w - 3) / 3, y + 1.4, 2.2]);
  out.blink.push([cx + w / 2 - 1.8, y + 9.4]);
}
function addTanks(out, P, z, gl) {
  const wall = P('house'), roof = P('roof'), rs = P('roofSnow');
  const w = z.x1 - z.x0, n = 3;
  for (let i = 0; i < n; i++) { const cx = z.x0 + (i + 0.5) * w / n, r = 1.6 + 0.5 * (i % 2), h = 3.8 + 1.2 * ((i + 1) % 2), y = gl(cx) - 0.1; wall.rect(cx - r, y, r * 2, h); roof.moveTo(cx - r, y + h); roof.quadraticCurveTo(cx, y + h + r * 0.5, cx + r, y + h); roof.closePath(); rs.moveTo(cx - r * 0.8, y + h + 0.1); rs.quadraticCurveTo(cx, y + h + r * 0.45, cx + r * 0.8, y + h + 0.1); rs.closePath(); }
  out.blink.push([z.x0 + w / 2, gl(z.x0 + w / 2) + 6.2]);
}
function addHeadframe(out, P, z, gl) {
  const m = P('mast'), wall = P('house'), roof = P('roof'), cx = (z.x0 + z.x1) / 2, y = gl(cx) - 0.1;
  m.moveTo(cx - 2.2, y); m.lineTo(cx - 0.5, y + 12); m.lineTo(cx - 0.2, y + 12); m.lineTo(cx - 1.6, y); m.closePath();
  m.moveTo(cx + 2.2, y); m.lineTo(cx + 0.5, y + 12); m.lineTo(cx + 0.2, y + 12); m.lineTo(cx + 1.6, y); m.closePath();
  m.moveTo(cx - 1.2, y + 12); m.lineTo(cx + 1.2, y + 12); m.lineTo(cx + 1.2, y + 12.5); m.lineTo(cx - 1.2, y + 12.5); m.closePath();
  m.moveTo(cx + 1.0, y + 13.0); m.arc(cx, y + 13.0, 1.0, 0, TAU);
  for (let k = 1; k < 4; k++) { const yy = y + k * 3; m.rect(cx - 2.2 + k * 0.5, yy, 4.4 - k, 0.2); }
  wall.rect(cx + 2.4, y, 4.5, 3.2); roof.moveTo(cx + 2.2, y + 3.2); roof.lineTo(cx + 4.65, y + 4.4); roof.lineTo(cx + 7.1, y + 3.2); roof.closePath();
  out.lights.push([cx + 3.5, y + 1.6, 1.8]); out.blink.push([cx, y + 14.2]);
}
function addPulpBg(out, P, z, gl) {
  const wall = P('house'), roof = P('roof'), chim = P('chimney'), cx = (z.x0 + z.x1) / 2, y = gl(cx) - 0.1, w = z.x1 - z.x0 - 4;
  wall.rect(cx - w / 2, y, w, 4.2); wall.rect(cx - w / 2 + 2, y + 4.2, w * 0.4, 2.2);
  roof.rect(cx - w / 2 - 0.2, y + 4.2, w + 0.4, 0.3);
  for (const o of [w * 0.18, w * 0.34]) { chim.moveTo(cx + o - 0.6, y); chim.lineTo(cx + o - 0.35, y + 15); chim.lineTo(cx + o + 0.35, y + 15); chim.lineTo(cx + o + 0.6, y); chim.closePath(); out.smoke.push([cx + o, y + 15.2, 1]); out.blink.push([cx + o, y + 15.4]); }
  for (let i = 0; i < 6; i++) out.lights.push([cx - w / 2 + 1.5 + i * (w - 3) / 5, y + 2.0, 2.0]);
}
function addCranesBg(out, P, z, gl) {
  const m = P('mast');
  for (const f of [0.28, 0.72]) {
    const cx = z.x0 + (z.x1 - z.x0) * f, y = gl(cx) - 0.1;
    m.rect(cx - 1.2, y, 0.3, 6.5); m.rect(cx + 0.9, y, 0.3, 6.5); m.rect(cx - 1.3, y + 6.5, 2.6, 0.5); m.rect(cx - 0.5, y + 7.0, 1.2, 1.1);
    m.moveTo(cx, y + 7.6); m.lineTo(cx + 7.5, y + 10.4); m.lineTo(cx + 7.5, y + 10.1); m.lineTo(cx, y + 7.2); m.closePath();
    m.rect(cx + 7.35, y + 6.5, 0.08, 3.6);
  }
}
function addTrain(out, P, z, gl) {
  const wall = P('house'), roof = P('roof'), w = z.x1 - z.x0, n = Math.max(2, Math.round(w / 5.4));
  for (let i = 0; i < n; i++) { const x = z.x0 + i * w / n + 0.2, y = gl(x) + 0.4, len = w / n - 0.5; wall.rect(x, y, len, i === 0 ? 2.6 : 2.2); roof.rect(x, y - 0.4, len, 0.4); if (i === 0) { wall.rect(x + len * 0.6, y + 2.6, len * 0.35, 0.8); out.lights.push([x + len * 0.78, y + 2.9, 1.2]); } }
}
function addMast(out, P, z, gl) {
  const m = P('mast'), x = (z.x0 + z.x1) / 2, y = gl(x);
  m.moveTo(x - 0.7, y); m.lineTo(x - 0.05, y + 14); m.lineTo(x + 0.05, y + 14); m.lineTo(x + 0.7, y); m.closePath();
  out.blink.push([x, y + 14.2]);
}

const GROUND_DIP = [0, 1.25, 1.25, 0.65]; // how far below its base line each layer's ground can dip (layer units)
const BG_ORDER = ['far', 'farShade', 'farSnow', 'ridge', 'ridgeSnow', 'mid', 'near', 'trunk', 'midTree', 'nearTree', 'midSnow', 'nearSnow', 'birchCrown', 'birch', 'birchMark', 'house', 'win', 'roof', 'roofSnow', 'chimney', 'mast'];
class BgRenderer {
  constructor() { this.cache = LAYERS.map(() => new Map()); this.zones = []; this.zkey = ''; this.stars = []; const r = mulberry32(99); for (let i = 0; i < 140; i++) this.stars.push([r(), r() * 0.62, 0.5 + r() * 1.3, r() * TAU]); }
  setZones(course) {
    // world x -> layer x conversions for special background features: whatever stands behind the yards on this drive
    const zones = [];
    const at = (wx, L, w, kind) => { const lx = wx * L.p / L.s; zones.push({ layer: L.id, x0: lx - w / 2, x1: lx + w / 2, kind }); };
    for (const z of course.bgZones || []) at(z.wx, LAYERS[z.layer], z.w, z.kind);
    const key = zones.map(z => z.kind[0] + Math.round(z.x0)).join('');
    if (key === this.zkey) return;
    this.zones = zones; this.cache = LAYERS.map(() => new Map()); this.zkey = key;
  }
  chunk(li, k) {
    const c = this.cache[li]; let ch = c.get(k);
    if (!ch) { ch = genChunk(LAYERS[li], k, this.zones); c.set(k, ch); if (c.size > 14) c.delete(c.keys().next().value); }
    return ch;
  }
  drawSky(ctx, R, P, t) {
    const W = R.W, H = R.H;
    const hz = H * (0.62 + clamp(-R.camDy * 0.0015, -0.05, 0.05));
    const g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, css(P.skyTop)); g.addColorStop(0.55, css(P.skyMid)); g.addColorStop(1, css(P.skyHor));
    // the sky only has to reach down to where the far mountains (or, in fog, the ridge) become solid
    const lay = i => { const L = LAYERS[i]; return [H * L.base + clamp(R.camDy * L.p * 0.1, -H * 0.06, H * 0.06) * R.ppm / 30, R.ppm * L.s]; };
    let skyB = H;
    if (P.fogL.far < 0.99) { const [oy, sc] = lay(0); skyB = oy - 6 * sc; } else if (P.fogL.ridge < 0.99) { const [oy, sc] = lay(1); skyB = oy + 1.4 * sc; }
    skyB = Math.min(H, Math.ceil(Math.max(skyB, hz) + 2));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, skyB);
    // stars + aurora
    if (P.stars > 0.02) {
      // four twinkle groups, one path each
      ctx.fillStyle = '#fff';
      for (let gi = 0; gi < 4; gi++) {
        ctx.globalAlpha = P.stars * 0.9 * (0.55 + 0.45 * Math.sin(t * 1.3 + gi * 1.6)); ctx.beginPath();
        for (let i = gi; i < this.stars.length; i += 4) { const s = this.stars[i], sz = s[2] * R.k; ctx.rect(s[0] * W, s[1] * hz, sz, sz); }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (P.aurora > 0.02) this.drawAurora(ctx, R, P, t, hz);
    // sun / moon
    const e = P.elev;
    if (P.sunVis) {
      if (e > -6) {
        const sx = W * (0.12 + 0.76 * clamp((P.hour - 7.5) / 10, 0, 1)), sy = hz - (e + 2) * H * 0.028;
        const sc = P.sun, gr = H * 0.45; ctx.globalAlpha = 0.55; ctx.drawImage(GLOW.get(rgbKey(sc, 8), 'sun'), sx - gr, sy - gr, gr * 2, gr * 2); ctx.globalAlpha = 1;
        ctx.fillStyle = css(mixc(sc, [255, 255, 255], 0.3)); ctx.beginPath(); ctx.arc(sx, sy, H * (e < 3 ? 0.075 : 0.05), 0, TAU); ctx.fill();
      } else if (e < -9) {
        const mx = W * 0.78, my = H * 0.16, mr = H * 0.042;
        const gr = H * 0.25; ctx.globalAlpha = 0.22; ctx.drawImage(GLOW.get('200,215,255', 'lin'), mx - gr, my - gr, gr * 2, gr * 2); ctx.globalAlpha = 1;
        ctx.fillStyle = '#e9eefb'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(160,172,200,0.5)'; ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, TAU); ctx.arc(mx + mr * 0.35, my + mr * 0.25, mr * 0.16, 0, TAU); ctx.arc(mx + mr * 0.1, my - mr * 0.45, mr * 0.1, 0, TAU); ctx.fill();
      }
    }
    // clouds
    if (P.cloudA > 0) this.drawClouds(ctx, R, P, t, hz);
    return hz;
  }
  drawAurora(ctx, R, P, t, hz) {
    const W = R.W, H = R.H;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const bands = [[0.18, '#5cf2a6', 1], [0.26, '#3fd0c0', 0.7], [0.12, '#b06cf0', 0.45]];
    bands.forEach(([yy, col, a], bi) => {
      const top = [], step = W / 48;
      for (let i = 0; i <= 48; i++) { const x = i * step; top.push([x, H * yy + Math.sin(x / W * 5 + t * 0.15 + bi * 2) * H * 0.05 + Math.sin(x / W * 13 - t * 0.27 + bi) * H * 0.02]); }
      const g = ctx.createLinearGradient(0, H * (yy - 0.08), 0, H * (yy + 0.22));
      const c = hex(col);
      g.addColorStop(0, css(c, 0)); g.addColorStop(0.35, css(c, 0.5 * a * P.aurora)); g.addColorStop(0.6, css(c, 0.18 * a * P.aurora)); g.addColorStop(1, css(c, 0));
      ctx.fillStyle = g; ctx.beginPath();
      top.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      for (let i = top.length - 1; i >= 0; i--) ctx.lineTo(top[i][0], top[i][1] + H * (0.2 + 0.06 * Math.sin(i * 0.7 + t * 0.4 + bi)));
      ctx.closePath(); ctx.fill();
    });
    ctx.restore();
  }
  drawClouds(ctx, R, P, t, hz) {
    const W = R.W, H = R.H, a = P.cloudA;
    const off = (R.camX * 2 + t * 4) * R.k;
    const cc = P.cloud, dark = mixc(P.cloud, P.skyMid, 0.45);
    const n = a > 0.5 ? 9 : 4, ver = R.palVer + ':' + W + 'x' + H + ':' + a.toFixed(2);
    for (let i = 0; i < n; i++) {
      const span = W * 1.6, cw = W * (0.22 + 0.2 * hashf(i, 5)), y = H * (0.08 + 0.36 * hashf(i, 6)) * (a > 0.5 ? 1 : 0.8);
      const x = ((hashf(i, 7) * span - off * (0.4 + 0.4 * hashf(i, 8))) % span + span) % span - W * 0.3;
      const h = H * (0.025 + 0.03 * hashf(i, 9)) * (a > 0.5 ? 1.6 : 1);
      if (x > W || x + cw < 0) continue;
      const s = SPR.get('cl:' + i, ver, [0, 0, cw, h * 2.5], 1, g => {
        g.setTransform(1, 0, 0, 1, 2, 2 + h * 1.15);
        g.fillStyle = css(dark, 0.55 * a); this.blob(g, 0, h * 0.35, cw, h);
        g.fillStyle = css(cc, 0.75 * a); this.blob(g, 0, 0, cw * 0.92, h * 0.9);
      });
      ctx.drawImage(s.cv, x - 2, y - h * 1.15 - 2);
    }
  }
  blob(ctx, x, y, w, h) {
    ctx.beginPath(); ctx.moveTo(x, y + h);
    ctx.bezierCurveTo(x + w * 0.05, y - h * 0.2, x + w * 0.25, y - h * 0.6, x + w * 0.4, y - h * 0.3);
    ctx.bezierCurveTo(x + w * 0.5, y - h * 1.1, x + w * 0.75, y - h * 0.9, x + w * 0.8, y - h * 0.2);
    ctx.bezierCurveTo(x + w * 0.95, y - h * 0.3, x + w, y + h * 0.4, x + w * 0.95, y + h);
    ctx.closePath(); ctx.fill();
  }
  layerSprite(li, k, ver, scQ, col, outlined, olc, lw, y0) {
    const L = LAYERS[li], ch = this.chunk(li, k), cx0 = k * L.cw, cx1 = cx0 + L.cw;
    return SPR.get('bg:' + li + ':' + k + ':' + ch.zk, ver, [cx0 - 0.6, y0, cx1 + 0.6, ch.y1 + 0.4], scQ, g => {
      for (const key of BG_ORDER) {
        const p = ch.paths[key]; if (!p) continue;
        g.fillStyle = col(key); if (key === 'birchCrown') { g.globalAlpha = 0.32; g.fill(p); g.globalAlpha = 1; continue; } g.fill(p);
        if (outlined && (key === 'nearTree' || key === 'midTree' || key === 'house' || key === 'roof' || key === 'birch')) { g.strokeStyle = olc; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(p); }
      }
    });
  }
  prefetch() {
    const f = this._pf; this._pf = null;
    if (!f || SPR.spent > SPR.budgetMs * 0.5) return;
    if (!SPR.has('bg:' + f[0] + ':' + f[1] + ':' + this.chunk(f[0], f[1]).zk, f[2])) this.layerSprite(f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[9]);
  }
  drawLayers(ctx, R, P, t) {
    const W = R.W, H = R.H, ppm = R.ppm;
    const RES = R.quality < 0.9 ? [0.4, 0.5, 0.55, 0.7] : [0.5, 0.55, 0.65, 0.8], Y0 = [-2, -2.6, -1.7, -1.4];
    const dir = R.camDir || 1;
    for (let li = 0; li < LAYERS.length; li++) {
      const L = LAYERS[li], sc = ppm * L.s;
      const ox = W / 2 - R.camX * L.p * ppm, oy = H * L.base + clamp(R.camDy * L.p * 0.1, -H * 0.06, H * 0.06) * ppm / 30;
      const fog = P.fogL[L.id], fc = P.fogc;
      if (fog >= 0.99) continue;
      const col = key => {
        let c = P[key];
        if (!c) {          if (key === 'trunk') c = P.trunk;
          else if (key === 'house') c = mixc(hex('#6b4b36'), P[L.id === 'near' ? 'nearTree' : 'midTree'], 0.55);
          else if (key === 'roof') c = mixc(hex('#5a5550'), P.midTree, 0.6);
          else if (key === 'roofSnow') c = P[L.id === 'near' ? 'nearSnow' : 'midSnow'];
          else if (key === 'win') c = P.dark > 0.1 ? hex('#ffd27a') : mixc(hex('#9fb4bf'), P.midTree, 0.4);
          else if (key === 'chimney' || key === 'mast') c = mixc(hex('#7a6a60'), P.midTree, 0.7);
          else if (key === 'birch') c = mixc(hex('#e9e4da'), P.nearTree, 0.25 + P.sil * 0.6);
          else if (key === 'birchMark') c = mixc(hex('#2b2522'), P.nearTree, 0.4);
          else if (key === 'birchCrown') c = mixc(hex('#7a6a6a'), P.nearTree, 0.35);
          else c = [255, 0, 255];
          if (key !== 'win') c = mulc(c, P.amb);
        }
        if (key === 'win') return css(c);
        return css(fog > 0 ? mixc(c, fc, Math.min(1, fog)) : c);
      };
      // far layer: two painted panoramas joined into one wrap-around strip (A crossfading into B, B back into A),
      // palette-tinted. Pinned to the base zoom so the backdrop never drifts after the truck stops.
      if (li === 0 && typeof BG_PANO_A !== 'undefined' && BG_PANO_A.ready && BG_PANO_B.ready) {
        const key = R.palVer + ':' + Math.round(fog * 16);
        if (!this._pano || this._pano.key !== key) {
          const A = BG_PANO_A, B = BG_PANO_B, f = Math.min(240, A.w >> 3, B.w >> 3), Lw = A.w + B.w - 2 * f;
          // B with alpha ramps at both ends: it crossfades into A at the inner junction and across the wrap
          const bc = document.createElement('canvas'); bc.width = B.w; bc.height = B.h;
          const bgc = bc.getContext('2d');
          bgc.drawImage(B.img, 0, 0);
          const gr = bgc.createLinearGradient(0, 0, B.w, 0);
          gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(f / B.w, 'rgba(0,0,0,1)');
          gr.addColorStop(1 - f / B.w, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          bgc.globalCompositeOperation = 'destination-in'; bgc.fillStyle = gr; bgc.fillRect(0, 0, B.w, B.h);
          const cv = (this._pano && this._pano.cv) || document.createElement('canvas');
          cv.width = Lw; cv.height = A.h;
          const g = cv.getContext('2d');
          g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, Lw, cv.height);
          g.drawImage(A.img, 0, 0);
          g.drawImage(bc, A.w - f, 0);       // junction A → B inside the strip
          g.drawImage(bc, A.w - f - Lw, 0);  // junction B → A across the wrap
          g.globalCompositeOperation = 'multiply'; g.fillStyle = css(mulc([255, 255, 255], P.amb)); g.fillRect(0, 0, Lw, cv.height);
          if (fog > 0) { g.globalCompositeOperation = 'source-over'; g.fillStyle = css(P.fogc, Math.min(1, fog)); g.fillRect(0, 0, Lw, cv.height); }
          this._pano = { key, cv, w: Lw, h: A.h };
        }
        const ox0 = W / 2 - R.camX * L.p * (VIEW.h / 12.5) * R.k, oy0 = H * L.base;
        const s2 = H * 0.60 / this._pano.h, tw = this._pano.w * s2, th = this._pano.h * s2, top = oy0 - th;
        for (let sx = ox0 - Math.ceil(ox0 / tw) * tw; sx < W; sx += tw) ctx.drawImage(this._pano.cv, Math.round(sx), top, tw, th);
        let yb = Math.floor(oy0);
        if (yb < H) {
          let to = Math.min(H, R.groundY || H);
          const N = LAYERS[1], noy = H * N.base + clamp(R.camDy * N.p * 0.1, -H * 0.06, H * 0.06) * ppm / 30;
          to = Math.min(to, Math.ceil(noy + GROUND_DIP[1] * ppm * N.s) + 2);
          if (to > yb) { ctx.fillStyle = col('far'); ctx.fillRect(0, yb, W, to - yb); }
        }
        continue;
      }
      const lx0 = (-ox) / sc, lx1 = (W - ox) / sc, k0 = Math.floor(lx0 / L.cw), k1 = Math.floor(lx1 / L.cw);
      const scQ = SPR.ppmQ(sc * RES[li]), ver = R.palVer + '@' + scQ.toFixed(3);
      const lw = (L.id === 'near' ? 1.6 : 1.1) * R.k / sc, outlined = (L.id === 'near' || L.id === 'mid') && fog < 0.7;
      const olc = css(mixc(mixc(P.outline, P.midTree, L.id === 'near' ? 0.25 : 0.55), fc, Math.min(1, fog)));
      const smoke = this._smoke || (this._smoke = []);
      let yb = H;
      for (let k = k0; k <= k1; k++) {
        const ch = this.chunk(li, k), cx0 = k * L.cw, cx1 = cx0 + L.cw;
        const s = this.layerSprite(li, k, ver, scQ, col, outlined, olc, lw, Y0[li]);
        const xL = Math.round(ox + cx0 * sc), xR = Math.round(ox + cx1 * sc);
        if (xR > 0 && xL < W) ctx.drawImage(s.cv, (cx0 - s.x0) * s.ppm, 0, L.cw * s.ppm, s.h, xL, oy - s.y1 * sc, xR - xL, s.h * sc / s.ppm);
        yb = Math.min(yb, Math.floor(oy - s.y0 * sc) - 1);
        // window lights at night, chimney smoke and blinking tops stay live
        if (P.dark > 0.1 && ch.lights.length) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(0.45 * P.dark, 0, 1);
          const gl = GLOW.get('255,190,110');
          for (const l of ch.lights) { const r = l[2] * 0.9 * sc, x = ox + l[0] * sc, y = oy - l[1] * sc; ctx.drawImage(gl, x - r, y - r, r * 2, r * 2); }
          ctx.restore();
        }
        for (const sm of ch.smoke) smoke.push(sm);
        for (const b of ch.blink) R.bgBlink.push([b[0] * sc + ox, oy - b[1] * sc]);
      }
      if (yb < H) {
        let to = Math.min(H, R.groundY || H);
        if (li < LAYERS.length - 1) { const N = LAYERS[li + 1], noy = H * N.base + clamp(R.camDy * N.p * 0.1, -H * 0.06, H * 0.06) * ppm / 30; to = Math.min(to, Math.ceil(noy + GROUND_DIP[li + 1] * ppm * N.s) + 2); }
        if (to > yb) { ctx.fillStyle = col(L.id); ctx.fillRect(0, yb, W, to - yb); }
      }
      // prefetch the chunk coming into view next
      if (SPR.spent < SPR.budgetMs * 0.5) { const kn = dir >= 0 ? k1 + 1 : k0 - 1; this._pf = [li, kn, ver, scQ, col, outlined, olc, lw, L, Y0[li]]; }
      if (smoke.length) {
        ctx.setTransform(sc, 0, 0, -sc, ox, oy);
        const sc2 = mulc(mixc(hex('#d9d5cf'), fc, Math.min(1, fog + 0.1)), P.amb);
        for (const sm of smoke) {
          const big = sm[2] ? 1.8 : 1;
          for (let i = 0; i < 6; i++) {
            const f = (((t * 0.12 + i / 6 + sm[0] * 0.13) % 1) + 1) % 1;
            ctx.fillStyle = css(sc2, 0.5 * (1 - f));
            ctx.beginPath(); ctx.arc(sm[0] + f * (2.5 + R.wind * 0.4) * big, sm[1] + f * 4 * big, (0.3 + f * 1.1) * big, 0, TAU); ctx.fill();
          }
        }
        smoke.length = 0;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
