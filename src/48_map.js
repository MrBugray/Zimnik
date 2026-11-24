// ===== district map =====
// A plan view of the whole road network. Every road runs through a few hand-placed waypoints and is given just
// enough meander to be as long on the map as it is to drive (yards and junction pads included). Landmarks sit at
// their real distance along each road, and road statistics and profiles are read from the road pieces themselves.
const MAP_ALT0 = 186;                                      // camp yard altitude, m above sea level
const MAP_B = [-1050, -1120, 3350, 1080];                  // map extent in metres (x east, y north)
// the river, west to east: it carries the ice road, the river road ice and both crossings
const MAP_RIVER = [[-1100, -600], [-980, -640], [-850, -665], [-700, -612], [-560, -676], [-400, -640], [-240, -702], [-80, -770], [80, -796], [240, -766], [380, -722], [520, -655],
  [660, -612], [820, -652], [975, -612], [1110, -548], [1235, -526], [1330, -512], [1420, -541], [1500, -556], [1580, -531], [1640, -503], [1720, -524], [1800, -585], [1905, -648], [2030, -662],
  [2150, -624], [2280, -600], [2420, -642], [2560, -612], [2680, -566], [2770, -541], [2865, -500], [2965, -482], [3080, -522], [3200, -566], [3420, -540]];
const MAP_LAKES = [
  { x: 1180, y: 175, rx: 70, ry: 38, a: 0.3, name: '' },
  { x: -905, y: 430, rx: 125, ry: 66, a: -0.4, name: 'Lake Lesnoe' },
  { x: 1240, y: 760, rx: 92, ry: 48, a: 0.25, name: '' },
  { x: 2230, y: -905, rx: 150, ry: 58, a: 0.1, name: 'Lake Dolgoe' },
  { x: 2620, y: -1000, rx: 80, ry: 40, a: -0.3, name: '' },
  { x: 40, y: 340, rx: 60, ry: 34, a: 0.6, name: '' },
];
const MAP_OXBOWS = [[620, -545, 70, 30, 0.1, 0.15, 3.0], [2090, -760, 80, 34, -0.1, 3.3, 6.1], [-380, -545, 60, 26, 0.2, 0.2, 3.1]];
// the deep forest between the river road and the pass: no way through except the old forest track
const MAP_DENSE = [[1195, 70], [1420, 102], [1640, 50], [1765, -55], [1735, -300], [1575, -430], [1395, -440], [1235, -335], [1165, -120]];
const MAP_HILLS = [
  // x, y, half-length, half-width, height (m), angle, shape (1 round, 3 flat-topped)
  [100, 900, 520, 180, 62, -0.1, 1], [-300, 780, 300, 220, 52, 0.5, 1], [-470, 650, 230, 170, 30, 0.2, 1], [560, 740, 250, 190, 34, 0, 1],
  [-760, 860, 260, 180, 48, -0.3, 1], [1400, 1080, 640, 160, 56, 0.05, 1], [2200, 1050, 380, 150, 44, -0.2, 1],
  [2420, 810, 300, 190, 34, -0.3, 1], [3020, 820, 420, 240, 40, 0.3, 1], [1600, -1020, 520, 170, 44, 0.05, 1], [2520, -1070, 420, 150, 38, -0.1, 1],
  [-920, -40, 260, 300, 26, 0.4, 1], [3150, -200, 260, 300, 30, -0.4, 1], [700, 450, 200, 140, 18, 0.7, 1], [1850, 620, 260, 150, 24, -0.5, 1],
  [-200, -980, 420, 140, 30, 0.1, 1], [700, -1000, 300, 130, 26, -0.15, 1],
];
const MAP_MINOR = ['warn', 'culvert', 'oldsign', 'corduroy', 'hut', 'ice', 'boat', 'ruin', 'fallen'];
const MAP_SURF_COL = ['#f2f0ea', '#c9d6e6', '#8fc3dc', '#b7a58c', '#9b8463', '#7d7a76', '#b07a45', '#a9a9a2'];
const MAP_ROAD = { main: ['#f6e6b4', 1], pass: ['#e39a4c', 1], river: ['#f0e2c2', 1], zimnik: ['#e9f1f4', 0.8], ice: ['#ffffff', 0.85], track: ['#e3d3ae', 0.72] };
const MAP_NOTES = {
  camp: 'Home base: the garage, the loader and the log piles. Logs and pulpwood go out from here.',
  mill: 'Sawmill No 3 cuts logs into lumber, and has a workshop. It can only ship lumber it has logs for.',
  depot: 'The fuel depot. Drums and tanker loads of diesel for everyone in the district.',
  port: 'Winter port on the river. Supplies come in here; the ice road starts at the quay.',
  cut12: 'Fresh fellings in the hills. Logs and pulpwood, a long way from anywhere.',
  mine: 'Coal mine in the western hills. Needs pit props, fuel and supplies; ships coal by tipper.',
  lesnoy: 'A forest village on the western track.',
  sosn: 'A village on the far bank, reached over the ice, or the long way round by the steel bridge.',
  rail: 'The railway siding: where lumber and coal leave the district and supplies arrive.',
  pit: 'The gravel pit above the sawmill. Short, heavy runs.',
  pulp: 'Zarechny pulp and paper mill. Hungry for pulpwood; makes paper goods from what it gets.',
  zar: 'The village beyond the river, past the pulp mill: over the ice, or round by the east bridge.',
  xjct: 'The camp road splits: on to the fork, up to Cutting No 12, or down to the river landing.',
  fork: 'Three roads east: the Pass, the River road and, if you know about it, the old zimnik.',
  sjct: 'The east roads meet before the sawmill.',
  icej: 'Out on the river ice: the ice road west, the river road east, the crossing to Sosnovka.',
  bridgej: 'Past the old bridge: the river road climbs to the mill junction, a gravel road runs to the pulp mill, and the bridge road crosses to the far bank.',
};

