// ===== palettes: time of day x weather =====
const PAL_KEYS = ['skyTop', 'skyMid', 'skyHor', 'sun', 'far', 'farSnow', 'farShade', 'ridge', 'ridgeSnow', 'mid', 'midSnow', 'midTree', 'near', 'nearSnow', 'nearTree', 'trunk',
  'snow', 'snowShade', 'soil', 'soilDeep', 'soilLine', 'ice', 'iceDeep', 'water', 'outline', 'cloud'];
const P_DAY = {
  skyTop: '#79a5c5', skyMid: '#a9c7d8', skyHor: '#dde8eb', sun: '#fff5dc',
  far: '#a7b9c8', farSnow: '#eef3f6', farShade: '#8aa0b2', ridge: '#7b9294', ridgeSnow: '#dbe5ea',
  mid: '#dfe7eb', midSnow: '#e9eff2', midTree: '#5a706b', near: '#e8eef1', nearSnow: '#f1f5f7', nearTree: '#46594f', trunk: '#5b4a3d',
  snow: '#f2f6f8', snowShade: '#bfcfdb', soil: '#5c4a3f', soilDeep: '#4a3c33', soilLine: '#382c25', ice: '#c4e3ee', iceDeep: '#86b7cb', water: '#3a6072',
  outline: '#221c18', cloud: '#f6f8f8', amb: [1, 1, 1], sil: 0, dark: 0, stars: 0,
};
const P_GOLD = {
  skyTop: '#6c8ab3', skyMid: '#b6b0c2', skyHor: '#f1cc9e', sun: '#ffe1a2',
  far: '#b4a5b6', farSnow: '#f6e1cd', farShade: '#9a8ba3', ridge: '#837d8c', ridgeSnow: '#eadbd1',
  mid: '#e6d8cf', midSnow: '#efe0d5', midTree: '#5c5a69', near: '#efdfd3', nearSnow: '#f6e7da', nearTree: '#454757', trunk: '#55443c',
  snow: '#f6e8da', snowShade: '#c1b0bf', soil: '#584640', soilDeep: '#453730', soilLine: '#382c27', ice: '#e0d6dc', iceDeep: '#a7a3bb', water: '#3c5167',
  outline: '#221a17', cloud: '#fde9d4', amb: [1.0, 0.93, 0.85], sil: 0.06, dark: 0, stars: 0,
};
const P_DUSK = {
  skyTop: '#2c2a55', skyMid: '#8a4e7d', skyHor: '#f29a62', sun: '#ffc27c',
  far: '#5a4266', farSnow: '#7d6283', farShade: '#4a3552', ridge: '#3b2b46', ridgeSnow: '#5c4664',
  mid: '#3a2c45', midSnow: '#46354f', midTree: '#22182c', near: '#2a1f33', nearSnow: '#3a2d44', nearTree: '#160f1c', trunk: '#170f15',
  snow: '#5c4c66', snowShade: '#3c3047', soil: '#241a21', soilDeep: '#1b131a', soilLine: '#120c10', ice: '#6b6888', iceDeep: '#44426a', water: '#1d1f38',
  outline: '#0e090c', cloud: '#c97a7a', amb: [0.45, 0.36, 0.45], sil: 0.7, dark: 0.16, stars: 0.1,
};
const P_TWI = {
  skyTop: '#121a3b', skyMid: '#2e2f5c', skyHor: '#694c76', sun: '#ffb070',
  far: '#2c2d4b', farSnow: '#46486d', farShade: '#24253f', ridge: '#1f2139', ridgeSnow: '#33355a',
  mid: '#262a45', midSnow: '#2d3150', midTree: '#13152a', near: '#20243d', nearSnow: '#2c3150', nearTree: '#0d0f1e', trunk: '#0d0c14',
  snow: '#3d4567', snowShade: '#272e49', soil: '#16131c', soilDeep: '#110f16', soilLine: '#09080c', ice: '#3c4f73', iceDeep: '#273857', water: '#10172c',
  outline: '#07060a', cloud: '#3c3d5e', amb: [0.3, 0.31, 0.43], sil: 0.6, dark: 0.42, stars: 0.6,
};
const P_NIGHT = {
  skyTop: '#050916', skyMid: '#0b1430', skyHor: '#18284c', sun: '#e8eefc',
  far: '#18223c', farSnow: '#2b3b5c', farShade: '#121a30', ridge: '#111a30', ridgeSnow: '#22304e',
  mid: '#1c2742', midSnow: '#24304d', midTree: '#0b1122', near: '#1f2a46', nearSnow: '#2a3757', nearTree: '#080c18', trunk: '#08090f',
  snow: '#34456a', snowShade: '#1d2842', soil: '#120f16', soilDeep: '#0d0b10', soilLine: '#060508', ice: '#2c4566', iceDeep: '#1c2f4c', water: '#0b1426',
  outline: '#040408', cloud: '#1d2740', amb: [0.25, 0.3, 0.42], sil: 0.45, dark: 0.6, stars: 1,
};
const TOD_KEYS = [[-17, P_NIGHT], [-8, P_TWI], [-2.5, P_DUSK], [4.5, P_GOLD], [13, P_DAY]];
const WEATHER = {
  clear: { name: 'Clear', fog: 0.0, desat: 0.0, dim: 1, grey: 0, part: 0, wind: 0, vis: 999, temp: -20, fresh: 0, clouds: 0.25 },
  overcast: { name: 'Overcast', fog: 0.28, desat: 0.55, dim: 0.86, grey: 0.85, part: 0, wind: -2, vis: 500, temp: -12, fresh: 0, clouds: 1 },
  snow: { name: 'Snowfall', fog: 0.45, desat: 0.62, dim: 0.86, grey: 0.92, part: 0.45, wind: -3, vis: 160, temp: -9, fresh: 0.7, accum: 0.0012, clouds: 1 },
  blizzard: { name: 'Blizzard', fog: 0.78, desat: 0.72, dim: 0.9, grey: 1, part: 1, wind: -15, vis: 38, temp: -27, fresh: 1, accum: 0.0028, clouds: 1 },
  fog: { name: 'Fog', fog: 0.86, desat: 0.5, dim: 0.95, grey: 1, part: 0, wind: 0, vis: 48, temp: -5, fresh: 0.2, clouds: 1 },
  thaw: { name: 'Thaw', fog: 0.32, desat: 0.4, dim: 0.9, grey: 0.75, part: 0.18, sleet: 1, wind: -2, vis: 260, temp: -2, fresh: 0.5, clouds: 1 },
};
const TIMES = { morning: { name: 'Morning', h: 9.0 }, noon: { name: 'Noon', h: 12.5 }, dusk: { name: 'Dusk', h: 17.4 }, night: { name: 'Night', h: 22.0 } };
function sunElev(h) { return 22 * Math.cos((h - 12.5) * Math.PI / 12) - 8; }
// wobj: the weather as it is right now (a change of weather is a blend of two); wkey names the one that dominates
function computePalette(hour, wkey, wobj) {
  const e = sunElev(hour), W = wobj || WEATHER[wkey] || WEATHER.clear;
  let a = TOD_KEYS[0], b = TOD_KEYS[0], t = 0;
  if (e >= TOD_KEYS[TOD_KEYS.length - 1][0]) { a = b = TOD_KEYS[TOD_KEYS.length - 1]; }
  else for (let i = 0; i < TOD_KEYS.length - 1; i++) if (e >= TOD_KEYS[i][0] && e < TOD_KEYS[i + 1][0]) { a = TOD_KEYS[i]; b = TOD_KEYS[i + 1]; t = smooth((e - a[0]) / (b[0] - a[0])); break; }
  const pa = a[1], pb = b[1], P = { elev: e, hour, w: W, wkey };
  for (const k of PAL_KEYS) P[k] = mixc(hex(pa[k]), hex(pb[k]), t);
  P.amb = mixc(pa.amb, pb.amb, t); P.sil = lerp(pa.sil, pb.sil, t); P.dark = lerp(pa.dark, pb.dark, t); P.stars = lerp(pa.stars, pb.stars, t);
  // weather: overcast skies, desaturation and dimming
  const greySky = mixc(desat(P.skyHor, 0.8), desat(P.skyMid, 0.9), 0.35);
  P.fogc = mixc(desat(P.skyHor, 0.75), P.skyTop, 0.12);
  if (W.grey) {
    const g = W.grey;
    P.skyTop = mixc(P.skyTop, mixc(greySky, P.skyTop, 0.25), g);
    P.skyMid = mixc(P.skyMid, greySky, g);
    P.skyHor = mixc(P.skyHor, mixc(greySky, [255, 255, 255], 0.12 * (1 - P.dark)), g);
    P.fogc = mixc(P.fogc, mixc(greySky, P.skyHor, 0.4), g);
  }
  if (W.desat) for (const k of PAL_KEYS) if (!k.startsWith('sky')) P[k] = mulc(desat(P[k], W.desat), [W.dim, W.dim, W.dim]);
  P.amb = mixc(P.amb, desat(P.amb, 1), W.desat * 0.8); P.amb = mulc(P.amb, [W.dim, W.dim, W.dim]);
  P.stars *= W.grey ? 0 : 1;
  P.aurora = (P.stars > 0.5 && !W.grey) ? (P.stars - 0.5) * 2 : 0;
  P.sunVis = W.grey ? 0 : 1;
  P.fog = W.fog;
  P.fogL = { far: Math.min(1, W.fog * 1.25), ridge: Math.min(1, W.fog * 1.1), mid: W.fog * 0.85, near: W.fog * 0.62, world: W.fog * 0.2 };
  P.silc = P.nearTree;
  P.cloudA = W.clouds;
  return P;
}
// lit material colour for objects in the world (truck, decor)
function makeLit(P) {
  const cache = new Map(), amb = P.amb, sil = P.sil, silc = mixc(P.nearTree, P.outline, 0.3), fogw = P.fogL.world, fogc = P.fogc, W = P.w;
  return function L(h, extraFog) {
    const key = extraFog ? h + '|' + extraFog : h;
    let s = cache.get(key); if (s) return s;
    let c = hex(h);
    if (W.desat) c = mulc(desat(c, W.desat * 0.85), [W.dim, W.dim, W.dim]);
    c = mixc(mulc(c, amb), silc, sil);
    const f = fogw + (extraFog || 0);
    if (f > 0) c = mixc(c, fogc, Math.min(1, f));
    s = css(c); cache.set(key, s); return s;
  };
}
