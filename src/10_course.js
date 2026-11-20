// ===== course: terrain profile, surfaces, decor =====
// A drive is one side-on profile sampled every DX metres. It is assembled from pieces (yards, junction pads and
// roads, see 11_world.js) and keeps growing while you drive: when you pick a road at a junction, the stretch past
// the junction is cut off and the chosen road is appended. Everything that caches terrain (physics ground, terrain
// chunks) looks at the edit list to find out what changed.
const DX = 0.5;
const S_SNOW = 0, S_DEEP = 1, S_ICE = 2, S_GRAVEL = 3, S_RUTS = 4, S_ROCK = 5, S_WOOD = 6, S_SLABS = 7;
const SURF = [
  { id: 'snow', name: 'Packed snow', mu: 0.36, soft: 0.04, uneven: 0.25, roll: 0.028, band: 0.34 },
  { id: 'deep', name: 'Deep snow', mu: 0.33, soft: 0.45, uneven: 0.55, roll: 0.040, band: 0.62 },
  { id: 'ice', name: 'Ice', mu: 0.10, soft: 0.0, uneven: 0.15, roll: 0.012, band: 0.30 },
  { id: 'gravel', name: 'Gravel', mu: 0.55, soft: 0.03, uneven: 0.30, roll: 0.020, band: 0.26 },
  { id: 'ruts', name: 'Frozen ruts', mu: 0.46, soft: 0.10, uneven: 0.75, roll: 0.032, band: 0.32 },
  { id: 'rock', name: 'Rock', mu: 0.62, soft: 0.0, uneven: 0.50, roll: 0.018, band: 0.22 },
  { id: 'wood', name: 'Timber', mu: 0.42, soft: 0.0, uneven: 0.10, roll: 0.014, band: 0.26 },
  { id: 'slabs', name: 'Concrete slabs', mu: 0.60, soft: 0.0, uneven: 0.10, roll: 0.012, band: 0.24 },
];
const DB = 32; // decor bucket width (m)

function trap(u, a) { // trapezoid-slope easing: 0..1, max slope = 1/(1-a)
  const s = 1 / (1 - a);
  if (u < a) return s * u * u / (2 * a);
  if (u > 1 - a) return 1 - s * (1 - u) * (1 - u) / (2 * a);
  return s * (a / 2 + (u - a));
}
function stepsFn(t, n, r) {
  const k = Math.min(n - 1, Math.floor(t * n)); const f = t * n - k;
  return (k + trap(Math.min(1, f / r), 0.2)) / n;
}