// ---------- geometry helpers ----------
function mapSpline(pts, n) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1].slice()); return out;
}
function mapLen(P) { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; }
// route through waypoints with a gentle meander, solved so the length matches the road; resampled every 2 m
function mapRoute(way, target, seed, still) {
  const base = mapSpline(way, 30), n = base.length, cum = [0], nx = [], ny = [];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(base[i][0] - base[i - 1][0], base[i][1] - base[i - 1][1]));
  for (let i = 0; i < n; i++) { const a = base[Math.max(0, i - 1)], b = base[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; nx.push(-(b[1] - a[1]) / l); ny.push((b[0] - a[0]) / l); }
  const Lb = cum[n - 1], k = Math.max(2, Math.round(target / 230)), ph = seed * 1.7;
  // still: [u0, u1] stretch (fraction of the length) that keeps to the waypoints, e.g. a road on the river ice
  const env = u => { let e = Math.pow(Math.sin(Math.PI * u), 0.6); if (still) e *= 1 - sstep(still[0] - 0.05, still[0], u) * sstep(still[1] + 0.05, still[1], u); return e; };
  const make = A => base.map((p, i) => { const u = cum[i] / Lb, f = A * env(u) * (Math.sin(TAU * u * k + ph) + 0.35 * Math.sin(TAU * u * k * 2.3 + ph * 2)); return [p[0] + nx[i] * f, p[1] + ny[i] * f]; });
  let lo = 0, hi = 260, P = base;
  if (Lb < target) { for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2; P = make(m); if (mapLen(P) < target) lo = m; else hi = m; } P = make((lo + hi) / 2); }
  const out = [P[0]], step = 2; let acc = 0;
  for (let i = 1; i < P.length; i++) {
    let a = P[i - 1]; const b = P[i]; let seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (acc + seg >= step) { const t = (step - acc) / seg; a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; out.push(a); seg = Math.hypot(b[0] - a[0], b[1] - a[1]); acc = 0; }
    acc += seg;
  }
  out.push(P[P.length - 1]);
  const L = (out.length - 1) * step, kk = target / Math.max(1, L);
  return { pts: out, len: target, at(s) { const f = clamp(s / kk / step, 0, out.length - 1), i = Math.min(out.length - 2, Math.floor(f)), t = f - i, a = out[i], b = out[i + 1]; return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }; } };
}
function mapDistSeg(px, py, P) {
  let best = 1e18, bi = 0;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], ax = a[0], ay = a[1], dx = b[0] - ax, dy = b[1] - ay, l2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - px, qy = ay + dy * t - py, d = qx * qx + qy * qy;
    if (d < best) { best = d; bi = i; }
  }
  return { d: Math.sqrt(best), i: bi };
}
function vnoise2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const k = xi * 7919 + yi * 104729, a = hashf(k, seed), b = hashf(k + 7919, seed), c = hashf(k + 104729, seed), d = hashf(k + 112648, seed);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
// a river polyline between two points on it (nearest vertices), for roads that run on the ice
function riverBetween(R, p, q) {
  const near = pt => { let bi = 0, bd = 1e18; R.forEach((r, i) => { const d = (r[0] - pt[0]) ** 2 + (r[1] - pt[1]) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
  const a = near(p), b = near(q), s = a < b ? R.slice(a, b + 1) : R.slice(b, a + 1).reverse();
  return s;
}

// ---------- model: roads, places, terrain ----------
let MAP_MODEL = null;
function mapModel() {
  if (MAP_MODEL) return MAP_MODEL;
  const M = {};
  M.river = mapSpline(MAP_RIVER, 8);
  // roads: map length = road + half of the yard or pad at each end
  const half = n => nodeLen(n) / 2;
  M.roads = {};
  let seed = 1;
  for (const id in EDGES) {
    const E = EDGES[id], A = NODES[E.a].at, B = NODES[E.b].at;
    let way = E.way, still = null;
    if (!way) { const rv = riverBetween(MAP_RIVER, [A[0] + 20, A[1] - 80], B); way = [A].concat(rv.slice(1, -1), [B]); still = [0.1, 0.95]; }
    if (id === 'e5') still = [0.0, 0.33];
    if (id === 'e19') still = [0.0, 0.3];
    if (id === 'e24') still = [0.4, 0.68];
    if (id === 'e27') still = [0.24, 0.44];
    if (id === 'e28') still = [0.64, 0.84];
    if (id === 'e30') still = [0.42, 0.82];
    const P = edgePiece(id), geo = mapRoute(way, E.len + half(E.a) + half(E.b), seed++, still);
    M.roads[id] = { id, name: E.name, kind: E.kind, secret: E.secret || null, geo, off: half(E.a), P, st: P.stats, lo: MAP_ALT0 + NODES[E.a].alt + P.stats.lo, hi: MAP_ALT0 + NODES[E.a].alt + P.stats.hi };
  }
  // a point on a road, s metres from its a end
  M.onRoad = (edge, s) => { const r = M.roads[edge]; return r.geo.at(r.off + s); };
  // where a drive position is on the map
  M.locate = at => {
    if (!at) return null;
    if (at.edge) return M.onRoad(at.edge, at.s);
    const N = NODES[at.node]; return { x: N.at[0], y: N.at[1], ang: 0 };
  };
  // places: yards and junctions, then landmarks along the roads
  const P = [];
  for (const id in NODES) { const N = NODES[id]; P.push({ id, name: N.name, sub: N.sub, icon: N.kind === 'yard' ? N.icon : 'fork', node: id, mx: N.at[0], my: N.at[1], note: MAP_NOTES[id] || '', big: N.kind === 'yard' }); }
  const marks = { culvert: ['Creek culvert', 'creek dip', 'culvert'], oldsign: ['Old sign', 'roadside', 'oldsign'], cairn: ['Pass summit', 'cairn · ' + Math.round(MAP_ALT0 + NODES.fork.alt + edgePiece('e3').stats.hi) + ' m', 'summit'], bridge: ['Old bridge', 'timber deck', 'bridge'], rbridge: ['Steel bridge', 'over the Zimnyaya', 'bridge'],
    fishhut: ['Fishing hut', 'on the ice', 'hut'], wreck: ['The wreck', 'abandoned truck', 'wreck'], corduroy: ['Log crossing', 'corduroy over a creek', 'corduroy'], boat: ['Upturned boat', 'on the bank', 'boat'], hut: ['Hunters\' hut', 'on the ridge', 'hut'], ruin: ['Abandoned hamlet', 'south bank', 'ruin'] };
  for (const id in EDGES) {
    const pc = edgePiece(id);
    for (const d of pc.decor) {
      const m = marks[d.t]; if (!m) continue;
      const s = d.x1 !== undefined ? (d.x + d.x1) / 2 : d.x, q = M.onRoad(id, s);
      P.push({ id: id + ':' + d.t + ':' + Math.round(s), name: m[0], sub: m[1], icon: m[2], edge: id, s, mx: q.x, my: q.y, ang: q.ang, note: '', secret: EDGES[id].secret || null, side: d.t === 'fishhut' ? 1 : 0, reveal: d.secret || null });
    }
  }
  for (const f of FINDS) { const q = M.onRoad(f.edge, f.s); P.push({ id: f.id, name: f.name, sub: f.where, icon: 'find', edge: f.edge, s: f.s, find: f, mx: q.x, my: q.y, ang: q.ang, note: 'Salvage ' + f.where + '.', secret: EDGES[f.edge].secret || null, side: -1 }); }
  M.places = P;
  // creeks into the river: past the culvert, under the old bridge, at the log crossings
  const wander = (P, seed, keep) => { const n = P.length, out = []; for (let i = 0; i < n; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, u = i / (n - 1), e = Math.sin(Math.PI * u) * (keep ? Math.min(1, Math.abs(u - keep) * 6) : 1), f = 26 * e * (vnoise2(i * 0.18, seed, 5) + 0.5 * vnoise2(i * 0.5, seed, 6)); out.push([P[i][0] - (b[1] - a[1]) / l * f, P[i][1] + (b[0] - a[0]) / l * f]); } return out; };
  const toRiver = (pts, seed, keep) => { const last = pts[pts.length - 1]; let best = null, bd = 1e18; for (const q of M.river) { const d = (q[0] - last[0]) ** 2 + (q[1] - last[1]) ** 2; if (d < bd) { bd = d; best = q; } } pts.push(best.slice()); return wander(mapSpline(pts, 12), seed || 3, keep); };
  const pt = (id, t) => P.find(p => p.edge === id && p.icon === t);
  const cv = pt('e1', 'culvert'), br = pt('e5', 'bridge'), cd = pt('e7', 'corduroy'), c11 = pt('e11', 'corduroy');
  M.creeks = [];
  // creeks rise in the hills, pass under the road where the culvert or bridge is, and wander down to the river
  if (cv) M.creeks.push(toRiver([[cv.mx + 120, cv.my + 300], [cv.mx + 30, cv.my + 140], [cv.mx, cv.my], [cv.mx - 60, cv.my - 240], [cv.mx - 20, cv.my - 470]], 3, 0.33));
  if (br) M.creeks.push(toRiver([[br.mx + 260, br.my + 520], [br.mx + 120, br.my + 250], [br.mx, br.my], [br.mx - 60, br.my - 230]], 4, 0.6));
  if (cd) M.creeks.push(wander(mapSpline([[cd.mx - 90, cd.my + 300], [cd.mx - 20, cd.my + 120], [cd.mx, cd.my], [cd.mx + 30, cd.my - 160], [cd.mx + 60, cd.my - 290]], 12), 5, 0.5));
  if (c11) M.creeks.push(toRiver([[c11.mx + 170, c11.my + 210], [c11.mx + 60, c11.my + 80], [c11.mx, c11.my], [c11.mx - 90, c11.my - 200], [c11.mx - 120, c11.my - 420]], 6, 0.3));
  M.creeks.push(toRiver([[2480, 760], [2560, 560], [2700, 330], [2760, 80], [2900, -200]], 7));
  M.creeks.push(toRiver([[-200, 620], [-260, 360], [-330, 120], [-420, -150], [-470, -420]], 8));
  M.creeks.push(wander(mapSpline([[1700, -950], [1640, -820], [1560, -700], [1520, -560]], 12), 9));
  // swamp along the zimnik, and a bog on the south bank
  const zr = M.roads.e7; M.swamp = [];
  for (let s = 70; s < 840; s += 22) { const p = zr.geo.at(zr.off + s); M.swamp.push([p.x, p.y, 150 + 60 * Math.sin(s * 0.013)]); }
  const sb = M.onRoad('e26', 1100); for (let k = 0; k < 5; k++) M.swamp.push([sb.x - 160 + k * 80, sb.y - 60 + 30 * Math.sin(k), 90]);
  // terrain: a flat-topped ridge carries the pass, hills in the west and north, sopki beyond the river
  const pr = M.roads.e3, s0 = pr.off + pr.P.marks.summit, pa = pr.geo.at(s0), pb = pr.geo.at(s0 + 220), pc = pr.geo.at(s0 + 110);
  const ridgeTop = NODES.fork.alt + pr.P.stats.hi + 1.5;
  const hills = [[pc.x, pc.y, 340, 250, ridgeTop, Math.atan2(pb.y - pa.y, pb.x - pa.x), 3]].concat(MAP_HILLS);
  const hillT = hills.map(([cx, cy, a, b, amp, ang, pw]) => ({ cx, cy, ia: 1 / a, ib: 1 / b, amp, c: Math.cos(ang), s: Math.sin(ang), pw }));
  const RC = M.river.filter((_, i) => i % 3 === 0);
  const swampC = M.swamp; let sx0 = 1e9, sx1 = -1e9, sy0 = 1e9, sy1 = -1e9; for (const [x, y, r] of swampC) { sx0 = Math.min(sx0, x - 2 * r); sx1 = Math.max(sx1, x + 2 * r); sy0 = Math.min(sy0, y - 2 * r); sy1 = Math.max(sy1, y + 2 * r); }
  const pins = Object.values(NODES).map(N => [N.at[0], N.at[1], N.alt]);
  // the river runs west to east, so only the stretch near x can be the closest one
  const RX = RC.map(q => q[0]);
  const riverDist = (x, y) => {
    let lo = 0, hi = RX.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (RX[m] < x) lo = m; else hi = m; }
    let best = 1e18;
    for (let i = Math.max(1, lo - 4); i <= Math.min(RC.length - 1, lo + 5); i++) {
      const a = RC[i - 1], b = RC[i], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
      let t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = a[0] + dx * t - x, qy = a[1] + dy * t - y, d = qx * qx + qy * qy; if (d < best) best = d;
    }
    return Math.sqrt(best);
  };
  M.height = (x, y) => {
    let h = 5 + 7 * vnoise2(x / 280, y / 280, 11) + 3.5 * vnoise2(x / 110, y / 110, 12) + 1.2 * vnoise2(x / 45, y / 45, 14);
    for (const t of hillT) {
      const dx = x - t.cx, dy = y - t.cy, u = (dx * t.c + dy * t.s) * t.ia, v = (-dx * t.s + dy * t.c) * t.ib, q = u * u + v * v;
      if (q > 9) continue;
      h += t.amp * Math.exp(-(t.pw === 1 ? q : q * q * q)) * (1 + 0.1 * vnoise2(x / 90, y / 90, 13));
    }
    const d = riverDist(x, y); if (d < 360) { const wr = Math.exp(-(d / 120) * (d / 120)); h = h + (-7 - h) * wr; }
    if (x > sx0 && x < sx1 && y > sy0 && y < sy1) {
      let ws = 0; for (const [sx, sy, r] of swampC) { const d2 = ((x - sx) * (x - sx) + (y - sy) * (y - sy)) / (r * r); if (d2 < 4) ws = Math.max(ws, Math.exp(-d2 * d2)); }
      h = h + (-2.5 - h) * ws * 0.9;
    }
    // the places sit at their own height
    for (const [px, py, a] of pins) { const d2 = ((x - px) ** 2 + (y - py) ** 2) / 8100; if (d2 < 6) h = h + (a - h) * Math.exp(-d2) * 0.85; }
    return h;
  };
  M.riverCoarse = RC;
  M.zimCoarse = zr.geo.pts.filter((_, i) => i % 10 === 0);
  // height grid: contour lines by marching squares, every 10 m of altitude; above about 232 m the trees give out
  const g = 24, nx0 = Math.ceil((MAP_B[2] - MAP_B[0]) / g), ny0 = Math.ceil((MAP_B[3] - MAP_B[1]) / g), H = new Float32Array((nx0 + 1) * (ny0 + 1));
  for (let j = 0; j <= ny0; j++) for (let i = 0; i <= nx0; i++) H[j * (nx0 + 1) + i] = MAP_ALT0 + M.height(MAP_B[0] + i * g, MAP_B[1] + j * g);
  M.bare = []; for (let j = 0; j <= ny0; j += 2) for (let i = 0; i <= nx0; i += 2) if (H[j * (nx0 + 1) + i] > 232) M.bare.push(MAP_B[0] + i * g, MAP_B[1] + j * g);
  M.contours = [];
  for (let lv = 170; lv <= 280; lv += 10) {
    const seg = [];
    for (let j = 0; j < ny0; j++) for (let i = 0; i < nx0; i++) {
      const k = j * (nx0 + 1) + i, a = H[k], b = H[k + 1], c = H[k + nx0 + 2], d = H[k + nx0 + 1];
      const idx = (a > lv ? 1 : 0) | (b > lv ? 2 : 0) | (c > lv ? 4 : 0) | (d > lv ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const x0 = MAP_B[0] + i * g, y0 = MAP_B[1] + j * g, L = (p, q) => (lv - p) / (q - p);
      const e = [[x0 + g * L(a, b), y0], [x0 + g, y0 + g * L(b, c)], [x0 + g * L(d, c), y0 + g], [x0, y0 + g * L(a, d)]];
      const T = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 2], [0, 1]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 3], [1, 2]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[0, 3]] }[idx];
      for (const [p, q] of T) seg.push(e[p][0], e[p][1], e[q][0], e[q][1]);
    }
    M.contours.push({ lv, seg, index: lv % 50 === 0 });
  }
  // lakes with a ragged shore
  M.lakes = MAP_LAKES.map(L => { const pts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, r = 1 + 0.16 * vnoise2(Math.cos(a) * 2 + L.x, Math.sin(a) * 2, 21); const ex = Math.cos(a) * L.rx * r, ey = Math.sin(a) * L.ry * r; pts.push([L.x + ex * Math.cos(L.a) - ey * Math.sin(L.a), L.y + ex * Math.sin(L.a) + ey * Math.cos(L.a)]); } return { pts, L }; });
  MAP_MODEL = M; return M;
}

