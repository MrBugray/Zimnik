'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashf(i, seed) {
  let h = Math.imul((i | 0) ^ Math.imul(seed | 0, 0x9E3779B1), 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise1(x, seed) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hashf(i, seed), hashf(i + 1, seed), u) * 2 - 1;
}
function fbm1(x, seed, oct) {
  oct = oct || 3; let a = 0, amp = 1, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { a += noise1(x * f, seed + o * 131) * amp; n += amp; amp *= 0.5; f *= 2.03; }
  return a / n;
}
// colours as [r,g,b]
const _hexCache = new Map();
function hex(h) {
  let c = _hexCache.get(h); if (c) return c;
  let s = h; if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  const n = parseInt(s.slice(1), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  _hexCache.set(h, c); return c;
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mulc = (a, m) => [a[0] * m[0], a[1] * m[1], a[2] * m[2]];
const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const desat = (c, t) => { const l = lum(c); return mixc(c, [l, l, l], t); };
function css(c, al) {
  const r = clamp(c[0], 0, 255) | 0, g = clamp(c[1], 0, 255) | 0, b = clamp(c[2], 0, 255) | 0;
  return al === undefined || al >= 1 ? 'rgb(' + r + ',' + g + ',' + b + ')' : 'rgba(' + r + ',' + g + ',' + b + ',' + al.toFixed(3) + ')';
}
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const store = {
  key: 'zimnik.test.v1', data: null,
  load() { try { this.data = JSON.parse(localStorage.getItem(this.key) || '{}'); } catch (e) { this.data = {}; } return this.data; },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { } },
};
// landscape layout box; when the page is portrait (e.g. inside an app that won't rotate) the whole game is rotated 90°
const VIEW = { w: 800, h: 360, rot: false };
function layoutView() {
  const iw = window.innerWidth, ih = window.innerHeight, rot = ih > iw * 1.05;
  VIEW.rot = rot; VIEW.w = rot ? ih : iw; VIEW.h = rot ? iw : ih;
  const app = document.getElementById('app');
  if (app) {
    app.classList.toggle('rot', rot);
    app.style.width = VIEW.w + 'px'; app.style.height = VIEW.h + 'px';
    app.style.transformOrigin = '0 0';
    app.style.transform = rot ? 'translateX(' + iw + 'px) rotate(90deg)' : '';
  }
  return VIEW;
}
// fraction (0 = bottom, 1 = top) of a pointer along an element's own vertical axis, rotation-aware
function fracUp(el, e) {
  const r = el.getBoundingClientRect();
  return VIEW.rot ? (e.clientX - r.left) / r.width : (r.bottom - e.clientY) / r.height;
}