class Course {
  constructor(seed) {
    this.seed = seed; this.X0 = 0;
    this.y = []; this.s = []; this.soft = []; this.under = []; this.vis = []; this.bot = [];
    this.decor = []; this.buckets = new Map(); this.dn = 0; this.drm = 0;
    this.marks = {}; this.cur = 0;
    this.solids = []; this.bgZones = []; this.zones = []; this.legs = [];
    this.vers = []; this.ver = 0; this.dirtyFrom = 0;
  }
  get n() { return this.y.length; }
  get x() { return this.X0 + (this.y.length - 1) * DX; }
  get xEnd() { return this.x; }
  start(y) { this.y = [y]; this.s = [S_RUTS]; this.soft = [0.06]; this.under = [0]; this.vis = [NaN]; this.bot = [0]; this.cur = y; }
  // bot: 1 where deep snow has no firm base within a tyre's reach (only on the most hidden roads)
  push(y, s, soft, under, vis, bot) { this.y.push(y); this.s.push(s); this.soft.push(soft); this.under.push(under || 0); this.vis.push(vis === undefined ? NaN : vis); this.bot.push(bot || 0); this.cur = y; }
  sec(len, dy, surf, o) {
    o = o || {};
    const steps = Math.round(len / DX), y0 = this.cur, x0 = this.x;
    const amp = o.amp === undefined ? 0.5 : o.amp, wl = o.wl || 40, rough = o.rough || 0;
    const seed = (this.seed * 7919 + Math.round(x0) * 13) | 0;
    const edge = Math.min(0.35, (o.edge || 14) / len);
    for (let k = 1; k <= steps; k++) {
      const t = k / steps, x = x0 + k * DX;
      let f;
      if (o.shape === 'l') f = t;
      else if (o.shape === 'ramp') f = trap(t, 0.2);
      else if (o.shape === 'steps') f = stepsFn(t, o.n || 2, o.r || 0.85);
      else f = smooth(t);
      const env = sstep(0, edge, t) * sstep(1, 1 - edge, t);
      let y = y0 + dy * f + fbm1(x / wl, seed, 3) * amp * env;
      if (rough) y += (noise1(x / 1.9, seed + 17) * 0.7 + noise1(x / 1.1, seed + 29) * 0.3) * rough * env;
      if (o.bumps) for (const b of o.bumps) { const d = (x - b[0]) / b[2]; if (Math.abs(d) < 1) y += b[1] * 0.5 * (1 + Math.cos(Math.PI * d)); }
      const sf = o.surfFn ? o.surfFn(t, x) : surf;
      const sd = o.softFn ? o.softFn(t, x, sf) : SURF[sf].soft;
      this.push(y, sf, sd, o.under || 0, o.visFn ? o.visFn(t, x, y) : NaN, o.bot || 0);
    }
    return this;
  }
  mark(name) { this.marks[name] = this.x; return this; }
  // queries
  idx(x) { return (x - this.X0) / DX; }
  hAt(x) {
    const f = this.idx(x), i = Math.floor(f);
    if (i < 0) return this.y[0]; if (i >= this.n - 1) return this.y[this.n - 1];
    const t = f - i; return this.y[i] + (this.y[i + 1] - this.y[i]) * t;
  }
  slopeAt(x) { return (this.hAt(x + 1) - this.hAt(x - 1)) / 2; }
  ii(x) { return clamp(Math.round(this.idx(x)), 0, this.n - 1); }
  surfAt(x) { return this.s[this.ii(x)]; }
  softAt(x) { return this.soft[this.ii(x)]; }
  botAt(x) { return this.bot[this.ii(x)] || 0; }
  visAt(x) { return this.vis[this.ii(x)]; }
  // ---------- decor, bucketed by x so a long drive only touches what is near the camera ----------
  add(t, x, o) { const d = Object.assign({ t, x, z: 0, seed: (hashf(Math.round(x * 10), 77) * 1e6) | 0 }, o || {}); this.addDecor(d); return d; }
  addDecor(d) {
    d.o = this.dn++; this.decor.push(d);
    const k0 = Math.floor(Math.min(d.x, d.x1 === undefined ? d.x : d.x1) / DB), k1 = Math.floor(Math.max(d.x, d.x1 === undefined ? d.x : d.x1) / DB);
    for (let k = k0; k <= k1; k++) { let b = this.buckets.get(k); if (!b) this.buckets.set(k, b = []); b.push(d); }
    this._dq = null;
  }
  removeDecor(d) {
    const i = this.decor.indexOf(d); if (i < 0) return; this.decor.splice(i, 1);
    for (const b of this.buckets.values()) { const j = b.indexOf(d); if (j >= 0) b.splice(j, 1); }
    this.drm++; this._dq = null;
  }
  // decor overlapping [x0, x1], far layers first (z descending), then in the order it was added
  decorIn(x0, x1) {
    const k0 = Math.floor(x0 / DB), k1 = Math.floor(x1 / DB), key = k0 + ':' + k1 + ':' + this.dn + ':' + this.drm;
    if (this._dq && this._dq.key === key) return this._dq.list;
    const out = [], seen = new Set();
    for (let k = k0; k <= k1; k++) { const b = this.buckets.get(k); if (b) for (const d of b) if (!seen.has(d)) { seen.add(d); out.push(d); } }
    out.sort((a, b) => ((b.z || 0) - (a.z || 0)) || (a.o - b.o));
    this._dq = { key, list: out }; return out;
  }
  // ---------- editing ----------
  edit(x) { this.vers.push([x, ++this.ver]); this.dirtyFrom = Math.min(this.dirtyFrom, Math.max(0, Math.floor(this.idx(x)) - 1)); }
  // version of whatever lies in [x0, x1]: changes when that stretch is cut or extended
  verAt(x0, x1) { let v = 0; for (const e of this.vers) if (e[0] <= x1 + 1.5 && e[1] > v) v = e[1]; return v; }
  truncate(x) {
    const n = Math.max(2, Math.floor(this.idx(x)) + 1);
    if (n >= this.n) return;
    for (const a of [this.y, this.s, this.soft, this.under, this.vis, this.bot]) if (a.length > n) a.length = n;
    this.cur = this.y[n - 1];
    const xe = this.x;
    for (const d of this.decor.slice()) if (Math.max(d.x, d.x1 === undefined ? d.x : d.x1) > xe) this.removeDecor(d);
    this.solids = this.solids.filter(s => s.x1 <= xe); this.bgZones = this.bgZones.filter(z => z.wx <= xe); this.zones = this.zones.filter(z => z.x1 <= xe);
    this.legs = this.legs.filter(l => l.x0 < xe); const last = this.legs[this.legs.length - 1]; if (last && last.x1 > xe) last.x1 = xe;
    this.edit(xe);
  }
  // append a piece (see buildPiece); rev runs it backwards. Returns the course x where it starts and ends.
  appendPiece(P, rev, leg) {
    const x0 = this.x, y0 = this.cur, n = P.y.length, L = (n - 1) * DX, yEnd = P.y[n - 1];
    for (let k = 1; k < n; k++) {
      const i = rev ? n - 1 - k : k, yr = rev ? P.y[i] - yEnd : P.y[i], v = P.vis[i];
      this.push(y0 + yr, P.s[i], P.soft[i], P.under[i], isNaN(v) ? NaN : y0 + (rev ? v - yEnd : v), P.bot ? P.bot[i] : 0);
    }
    const X = u => x0 + (rev ? L - u : u);
    for (const d of P.decor) {
      const q = Object.assign({}, d); q.x = X(d.x);
      if (d.x1 !== undefined) { q.x1 = X(d.x1); if (rev) { const a = q.x; q.x = q.x1; q.x1 = a; } }
      if (rev && q.lean) q.lean = -q.lean;
      if (rev && q.dir) q.dir = -q.dir;
      this.addDecor(q);
    }
    for (const s of P.solids || []) { const a = X(s.x0), b = X(s.x1); this.solids.push({ x0: Math.min(a, b), x1: Math.max(a, b), y0: y0 + (rev ? s.y0 - yEnd : s.y0), y1: y0 + (rev ? s.y1 - yEnd : s.y1), k: s.k }); }
    for (const z of P.bgZones || []) this.bgZones.push(Object.assign({}, z, { wx: X(z.wx) }));
    const x1 = this.x;
    if (leg) { leg.x0 = x0; leg.x1 = x1; leg.rev = !!rev; leg.L = L; this.legs.push(leg); }
    this.edit(x0); this.fixWater(Math.floor(this.idx(x0)) - 1);
    return { x0, x1, X };
  }
  // water under ice or logs, one stretch at a time: the bed deepens away from the banks
  fixWater(i0) {
    let i = clamp(i0, 0, this.n - 1), first = -1;
    while (i > 0 && this.under[i] === 1 && this.under[i - 1] === 1) i--;
    for (; i < this.n; i++) {
      if (this.under[i] !== 1) continue;
      let j = i; while (j + 1 < this.n && this.under[j + 1] === 1) j++;
      for (let k = i; k <= j; k++) { const e = Math.min(k - i, j - k) * DX, dep = Math.min(2.8, 0.2 + e * 0.045) * (0.85 + 0.15 * noise1(k * DX / 40, 7)); this.vis[k] = this.y[k] - 1.05 - dep; }
      if (first < 0) first = i;
      i = j;
    }
    if (first >= 0 && first < i0) this.edit(this.X0 + first * DX);
  }
}