// ---------- drawing ----------
// label boxes, so map text keeps clear of other text: centre, half sizes and angle, overlap by separating axes
function mapBox(cx, cy, hw, hh, a, own) { a = a || 0; return { cx, cy, hw, hh, c: Math.cos(a), s: Math.sin(a), own }; }
function mapBoxHit(A, B) {
  const dx = B.cx - A.cx, dy = B.cy - A.cy, ax = [A.c, A.s, -A.s, A.c, B.c, B.s, -B.s, B.c];
  for (let i = 0; i < 8; i += 2) {
    const nx = ax[i], ny = ax[i + 1];
    const ra = A.hw * Math.abs(A.c * nx + A.s * ny) + A.hh * Math.abs(A.c * ny - A.s * nx);
    const rb = B.hw * Math.abs(B.c * nx + B.s * ny) + B.hh * Math.abs(B.c * ny - B.s * nx);
    if (Math.abs(dx * nx + dy * ny) > ra + rb) return false;
  }
  return true;
}
class MapView {
  constructor(hud) { this.hud = hud; this.sel = null; this.zoom = 1; this.cx = null; this.cy = null; this.padR = 0; }
  open(cv, here) {
    this.cv = cv; this.here = here; this.M = mapModel();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize(); this.fit(); this.render();
  }
  found(k) { return !k || this.hud.G.secret(k); }
  resize() { const r = this.cv.getBoundingClientRect(); this.W = Math.max(2, Math.round(r.width * this.dpr)); this.H = Math.max(2, Math.round(r.height * this.dpr)); this.cv.width = this.W; this.cv.height = this.H; }
  fit() {
    const w = MAP_B[2] - MAP_B[0], h = MAP_B[3] - MAP_B[1];
    this.base = Math.min(this.W / w, this.H / h) * 1.02; this.zoom = 1;
    this.cx = (MAP_B[0] + MAP_B[2]) / 2; this.cy = (MAP_B[1] + MAP_B[3]) / 2;
  }
  get sc() { return this.base * this.zoom; }
  toPx(x, y) { return [this.W / 2 + (x - this.cx) * this.sc, this.H / 2 - (y - this.cy) * this.sc]; }
  toMap(px, py) { return [this.cx + (px - this.W / 2) / this.sc, this.cy - (py - this.H / 2) / this.sc]; }
  clampView() {
    const hw = this.W / 2 / this.sc, hh = this.H / 2 / this.sc;
    // with the info card open, the map may slide left under it so the right edge can still be brought into view
    this.cx = clamp(this.cx, MAP_B[0] + Math.min(hw, (MAP_B[2] - MAP_B[0]) / 2), MAP_B[2] - Math.min(hw, (MAP_B[2] - MAP_B[0]) / 2) + this.padR / this.sc);
    this.cy = clamp(this.cy, MAP_B[1] + Math.min(hh, (MAP_B[3] - MAP_B[1]) / 2), MAP_B[3] - Math.min(hh, (MAP_B[3] - MAP_B[1]) / 2));
  }
  setZoom(z, px, py) {
    const [mx, my] = this.toMap(px === undefined ? this.W / 2 : px, py === undefined ? this.H / 2 : py);
    this.zoom = clamp(z, 1, 6);
    const [nx, ny] = this.toMap(px === undefined ? this.W / 2 : px, py === undefined ? this.H / 2 : py);
    this.cx += mx - nx; this.cy += my - ny; this.clampView();
  }
  // while a finger is moving, the last full drawing is just shifted and scaled; the full redraw follows when it stops
  quick() {
    const sn = this.snap; if (!sn) return this.render();
    const g = this.cv.getContext('2d'), k = this.sc / sn.sc;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#ece7da'; g.fillRect(0, 0, this.W, this.H);
    const [x0, y0] = this.toPx(sn.cx - sn.W / 2 / sn.sc, sn.cy + sn.H / 2 / sn.sc);
    g.drawImage(sn.cv, x0, y0, sn.W * k, sn.H * k);
    clearTimeout(this.fullT); this.fullT = setTimeout(() => this.render(), 160);
  }
  roadVisible(r) { return this.found(r.secret); }
  // the whole map in one pass; drawn into the visible canvas only (pan and zoom redraw it)
  render() {
    clearTimeout(this.fullT);
    const g = this.cv.getContext('2d'), M = this.M, sc = this.sc, W = this.W, H = this.H; this.u = this.hud.uPx() * this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#ece7da'; g.fillRect(0, 0, W, H);
    const wt = () => g.setTransform(sc, 0, 0, -sc, W / 2 - this.cx * sc, H / 2 + this.cy * sc);
    wt(); g.lineJoin = 'round'; g.lineCap = 'round';
    const px = 1 / sc; // one device pixel in metres
    // forest tint with clearings cut out of it
    const fl = this.forestLayer(sc);
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(fl, 0, 0); wt();
    // contours
    for (const c of M.contours) {
      g.beginPath(); const s = c.seg; for (let i = 0; i < s.length; i += 4) { g.moveTo(s[i], s[i + 1]); g.lineTo(s[i + 2], s[i + 3]); }
      g.strokeStyle = c.index ? 'rgba(146,104,66,0.75)' : 'rgba(160,122,86,0.42)'; g.lineWidth = (c.index ? 1.6 : 0.9) * this.dpr * px; g.stroke();
    }
    // water: lakes, oxbows, the river with its ice, creeks
    for (const lk of M.lakes) { this.poly(g, lk.pts); g.closePath(); g.fillStyle = '#c3d8e0'; g.fill(); g.strokeStyle = '#6f97a8'; g.lineWidth = Math.max(3, 1.4 * this.dpr * px); g.stroke(); }
    g.strokeStyle = '#7fa3b2'; g.lineWidth = Math.max(10, 2 * this.dpr * px);
    for (const [x, y, rx, ry, a, a0, a1] of MAP_OXBOWS) { g.beginPath(); g.ellipse(x, y, rx, ry, a, a0, a1); g.stroke(); }
    this.poly(g, M.river); g.strokeStyle = '#6f97a8'; g.lineWidth = Math.max(50, 3.2 * this.dpr * px); g.stroke();
    this.poly(g, M.river); g.strokeStyle = '#c3d8e0'; g.lineWidth = Math.max(43, 2.0 * this.dpr * px); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1 * this.dpr * px; g.setLineDash([14, 22]); this.poly(g, M.river); g.stroke(); g.setLineDash([]);
    for (const cr of M.creeks) { this.poly(g, cr); g.strokeStyle = '#6f97a8'; g.lineWidth = Math.max(5, 1.6 * this.dpr * px); g.stroke(); }
    // swamp symbols
    g.strokeStyle = 'rgba(92,134,152,0.75)'; g.lineWidth = 1 * this.dpr * px; g.beginPath();
    for (let i = 0; i < 460; i++) {
      const sw = M.swamp[i % M.swamp.length], a = hashf(i, 31) * TAU, r = Math.sqrt(hashf(i, 32)) * sw[2] * 1.15, x = sw[0] + Math.cos(a) * r, y = sw[1] + Math.sin(a) * r * 0.8;
      if (mapDistSeg(x, y, M.zimCoarse).d < 18) continue;
      g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.moveTo(x - 4, y + 5); g.lineTo(x + 4, y + 5);
    }
    g.stroke();
    // route of the selected place from where the truck is (or the drive so far, from the pause menu)
    const R = M.roads, roadW = Math.max(13, 4.0 * this.dpr * px), fillW = Math.max(8.5, 2.5 * this.dpr * px);
    const hl = this.highlight();
    if (hl) for (const [id, col] of hl) { const r = R[id]; this.poly(g, r.geo.pts); g.strokeStyle = col; g.lineWidth = roadW * 2.3; g.stroke(); }
    // roads: casing then fill
    const ids = Object.keys(R).filter(id => this.roadVisible(R[id]));
    const ord = id => ({ track: 0, zimnik: 1, ice: 2, river: 3, pass: 4, main: 5 })[R[id].kind];
    ids.sort((a, b) => ord(a) - ord(b));
    for (const id of ids) { const r = R[id], k = MAP_ROAD[r.kind]; this.poly(g, r.geo.pts); g.strokeStyle = '#3a332b'; g.lineWidth = roadW * k[1]; g.stroke(); }
    for (const id of ids) {
      const r = R[id], k = MAP_ROAD[r.kind];
      this.poly(g, r.geo.pts); g.strokeStyle = k[0]; g.lineWidth = fillW * k[1]; g.stroke();
      if (r.kind === 'zimnik' || r.kind === 'track') { g.setLineDash([18, 14]); g.strokeStyle = r.kind === 'zimnik' ? '#5b8fa6' : '#8a6a3c'; g.lineWidth = fillW * 0.42; this.poly(g, r.geo.pts); g.stroke(); g.setLineDash([]); }
      // stretches on the river ice
      const P = r.P; let a = -1;
      for (let i = 0; i <= P.n; i += 8) {
        const ice = i < P.n && P.s[i] === S_ICE && P.under[i] === 1;
        if (ice && a < 0) a = i; else if (!ice && a >= 0) { const s0 = r.off + a * DX, s1 = r.off + i * DX, pts = []; for (let s = s0; s <= s1; s += 6) { const q = r.geo.at(s); pts.push([q.x, q.y]); } if (pts.length > 1) { this.poly(g, pts); g.strokeStyle = '#ffffff'; g.lineWidth = fillW * k[1]; g.stroke(); g.setLineDash([12, 10]); g.strokeStyle = '#4c87a1'; g.lineWidth = fillW * 0.45; g.stroke(); g.setLineDash([]); } a = -1; }
      }
    }
    if (this.sel && this.sel.road) { const r = R[this.sel.road]; this.poly(g, r.geo.pts); g.strokeStyle = 'rgba(240,173,58,0.55)'; g.lineWidth = roadW * 2.2; g.stroke(); this.poly(g, r.geo.pts); g.strokeStyle = MAP_ROAD[r.kind][0]; g.lineWidth = fillW; g.stroke(); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.labels(g);
    this.icons(g);
    this.chrome(g);
    const sn = this.snap || (this.snap = { cv: document.createElement('canvas') });
    if (sn.cv.width !== this.W || sn.cv.height !== this.H) { sn.cv.width = this.W; sn.cv.height = this.H; }
    sn.cv.getContext('2d').drawImage(this.cv, 0, 0); sn.cx = this.cx; sn.cy = this.cy; sn.sc = this.sc; sn.W = this.W; sn.H = this.H;
  }
  // roads to light up: the drive so far (pause), or the way from the truck to the selected place
  highlight() {
    const h = this.here, G = this.hud.G;
    if (h && h.legs) return h.legs.filter(l => l.kind === 'edge').map(l => [l.edge, 'rgba(240,173,58,0.42)']);
    const s = this.sel; if (!s || !s.place) return null;
    const p = this.M.places.find(q => q.id === s.place); if (!p || !p.node || NODES[p.node].kind !== 'yard' || p.node === G.loc) return null;
    const r = route(G.loc, p.node, null, k => G.secret(k)); this.selRoute = r;
    return r.edges.map(e => [e, 'rgba(110,170,80,0.5)']);
  }
  forestLayer(sc) {
    const W = this.W, H = this.H, M = this.M;
    const c = this.fl || (this.fl = document.createElement('canvas')); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const q = c.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, W, H);
    q.fillStyle = '#cdd4c0'; q.fillRect(0, 0, W, H);
    const wt = () => q.setTransform(sc, 0, 0, -sc, W / 2 - this.cx * sc, H / 2 + this.cy * sc);
    // the deep forest is darker
    wt(); q.beginPath(); this.poly(q, MAP_DENSE); q.closePath(); q.fillStyle = '#b4c0a6'; q.fill();
    q.lineJoin = 'round'; q.lineCap = 'round';
    q.globalCompositeOperation = 'destination-out'; q.fillStyle = q.strokeStyle = '#000';
    // bare ground: hilltops above the trees, the swamp, water and banks, clearings, road corridors
    q.beginPath(); for (const [x, y, r] of M.swamp) { q.moveTo(x + r, y); q.ellipse(x, y, r * 1.05, r * 0.85, 0, 0, TAU); } q.fill();
    this.poly(q, M.river); q.lineWidth = 78; q.stroke();
    for (const lk of M.lakes) { q.beginPath(); this.poly(q, lk.pts); q.closePath(); q.lineWidth = 30; q.fill(); q.stroke(); }
    for (const id in M.roads) { const r = M.roads[id]; if (!this.roadVisible(r) && r.secret) continue; this.poly(q, r.geo.pts); q.lineWidth = r.kind === 'track' ? 22 : 34; q.stroke(); }
    for (const id in NODES) { const N = NODES[id]; if (N.kind !== 'yard') continue; q.beginPath(); q.ellipse(N.at[0], N.at[1], 120, 85, 0.2 * hashf(id.length, 3), 0, TAU); q.fill(); }
    q.beginPath(); for (let i = 0; i < M.bare.length; i += 2) q.rect(M.bare[i] - 26, M.bare[i + 1] - 26, 52, 52); q.fill();
    // tree marks on what is left: closer together in the deep forest
    q.globalCompositeOperation = 'source-atop'; q.setTransform(1, 0, 0, 1, 0, 0);
    const step = Math.max(8, 10 * this.dpr), sz = Math.max(2.2, 2.6 * this.dpr);
    const dark = new Path2D(), light = new Path2D(), birch = new Path2D();
    for (let y = 0; y < H + step; y += step * 0.8) for (let x = 0; x < W + step; x += step) {
      const [mx, my] = this.toMap(x, y), ix = Math.round(mx / 7), iy = Math.round(my / 7);
      const jx = x + (hashf(ix * 31 + iy, 51) - 0.5) * step, jy = y + (hashf(ix + iy * 17, 52) - 0.5) * step;
      const dense = inPoly(mx, my, MAP_DENSE);
      if (!dense && vnoise2(mx / 170, my / 170, 9) < -0.42) continue;
      const P = dense ? dark : (my < -700 && hashf(ix * 7 + iy, 53) < 0.45) ? birch : light, k = dense ? 1.15 : 1;
      P.moveTo(jx, jy - sz * 1.6 * k); P.lineTo(jx + sz * k, jy + sz * 0.6 * k); P.lineTo(jx - sz * k, jy + sz * 0.6 * k); P.closePath();
      if (dense) { const jx2 = jx + step * 0.5, jy2 = jy + step * 0.3; dark.moveTo(jx2, jy2 - sz * 1.6); dark.lineTo(jx2 + sz, jy2 + sz * 0.6); dark.lineTo(jx2 - sz, jy2 + sz * 0.6); dark.closePath(); }
    }
    q.fillStyle = 'rgba(96,112,86,0.55)'; q.fill(light);
    q.fillStyle = 'rgba(122,128,96,0.5)'; q.fill(birch);
    q.fillStyle = 'rgba(62,82,60,0.7)'; q.fill(dark);
    return c;
  }
  poly(g, P) { g.beginPath(); g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]); }
  labels(g) {
    const M = this.M, u = this.u, R = M.roads, lb = this.lb = this.furniture();
    const along = (id, s, text, col) => {
      const r = R[id]; if (!this.roadVisible(r)) return;
      const p = r.geo.at(s), a = -p.ang, [x, y] = this.toPx(p.x, p.y), up = Math.cos(a) < 0 ? Math.PI : 0;
      if (x < -200 || y < -50 || x > this.W + 200 || y > this.H + 50) return;
      g.save(); g.translate(x, y); g.rotate(a + up); g.font = '700 ' + (u * 3.0).toFixed(1) + 'px "Barlow Condensed",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const off = -u * 3.0, th = a + up; g.lineWidth = u * 0.9; g.strokeStyle = 'rgba(236,231,218,0.9)'; g.strokeText(text, 0, off); g.fillStyle = col; g.fillText(text, 0, off);
      lb.push(mapBox(x - off * Math.sin(th), y + off * Math.cos(th), g.measureText(text).width / 2 + u * 0.5, u * 1.7, th)); g.restore();
    };
    const show = this.zoom > 1.25;
    along('e3', 330, 'PASS ROAD · ' + km(EDGES.e3.len) + ' km', '#8a4a18');
    along('e4', 380, 'RIVER ROAD', '#5a4a30');
    along('e7', 740, 'OLD ZIMNIK · ' + km(EDGES.e7.len) + ' km', '#3f6f86');
    along('e17', 1100, 'NORTH ROAD · ' + km(EDGES.e17.len) + ' km', '#5a4a30');
    along('e18', 700, 'ICE ROAD · ' + km(EDGES.e18.len) + ' km', '#3f6f86');
    along('e25', 520, 'FOREST TRACK', '#3e5232');
    along('e26', 1000, 'SOUTH BANK TRACK', '#5a4a30');
    along('e30', 560, 'ICE CROSSING · ' + km(EDGES.e30.len) + ' km', '#3f6f86');
    if (show) { along('e1', 250, 'CAMP ROAD', '#4a3f33'); along('e16', 600, 'RIDGE TRACK', '#5a4a30'); along('e9', 380, 'DEPOT ROAD', '#4a3f33'); along('e13', 560, 'LANDING ROAD', '#4a3f33'); along('e15', 520, 'CUTTING ROAD', '#4a3f33'); along('e10', 450, 'MINE ROAD', '#4a3f33'); along('e22', 520, 'PULP MILL ROAD', '#4a3f33'); along('e27', 1150, 'BRIDGE ROAD', '#4a3f33'); along('e28', 300, 'EAST BRIDGE ROAD', '#4a3f33'); along('e29', 480, 'HILL ROAD', '#8a4a18'); along('e31', 350, 'QUARRY RIDGE', '#5a4a30'); }
    // terrain names
    // (drawn after the places, in icons(), so they can make way)
    const T = this.terr = [];
    const place = (x, y, t, size, col, sub) => { const [px, py] = this.toPx(x, y); T.push({ px, py, t, size, col, sub }); };
    const rp = M.river[Math.round(M.river.length * 0.16)], rq = M.river[Math.round(M.river.length * 0.62)], sp = M.swamp[12];
    place(rp[0], rp[1] - 80, 'R. Zimnyaya', 3.4, '#4c7d92'); place(rq[0], rq[1] - 80, 'R. Zimnyaya', 3.0, '#4c7d92');
    place(sp[0], sp[1] - 110, 'Gnilaya swamp', 3.0, '#4c7d92');
    const sm = M.places.find(p => p.icon === 'summit'); if (sm) place(sm.mx + 40, sm.my + 230, 'Kamenny ridge', 3.2, '#7a5a3a');
    place(1250, -150, 'Glukhoy forest', 3.0, '#2f4a2c', ['no way through', 2.4, '#3e5a3a']);
    place(60, 985, 'Lysye hills', 3.2, '#7a5a3a'); place(1650, -1050, 'Zarechnye sopki', 3.0, '#7a5a3a'); place(2400, 880, 'Karier hill', 2.8, '#7a5a3a'); place(1400, 1050, 'Severny ridge', 3.0, '#7a5a3a'); place(-760, 900, 'Medvezhya hill', 2.8, '#7a5a3a');
    for (const lk of MAP_LAKES) if (lk.name) place(lk.x, lk.y - lk.ry - 40, lk.name, 2.8, '#4c7d92');
  }
  icons(g) {
    const M = this.M, u = this.u, G = this.hud.G, D = G.data, lb = this.lb || (this.lb = []);
    this.hit = [];
    g.textAlign = 'left'; g.textBaseline = 'middle';
    const font = (w, px) => w + ' ' + px.toFixed(1) + 'px "Barlow Condensed",sans-serif';
    const parked = {}; for (const id in TRUCKS) { if (D.trucks[id].road) continue; const l = D.trucks[id].loc; (parked[l] = parked[l] || []).push(id); }
    // the truck and a stranded truck are drawn last, on top of everything; other names keep clear of theirs
    const h = this.here, hp = h && M.locate(h.at), hq = h && h.stranded && M.locate(h.stranded), sName = h && h.strandName || 'Stranded truck';
    if (hp) { const [x, y] = this.toPx(hp.x, hp.y); g.font = font('700', u * 3.4); const w = g.measureText('You are here').width; lb.push(mapBox(x, y, u * 2.4, u * 2.4, 0, 'here'), mapBox(x + u * 3.4 + w / 2, y + u * 3.6, w / 2 + u * 0.4, u * 2.0, 0, 'here')); }
    if (hq) { const [x, y] = this.toPx(hq.x, hq.y); g.font = font('700', u * 3); const w = g.measureText(sName).width; lb.push(mapBox(x, y, u * 1.9, u * 1.9, 0, 'str'), mapBox(x + u * 2.6 + w / 2, y, w / 2 + u * 0.4, u * 1.8, 0, 'str')); }
    // icons first (each keeps its own spot clear), then the names
    const names = [];
    for (const p of M.places) {
      if (p.secret && !this.found(p.secret)) continue;
      const minor = MAP_MINOR.includes(p.icon) && !(p.reveal && !this.found(p.reveal));
      const junction = p.node && NODES[p.node].kind === 'jct';
      if ((minor || p.icon === 'find' || junction) && this.zoom < 1.5 && !(this.sel && this.sel.place === p.id)) { if (!junction) continue; }
      let [x, y] = this.toPx(p.mx, p.my); const sel = this.sel && this.sel.place === p.id;
      if (p.side && p.ang !== undefined) { const o = p.side * u * 3.4; x += -Math.sin(p.ang) * o; y += -Math.cos(p.ang) * o; }
      if (x < -60 || y < -60 || x > this.W + 60 || y > this.H + 60) continue;
      const s = u * (p.big ? 1.15 : junction ? 0.7 : 1);
      g.save(); g.translate(x, y);
      if (sel) { g.fillStyle = 'rgba(240,173,58,0.45)'; g.beginPath(); g.arc(0, 0, s * 4.4, 0, TAU); g.fill(); }
      if (junction) { g.fillStyle = '#f6e6b4'; g.strokeStyle = '#2a2520'; g.lineWidth = u * 0.5; g.beginPath(); g.arc(0, 0, u * 1.2, 0, TAU); g.fill(); g.stroke(); }
      else this.icon(g, p, s, D);
      g.restore();
      lb.push(mapBox(x, y, s * 1.7, s * 1.7, 0, p.id));
      // jobs waiting and trucks parked at a yard
      if (p.big) {
        const n = G.econ.board(p.node, G).length, here = parked[p.node];
        if (n) { const bx = x + s * 3.0, by = y - s * 2.6; g.fillStyle = '#f0ad3a'; g.strokeStyle = '#2a2520'; g.lineWidth = u * 0.4; g.beginPath(); g.arc(bx, by, u * 1.7, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#2a2520'; g.font = font('700', u * 2.4); g.textAlign = 'center'; g.fillText(String(n), bx, by + u * 0.1); g.textAlign = 'left'; lb.push(mapBox(bx, by, u * 1.9, u * 1.9, 0, p.id)); }
        if (here) here.forEach((id, i) => { const tx = x - s * 3.2 - i * u * 3.2, ty = y - s * 2.6; this.truckMark(g, tx, ty, id === G.gid); lb.push(mapBox(tx, ty, u * 1.6, u * 1.3, 0, p.id)); });
      }
      const big = p.big || p.icon === 'summit';
      if (big || this.zoom >= 1.7 || sel || (junction && this.zoom >= 1.3)) names.push({ p, x, y, s, sel, big, junction });
      this.hit.push({ x, y, r: s * 4.2, place: p.id });
    }
    // names: the selected place first, then yards, the summit, junctions and the rest. Each takes the first side
    // (right, left, below, above) that keeps clear of other text and icons; a minor name with no room waits for a
    // closer zoom (its icon is still there to tap)
    const rank = v => v.sel ? 0 : v.p.big ? 1 : v.big ? 2 : v.junction ? 3 : 4;
    names.sort((a, b) => rank(a) - rank(b));
    const edge = this.W - this.padR - u * 1.5;
    for (const v of names) {
      const { p, x, y, s, big } = v, fs = (big ? 3.3 : 2.8) * u, two = p.sub && (big || v.sel);
      g.font = font('700', fs); let wN = g.measureText(p.name).width;
      if (two) { g.font = font('500', fs * 0.78); wN = Math.max(wN, g.measureText(p.sub).width); }
      // text boxes by cap height (a line spans about 0.42 of the font size either side of its middle)
      const ty = y + (p.big ? s * 1.4 : 0) - (two ? fs * 0.45 : 0), hgt = two ? fs * 1.68 : fs * 0.84, gap = s * 3.3;
      const right = [x + gap, ty, 'left'], left = [x - gap, ty, 'right'];
      const C = x + gap + wN > edge ? [left, right] : [right, left];
      C.push([x, y + s * 2.3 + fs * 0.55, 'center']);
      if (!p.big) C.push([x, y - s * 2.3 - fs * 0.55 - (two ? fs * 0.95 : 0), 'center']);
      const boxOf = c => { const x0 = c[2] === 'left' ? c[0] : c[2] === 'right' ? c[0] - wN : c[0] - wN / 2; return mapBox(x0 + wN / 2, c[1] - fs * 0.42 + hgt / 2, wN / 2 + u * 0.4, hgt / 2 + u * 0.25, 0, p.id); };
      let pick = null, pb = null;
      for (const c of C) { const B = boxOf(c); if (B.cx - B.hw >= u * 0.5 && B.cx + B.hw <= edge + u && B.cy - B.hh >= 0 && B.cy + B.hh <= this.H && !lb.some(b => b.own !== p.id && mapBoxHit(b, B))) { pick = c; pb = B; break; } }
      if (!pick) { if (!(v.sel || big)) continue; pick = C[0]; pb = boxOf(pick); }
      lb.push(pb);
      g.textAlign = pick[2]; g.font = font('700', fs);
      g.lineWidth = u * 0.8; g.strokeStyle = 'rgba(236,231,218,0.92)'; g.strokeText(p.name, pick[0], pick[1]); g.fillStyle = '#2a2520'; g.fillText(p.name, pick[0], pick[1]);
      if (two) { g.font = font('500', fs * 0.78); g.strokeText(p.sub, pick[0], pick[1] + fs * 0.95); g.fillStyle = '#4a4238'; g.fillText(p.sub, pick[0], pick[1] + fs * 0.95); }
    }
    // terrain names last: nudged up, down or sideways when a name, label or icon is in the way
    g.textAlign = 'center';
    const tf = f => 'italic 600 ' + f.toFixed(1) + 'px "Barlow Condensed",sans-serif';
    for (const L of this.terr || []) {
      if (L.px < -300 || L.px > this.W + 300 || L.py < -60 || L.py > this.H + 60) continue;
      const fs = u * L.size, sf = L.sub ? u * L.sub[1] : 0, sy = fs / 2 + sf * 0.6;
      g.font = tf(fs); const w1 = g.measureText(L.t).width; let w2 = 0; if (L.sub) { g.font = tf(sf); w2 = g.measureText(L.sub[0]).width; }
      const boxes = (dx, dy) => { const b = [mapBox(L.px + dx, L.py + dy, w1 / 2 + u * 0.3, fs * 0.42 + u * 0.2)]; if (L.sub) b.push(mapBox(L.px + dx, L.py + dy + sy, w2 / 2 + u * 0.3, sf * 0.42 + u * 0.15)); return b; };
      const ok = B => B.cx - B.hw >= 0 && B.cx + B.hw <= this.W - this.padR && B.cy - B.hh >= 0 && B.cy + B.hh <= this.H && !lb.some(q => mapBoxHit(q, B));
      let at = [0, 0];
      const a = w1 * 0.3, b = w1 * 0.55, v = fs * 1.2, v2 = fs * 2.2;
      for (const c of [[0, 0], [0, -v], [0, v], [-a, 0], [a, 0], [-b, 0], [b, 0], [-a, -v], [a, -v], [-a, v], [a, v], [0, -v2], [0, v2]]) if (boxes(c[0], c[1]).every(ok)) { at = c; break; }
      lb.push(...boxes(at[0], at[1]));
      g.font = tf(fs); g.fillStyle = L.col; g.fillText(L.t, L.px + at[0], L.py + at[1]);
      if (L.sub) { g.font = tf(sf); g.fillStyle = L.sub[2]; g.fillText(L.sub[0], L.px + at[0], L.py + at[1] + sy); }
    }
    g.textAlign = 'left';
    for (const id in TRUCKS) {
      const R = D.trucks[id].road; if (!R || (h && (id === G.gid || (h.stranded && h.job && h.job.truck === id)))) continue;
      const q = M.onRoad(R.edge, R.s), [x, y] = this.toPx(q.x, q.y), nm = TRUCKS[id].name.split(' ')[0];
      g.strokeStyle = '#2a2520'; g.lineWidth = u * 0.4; g.fillStyle = 'rgba(240,173,58,0.35)'; g.beginPath(); g.arc(x, y, u * 2.6, 0, TAU); g.fill();
      this.truckMark(g, x, y, id === G.gid);
      g.font = font('700', u * 2.8); g.lineWidth = u * 0.8; g.strokeStyle = 'rgba(236,231,218,0.95)'; g.strokeText(nm, x + u * 2.4, y - u * 2.2); g.fillStyle = '#7a4d0e'; g.fillText(nm, x + u * 2.4, y - u * 2.2);
    }
    // you are here / stranded truck / where the drive is going
    if (h) {
      const p = hp;
      if (h.trip && h.trip.dest) { const N = NODES[h.trip.dest], [dx, dy] = this.toPx(N.at[0], N.at[1]); g.strokeStyle = '#3f7a2e'; g.lineWidth = u * 0.8; g.beginPath(); g.arc(dx, dy, u * 4.6, 0, TAU); g.stroke(); }
      if (p) {
        const [x, y] = this.toPx(p.x, p.y);
        g.save(); g.translate(x, y);
        g.fillStyle = 'rgba(240,173,58,0.5)'; g.beginPath(); g.arc(0, 0, u * 5.6, 0, TAU); g.fill();
        g.strokeStyle = '#fdf8ec'; g.lineWidth = u * 0.8; g.beginPath(); g.arc(0, 0, u * 4.4, 0, TAU); g.stroke();
        g.fillStyle = '#f0ad3a'; g.strokeStyle = '#2a2520'; g.lineWidth = u * 0.7; g.beginPath(); g.arc(0, 0, u * 2.8, 0, TAU); g.fill(); g.stroke();
        const dir = h.at.edge && h.at.leg && h.at.leg.rev ? Math.PI : 0;
        g.rotate(-p.ang + dir); g.fillStyle = '#2a2520'; g.beginPath(); g.moveTo(u * 1.8, 0); g.lineTo(-u * 1.2, u * 1.2); g.lineTo(-u * 0.7, 0); g.lineTo(-u * 1.2, -u * 1.2); g.closePath(); g.fill();
        g.restore();
        g.font = '700 ' + (u * 3.4).toFixed(1) + 'px "Barlow Condensed",sans-serif'; g.lineWidth = u * 0.9; g.strokeStyle = 'rgba(236,231,218,0.95)'; g.strokeText('You are here', x + u * 3.4, y + u * 3.6); g.fillStyle = '#7a4d0e'; g.fillText('You are here', x + u * 3.4, y + u * 3.6);
      }
      if (h.stranded) {
        const q = hq, [rx, ry] = this.toPx(q.x, q.y);
        g.fillStyle = '#b8322a'; g.strokeStyle = '#2a2520'; g.lineWidth = u * 0.5; g.beginPath(); g.arc(rx, ry, u * 1.7, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#fff'; g.font = '700 ' + (u * 2.6).toFixed(1) + 'px "Barlow Condensed",sans-serif'; g.textAlign = 'center'; g.fillText('!', rx, ry + u * 0.1);
        g.textAlign = 'left'; g.font = '700 ' + (u * 3).toFixed(1) + 'px "Barlow Condensed",sans-serif'; g.strokeStyle = 'rgba(236,231,218,0.95)'; g.lineWidth = u * 0.8; g.strokeText(sName, rx + u * 2.6, ry); g.fillStyle = '#8a2a1f'; g.fillText(sName, rx + u * 2.6, ry);
      }
    }
  }
  truckMark(g, x, y, mine) {
    const u = this.u; g.save(); g.translate(x, y);
    g.fillStyle = mine ? '#f0ad3a' : '#e9e4d6'; g.strokeStyle = '#2a2520'; g.lineWidth = u * 0.4;
    g.beginPath(); g.rect(-u * 1.4, -u * 0.8, u * 1.9, u * 1.3); g.rect(u * 0.5, -u * 0.3, u * 0.9, u * 0.8); g.fill(); g.stroke();
    g.fillStyle = '#2a2520'; g.beginPath(); g.arc(-u * 0.8, u * 0.7, u * 0.35, 0, TAU); g.arc(u * 0.9, u * 0.7, u * 0.35, 0, TAU); g.fill();
    g.restore();
  }
  icon(g, p, s, D) {
    const ink = '#2a2520';
    g.lineWidth = s * 0.45; g.strokeStyle = ink; g.fillStyle = ink;
    const box = (w, h, c) => { g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.fillStyle = c; g.fill(); g.stroke(); };
    switch (p.icon) {
      case 'camp':
        for (const [dx, dy] of [[-1.8, 0.8], [0.6, -1.0], [2.2, 1.2]]) { g.save(); g.translate(dx * s, dy * s); box(s * 2.0, s * 1.5, '#8a5a3c'); g.beginPath(); g.moveTo(-s * 1.2, -s * 0.75); g.lineTo(0, -s * 1.8); g.lineTo(s * 1.2, -s * 0.75); g.closePath(); g.fillStyle = '#5a3a28'; g.fill(); g.stroke(); g.restore(); }
        break;
      case 'mill':
        box(s * 5.2, s * 2.8, '#7d7a76'); g.fillStyle = '#e9e4d6'; g.beginPath(); g.arc(-s * 1.2, 0, s * 0.9, 0, TAU); g.fill(); g.stroke();
        g.beginPath(); g.rect(s * 1.1, -s * 3.4, s * 0.8, s * 2.0); g.fillStyle = '#5b5650'; g.fill(); g.stroke(); break;
      case 'pulp':
        box(s * 5.4, s * 2.6, '#8f8a80'); for (const dx of [0.9, 1.9]) { g.beginPath(); g.rect(dx * s, -s * 4.2, s * 0.6, s * 3.0); g.fillStyle = '#5b5650'; g.fill(); g.stroke(); } break;
      case 'mine':
        g.beginPath(); g.moveTo(-s * 1.6, s * 1.4); g.lineTo(0, -s * 2.2); g.lineTo(s * 1.6, s * 1.4); g.stroke(); g.beginPath(); g.arc(0, -s * 2.2, s * 0.7, 0, TAU); g.fillStyle = '#e9e4d6'; g.fill(); g.stroke();
        g.save(); g.translate(s * 2.2, s * 0.6); box(s * 2.2, s * 1.6, '#2b2a2b'); g.restore(); break;
      case 'oldsign': g.beginPath(); g.moveTo(0, s * 1.4); g.lineTo(0, -s * 0.6); g.stroke(); g.save(); g.translate(0, -s * 0.9); g.rotate(-0.15); box(s * 2.2, s * 1.0, '#a99a7c'); g.restore(); if (!this.found('zimnik')) { g.fillStyle = '#7a4d0e'; g.font = '700 ' + (s * 2.4).toFixed(1) + 'px "Barlow Condensed",sans-serif'; g.textAlign = 'center'; g.fillText('?', s * 2.2, -s * 1.8); g.textAlign = 'left'; } break;
      case 'culvert': g.beginPath(); g.arc(0, 0, s * 1.1, Math.PI, 0); g.stroke(); break;
      case 'summit': g.beginPath(); g.moveTo(0, -s * 1.5); g.lineTo(s * 1.4, s * 0.9); g.lineTo(-s * 1.4, s * 0.9); g.closePath(); g.fillStyle = ink; g.fill(); break;
      case 'hut': box(s * 1.8, s * 1.3, '#8a5a3c'); if (p.reveal && !this.found(p.reveal)) { g.fillStyle = '#7a4d0e'; g.font = '700 ' + (s * 2.2).toFixed(1) + 'px "Barlow Condensed",sans-serif'; g.textAlign = 'center'; g.fillText('?', s * 1.9, -s * 1.5); g.textAlign = 'left'; } break;
      case 'bridge': g.lineWidth = s * 0.4; g.beginPath(); g.moveTo(-s * 1.6, -s * 0.8); g.lineTo(-s * 0.8, -s * 0.5); g.lineTo(s * 0.8, -s * 0.5); g.lineTo(s * 1.6, -s * 0.8); g.moveTo(-s * 1.6, s * 0.8); g.lineTo(-s * 0.8, s * 0.5); g.lineTo(s * 0.8, s * 0.5); g.lineTo(s * 1.6, s * 0.8); g.stroke(); break;
      case 'corduroy': g.lineWidth = s * 0.35; g.beginPath(); for (let k = -2; k <= 2; k++) { g.moveTo(k * s * 0.55, -s * 1.1); g.lineTo(k * s * 0.55, s * 1.1); } g.strokeStyle = '#6b4b36'; g.stroke(); break;
      case 'wreck': box(s * 2.2, s * 1.1, '#9a6a4a'); g.beginPath(); g.moveTo(-s * 0.6, -s * 0.9); g.lineTo(s * 0.6, s * 0.9); g.moveTo(s * 0.6, -s * 0.9); g.lineTo(-s * 0.6, s * 0.9); g.stroke(); break;
      case 'boat': g.beginPath(); g.moveTo(-s * 1.6, -s * 0.2); g.quadraticCurveTo(0, s * 1.4, s * 1.6, -s * 0.2); g.closePath(); g.fillStyle = '#3f6a5a'; g.fill(); g.stroke(); break;
      case 'ruin': box(s * 2.0, s * 1.2, '#6a4a33'); g.beginPath(); g.moveTo(-s * 1.2, -s * 0.6); g.lineTo(s * 0.6, -s * 1.4); g.stroke(); break;
      case 'find': {
        const got = D.found && D.found[p.find.id];
        g.save(); g.rotate(Math.PI / 4); box(s * 1.7, s * 1.7, got ? '#c9c2b2' : '#f0ad3a'); g.restore();
        if (got) { g.strokeStyle = '#3f7a2e'; g.lineWidth = s * 0.5; g.beginPath(); g.moveTo(-s * 0.6, 0); g.lineTo(-s * 0.1, s * 0.5); g.lineTo(s * 0.7, -s * 0.6); g.stroke(); }
        break;
      }
      case 'tank': box(s * 2.4, s * 1.4, '#a9a39a'); g.beginPath(); g.moveTo(-s * 1.2, 0); g.lineTo(s * 1.2, 0); g.stroke(); g.save(); g.translate(s * 1.9, -s * 0.4); box(s * 1.4, s * 2.0, '#d9d7d0'); g.restore(); break;
      case 'cut': g.lineWidth = s * 0.4; g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(k * s, s * 1.0); g.lineTo(k * s + s * 0.4, -s * 0.2); } g.stroke(); g.beginPath(); g.arc(0, s * 1.2, s * 1.6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); break;
      case 'rail': g.lineWidth = s * 0.35; g.beginPath(); g.moveTo(-s * 2, -s * 0.4); g.lineTo(s * 2, -s * 0.4); g.moveTo(-s * 2, s * 0.4); g.lineTo(s * 2, s * 0.4); for (let k = -1.6; k <= 1.6; k += 0.8) { g.moveTo(k * s, -s * 0.8); g.lineTo(k * s, s * 0.8); } g.stroke(); break;
      case 'village': for (const [dx, dy] of [[-1.4, 0.3], [1.3, -0.4], [0.1, 1.2]]) { g.save(); g.translate(dx * s, dy * s); box(s * 1.5, s * 1.2, '#a9875e'); g.restore(); } break;
      case 'port': g.lineWidth = s * 0.45; g.beginPath(); g.moveTo(0, -s * 1.5); g.lineTo(0, s * 1.2); g.moveTo(-s * 1.2, s * 0.4); g.quadraticCurveTo(0, s * 1.9, s * 1.2, s * 0.4); g.moveTo(-s * 0.7, -s * 0.8); g.lineTo(s * 0.7, -s * 0.8); g.stroke(); break;
      case 'pit': g.beginPath(); g.arc(0, 0, s * 1.4, 0, TAU); g.fillStyle = '#b7a58c'; g.fill(); g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.6, 0, TAU); g.stroke(); break;
    }
  }
  // frame, scale bar, north arrow (screen space)
  scaleBar() {
    const u = this.u, pad = u * 3, nice = [50, 100, 200, 250, 500, 1000], want = this.W * 0.14 / this.sc, len = nice.reduce((a, b) => Math.abs(b - want) < Math.abs(a - want) ? b : a);
    return { len, bw: len * this.sc, x0: pad + u * 1.5, y0: this.H - pad - u * 3.5, nx: this.W - pad - u * 4, ny: this.H - pad - u * 7 };
  }
  // screen furniture that names should not hide under: the title and buttons (page elements), scale and north arrow
  furniture() {
    const u = this.u, out = [], d = this.dpr, cr = this.cv.getBoundingClientRect(), wrap = this.cv.parentNode;
    for (const q of ['.mtitle', '.mapbar']) {
      const el = wrap && wrap.querySelector(q); if (!el) continue;
      const r = el.getBoundingClientRect(); if (r.width) out.push(mapBox(((r.left + r.right) / 2 - cr.left) * d, ((r.top + r.bottom) / 2 - cr.top) * d, r.width / 2 * d + u * 0.5, r.height / 2 * d + u * 0.5, 0, 'ui'));
    }
    const { bw, x0, y0, nx, ny } = this.scaleBar();
    out.push(mapBox(x0 - u * 1.5 + (bw + u * 12) / 2, y0 - u * 0.25, (bw + u * 12) / 2, u * 4.25, 0, 'ui'), mapBox(nx, ny + u * 1.5, u * 2.2, u * 5, 0, 'ui'));
    return out;
  }
  chrome(g) {
    const u = this.u, W = this.W, H = this.H;
    g.strokeStyle = '#2a2520'; g.lineWidth = u * 0.6; g.strokeRect(u * 0.3, u * 0.3, W - u * 0.6, H - u * 0.6);
    const { len, bw, x0, y0, nx, ny } = this.scaleBar();
    g.fillStyle = 'rgba(236,231,218,0.9)'; g.fillRect(x0 - u * 1.5, y0 - u * 4.5, bw + u * 12, u * 8.5);
    g.fillStyle = '#2a2520'; g.fillRect(x0, y0, bw / 2, u * 1.0); g.strokeStyle = '#2a2520'; g.lineWidth = u * 0.35; g.strokeRect(x0, y0, bw, u * 1.0);
    g.font = '600 ' + (u * 2.8).toFixed(1) + 'px "Barlow Condensed",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText('0', x0, y0 - u * 0.8); g.fillText(len >= 1000 ? (len / 1000) + ' km' : len + ' m', x0 + bw, y0 - u * 0.8);
    g.textAlign = 'left'; g.font = '500 ' + (u * 2.4).toFixed(1) + 'px "Barlow Condensed",sans-serif'; g.fillText('Contours every 10 m', x0, y0 + u * 3.4);
    g.fillStyle = '#2a2520'; g.beginPath(); g.moveTo(nx, ny - u * 3.5); g.lineTo(nx + u * 1.6, ny + u * 1.6); g.lineTo(nx, ny + u * 0.6); g.lineTo(nx - u * 1.6, ny + u * 1.6); g.closePath(); g.fill();
    g.font = '700 ' + (u * 3).toFixed(1) + 'px "Barlow Condensed",sans-serif'; g.textAlign = 'center'; g.fillText('N', nx, ny + u * 5);
  }
  // bring a selection out from under the info card
  reveal(sel) {
    let pt = null;
    if (sel && sel.place) { const p = this.M.places.find(q => q.id === sel.place); if (p) pt = [p.mx, p.my]; }
    else if (sel && sel.road) {
      const P = this.M.roads[sel.road].geo.pts; let x0 = 1e9, x1 = -1e9; for (const q of P) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); }
      const m = this.u * 6, [l] = this.toPx(x0, 0), [r] = this.toPx(x1, 0), over = r - (this.W - this.padR - m);
      if (over > 0) { this.cx += Math.min(over, Math.max(0, l - m)) / this.sc; this.clampView(); }
      return;
    }
    if (!pt) return;
    const [px] = this.toPx(pt[0], pt[1]);
    if (px > this.W - this.padR - this.u * 6) { this.cx += (px - (this.W - this.padR) / 2) / this.sc; this.clampView(); }
  }
  // what is under a tap
  pick(px, py) {
    for (const h of this.hit) if (Math.hypot(px - h.x, py - h.y) < h.r) return { place: h.place };
    const [mx, my] = this.toMap(px, py), tol = this.u * 4 / this.sc;
    let best = null, bd = tol;
    for (const id in this.M.roads) {
      const r = this.M.roads[id]; if (!this.roadVisible(r)) continue;
      const d = mapDistSeg(mx, my, r.geo.pts.filter((_, i) => i % 4 === 0)).d; if (d < bd) { bd = d; best = { road: id }; }
    }
    return best;
  }
  // ---------- info card ----------
  infoHTML(sel) {
    const M = this.M, G = this.hud.G;
    if (!sel) return '';
    if (sel.road) {
      const r = M.roads[sel.road], E = EDGES[sel.road], st = r.st;
      const tot = st.mix.reduce((a, b) => a + b, 0) || 1;
      const mix = st.mix.map((v, i) => [i, v / tot]).filter(q => q[1] > 0.02).sort((a, b) => b[1] - a[1]);
      const bar = '<div class="mbar">' + mix.map(([i, f]) => '<i style="flex:' + f.toFixed(3) + ';background:' + MAP_SURF_COL[i] + '"></i>').join('') + '</div>';
      const leg = mix.map(([i, f]) => '<span><i style="background:' + MAP_SURF_COL[i] + '"></i>' + SURF[i].name + ' ' + Math.round(f * 100) + '%</span>').join('');
      const finds = FINDS.filter(f => f.edge === sel.road), left = finds.filter(f => !G.data.found[f.id]).length;
      const fl = finds.length ? '<p>Salvage: ' + finds.filter(f => G.data.found[f.id]).map(f => '✓ ' + f.name).concat(left ? [left + ' still out there'] : []).join(' · ') + '</p>' : '';
      return '<h2>' + r.name + '</h2><div class="msub">' + NODES[E.a].name + ' – ' + NODES[E.b].name + (E.traits ? ' · ' + E.traits : '') + '</div>' +
        '<div class="mst"><span>Length</span><span>' + km(E.len) + ' km</span><span>Altitude</span><span>' + Math.round(r.lo) + '–' + Math.round(r.hi) + ' m</span>' +
        '<span>Climb / descent</span><span>↑' + Math.round(st.up) + ' m · ↓' + Math.round(st.down) + ' m</span><span>Steepest</span><span>' + Math.round(st.maxG * 100) + '%</span>' + (st.ice ? '<span>On the ice</span><span>' + Math.round(st.ice) + ' m</span>' : '') +
        '</div><canvas class="mprof"></canvas>' + bar + '<div class="mleg">' + leg + '</div>' + fl;
    }
    const p = M.places.find(q => q.id === sel.place); if (!p) return '';
    let extra = '';
    if (p.node && NODES[p.node].kind === 'yard') {
      const E = ECON[p.node], jobs = G.econ.board(p.node, G), here = Object.keys(TRUCKS).filter(t => G.data.trucks[t].loc === p.node && !G.data.trucks[t].road).map(t => TRUCKS[t].name);
      const want = Object.keys(E.needs).sort((a, b) => G.econ.demand(p.node, b) - G.econ.demand(p.node, a)).map(c => CARGO[c].name.toLowerCase() + ' (' + G.econ.demandWord(G.econ.demand(p.node, c)) + ')');
      extra += '<div class="mst"><span>Makes</span><span>' + (E.makes.length ? E.makes.map(c => CARGO[c].name).join(', ') : '—') + '</span><span>Needs</span><span>' + (want.slice(0, 3).join(', ') || '—') + '</span>' +
        '<span>Workshop</span><span>' + (NODES[p.node].garage ? 'yes — parts and repairs' : 'no repairs here') + '</span>' + (here.length ? '<span>Parked here</span><span>' + here.join(', ') + '</span>' : '') + '</div>';
      if (jobs.length) extra += '<h3>' + jobs.length + ' jobs here</h3>' + jobs.slice(0, 4).map(j => { const e = G.jobEstimate(j); return '<div class="mjob"><span>' + (j.kind === 'haul' ? CARGO[j.cargo].name + ' → ' + NODES[j.to].name : j.kind === 'rescue' ? 'Rescue on the ' + EDGES[j.edge].name : 'Tow to ' + NODES[j.to].name) + '</span><em>' + (e === null ? '—' : money(e)) + '</em></div>'; }).join('');
      const onRd = !this.here && G.roadOf();
      if (onRd) { const d = G.distFrom(p.node); if (d < Infinity) extra += '<p>From where your truck stands: ' + km(d) + ' km by road.</p>'; }
      else if (p.node !== G.loc && this.selRoute && this.selRoute.d < Infinity) extra += '<p>From ' + NODES[G.loc].name + ': ' + km(this.selRoute.d) + ' km by road.</p>';
      if (!this.here && (onRd || p.node !== G.loc) && !G.cfg().job && (G.state === 'hub' || G.state === 'jobs' || G.state === 'title')) extra += '<div class="mgo"><button class="btn amber" id="mGo">Drive here</button></div>';
    } else if (p.find) extra = '<p>' + (G.data.found[p.find.id] ? '✓ Already salvaged: ' + p.find.name : 'Not picked up yet. Stop by the crate.') + '</p>';
    if (p.edge) extra += '<div class="mst"><span>Road</span><span>' + EDGES[p.edge].name + '</span><span>Altitude</span><span>' + Math.round(MAP_ALT0 + NODES[EDGES[p.edge].a].alt + edgePiece(p.edge).y[Math.round(p.s / DX)]) + ' m</span></div>';
    else if (p.node) extra += '<div class="mst"><span>Altitude</span><span>' + Math.round(MAP_ALT0 + NODES[p.node].alt) + ' m</span><span>Roads</span><span>' + ADJ[p.node].filter(a => this.found(EDGES[a.edge].secret)).length + '</span></div>';
    return '<h2>' + p.name + '</h2><div class="msub">' + (p.sub || '') + '</div>' + (p.note ? '<p>' + p.note + '</p>' : '') + extra;
  }
  drawProfile(cv, road) {
    const r = this.M.roads[road], P = r.P, dpr = this.dpr, w = Math.max(2, Math.round(cv.clientWidth * dpr)), h = Math.max(2, Math.round(cv.clientHeight * dpr));
    cv.width = w; cv.height = h; const g = cv.getContext('2d');
    const lo = P.stats.lo - 4, hi = Math.max(P.stats.hi + 4, lo + 30), L = P.len, X = s => s / L * w, Y = v => h - (v - lo) / (hi - lo) * h * 0.92;
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, w, h);
    for (let i = 4; i < P.n; i += 4) { const a = i - 4; g.fillStyle = MAP_SURF_COL[P.s[a]]; g.beginPath(); g.moveTo(X(a * DX), h); g.lineTo(X(a * DX), Y(P.y[a])); g.lineTo(X(i * DX) + 0.6, Y(P.y[i])); g.lineTo(X(i * DX) + 0.6, h); g.closePath(); g.fill(); }
    g.strokeStyle = '#1d1814'; g.lineWidth = 1.5 * dpr; g.beginPath(); for (let i = 0; i < P.n; i += 4) i ? g.lineTo(X(i * DX), Y(P.y[i])) : g.moveTo(X(0), Y(P.y[0])); g.stroke();
    g.fillStyle = '#efe7d6'; g.font = '600 ' + (11 * dpr) + 'px "Barlow Condensed",sans-serif'; g.textBaseline = 'top';
    g.fillText(Math.round(r.hi) + ' m', 4 * dpr, 3 * dpr); g.textBaseline = 'bottom'; g.textAlign = 'right'; g.fillText(km(L) + ' km', w - 4 * dpr, h - 3 * dpr);
    g.textAlign = 'left'; g.fillText(NODES[EDGES[road].a].name, 4 * dpr, h - 3 * dpr);
  }
}