function rockMix(t, x) { return fbm1(x / 22, 5, 2) > 0.18 ? S_ROCK : S_SNOW; }
function screeMix(t, x) { const v = fbm1(x / 18, 9, 2); return v > 0.2 ? S_ROCK : v < -0.35 ? S_SNOW : S_GRAVEL; }
function deepSoft(t, x, sf) { return sf === S_DEEP ? 0.42 + 0.16 * fbm1(x / 20, 3, 2) : SURF[sf].soft; }
// ice on a river (water under it, see fixWater) with patches of snow and pressure ridges
function iceSec(c, len, o) {
  o = o || {}; const x0 = c.x, patches = o.patches || [];
  return c.sec(len, o.dy || 0, S_ICE, {
    amp: 0.04, wl: 30, rough: 0.012, under: o.under || 1, bumps: (o.bumps || []).map(b => [x0 + b[0], b[1], b[2]]),
    surfFn: (t, x) => { const u = x - x0; for (const p of patches) if (u > p[0] && u < p[1]) return S_SNOW; return S_ICE; },
  });
}

// a flat test strip for the workshop floor
function buildFlatCourse() {
  const c = new Course(5); c.X0 = -30; c.start(0); c.s[0] = S_SLABS; c.soft[0] = 0;
  c.sec(60, 0, S_SLABS, { amp: 0, rough: 0, shape: 'l' });
  c.branch = 'garage';
  return c;
}
