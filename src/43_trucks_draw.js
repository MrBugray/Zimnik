// ===== truck drawing: both trucks, wheels, cargo, paint, add-ons =====
// Every truck is drawn from three cached layers (back, front, over) plus rotating wheel/rim sprites and cargo
// sprites; only small moving bits (antenna, beacon flash, loose chains, snow around the tires) are drawn live.
let IA = 1; // render interpolation between the last two physics steps
function ipos(b) { const p = b.getPosition(); if (b._px === undefined) return { x: p.x, y: p.y }; return { x: b._px + (p.x - b._px) * IA, y: b._py + (p.y - b._py) * IA }; }
function iang(b) { const a = b.getAngle(); return b._pa === undefined ? a : b._pa + (a - b._pa) * IA; }
function iwp(b, lx, ly) { const p = ipos(b), a = iang(b), c = Math.cos(a), s = Math.sin(a); return { x: p.x + c * lx - s * ly, y: p.y + s * lx + c * ly }; }
function iwv(b, lx, ly) { const a = iang(b), c = Math.cos(a), s = Math.sin(a); return { x: c * lx - s * ly, y: s * lx + c * ly }; }
const _shade = new Map();
function shadeHex(h, k) {
  const key = h + k; let s = _shade.get(key); if (s) return s;
  const c = hex(h), t = k < 0 ? [0, 0, 0] : [255, 255, 255], m = mixc(c, t, Math.abs(k));
  s = '#' + m.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); _shade.set(key, s); return s;
}
function wtxt(ctx, R, x, y, str, size, color, align, weight) {
  const px = size * R.ppm; if (px < 4) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1 / R.ppm, -1 / R.ppm);
  ctx.font = (weight || 700) + ' ' + px.toFixed(1) + 'px "Barlow Condensed","Arial Narrow",sans-serif';
  ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(str, 0, 0); ctx.restore();
}
function enter(ctx, body) { const p = ipos(body); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(iang(body)); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
// polygon with rounded corners
function rpoly(ctx, pts, r) {
  const n = pts.length; ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n], q = pts[(i + 1) % n];
    if (i === 0) ctx.moveTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    else ctx.arcTo(p[0], p[1], q[0], q[1], r);
  }
  ctx.closePath();
}
let CARGO_SID = 0;

// --- Polaris 750 '65 body outlines (local metres, origin = top of the frame at mid-wheelbase, ground ≈ -1.0) ---
const PL_CAB = new Path2D();
PL_CAB.moveTo(-0.34, -0.05); PL_CAB.lineTo(1.98, -0.05); PL_CAB.lineTo(1.98, 0.84); PL_CAB.lineTo(1.75, 1.43);
PL_CAB.quadraticCurveTo(1.81, 1.47, 1.71, 1.51); PL_CAB.lineTo(-0.20, 1.51); PL_CAB.quadraticCurveTo(-0.34, 1.51, -0.34, 1.37); PL_CAB.closePath();
const PL_FRONT = new Path2D();
PL_FRONT.moveTo(1.95, -0.08); PL_FRONT.lineTo(1.95, 0.84); PL_FRONT.lineTo(3.14, 0.785); PL_FRONT.quadraticCurveTo(3.29, 0.78, 3.30, 0.65);
PL_FRONT.lineTo(3.30, -0.14); PL_FRONT.lineTo(3.132, -0.14); PL_FRONT.arc(2.45, -0.475, 0.76, 0.456, 2.686, false); PL_FRONT.lineTo(1.95, -0.10); PL_FRONT.closePath();
const PL_WIN_F = [[0.97, 0.94], [1.85, 0.94], [1.675, 1.39], [0.97, 1.39]], PL_WIN_R = [[-0.17, 0.94], [0.73, 0.94], [0.73, 1.39], [-0.17, 1.39]];
const BARS_CAB = (() => { const p = new Path2D(), c = [[0.95, 0.12], [0.95, 1.30], [1.06, 1.43], [2.12, 1.43], [2.4, 0.9], [2.46, 0.86], [2.46, 0.12]]; p.moveTo(c[0][0], c[0][1]); for (let i = 1; i < c.length; i++) p.lineTo(c[i][0], c[i][1]); p.closePath(); return p; })();
const BARS_HOOD = (() => { const p = new Path2D(); p.moveTo(2.46, 0.12); p.lineTo(2.46, 0.86); p.lineTo(3.42, 0.8); p.lineTo(3.63, 0.7); p.lineTo(3.7, 0.12); p.closePath(); return p; })();
const ART_BOUNDS = { cc: [-3.9, -1.02, 3.72, 2.36], bars: [-3.6, -1.0, 4.1, 2.12], sk: [-5.3, -1.1, 4.5, 2.7], skt: [-3.15, -1.1, 4.5, 2.7],
  tr_flat: [-11.5, -1.45, 1.25, 0.75], tr_logs: [-11.3, -1.45, 1.05, 2.45], tr_tank: [-11.4, -1.45, 1.05, 2.3], tr_tip: [-9.35, -1.45, 1.1, 2.7] };
const ART_PREFIX = { cc: 'pl', bars: 'bars', sk: 'sk', skt: 'skt', tr_flat: 'trf', tr_logs: 'trl', tr_tank: 'trt', tr_tip: 'trp' };
// Skinnerd 143H outlines: sleeper cab with a step skirt cut by the front arch, roof spoiler, short bonnet
const SK_ARC = [3.0, -0.54, 0.74];
const SK_CAB = new Path2D();
SK_CAB.moveTo(0.62, 0.02); SK_CAB.lineTo(1.55, 0.02); SK_CAB.lineTo(1.55, -0.30); SK_CAB.lineTo(2.30, -0.30);
SK_CAB.arc(3.0, -0.54, 0.74, 2.81, 2.20, true); SK_CAB.lineTo(2.56, 0.94); SK_CAB.lineTo(2.42, 1.66);
SK_CAB.quadraticCurveTo(2.41, 1.80, 2.27, 1.80); SK_CAB.lineTo(0.72, 1.80); SK_CAB.quadraticCurveTo(0.62, 1.80, 0.62, 1.70); SK_CAB.closePath();
const SK_SPOILER = new Path2D();
SK_SPOILER.moveTo(0.62, 1.78); SK_SPOILER.lineTo(0.62, 2.38); SK_SPOILER.lineTo(0.96, 2.38); SK_SPOILER.bezierCurveTo(1.22, 2.36, 1.52, 2.05, 1.88, 1.81); SK_SPOILER.lineTo(1.88, 1.78); SK_SPOILER.closePath();
const SK_HOOD = new Path2D();
SK_HOOD.moveTo(2.54, 0.055); SK_HOOD.lineTo(2.54, 0.94); SK_HOOD.lineTo(4.12, 0.86); SK_HOOD.quadraticCurveTo(4.26, 0.85, 4.27, 0.72);
SK_HOOD.lineTo(4.27, -0.12); SK_HOOD.lineTo(3.609, -0.12); SK_HOOD.arc(3.0, -0.54, 0.74, 0.604, 2.20, false); SK_HOOD.closePath();
const SK_WIN = [[1.62, 1.12], [2.41, 1.12], [2.32, 1.60], [1.62, 1.60]];

// snow closing over the bottom of a sunk tyre: centred where the tyre touches the ground and laid along it, so on a
// slope or a crest it hugs the real surface instead of floating level under the axle
function snowAround(ctx, P, tr, w, p) {
  if (!w.touch || w.sink <= 0.04) return;
  const c = tr.sim.course, r = tr.r, d = Math.min(w.sink, 0.45), cx = w.cpx !== undefined && Math.abs(w.cpx - p.x) < r ? w.cpx : p.x;
  const x0 = cx - r * 1.05, x1 = cx + r * 1.05, N = 12;
  ctx.beginPath(); ctx.moveTo(x0, c.hAt(x0) + 0.01);
  for (let k = 1; k <= N; k++) { const u = k / N, x = x0 + (x1 - x0) * u; ctx.lineTo(x, c.hAt(x) + 0.01 + d * Math.pow(Math.sin(Math.PI * u), 0.7) * (0.96 + 0.08 * Math.sin(u * 7 + w.ax))); }
  for (let k = N; k >= 0; k--) { const x = x0 + (x1 - x0) * k / N; ctx.lineTo(x, c.hAt(x) - 0.03); }
  ctx.closePath(); fs(ctx, css(P.snow), css(P.snowShade), 0.03);
}
// ---------- trucks drawn as pictures (ART_IMG, from tools/art) ----------
// pictures decode in the background; until they are ready the truck is simply not drawn
function artImg(id) {
  const A = ART_IMG[id]; if (!A) return null;
  if (!A.img) { A.img = {}; let left = 0; for (const k in A.src) { const im = new Image(); left++; im.onload = () => { if (--left === 0) A.ready = true; }; im.src = A.src[k]; A.img[k] = im; } }
  return A.ready ? A : null;
}
// a fixture any truck can carry (the amber beacon off Lucas's Polaris sheet)
function artFix(k) {
  const F = ART_FIX[k]; if (!F) return null;
  if (!F.img) { F.img = new Image(); F.img.onload = () => { F.ready = true; }; F.img.src = F.src; }
  return F.ready ? F : null;
}
// paint: each pixel is a grey part (its green channel) plus an amount of magenta, and the magenta becomes the colour.
// With livery zones (the Polaris) the second colour goes on the roof, the lower body, the band or the crease stripe.
// The zones picture: red roof, green lower body, blue 255 the band and 128 the stripe.
const ZONE_OF = { two: [0, 128, 256], lower: [1, 128, 256], band: [2, 192, 256], stripe: [2, 64, 192], company: [2, 192, 256], rescue: [1, 128, 256] };
function artPainted(A, name, c1, c2, livery) {
  const C = A.paint || (A.paint = new Map()), key = name + c1 + (c2 || '') + (livery || ''); let c = C.get(key); if (c) return c;
  const im = A.img[name]; c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data, p1 = hex(c1), p2 = c2 ? hex(c2) : p1;
  const Z = name === 'body' && A.img.zones && c2 ? ZONE_OF[livery] : null;
  let zd = null;
  if (Z) { const zc = document.createElement('canvas'); zc.width = c.width; zc.height = c.height; const zg = zc.getContext('2d', { willReadFrequently: true }); zg.imageSmoothingEnabled = false; zg.drawImage(A.img.zones, 0, 0, c.width, c.height); zd = zg.getImageData(0, 0, c.width, c.height).data; }
  for (let i = 0; i < px.length; i += 4) {
    const R = px[i], G = px[i + 1], B = px[i + 2], m = (R < B ? R : B) - G;
    if (m > 3) {
      const k = m / 255, z = zd ? zd[i + Z[0]] : 0, p = zd && z >= Z[1] && z < Z[2] ? p2 : p1;
      px[i] = G + k * p[0]; px[i + 1] = G + k * p[1]; px[i + 2] = G + k * p[2];
    }
  }
  g.putImageData(d, 0, 0);
  if (C.size >= 8) C.delete(C.keys().next().value);
  C.set(key, c); return c;
}
// a picture lit like the vector art: the palette's colour mapping L is per-channel affine, so it is read off black and
// white and applied as a multiply and an add over a black underlay; the picture's own alpha is put back at the end
const rgbOf = s => s[0] === '#' ? hex(s) : s.match(/[\d.]+/g).slice(0, 3).map(Number);
function artLit(g, img, x0, y1, w, h, L, P) {
  const k0 = rgbOf(L('#000000')), k1 = rgbOf(L('#ffffff')), Wd = P.w && P.w.desat;
  g.save(); g.scale(1, -1); g.imageSmoothingQuality = 'high';
  g.fillStyle = '#000'; g.fillRect(x0, -y1, w, h);
  if (Wd) g.filter = 'saturate(' + (1 - Wd * 0.85).toFixed(3) + ')';
  g.drawImage(img, x0, -y1, w, h); g.filter = 'none';
  g.globalCompositeOperation = 'multiply'; g.fillStyle = css([k1[0] - k0[0], k1[1] - k0[1], k1[2] - k0[2]]); g.fillRect(x0, -y1, w, h);
  if (k0[0] + k0[1] + k0[2] > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = css(k0); g.fillRect(x0, -y1, w, h); }
  g.globalCompositeOperation = 'destination-in'; g.drawImage(img, x0, -y1, w, h);
  g.restore();
}
// add-ons not on the picture sheets, drawn as vector parts over a drawn truck: the snorkel out of the fender and up the
// A-pillar (its path, then its head's box), the light bar on the roof or up on the cage's top frame ([lamp x, y, mounts])
const ART_BITS_AT = {
  cc: { snorkel: [[1.26, 0.05], [1.22, 0.40], [1.09, 0.70], [0.86, 1.14], [0.84, 1.36]], head: [0.76, 1.30], bar: [0.74, 1.46, 1.27], barCage: [1.0, 1.53, 1.445] },
  ccf: { snorkel: [[1.30, 0.05], [1.30, 0.45], [1.32, 0.70], [1.10, 1.14], [1.08, 1.32]], head: [1.00, 1.26], bar: [1.0, 1.29, 1.18], barCage: [1.05, 1.45, 1.357] },
};
function artBits(art, ctx, pal, ol, L, tr, a, B) {
  if (a.snorkel) {
    const pth = () => { ctx.beginPath(); B.snorkel.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = ol; ctx.lineWidth = 0.13; pth(); ctx.stroke(); ctx.strokeStyle = pal.black; ctx.lineWidth = 0.09; pth(); ctx.stroke();
    ctx.strokeStyle = L('#55524d'); ctx.lineWidth = 0.018; ctx.beginPath(); B.snorkel.slice(1, 4).forEach(([x, y], i) => i ? ctx.lineTo(x - 0.02, y) : ctx.moveTo(x - 0.02, y)); ctx.stroke();
    const [hx, hy] = B.head; rr(ctx, hx, hy, 0.20, 0.14, 0.05); fs(ctx, pal.black, ol, 0.03);
    ctx.fillStyle = L('#5b5853'); for (let i = 0; i < 3; i++) ctx.fillRect(hx + 0.15, hy + 0.025 + i * 0.032, 0.025, 0.014);
  }
  if (a.lightbar) { const [lx, ly, roof] = a.cage ? B.barCage : B.bar; art.lightBar(ctx, pal, ol, L, tr, lx, ly, roof); }
}
const ART_BITS = {
  cc(ctx, pal, ol, L, tr, a) { artBits(this, ctx, pal, ol, L, tr, a, ART_BITS_AT.cc); },
  ccf(ctx, pal, ol, L, tr, a) { artBits(this, ctx, pal, ol, L, tr, a, ART_BITS_AT.ccf); },
};
class TruckArt {
  constructor() { }
  // a drawn truck: the body in the chassis frame, then each wheel's own picture turning with its wheel. The shading
  // Lucas drew on the tyres was taken out of the turning picture and laid back on top as a separate layer that
  // stays with the truck, so the light on the tyre does not spin round with it.
  drawImg(ctx, R, P, tr, L, t, lights, fog) {
    const gk = tr.gk || tr.id, A = artImg(gk); if (!A) return;
    const ppm = SPR.ppmQ(R.ppm), ver = R.palVer + '@' + ppm.toFixed(2), p = tr.cfg.paint || TRUCKS[tr.id].paint, f = fog ? ':f' : '', a = tr.addons || {}, G = tr.G;
    const zoned = !!A.src.zones, look = zoned ? p.c1 + p.c2 + p.livery + p.num : p.c1;
    // a load in the bed sits behind the bed's near side: drawn first, the body covers its lower part
    for (const it of tr.items) if (!it.lost) this.cargo(ctx, R, P, it, L, ver, ppm, fog);
    const body = SPR.get('ti:' + gk + ':' + look + f, ver, [A.x0, A.y1 - A.h, A.x0 + A.w, A.y1], ppm, g => {
      artLit(g, artPainted(A, 'body', p.c1, zoned ? p.c2 : null, zoned ? p.livery : null), A.x0, A.y1, A.w, A.h, L, P);
      if (G.decals) this.artDecals(g, { ppm }, G.decals, p, L);
    });
    enter(ctx, tr.chassis); blit(ctx, body); ctx.restore();
    const ca = iang(tr.chassis), rim = zoned ? RIM_HEX[p.rims] || RIM_HEX.bronze : null, parts = tr.cfg.parts || {};
    // a lift kit (or mud tyres) puts the off-road wheel on: lugged tyre, beadlock rim
    const off = !!(A.owheel && (parts.lift && parts.lift !== 'l0' || parts.tires === 'mt'));
    tr.wheels.forEach((w, i) => {
      const j = Math.min(i, A.wheels.length - 1), nm = off ? 'owheel' : 'wheel' + j, m = off ? A.owheel : A.wheels[j];
      const bx = [m.dx - m.half, m.dy - m.half, m.dx + m.half, m.dy + m.half];
      const s = SPR.get('tw:' + gk + ':' + nm + (rim || '') + f, ver, bx, ppm, g => artLit(g, rim ? artPainted(A, nm, rim) : A.img[nm], m.dx - m.half, m.dy + m.half, 2 * m.half, 2 * m.half, L, P));
      // the drawn wheel takes the size the physics has (bigger tyres from a lift kit)
      const q = ipos(w.body), ks = tr.r / m.r;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(iang(w.body)); if (Math.abs(ks - 1) > 0.005) ctx.scale(ks, ks); blit(ctx, s); ctx.restore();
      const sh = !off && A.img['shade' + j];
      if (sh) {
        const o = SPR.get('tsh:' + gk + ':' + j + f, ver, bx, ppm, g => artLit(g, sh, m.dx - m.half, m.dy + m.half, 2 * m.half, 2 * m.half, L, P));
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ca); if (Math.abs(ks - 1) > 0.005) ctx.scale(ks, ks); blit(ctx, o); ctx.restore();
      }
      snowAround(ctx, P, tr, w, q);
    });
    // add-ons: the drawn ones from the picture sheet, the rest as vector parts on top
    if (A.layers || a.lightbar || a.snorkel) {
      enter(ctx, tr.chassis);
      const lay = n => { const Ly = A.layers[n]; return SPR.get('tl:' + gk + ':' + n + f, ver, [Ly.x0, Ly.y1 - Ly.h, Ly.x0 + Ly.w, Ly.y1], ppm, g => artLit(g, A.img[n], Ly.x0, Ly.y1, Ly.w, Ly.h, L, P)); };
      const has = n => A.layers && A.layers[n];
      if (a.sliders && has('sliders')) blit(ctx, lay('sliders'));
      if (a.bullbar && has('bullbar')) blit(ctx, lay('bullbar'));
      if (a.cage && has('cage')) blit(ctx, lay('cage'));
      if (a.rack && a.cage && has('rack')) blit(ctx, lay('rack'));
      const bits = ART_BITS[gk];
      if ((a.lightbar || a.snorkel) && bits) { const pal = this.paintSet(tr, L), ol = css(P.outline); bits.call(this, ctx, pal, ol, L, tr, a); }
      ctx.restore();
    }
    if (a.beacon) { enter(ctx, tr.chassis); this.beaconFix(ctx, R, P, tr, L, t, ver, ppm, f); ctx.restore(); }
    this.lightsOf(tr, P, t, lights);
  }
  // the door number, the company mark, RESCUE: drawn onto the painted picture where the geometry says
  artDecals(g, Rs, D, p, L) {
    const c2 = L(p.c2), pal = { c1: L(p.c1), c2 };
    if (p.livery === 'company' && D.logo) { const [x, y, r] = D.logo; g.beginPath(); g.arc(x, y, r, 0, TAU); fs(g, c2, L('#2a2520'), 0.02); this.logo(g, L, x, y, r * 0.8, pal); }
    if (p.livery === 'company' && D.name) wtxt(g, Rs, D.name[0], D.name[1], 'ZIMNIK HAULAGE', D.name[2], c2);
    if (p.livery === 'rescue' && D.rescue) wtxt(g, Rs, D.rescue[0], D.rescue[1], 'RESCUE', D.rescue[2], c2);
    if (p.livery !== 'company' && D.num) { const [x, y, r] = D.num; g.beginPath(); g.arc(x, y, r, 0, TAU); g.strokeStyle = c2; g.lineWidth = 0.022; g.stroke(); wtxt(g, Rs, x, y, String(p.num), r * 1.15, c2); }
  }
  // the amber beacon (Lucas's, off the Polaris sheet) on any truck's roof, or on the Polaris's rack with the cage
  beaconFix(ctx, R, P, tr, L, t, ver, ppm, f) {
    const F = artFix('beacon'); if (!F) return;
    const G = tr.G, at = tr.addons.cage && G.rackBeacon ? G.rackBeacon : G.beaconAt, x = at[0], y = at[1], w = F.w, h = F.h;
    const off = SPR.get('fx:beacon' + (f || ''), ver, [-w / 2 - 0.01, -0.01, w / 2 + 0.01, h + 0.01], ppm, g => artLit(g, F.img, -w / 2, h, w, h, L, P));
    ctx.save(); ctx.translate(x, y); blit(ctx, off);
    if (tr.lights) {
      // turning: the lamp brightens and fades; the glow around it is in lightsOf
      const k = 0.5 + 0.5 * Math.sin(t * 9);
      const on = SPR.get('fx:beaconOn' + (f || ''), ver, [-w / 2 - 0.01, -0.01, w / 2 + 0.01, h + 0.01], ppm, g => {
        g.save(); g.scale(1, -1); g.drawImage(F.img, -w / 2, -h, w, h); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,190,70,0.5)'; g.fillRect(-w / 2, -h, w, h);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35; g.drawImage(F.img, -w / 2, -h, w, h); g.restore();
      });
      ctx.globalAlpha = 0.35 + 0.65 * k; blit(ctx, on); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  lookKey(tr) {
    const c = tr.cfg, p = c.paint || TRUCKS[tr.id].paint, a = tr.addons;
    let k = p.c1 + p.c2 + p.livery + p.rims + p.num + '|';
    for (const n in a) if (a[n]) k += n.slice(0, 3);
    k += '|' + c.parts.tank + '|' + (tr.cargoType || '') + (tr.bulkUnits !== undefined ? tr.bulkUnits : '') + (tr.semi ? 's' : '') + '|' + Math.round((c.dirt || 0) * 16) + '|' + Math.round((tr.snowBuild || 0) * 8) + '|' + Math.round(tr.damage / 12) + '|' + (tr.lights ? 1 : 0);
    if (tr.id === 'bars' && tr.cargoType === 'logs') k += '|' + this.logTop(tr);
    return k;
  }
  logTop(tr) { let top = -1; for (const b of tr.items) if (!b.lost && b.joint) top = Math.max(top, b.k); return top; }
  draw(ctx, R, P, tr, L, t, lights, fog) {
    if (TRUCKS[tr.id] && TRUCKS[tr.id].art) return this.drawImg(ctx, R, P, tr, L, t, lights, fog);
    const ppm = SPR.ppmQ(R.ppm), ver = R.palVer + '@' + ppm.toFixed(2), Rs = { ppm };
    const base = 't:' + tr.id + ':' + this.lookKey(tr) + (fog ? ':f' : ''), B = ART_BOUNDS[tr.id], pre = ART_PREFIX[tr.id];
    const ol = css(P.outline);
    const layer = name => SPR.get(base + ':' + name, ver, B, ppm, g => { const pal = this.paintSet(tr, L); this[pre + name](g, Rs, P, tr, L, ol, pal); });
    enter(ctx, tr.chassis); blit(ctx, layer('Back')); this.springs(ctx, tr, L, ol); ctx.restore();
    for (const it of tr.items) if (!it.lost) this.cargo(ctx, R, P, it, L, ver, ppm, fog);
    this.fxR = R; this.fxVer = ver; this.fxPpm = ppm;
    enter(ctx, tr.chassis); blit(ctx, layer('Front')); this.dyn(ctx, P, tr, L, t, ol); ctx.restore();
    for (const w of tr.wheels) this.wheel(ctx, R, P, w, tr, L, ol, ver, ppm);
    enter(ctx, tr.chassis); blit(ctx, layer('Over')); ctx.restore();
    this.lightsOf(tr, P, t, lights);
  }
  paintSet(tr, L) {
    const p = tr.cfg.paint || TRUCKS[tr.id].paint;
    return { c1: L(p.c1), c1d: L(shadeHex(p.c1, -0.2)), c1l: L(shadeHex(p.c1, 0.14)), c2: L(p.c2), c2d: L(shadeHex(p.c2, -0.2)), livery: p.livery, rims: p.rims, num: p.num, hex1: p.c1,
      steel: L('#3a3834'), steelL: L('#4d4a44'), chrome: L('#c9ced0'), chromeD: L('#8d9396'), alu: L('#9aa1a4'), rust: L('#7a4a2c'), glass: L('#9ec0cc'), black: L('#232120'), wood: L('#7a5a3c') };
  }
  // night glass: dark with a faint warm dash glow, not a lit-up cabin
  glassCol(P, pal) { return P.dark > 0.12 ? css(mixc(hex('#3a4656'), hex('#9ec0cc'), clamp(1 - P.dark * 1.5, 0, 1))) : pal.glass; }
  // ---------- dirt, snow, rust ----------
  dirt(ctx, path, y0, y1, level, seed) {
    if (level < 0.03) return;
    ctx.save(); ctx.clip(path);
    const top = y0 + (y1 - y0) * level;
    const g = ctx.createLinearGradient(0, y0, 0, top);
    g.addColorStop(0, 'rgba(66,52,38,' + (0.55 + 0.3 * level).toFixed(2) + ')'); g.addColorStop(0.7, 'rgba(78,63,47,' + (0.3 + 0.2 * level).toFixed(2) + ')'); g.addColorStop(1, 'rgba(78,63,47,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-6, y0 - 1);
    for (let x = -6; x <= 6; x += 0.2) ctx.lineTo(x, top + 0.1 * noise1(x * 1.7, seed) + 0.05 * noise1(x * 5.3, seed + 3));
    ctx.lineTo(6, y0 - 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(58,46,34,' + (0.35 + 0.3 * level).toFixed(2) + ')';
    for (let i = 0; i < 60; i++) {
      const x = -5 + hashf(i, seed) * 10, y = y0 + Math.pow(hashf(i, seed + 1), 0.6) * (top - y0) * 1.25;
      const r = 0.012 + 0.03 * hashf(i, seed + 2);
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r, 0.3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // snow lying on a roof or hood; ya/yb are the surface heights at both ends (hoods slope)
  snowCap(ctx, P, x0, x1, ya, k, yb) {
    if (k < 0.04) return; if (yb === undefined) yb = ya;
    const h = 0.03 + 0.11 * k, m = (yb - ya) / (x1 - x0);
    ctx.beginPath(); ctx.moveTo(x0, ya); ctx.quadraticCurveTo(x0 + 0.05, ya + h + m * 0.05, x0 + 0.2, ya + h + m * 0.2); ctx.lineTo(x1 - 0.2, yb + h * 0.9 - m * 0.2); ctx.quadraticCurveTo(x1 - 0.05, yb + h * 0.9 - m * 0.05, x1, yb); ctx.closePath();
    fs(ctx, css(P.snow), css(P.snowShade), 0.03);
  }
  rustSpots(ctx, pal, k, spots) { if (k < 0.05) return; ctx.fillStyle = pal.rust; ctx.globalAlpha = Math.min(0.85, 0.3 + k); ctx.beginPath(); for (const s of spots) { ctx.moveTo(s[0] + s[2] * (0.6 + k), s[1]); ctx.ellipse(s[0], s[1], s[2] * (0.6 + k), s[3] * (0.6 + k), s[4] || 0, 0, TAU); } ctx.fill(); ctx.globalAlpha = 1; }
  // ---------- POLARIS 750 '65 ----------
  plBack(ctx, R, P, tr, L, ol, pal) {
    // driveshaft from the gearbox to the rear axle, behind everything else underneath
    ctx.strokeStyle = ol; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.moveTo(1.45, -0.30); ctx.lineTo(-2.30, -0.46); ctx.stroke();
    ctx.strokeStyle = pal.steel; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(1.45, -0.30); ctx.lineTo(-2.30, -0.46); ctx.stroke();
    for (const [x, y] of [[1.40, -0.30], [-0.40, -0.38], [-2.25, -0.46]]) { ctx.beginPath(); ctx.arc(x, y, 0.045, 0, TAU); fs(ctx, pal.steelL, ol, 0.02); }
    // gearbox and transfer case under the cab floor
    rr(ctx, 1.30, -0.44, 0.58, 0.36, 0.06); fs(ctx, L('#2e2c29'), ol, 0.035);
    // exhaust: pipe from the engine back under the cab, elbow up behind the cab into the stack;
    // the wide perforated section is the muffler, the tip is bent to the rear
    ctx.strokeStyle = ol; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.moveTo(1.95, -0.22); ctx.lineTo(-0.28, -0.22); ctx.quadraticCurveTo(-0.42, -0.22, -0.42, -0.08); ctx.stroke();
    ctx.strokeStyle = L('#5b5650'); ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(1.95, -0.22); ctx.lineTo(-0.28, -0.22); ctx.quadraticCurveTo(-0.42, -0.22, -0.42, -0.08); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = ol; ctx.lineWidth = 0.17; ctx.beginPath(); ctx.moveTo(-0.42, -0.10); ctx.lineTo(-0.42, 2.02); ctx.quadraticCurveTo(-0.42, 2.20, -0.60, 2.27); ctx.stroke();
    ctx.strokeStyle = pal.chrome; ctx.lineWidth = 0.11; ctx.beginPath(); ctx.moveTo(-0.42, -0.10); ctx.lineTo(-0.42, 2.02); ctx.quadraticCurveTo(-0.42, 2.20, -0.60, 2.27); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-0.445, 0.0); ctx.lineTo(-0.445, 2.0); ctx.stroke();
    ctx.lineCap = 'round';
    rr(ctx, -0.52, 0.45, 0.20, 1.10, 0.04); fs(ctx, L('#b9bec0'), ol, 0.035);
    ctx.fillStyle = L('#6c7174'); for (let y = 0.53; y < 1.50; y += 0.075) for (let x = -0.49; x < -0.33; x += 0.05) { ctx.beginPath(); ctx.arc(x + ((Math.round(y * 40) % 2) ? 0.025 : 0), y, 0.012, 0, TAU); ctx.fill(); }
    for (const y of [0.42, 1.55]) { ctx.beginPath(); ctx.rect(-0.53, y, 0.22, 0.04); fs(ctx, pal.steel, ol, 0.02); }
    // frame rails, rear crossmember, pintle hitch
    ctx.beginPath(); ctx.rect(-3.62, -0.24, 6.86, 0.24); fs(ctx, pal.steel, ol);
    ctx.fillStyle = pal.steelL; for (let x = -3.3; x < 3.1; x += 0.55) { ctx.beginPath(); ctx.arc(x, -0.12, 0.022, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.rect(-3.67, -0.46, 0.10, 0.46); fs(ctx, pal.steel, ol, 0.045);
    ctx.beginPath(); ctx.rect(-3.79, -0.30, 0.14, 0.22); fs(ctx, pal.steelL, ol, 0.035);
    ctx.beginPath(); ctx.arc(-3.82, -0.19, 0.065, Math.PI * 0.5, Math.PI * 1.5); ctx.strokeStyle = pal.black; ctx.lineWidth = 0.05; ctx.stroke();
    // battery box, long saddle tank on brackets, cab step
    ctx.beginPath(); ctx.rect(1.02, -0.62, 0.36, 0.36); fs(ctx, pal.steel, ol, 0.045);
    ctx.strokeStyle = pal.steelL; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(1.04, -0.34); ctx.lineTo(1.36, -0.34); ctx.stroke();
    this.tank(ctx, pal, ol, -0.34, 0.96, -0.74, 0.44);
    if (tr.cfg.parts.tank === 'k2') this.tank(ctx, pal, ol, -1.86, -0.98, -0.70, 0.40);
    ctx.strokeStyle = pal.steel; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-0.10, -0.30); ctx.lineTo(-0.10, -0.05); ctx.moveTo(1.70, -0.30); ctx.lineTo(1.70, -0.05); ctx.stroke();
    rr(ctx, -0.24, -0.31, 2.14, 0.06, 0.02); fs(ctx, pal.chromeD, ol, 0.03);
    // bed: sills on the frame, steel side rail with stake pockets, rear lamps
    ctx.beginPath(); ctx.rect(-3.62, 0.0, 2.98, 0.20); fs(ctx, pal.steel, ol, 0.045);
    ctx.fillStyle = pal.black; for (let x = -3.45; x < -0.7; x += 0.46) ctx.fillRect(x, 0.03, 0.08, 0.14);
    ctx.beginPath(); ctx.rect(-3.62, 0.20, 2.98, 0.14); fs(ctx, pal.steelL, ol, 0.045);
    ctx.fillStyle = pal.wood; ctx.fillRect(-3.60, 0.30, 2.94, 0.035);
    ctx.fillStyle = pal.steel; for (let x = -3.50; x < -0.7; x += 0.42) ctx.fillRect(x, 0.225, 0.07, 0.09);
    ctx.beginPath(); ctx.rect(-3.66, 0.21, 0.06, 0.11); fs(ctx, L('#c43a2c'), ol, 0.03);
    // headache rack behind the cab
    ctx.beginPath(); ctx.rect(-0.72, 0.34, 0.11, 1.28); fs(ctx, pal.steel, ol, 0.045);
    ctx.strokeStyle = pal.steelL; ctx.lineWidth = 0.035; for (let y = 0.52; y < 1.58; y += 0.2) { ctx.beginPath(); ctx.moveTo(-0.705, y); ctx.lineTo(-0.625, y); ctx.stroke(); }
    ctx.beginPath(); ctx.rect(-0.76, 1.58, 0.19, 0.07); fs(ctx, pal.steel, ol, 0.035);
  }
  // cylindrical tank seen from the side: straps, brackets up to the frame, filler cap
  tank(ctx, pal, ol, x0, x1, y0, d) {
    for (const x of [x0 + (x1 - x0) * 0.22, x0 + (x1 - x0) * 0.78]) { ctx.beginPath(); ctx.rect(x - 0.05, y0 + d * 0.5, 0.10, -y0 - d * 0.5 - 0.24); fs(ctx, pal.steel, ol, 0.025); }
    rr(ctx, x0, y0, x1 - x0, d, d / 2); fs(ctx, pal.alu, ol);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x0 + 0.08, y0 + d * 0.66, x1 - x0 - 0.16, 0.035);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x0 + 0.06, y0 + d * 0.12, x1 - x0 - 0.12, 0.05);
    for (const x of [x0 + (x1 - x0) * 0.22, x0 + (x1 - x0) * 0.78]) { ctx.beginPath(); ctx.rect(x - 0.03, y0 - 0.01, 0.06, d + 0.02); fs(ctx, pal.steel, ol, 0.02); }
    ctx.beginPath(); ctx.rect(x1 - 0.22, y0 + d - 0.01, 0.09, 0.05); fs(ctx, pal.chromeD, ol, 0.02);
  }
  plFront(ctx, R, P, tr, L, ol, pal) {
    const a = tr.addons, dirt = tr.cfg.dirt || 0, dmg = tr.damage / 100, sb = tr.snowBuild || 0;
    if (a.stakes) {
      ctx.fillStyle = pal.steelL; ctx.strokeStyle = ol; ctx.lineWidth = 0.035;
      for (let x = -3.53; x < -0.8; x += 0.42) { ctx.beginPath(); ctx.rect(x, 0.34, 0.07, 0.66); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.rect(-3.62, 0.62, 2.90, 0.06); fs(ctx, pal.steel, ol, 0.035);
      ctx.beginPath(); ctx.rect(-3.62, 0.94, 2.90, 0.07); fs(ctx, pal.steel, ol, 0.035);
      ctx.beginPath(); ctx.rect(-3.63, 0.34, 0.08, 0.67); fs(ctx, pal.steelL, ol, 0.035);
    }
    // cab
    ctx.fillStyle = pal.c1; ctx.fill(PL_CAB);
    this.plLivery(ctx, pal, PL_CAB, true);
    this.dirt(ctx, PL_CAB, -0.05, 1.0, dirt, 11);
    ctx.strokeStyle = ol; ctx.lineWidth = OUT; ctx.stroke(PL_CAB);
    const gc = this.glassCol(P, pal);
    rpoly(ctx, PL_WIN_F, 0.05); fs(ctx, gc, ol, 0.045);
    rpoly(ctx, PL_WIN_R, 0.05); fs(ctx, gc, ol, 0.045);
    ctx.strokeStyle = ol; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(1.61, 0.94); ctx.lineTo(1.575, 1.39); ctx.stroke();
    pathPts(ctx, [[1.10, 0.97], [1.28, 1.36], [1.38, 1.36], [1.20, 0.97]]); fs(ctx, css([255, 255, 255], 0.30 * (1 - P.sil)), null);
    pathPts(ctx, [[0.02, 0.97], [0.20, 1.36], [0.30, 1.36], [0.12, 0.97]]); fs(ctx, css([255, 255, 255], 0.24 * (1 - P.sil)), null);
    const seam = L(shadeHex(pal.hex1, -0.42));
    ctx.strokeStyle = seam; ctx.lineWidth = 0.03; ctx.beginPath();
    ctx.moveTo(0.88, -0.03); ctx.lineTo(0.88, 1.44); ctx.moveTo(0.82, -0.03); ctx.lineTo(0.82, 1.44);
    ctx.moveTo(1.95, -0.03); ctx.lineTo(1.95, 0.88); ctx.moveTo(-0.26, -0.03); ctx.lineTo(-0.26, 1.44);
    ctx.moveTo(-0.28, 1.455); ctx.lineTo(1.72, 1.455); ctx.stroke();
    ctx.fillStyle = pal.chromeD; ctx.fillRect(0.96, 0.69, 0.13, 0.04); ctx.fillRect(-0.18, 0.69, 0.13, 0.04);
    this.rustSpots(ctx, pal, dmg, [[-0.22, 0.02, 0.12, 0.05], [1.25, -0.0, 0.1, 0.05, 0.3], [0.4, 1.25, 0.07, 0.04]]);
    // hood, fenders and nose
    ctx.fillStyle = pal.c1; ctx.fill(PL_FRONT);
    this.plLivery(ctx, pal, PL_FRONT, false);
    this.dirt(ctx, PL_FRONT, -0.14, 0.85, dirt * 1.1, 17);
    ctx.strokeStyle = ol; ctx.lineWidth = OUT; ctx.stroke(PL_FRONT);
    // body-side crease running from the nose to the back of the cab
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-0.32, 0.505); ctx.lineTo(3.27, 0.48); ctx.stroke();
    ctx.strokeStyle = L(shadeHex(pal.hex1, -0.35)); ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-0.32, 0.475); ctx.lineTo(3.27, 0.45); ctx.stroke();
    ctx.strokeStyle = seam; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(1.99, 0.72); ctx.lineTo(3.22, 0.665); ctx.stroke();
    this.rustSpots(ctx, pal, dmg, [[3.05, -0.06, 0.13, 0.05], [1.88, -0.04, 0.1, 0.04]]);
    // name on the hood side, model plate on the cowl
    wtxt(ctx, R, 2.70, 0.595, 'POLARIS', 0.11, L('#e9ecec'), 'center', 700);
    rr(ctx, 2.05, 0.32, 0.24, 0.11, 0.02); fs(ctx, pal.chromeD, ol, 0.02); wtxt(ctx, R, 2.17, 0.375, '750', 0.08, L('#2a2826'));
    // grille edge, headlamp bezel, bumper, tow hook
    ctx.beginPath(); ctx.rect(3.255, -0.12, 0.055, 0.83); fs(ctx, pal.chrome, ol, 0.035);
    ctx.beginPath(); ctx.ellipse(3.31, 0.28, 0.05, 0.12, 0, -Math.PI / 2, Math.PI / 2); ctx.closePath(); fs(ctx, pal.chrome, ol, 0.035);
    ctx.beginPath(); ctx.ellipse(3.325, 0.28, 0.022, 0.085, 0, -Math.PI / 2, Math.PI / 2); ctx.closePath(); fs(ctx, tr.lights ? '#fff6cc' : L('#efe9cf'), null);
    const bump = pal.livery === 'rescue' ? pal.c2 : pal.chrome;
    ctx.beginPath(); ctx.rect(3.16, -0.40, 0.12, 0.24); fs(ctx, pal.black, null);
    rr(ctx, 3.22, -0.44, 0.28, 0.30, 0.05); fs(ctx, bump, ol);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(3.26, -0.29); ctx.lineTo(3.46, -0.29); ctx.stroke();
    ctx.strokeStyle = L('#b53b2a'); ctx.lineWidth = 0.06; ctx.beginPath(); ctx.arc(3.42, -0.50, 0.06, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    // west-coast mirror on the front door: tripod foot below the window, top arm to the window frame
    ctx.strokeStyle = pal.chromeD; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(1.50, 0.88); ctx.lineTo(1.80, 0.99); ctx.moveTo(1.70, 0.85); ctx.lineTo(1.80, 0.99); ctx.moveTo(1.64, 1.38); ctx.lineTo(1.80, 1.37); ctx.stroke();
    rr(ctx, 1.77, 0.97, 0.075, 0.42, 0.025); fs(ctx, pal.black, ol, 0.03); ctx.fillStyle = pal.chromeD; ctx.fillRect(1.79, 1.00, 0.018, 0.36);
    // small amber markers on the roof front and the front fender
    rr(ctx, 1.46, 1.51, 0.13, 0.045, 0.02); fs(ctx, L('#e8952e'), ol, 0.02);
    rr(ctx, 3.10, 0.50, 0.08, 0.05, 0.015); fs(ctx, L('#e8952e'), ol, 0.02);
    // snow lying on the roof, hood and an empty bed
    this.snowCap(ctx, P, -0.30, 1.70, 1.51, sb);
    this.snowCap(ctx, P, 2.0, 3.12, 0.84, sb * 0.8, 0.785);
    if (!tr.items.length) this.snowCap(ctx, P, -3.58, -0.75, 0.34, sb * 0.9);
    if (a.lightbar) this.lightBar(ctx, pal, ol, L, tr, 1.62, 1.70, 1.51);
    if (a.snorkel) { ctx.strokeStyle = pal.black; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.moveTo(2.02, 0.66); ctx.lineTo(1.93, 0.90); ctx.lineTo(1.75, 1.36); ctx.lineTo(1.74, 1.70); ctx.stroke(); rr(ctx, 1.64, 1.66, 0.23, 0.11, 0.04); fs(ctx, pal.black, ol, 0.035); }
    // door graphics
    if (pal.livery === 'company') { ctx.beginPath(); ctx.arc(1.42, 0.69, 0.15, 0, TAU); fs(ctx, pal.c2, ol, 0.03); this.logo(ctx, L, 1.42, 0.69, 0.12, pal); wtxt(ctx, R, 0.28, 0.69, 'ZIMNIK HAULAGE', 0.12, pal.c2); }
    else if (pal.livery === 'rescue') wtxt(ctx, R, 0.28, 0.68, 'RESCUE', 0.18, pal.c2);
    if (pal.livery !== 'company') { ctx.beginPath(); ctx.arc(1.42, 0.69, 0.12, 0, TAU); ctx.strokeStyle = pal.c2; ctx.lineWidth = 0.03; ctx.stroke(); wtxt(ctx, R, 1.42, 0.69, String(pal.num), 0.14, pal.c2); }
  }
  plOver(ctx, R, P, tr, L, ol, pal) {
    ctx.beginPath(); ctx.arc(2.45, -0.475, 0.76, 0.456, 2.686, false); ctx.strokeStyle = pal.black; ctx.lineWidth = 0.08; ctx.stroke();
    ctx.beginPath(); ctx.rect(-3.13, -0.86, 0.05, 0.62); fs(ctx, pal.black, null);
    ctx.beginPath(); ctx.rect(-3.16, -0.27, 0.11, 0.04); fs(ctx, pal.steel, null);
    if (tr.addons.bullbar) {
      ctx.strokeStyle = pal.black; ctx.lineWidth = 0.085;
      ctx.beginPath(); ctx.moveTo(3.46, -0.42); ctx.lineTo(3.58, -0.42); ctx.lineTo(3.58, 0.70); ctx.quadraticCurveTo(3.58, 0.80, 3.46, 0.80); ctx.lineTo(3.26, 0.79); ctx.stroke();
      ctx.lineWidth = 0.065; ctx.beginPath(); ctx.moveTo(3.58, 0.42); ctx.lineTo(3.33, 0.42); ctx.moveTo(3.58, 0.08); ctx.lineTo(3.50, 0.08); ctx.stroke();
      ctx.strokeStyle = ol; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(3.625, -0.42); ctx.lineTo(3.625, 0.70); ctx.stroke();
    }
  }
  plLivery(ctx, pal, path, isCab) {
    const L2 = pal.c2;
    ctx.save(); ctx.clip(path);
    if (pal.livery === 'two') { ctx.fillStyle = L2; if (isCab) ctx.fillRect(-0.5, 0.90, 2.6, 0.8); else ctx.fillRect(1.9, 0.75, 1.5, 0.2); }
    else if (pal.livery === 'lower') { ctx.fillStyle = L2; ctx.fillRect(-0.5, -0.3, 4.0, 0.78); }
    else if (pal.livery === 'band') { if (isCab) { ctx.fillStyle = L2; ctx.fillRect(-0.34, 0.14, 1.16, 0.26); ctx.fillRect(0.88, 0.14, 1.07, 0.26); } }
    else if (pal.livery === 'stripe') { ctx.fillStyle = L2; ctx.fillRect(-0.5, 0.51, 4.0, 0.12); ctx.fillStyle = pal.c2d; ctx.fillRect(-0.5, 0.505, 4.0, 0.025); }
    else if (pal.livery === 'company') { ctx.fillStyle = L2; ctx.fillRect(-0.5, -0.2, 4.0, 0.26); }
    else if (pal.livery === 'rescue') {
      ctx.fillStyle = L2; ctx.fillRect(-0.5, -0.2, 4.0, 0.34);
      ctx.fillStyle = pal.c1; for (let x = -0.7; x < 3.6; x += 0.36) { ctx.beginPath(); ctx.moveTo(x, -0.2); ctx.lineTo(x + 0.16, -0.2); ctx.lineTo(x + 0.34, 0.14); ctx.lineTo(x + 0.18, 0.14); ctx.closePath(); ctx.fill(); }
    }
    ctx.restore();
  }
  // ---------- BARS 6x6 ----------
  barsBack(ctx, R, P, tr, L, ol, pal) {
    rr(ctx, 0.86, 0.2, 0.12, 1.78, 0.05); fs(ctx, L('#45403a'), ol);
    rr(ctx, 0.83, 1.9, 0.18, 0.1, 0.03); fs(ctx, L('#2e2a27'), ol, 0.04);
    ctx.beginPath(); ctx.rect(-3.3, -0.17, 6.95, 0.28); fs(ctx, pal.steel, ol);
    ctx.beginPath(); ctx.rect(-3.45, -0.32, 0.18, 0.46); fs(ctx, pal.steel, ol);
    ctx.beginPath(); ctx.rect(-3.47, 0.0, 0.08, 0.12); fs(ctx, L('#c43a2c'), ol, 0.03);
    rr(ctx, 0.05, -0.53, 1.3, 0.42, 0.12); fs(ctx, pal.c1d, ol);
    ctx.fillStyle = pal.steel; ctx.fillRect(0.33, -0.55, 0.06, 0.46); ctx.fillRect(1.02, -0.55, 0.06, 0.46);
    if (tr.cfg.parts.tank === 'k2') { rr(ctx, -1.35, -0.53, 0.8, 0.42, 0.12); fs(ctx, pal.c1d, ol); }
    ctx.beginPath(); ctx.rect(-0.48, -0.45, 0.46, 0.33); fs(ctx, pal.steelL, ol);
    ctx.beginPath(); ctx.rect(-3.36, 0.11, 4.1, 0.3); fs(ctx, pal.steelL, ol);
    ctx.strokeStyle = pal.steel; ctx.lineWidth = 0.04;
    for (let x = -3.0; x < 0.6; x += 0.65) { ctx.beginPath(); ctx.moveTo(x, 0.13); ctx.lineTo(x, 0.39); ctx.stroke(); }
    ctx.beginPath(); ctx.rect(0.72, 0.4, 0.2, 1.4); fs(ctx, pal.steel, ol);
    ctx.strokeStyle = pal.steelL; ctx.lineWidth = 0.04; for (let y = 0.6; y < 1.75; y += 0.28) { ctx.beginPath(); ctx.moveTo(0.75, y); ctx.lineTo(0.89, y); ctx.stroke(); }
  }
  barsFront(ctx, R, P, tr, L, ol, pal) {
    const a = tr.addons, dirt = tr.cfg.dirt || 0, dmg = tr.damage / 100, sb = tr.snowBuild || 0;
    if (tr.cargoType !== 'drums') for (const sx of [-3.08, -1.78, -0.48]) { ctx.beginPath(); ctx.rect(sx, 0.32, 0.13, 1.56); fs(ctx, pal.steelL, ol); ctx.beginPath(); ctx.rect(sx - 0.03, 1.84, 0.19, 0.07); fs(ctx, pal.steel, ol, 0.035); }
    if (tr.cargoType === 'logs') {
      const top = this.logTop(tr);
      if (top >= 0) for (const cx of [-2.45, -1.12]) {
        const yt = 0.4 + 0.43 * (top + 1) + 0.02;
        ctx.strokeStyle = L('#8e8f8c'); ctx.lineWidth = 0.05; ctx.setLineDash([0.07, 0.05]); ctx.beginPath(); ctx.moveTo(cx, 0.36); ctx.lineTo(cx, yt); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.rect(cx - 0.06, 0.62, 0.12, 0.22); fs(ctx, L('#c9a33a'), ol, 0.03);
      }
    }
    ctx.fillStyle = pal.c1; ctx.fill(BARS_CAB);
    ctx.fillStyle = pal.c1d; ctx.fillRect(0.95, 0.12, 1.51, 0.32);
    this.liveryBars(ctx, pal, BARS_CAB);
    this.dirt(ctx, BARS_CAB, 0.12, 1.2, dirt, 23);
    ctx.strokeStyle = ol; ctx.lineWidth = OUT; ctx.stroke(BARS_CAB);
    this.snowCap(ctx, P, 1.02, 2.16, 1.43, sb);
    const gc = this.glassCol(P, pal);
    pathPts(ctx, [[1.52, 0.86], [1.52, 1.31], [2.08, 1.31], [2.3, 0.94], [2.3, 0.86]]); fs(ctx, gc, ol, 0.045);
    pathPts(ctx, [[1.62, 0.9], [1.82, 1.27], [1.92, 1.27], [1.72, 0.9]]); fs(ctx, css([255, 255, 255], 0.35 * (1 - P.sil)), null);
    rr(ctx, 1.06, 0.96, 0.3, 0.3, 0.05); fs(ctx, gc, ol, 0.04);
    ctx.strokeStyle = L(shadeHex(pal.hex1, -0.4)); ctx.lineWidth = 0.035; rr(ctx, 1.44, 0.18, 0.92, 1.17, 0.06); ctx.stroke();
    ctx.beginPath(); ctx.rect(1.52, 0.72, 0.16, 0.05); fs(ctx, pal.steel, null);
    if (pal.livery === 'company') { ctx.beginPath(); ctx.arc(1.92, 0.5, 0.16, 0, TAU); fs(ctx, pal.c2, ol, 0.03); this.logo(ctx, L, 1.92, 0.5, 0.13, pal); }
    else { ctx.beginPath(); ctx.arc(1.92, 0.5, 0.12, 0, TAU); ctx.strokeStyle = L('#e7e2d4'); ctx.lineWidth = 0.035; ctx.stroke(); wtxt(ctx, R, 1.92, 0.5, String(pal.num), 0.17, L('#e7e2d4')); }
    this.rustSpots(ctx, pal, 0.25 + dmg, [[1.15, 0.2, 0.16, 0.06, 0.2], [2.28, 0.24, 0.1, 0.05, -0.3], [3.0, 0.2, 0.18, 0.05]]);
    ctx.beginPath(); ctx.rect(1.62, -0.06, 0.5, 0.08); fs(ctx, pal.steel, ol, 0.035);
    ctx.strokeStyle = pal.steel; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(2.36, 1.05); ctx.lineTo(2.56, 1.12); ctx.stroke();
    rr(ctx, 2.52, 0.8, 0.09, 0.42, 0.03); fs(ctx, L('#2f2d2b'), ol, 0.035);
    ctx.fillStyle = pal.c1; ctx.fill(BARS_HOOD); this.dirt(ctx, BARS_HOOD, 0.12, 0.8, dirt, 29); ctx.strokeStyle = ol; ctx.lineWidth = OUT; ctx.stroke(BARS_HOOD);
    this.snowCap(ctx, P, 2.5, 3.4, 0.86, sb * 0.8, 0.80);
    ctx.strokeStyle = L('#3d4430'); ctx.lineWidth = 0.03;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(2.75, 0.6 - i * 0.07); ctx.lineTo(3.2, 0.6 - i * 0.07); ctx.stroke(); }
    ctx.beginPath(); ctx.rect(3.6, 0.14, 0.12, 0.56); fs(ctx, L('#25231f'), ol, 0.04);
    if (a.lightbar) { rr(ctx, 1.12, 1.47, 0.98, 0.08, 0.03); fs(ctx, pal.black, ol, 0.035); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(1.25 + i * 0.24, 1.63, 0.09, 0, TAU); fs(ctx, pal.chrome, ol, 0.035); ctx.beginPath(); ctx.arc(1.27 + i * 0.24, 1.63, 0.06, 0, TAU); fs(ctx, tr.lights ? '#fff6cc' : L('#e9e4cf'), null); } }
    if (a.snorkel) { ctx.strokeStyle = pal.black; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(2.5, 0.7); ctx.lineTo(2.42, 0.95); ctx.lineTo(2.18, 1.42); ctx.lineTo(2.16, 1.78); ctx.stroke(); rr(ctx, 2.05, 1.74, 0.24, 0.12, 0.05); fs(ctx, pal.black, ol, 0.035); }
  }
  barsOver(ctx, R, P, tr, L, ol, pal) {
    const s = tr.G, fx = s.axles[0], fy = s.anchorY, sb = tr.snowBuild || 0;
    ctx.beginPath(); ctx.arc(fx, fy, 0.8, Math.PI * 0.95, Math.PI * 0.05, true); ctx.arc(fx, fy, 0.68, Math.PI * 0.05, Math.PI * 0.95, false); ctx.closePath(); fs(ctx, pal.c1, ol);
    if (sb > 0.04) { ctx.beginPath(); ctx.arc(fx, fy, 0.8, Math.PI * 0.62, Math.PI * 0.38, true); ctx.arc(fx, fy, 0.8 + 0.06 * sb, Math.PI * 0.38, Math.PI * 0.62, false); ctx.closePath(); fs(ctx, css(P.snow), null); }
    ctx.beginPath(); ctx.arc(3.3, 0.36, 0.115, 0, TAU); fs(ctx, L('#cdd1cf'), ol, 0.04);
    ctx.beginPath(); ctx.arc(3.31, 0.36, 0.075, 0, TAU); fs(ctx, tr.lights ? '#fff6cc' : L('#efe9cf'), null);
    ctx.beginPath(); ctx.rect(3.62, -0.21, 0.32, 0.26); fs(ctx, L('#2b2926'), ol);
    ctx.strokeStyle = L('#b53b2a'); ctx.lineWidth = 0.06; ctx.beginPath(); ctx.arc(3.98, -0.1, 0.07, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    for (const ax of [s.axles[1], s.axles[2]]) { ctx.beginPath(); ctx.rect(ax - 0.66, -0.9, 0.05, 0.92); fs(ctx, L('#1b1a19'), null); }
    if (tr.addons.bullbar) {
      ctx.strokeStyle = pal.black; ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.moveTo(3.74, 0.04); ctx.lineTo(3.80, 0.04); ctx.lineTo(3.80, 0.80); ctx.lineTo(3.55, 0.86); ctx.stroke();
      ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(3.80, 0.45); ctx.lineTo(3.66, 0.45); ctx.stroke();
    }
  }
  // moving bits drawn every frame in the chassis frame
  dyn(ctx, P, tr, L, t, ol) {
    if (tr.isTrailer) return;
    const G = tr.G, an = G.antenna, sway = 0.03 * Math.sin(t * 3), bend = Math.min(0.35, Math.abs(tr.vF) * 0.015);
    ctx.strokeStyle = L('#222'); ctx.lineWidth = 0.02; ctx.beginPath();
    ctx.moveTo(an[0], an[1]); ctx.quadraticCurveTo(an[0] - 0.08, an[1] + 0.44 + sway, an[0] - 0.15 - bend, an[1] + 0.84); ctx.stroke();
    if (tr.addons.beacon) { if (artFix('beacon') && this.fxR) this.beaconFix(ctx, this.fxR, P, tr, L, t, this.fxVer, this.fxPpm, ''); else this.beacon(ctx, L, ol, G.beaconAt[0], G.beaconAt[1], t, tr.lights); }
    if (tr.id === 'bars' && tr.cargoType === 'logs' && this.logTop(tr) < 0) {
      ctx.strokeStyle = L('#8e8f8c'); ctx.lineWidth = 0.05; ctx.setLineDash([0.07, 0.05]);
      for (const cx of [-2.45, -1.12]) { ctx.beginPath(); ctx.moveTo(cx, 0.36); ctx.quadraticCurveTo(cx - 0.2, -0.1, cx - 0.05, -0.35 + 0.05 * Math.sin(t * 6 + cx)); ctx.stroke(); }
      ctx.setLineDash([]);
    }
  }
  // leaf springs follow the axles: drawn live between the frame hangers and the current wheel position
  springs(ctx, tr, L, ol) {
    if (tr.id === 'bars') return;
    const cp = ipos(tr.chassis), ca = iang(tr.chassis), c = Math.cos(-ca), sn = Math.sin(-ca), dark = L('#2b2926'), leaf = L('#4a4743');
    if (tr.isTrailer) {
      // air suspension: trailing arm from a hanger to the axle, air bag behind it
      for (const w of tr.wheels) {
        const p = ipos(w.body), dx = p.x - cp.x, dy = p.y - cp.y, lx = dx * c - dy * sn, ly = dx * sn + dy * c, top = tr.G.fixtures[0][4] - tr.G.fixtures[0][2];
        ctx.beginPath(); ctx.rect(lx + 0.35, top - 0.28, 0.16, 0.3); fs(ctx, dark, ol, 0.025);
        ctx.lineWidth = 0.09; ctx.strokeStyle = ol; ctx.beginPath(); ctx.moveTo(lx + 0.43, top - 0.22); ctx.lineTo(lx - 0.55, ly + 0.05); ctx.stroke(); ctx.lineWidth = 0.05; ctx.strokeStyle = leaf; ctx.stroke();
        rr(ctx, lx - 0.72, ly + 0.08, 0.3, Math.max(0.08, top - ly - 0.1), 0.08); fs(ctx, L('#1f1d1b'), ol, 0.025);
      }
      return;
    }
    const tandem = !!tr.G.tandem;
    tr.wheels.forEach((w, i) => {
      if (tandem && i > 0) return;
      const p = ipos(w.body), dx = p.x - cp.x, dy = p.y - cp.y, lx = dx * c - dy * sn, ly = dx * sn + dy * c;
      const half = tandem ? 0.72 : 0.62, top = -0.24, sy = ly + 0.13;
      ctx.lineWidth = 0.085; ctx.strokeStyle = ol; ctx.beginPath(); ctx.moveTo(lx - half, top - 0.02); ctx.quadraticCurveTo(lx, 2 * sy - top, lx + half, top - 0.02); ctx.stroke();
      ctx.lineWidth = 0.05; ctx.strokeStyle = leaf; ctx.stroke();
      ctx.lineWidth = 0.02; ctx.strokeStyle = dark; ctx.beginPath(); ctx.moveTo(lx - half * 0.6, sy + (top - sy) * 0.36 - 0.03); ctx.quadraticCurveTo(lx, sy - 0.03, lx + half * 0.6, sy + (top - sy) * 0.36 - 0.03); ctx.stroke();
      ctx.beginPath(); ctx.rect(lx - 0.07, sy - 0.07, 0.14, 0.12); fs(ctx, dark, ol, 0.02);
    });
    if (tandem) { // walking-beam bogie between the two rear axles
      const a = tr.wheels[1], b = tr.wheels[2];
      const pa = ipos(a.body), pb = ipos(b.body), m = { x: (pa.x + pb.x) / 2 - cp.x, y: (pa.y + pb.y) / 2 - cp.y };
      const lx = m.x * c - m.y * sn, ly = m.x * sn + m.y * c;
      ctx.beginPath(); ctx.rect(lx - 0.13, ly + 0.02, 0.26, -0.26 - ly); fs(ctx, dark, ol, 0.03);
      ctx.beginPath(); ctx.arc(lx, ly + 0.06, 0.09, 0, TAU); fs(ctx, leaf, ol, 0.025);
    }
  }
  // roof light bar seen from the side: one lamp can facing forward on two mounts
  lightBar(ctx, pal, ol, L, tr, lx, ly, roof) {
    ctx.strokeStyle = pal.black; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(lx - 0.42, roof); ctx.lineTo(lx - 0.38, ly - 0.10); ctx.moveTo(lx - 0.12, roof); ctx.lineTo(lx - 0.15, ly - 0.10); ctx.stroke();
    rr(ctx, lx - 0.52, ly - 0.11, 0.48, 0.05, 0.02); fs(ctx, pal.black, ol, 0.03);
    rr(ctx, lx - 0.26, ly - 0.085, 0.25, 0.17, 0.05); fs(ctx, pal.black, ol, 0.035);
    ctx.beginPath(); ctx.ellipse(lx - 0.012, ly, 0.024, 0.075, 0, -Math.PI / 2, Math.PI / 2); ctx.closePath(); fs(ctx, tr.lights ? '#fff6cc' : L('#cfcbbb'), ol, 0.02);
  }
  // ---------- SKINNERD 143H ----------
  skBack(ctx, R, P, tr, L, ol, pal) {
    // exhaust from the engine under the cab to a tall stack behind it
    ctx.strokeStyle = ol; ctx.lineWidth = 0.10; ctx.beginPath(); ctx.moveTo(3.4, -0.24); ctx.lineTo(0.62, -0.24); ctx.quadraticCurveTo(0.46, -0.24, 0.46, -0.08); ctx.stroke();
    ctx.strokeStyle = L('#5b5650'); ctx.lineWidth = 0.06; ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = ol; ctx.lineWidth = 0.19; ctx.beginPath(); ctx.moveTo(0.46, -0.10); ctx.lineTo(0.46, 2.62); ctx.stroke();
    ctx.strokeStyle = pal.chrome; ctx.lineWidth = 0.13; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0.43, 0.0); ctx.lineTo(0.43, 2.58); ctx.stroke();
    ctx.lineCap = 'round';
    rr(ctx, 0.345, 0.95, 0.23, 1.05, 0.04); fs(ctx, L('#b9bec0'), ol, 0.035);
    ctx.fillStyle = L('#6c7174'); for (let y = 1.03; y < 1.95; y += 0.075) for (let x = 0.38; x < 0.56; x += 0.05) { ctx.beginPath(); ctx.arc(x + ((Math.round(y * 40) % 2) ? 0.025 : 0), y, 0.012, 0, TAU); ctx.fill(); }
    // frame, air tanks, rear underrun bar and hitch
    ctx.beginPath(); ctx.rect(-5.10, -0.28, 9.10, 0.28); fs(ctx, pal.steel, ol);
    ctx.fillStyle = pal.steelL; for (let x = -4.8; x < 3.9; x += 0.6) { ctx.beginPath(); ctx.arc(x, -0.14, 0.024, 0, TAU); ctx.fill(); }
    rr(ctx, -1.20, -0.54, 0.70, 0.24, 0.12); fs(ctx, L('#3a3835'), ol, 0.035);
    ctx.beginPath(); ctx.rect(-5.14, -0.62, 0.09, 0.62); fs(ctx, pal.steel, ol, 0.045);
    ctx.beginPath(); ctx.rect(-5.30, -0.66, 0.30, 0.07); fs(ctx, pal.steelL, ol, 0.03);
    ctx.beginPath(); ctx.rect(-5.20, -0.32, 0.12, 0.22); fs(ctx, pal.steelL, ol, 0.035);
    ctx.beginPath(); ctx.arc(-5.24, -0.20, 0.065, Math.PI * 0.5, Math.PI * 1.5); ctx.strokeStyle = pal.black; ctx.lineWidth = 0.05; ctx.stroke();
    // big aluminium tank and battery box behind the steps
    this.tank(ctx, pal, ol, -0.30, 1.16, -0.76, 0.50);
    if (tr.cfg.parts.tank === 'k2') this.tank(ctx, pal, ol, -1.62, -0.62, -0.74, 0.46);
    ctx.beginPath(); ctx.rect(1.20, -0.72, 0.32, 0.46); fs(ctx, pal.black, ol, 0.04);
    // bed: sills, side rail with stake pockets, wood deck, rear lamps
    ctx.beginPath(); ctx.rect(-5.10, 0.0, 5.40, 0.16); fs(ctx, pal.steel, ol, 0.045);
    ctx.fillStyle = pal.black; for (let x = -4.95; x < 0.2; x += 0.5) ctx.fillRect(x, 0.03, 0.08, 0.10);
    ctx.beginPath(); ctx.rect(-5.10, 0.16, 5.40, 0.14); fs(ctx, pal.steelL, ol, 0.045);
    ctx.fillStyle = pal.wood; ctx.fillRect(-5.08, 0.265, 5.36, 0.035);
    ctx.fillStyle = pal.steel; for (let x = -4.98; x < 0.2; x += 0.45) ctx.fillRect(x, 0.185, 0.07, 0.085);
    ctx.beginPath(); ctx.rect(-5.14, 0.16, 0.06, 0.12); fs(ctx, L('#c43a2c'), ol, 0.03);
    // tall headboard protecting the cab from the load
    for (const x of [0.17, 0.27]) { ctx.beginPath(); ctx.rect(x, 0.30, 0.06, 2.02); fs(ctx, pal.steel, ol, 0.035); }
    ctx.strokeStyle = pal.steelL; ctx.lineWidth = 0.035; for (let y = 0.50; y < 2.3; y += 0.22) { ctx.beginPath(); ctx.moveTo(0.18, y); ctx.lineTo(0.32, y); ctx.stroke(); }
    ctx.beginPath(); ctx.rect(0.13, 2.30, 0.24, 0.07); fs(ctx, pal.steel, ol, 0.035);
  }
  skFront(ctx, R, P, tr, L, ol, pal) {
    const a = tr.addons, dirt = tr.cfg.dirt || 0, dmg = tr.damage / 100, sb = tr.snowBuild || 0;
    if (a.stakes) for (const x of [-0.45, -1.95, -3.45, -4.95]) { ctx.beginPath(); ctx.rect(x, 0.30, 0.12, 1.85); fs(ctx, pal.steelL, ol, 0.035); ctx.beginPath(); ctx.rect(x - 0.02, 2.12, 0.16, 0.06); fs(ctx, pal.steel, ol, 0.03); }
    // cab and spoiler
    for (const path of [SK_CAB, SK_SPOILER]) { ctx.fillStyle = pal.c1; ctx.fill(path); this.skLivery(ctx, pal, path); }
    this.dirt(ctx, SK_CAB, -0.30, 1.0, dirt, 41);
    ctx.strokeStyle = ol; ctx.lineWidth = OUT; ctx.stroke(SK_CAB); ctx.stroke(SK_SPOILER);
    const gc = this.glassCol(P, pal);
    rpoly(ctx, SK_WIN, 0.05); fs(ctx, gc, ol, 0.045);
    rr(ctx, 0.80, 1.22, 0.48, 0.32, 0.08); fs(ctx, gc, ol, 0.04);
    pathPts(ctx, [[1.80, 1.15], [1.96, 1.57], [2.06, 1.57], [1.90, 1.15]]); fs(ctx, css([255, 255, 255], 0.28 * (1 - P.sil)), null);
    const seam = L(shadeHex(pal.hex1, -0.42));
    ctx.strokeStyle = seam; ctx.lineWidth = 0.03; ctx.beginPath();
    ctx.moveTo(1.55, 0.18); ctx.lineTo(1.55, 1.66); ctx.moveTo(1.55, 0.18); ctx.lineTo(2.50, 0.18); ctx.lineTo(2.50, 0.96);
    ctx.moveTo(0.64, 1.74); ctx.lineTo(2.30, 1.74); ctx.moveTo(0.64, 1.02); ctx.lineTo(1.50, 1.02); ctx.stroke();
    ctx.fillStyle = pal.black; for (let i = 0; i < 4; i++) ctx.fillRect(0.68, 1.20 + i * 0.08, 0.07, 0.04);
    ctx.fillStyle = pal.chromeD; ctx.fillRect(1.64, 0.84, 0.14, 0.04); ctx.fillRect(1.47, 0.32, 0.03, 0.80);
    rr(ctx, 1.90, -0.25, 0.42, 0.05, 0.015); fs(ctx, pal.chromeD, ol, 0.02); rr(ctx, 1.90, -0.02, 0.42, 0.05, 0.015); fs(ctx, pal.chromeD, ol, 0.02);
    this.rustSpots(ctx, pal, dmg, [[0.8, 0.06, 0.12, 0.05], [2.2, -0.26, 0.1, 0.04], [1.2, 1.88, 0.08, 0.03]]);
    // sun visor and air horns on the roof
    pathPts(ctx, [[2.18, 1.74], [2.64, 1.74], [2.60, 1.82], [2.22, 1.83]]); fs(ctx, pal.black, ol, 0.03);
    pathPts(ctx, [[1.95, 1.83], [2.18, 1.84], [2.26, 1.93], [2.18, 1.88], [1.95, 1.87]]); fs(ctx, pal.chrome, ol, 0.02);
    // bonnet
    ctx.fillStyle = pal.c1; ctx.fill(SK_HOOD); this.skLivery(ctx, pal, SK_HOOD);
    this.dirt(ctx, SK_HOOD, -0.12, 0.94, dirt * 1.1, 43);
    ctx.strokeStyle = ol; ctx.lineWidth = OUT; ctx.stroke(SK_HOOD);
    ctx.strokeStyle = seam; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(2.58, 0.80); ctx.lineTo(4.14, 0.725); ctx.stroke();
    rr(ctx, 3.02, 0.47, 0.56, 0.16, 0.025); fs(ctx, L('#2a2826'), ol, 0.02); wtxt(ctx, R, 3.30, 0.55, '143H', 0.13, L('#e9ecec'));
    wtxt(ctx, R, 3.78, 0.76, 'SKINNERD', 0.075, L('#3a3632'), 'center', 700);
    ctx.fillStyle = pal.black; ctx.fillRect(4.215, 0.12, 0.055, 0.62);
    rr(ctx, 4.16, -0.10, 0.11, 0.17, 0.02); fs(ctx, pal.chrome, ol, 0.025); ctx.fillStyle = tr.lights ? '#fff6cc' : L('#efe9cf'); ctx.fillRect(4.235, -0.07, 0.03, 0.11);
    rr(ctx, 4.18, 0.09, 0.08, 0.07, 0.015); fs(ctx, L('#e8952e'), ol, 0.02);
    // deep steel bumper from the arch to the nose, with a plate and a step slot
    pathPts(ctx, [[3.70, -0.18], [4.30, -0.18], [4.34, -0.24], [4.34, -0.58], [4.28, -0.64], [3.86, -0.64], [3.72, -0.42]]); fs(ctx, L('#bfc3c2'), ol);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(3.76, -0.25, 0.54, 0.03);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(3.86, -0.47, 0.26, 0.04);
    rr(ctx, 4.31, -0.46, 0.035, 0.15, 0.01); fs(ctx, L('#e9ecec'), ol, 0.015);
    ctx.strokeStyle = L('#b53b2a'); ctx.lineWidth = 0.06; ctx.beginPath(); ctx.arc(4.30, -0.66, 0.06, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    // big mirror and kerb mirror on arms
    ctx.strokeStyle = pal.chromeD; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(2.42, 1.38); ctx.lineTo(2.60, 1.38); ctx.moveTo(2.47, 1.02); ctx.lineTo(2.60, 1.04); ctx.stroke();
    rr(ctx, 2.57, 1.00, 0.10, 0.46, 0.03); fs(ctx, pal.black, ol, 0.03); rr(ctx, 2.58, 0.76, 0.09, 0.20, 0.03); fs(ctx, pal.black, ol, 0.03);
    // snow
    this.snowCap(ctx, P, 0.62, 0.96, 2.38, sb);
    this.snowCap(ctx, P, 1.88, 2.30, 1.80, sb * 0.8);
    this.snowCap(ctx, P, 2.60, 4.10, 0.94, sb * 0.8, 0.86);
    if (tr.id === 'sk' && !tr.items.length) this.snowCap(ctx, P, -5.05, 0.1, 0.30, sb * 0.9);
    if (a.lightbar) this.lightBar(ctx, pal, ol, L, tr, 2.30, 1.96, 1.80);
    if (a.snorkel) { ctx.strokeStyle = pal.black; ctx.lineWidth = 0.11; ctx.beginPath(); ctx.moveTo(2.66, 0.76); ctx.lineTo(2.58, 1.06); ctx.lineTo(2.47, 1.62); ctx.lineTo(2.45, 2.0); ctx.stroke(); rr(ctx, 2.34, 1.96, 0.26, 0.12, 0.05); fs(ctx, pal.black, ol, 0.035); }
    if (pal.livery === 'company') { ctx.beginPath(); ctx.arc(2.02, 0.55, 0.16, 0, TAU); fs(ctx, pal.c2, ol, 0.03); this.logo(ctx, L, 2.02, 0.55, 0.13, pal); wtxt(ctx, R, 1.02, 0.60, 'ZIMNIK HAULAGE', 0.11, pal.c2); }
    else if (pal.livery === 'rescue') wtxt(ctx, R, 1.0, 0.62, 'RESCUE', 0.17, pal.c2);
    if (pal.livery !== 'company') { ctx.beginPath(); ctx.arc(2.02, 0.55, 0.12, 0, TAU); ctx.strokeStyle = pal.livery === 'lower' ? pal.c2 : pal.c2; ctx.lineWidth = 0.03; ctx.stroke(); wtxt(ctx, R, 2.02, 0.55, String(pal.num), 0.14, pal.c2); }
  }
  skOver(ctx, R, P, tr, L, ol, pal) {
    ctx.beginPath(); ctx.arc(3.0, -0.54, 0.74, 0.604, 2.81, false); ctx.strokeStyle = pal.black; ctx.lineWidth = 0.09; ctx.stroke();
    const mx = tr.id === 'skt' ? -2.98 : -4.24;
    ctx.beginPath(); ctx.rect(mx, -0.96, 0.05, 0.70); fs(ctx, pal.black, null);
    ctx.beginPath(); ctx.rect(mx - 0.03, -0.30, 0.12, 0.04); fs(ctx, pal.steel, null);
    if (tr.addons.bullbar) {
      ctx.strokeStyle = pal.black; ctx.lineWidth = 0.09;
      ctx.beginPath(); ctx.moveTo(4.32, -0.56); ctx.lineTo(4.44, -0.56); ctx.lineTo(4.44, 0.78); ctx.quadraticCurveTo(4.44, 0.90, 4.30, 0.90); ctx.lineTo(4.10, 0.89); ctx.stroke();
      ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(4.44, 0.45); ctx.lineTo(4.24, 0.45); ctx.moveTo(4.44, 0.12); ctx.lineTo(4.30, 0.12); ctx.stroke();
    }
  }
  // ---------- SKINNERD 143H TRACTOR ----------
  sktBack(ctx, R, P, tr, L, ol, pal) {
    ctx.strokeStyle = ol; ctx.lineWidth = 0.10; ctx.beginPath(); ctx.moveTo(3.4, -0.24); ctx.lineTo(0.62, -0.24); ctx.quadraticCurveTo(0.46, -0.24, 0.46, -0.08); ctx.stroke();
    ctx.strokeStyle = L('#5b5650'); ctx.lineWidth = 0.06; ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = ol; ctx.lineWidth = 0.19; ctx.beginPath(); ctx.moveTo(0.46, -0.10); ctx.lineTo(0.46, 2.62); ctx.stroke();
    ctx.strokeStyle = pal.chrome; ctx.lineWidth = 0.13; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0.43, 0.0); ctx.lineTo(0.43, 2.58); ctx.stroke();
    ctx.lineCap = 'round';
    rr(ctx, 0.345, 0.95, 0.23, 1.05, 0.04); fs(ctx, L('#b9bec0'), ol, 0.035);
    // short frame, fifth wheel over the bogie, air lines and quarter fenders
    ctx.beginPath(); ctx.rect(-2.78, -0.28, 6.78, 0.28); fs(ctx, pal.steel, ol);
    ctx.fillStyle = pal.steelL; for (let x = -2.5; x < 3.9; x += 0.6) { ctx.beginPath(); ctx.arc(x, -0.14, 0.024, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.rect(-2.84, -0.62, 0.09, 0.62); fs(ctx, pal.steel, ol, 0.045);
    ctx.beginPath(); ctx.rect(-2.90, -0.32, 0.12, 0.22); fs(ctx, pal.steelL, ol, 0.035);
    pathPts(ctx, [[-2.05, 0.0], [-0.85, 0.0], [-0.95, 0.12], [-1.95, 0.12]]); fs(ctx, pal.black, ol, 0.035);
    rr(ctx, -2.0, 0.10, 1.14, 0.09, 0.03); fs(ctx, L('#3a3835'), ol, 0.03);
    ctx.fillStyle = L('#c9a33a'); ctx.fillRect(-1.48, 0.17, 0.1, 0.03);
    ctx.lineWidth = 0.035; ctx.strokeStyle = L('#c8372c'); ctx.beginPath(); ctx.moveTo(0.55, 0.9); ctx.bezierCurveTo(0.1, 0.9, 0.3, 0.45, -0.1, 0.45); ctx.bezierCurveTo(-0.5, 0.45, -0.3, 0.2, -0.8, 0.22); ctx.stroke();
    ctx.strokeStyle = L('#3f6fa0'); ctx.beginPath(); ctx.moveTo(0.55, 0.82); ctx.bezierCurveTo(0.15, 0.82, 0.35, 0.38, -0.05, 0.38); ctx.bezierCurveTo(-0.45, 0.38, -0.25, 0.15, -0.8, 0.17); ctx.stroke();
    for (const ax of [-0.95, -2.31]) { ctx.beginPath(); ctx.arc(ax, -0.54, 0.66, Math.PI * 1.08, Math.PI * 1.92, true); ctx.strokeStyle = ol; ctx.lineWidth = 0.13; ctx.stroke(); ctx.strokeStyle = pal.black; ctx.lineWidth = 0.08; ctx.stroke(); }
    this.tank(ctx, pal, ol, -0.30, 1.16, -0.76, 0.50);
    if (tr.cfg.parts.tank === 'k2') this.tank(ctx, pal, ol, 0.5, 2.0, -0.72, 0.44);
    ctx.beginPath(); ctx.rect(1.20, -0.72, 0.32, 0.46); fs(ctx, pal.black, ol, 0.04);
  }
  sktFront(ctx, R, P, tr, L, ol, pal) { this.skFront(ctx, R, P, tr, L, ol, pal); }
  sktOver(ctx, R, P, tr, L, ol, pal) { this.skOver(ctx, R, P, tr, L, ol, pal); }
  // ---------- TRAILERS (origin at the kingpin, deck underside at y = 0) ----------
  trBeam(ctx, pal, ol, x1, deep) {
    pathPts(ctx, [[1.0, 0], [1.0, -0.2], [-0.6, -0.2], [-1.2, -deep], [-7.6, -deep], [-8.2, -0.24], [x1, -0.24], [x1, 0]]); fs(ctx, pal.steel, ol);
    ctx.fillStyle = pal.steelL; for (let x = -1.0; x > -7.6; x -= 0.6) { ctx.beginPath(); ctx.arc(x, -deep * 0.5, 0.025, 0, TAU); ctx.fill(); }
    // landing legs, wound up for the road
    ctx.beginPath(); ctx.rect(-1.75, -0.95, 0.12, 0.6); fs(ctx, pal.steelL, ol, 0.03); ctx.beginPath(); ctx.rect(-1.86, -1.0, 0.34, 0.06); fs(ctx, pal.steel, ol, 0.025);
    ctx.strokeStyle = pal.black; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-1.62, -0.6); ctx.lineTo(-1.45, -0.64); ctx.stroke();
    ctx.beginPath(); ctx.rect(-0.12, -0.12, 0.24, 0.12); fs(ctx, pal.black, ol, 0.025);
  }
  trRear(ctx, pal, ol, L, x1, top) {
    ctx.beginPath(); ctx.rect(x1 + 0.05, -0.88, 0.1, 0.62); fs(ctx, pal.steel, ol, 0.03); ctx.beginPath(); ctx.rect(x1 - 0.02, -0.9, 0.42, 0.08); fs(ctx, L('#c8372c'), ol, 0.025);
    ctx.fillStyle = L('#e9e6de'); for (let x = x1; x < x1 + 0.38; x += 0.16) ctx.fillRect(x + 0.04, -0.89, 0.07, 0.06);
    ctx.beginPath(); ctx.rect(x1 - 0.04, top - 0.16, 0.08, 0.14); fs(ctx, L('#c43a2c'), ol, 0.025);
  }
  trMarkers(ctx, L, ol, x0, x1, y) { ctx.fillStyle = L('#e8952e'); for (let x = x0; x > x1; x -= 2.4) ctx.fillRect(x, y, 0.1, 0.06); }
  trMudflaps(ctx, pal, x) { ctx.beginPath(); ctx.rect(x, -1.18, 0.05, 0.72); fs(ctx, pal.black, null); }
  trfBack(ctx, R, P, tr, L, ol, pal) { this.trBeam(ctx, pal, ol, -11.2, 0.48); }
  trfFront(ctx, R, P, tr, L, ol, pal) {
    ctx.beginPath(); ctx.rect(-11.2, 0, 12.2, 0.12); fs(ctx, L('#7a5a3c'), ol, 0.04);
    ctx.beginPath(); ctx.rect(-11.2, -0.08, 12.2, 0.1); fs(ctx, L('#4a4d52'), ol, 0.03);
    ctx.fillStyle = pal.black; for (let x = 0.7; x > -11.1; x -= 0.6) ctx.fillRect(x, -0.06, 0.07, 0.07);
    ctx.beginPath(); ctx.rect(0.85, 0.12, 0.1, 0.62); fs(ctx, pal.steel, ol, 0.03); ctx.beginPath(); ctx.rect(0.7, 0.68, 0.3, 0.07); fs(ctx, pal.steel, ol, 0.025);
    this.trRear(ctx, pal, ol, L, -11.2, 0.12); this.trMarkers(ctx, L, ol, -0.4, -10.8, -0.16);
    wtxt(ctx, R, -4.8, -0.32, 'ZIMNIK HAULAGE', 0.15, L('#e9e6de'));
    if (!tr.items.length) this.snowCap(ctx, P, -11.1, 0.9, 0.12, (tr.snowBuild || 0.5) * 0.9);
  }
  trfOver(ctx, R, P, tr, L, ol, pal) { this.trMudflaps(ctx, pal, -10.95); }
  trlBack(ctx, R, P, tr, L, ol, pal) {
    pathPts(ctx, [[0.6, 0.0], [0.6, -0.22], [-10.9, -0.22], [-10.9, 0.0]]); fs(ctx, pal.steel, ol);
    ctx.beginPath(); ctx.rect(-1.75, -0.85, 0.12, 0.62); fs(ctx, pal.steelL, ol, 0.03);
    for (const x of [-0.35, -4.3, -5.8, -9.95]) { ctx.beginPath(); ctx.rect(x - 0.2, 0.0, 0.4, 0.2); fs(ctx, pal.steelL, ol, 0.035); }
    ctx.beginPath(); ctx.rect(-0.12, -0.12, 0.24, 0.12); fs(ctx, pal.black, ol, 0.025);
  }
  trlFront(ctx, R, P, tr, L, ol, pal) {
    for (const x of [-0.35, -4.3, -5.8, -9.95]) { ctx.beginPath(); ctx.rect(x - 0.05, 0.2, 0.1, 1.95); fs(ctx, pal.steelL, ol, 0.03); ctx.beginPath(); ctx.rect(x - 0.08, 2.08, 0.16, 0.07); fs(ctx, pal.steel, ol, 0.025); }
    this.trRear(ctx, pal, ol, L, -10.9, 0.0); this.trMarkers(ctx, L, ol, -0.8, -10.5, -0.16);
    if (!tr.items.length) for (const x of [-0.35, -4.3, -5.8, -9.95]) this.snowCap(ctx, P, x - 0.2, x + 0.2, 0.2, 0.5);
  }
  trlOver(ctx, R, P, tr, L, ol, pal) { this.trMudflaps(ctx, pal, -10.75); }
  trtBack(ctx, R, P, tr, L, ol, pal) { this.trBeam(ctx, pal, ol, -11.0, 0.3); }
  trtFront(ctx, R, P, tr, L, ol, pal) {
    const body = L('#c9ced0'), dk = L('#8d9396');
    rr(ctx, -11.05, 0.0, 11.65, 2.05, 0.7); fs(ctx, body, ol);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-10.4, 1.62, 10.3, 0.1);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-10.6, 0.08, 10.9, 0.32);
    ctx.strokeStyle = dk; ctx.lineWidth = 0.04; ctx.beginPath(); for (let x = -9.6; x < 0; x += 1.6) { ctx.moveTo(x, 0.05); ctx.lineTo(x, 2.0); } ctx.stroke();
    ctx.fillStyle = L('#c8372c'); ctx.fillRect(-10.9, 0.7, 11.3, 0.14);
    for (const x of [-2.2, -5.2, -8.2]) { ctx.beginPath(); ctx.rect(x - 0.3, 2.05, 0.6, 0.1); fs(ctx, dk, ol, 0.025); }
    ctx.strokeStyle = pal.black; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(-10.6, 2.22); ctx.lineTo(-0.2, 2.22); for (let x = -10.4; x < 0; x += 1.3) { ctx.moveTo(x, 2.05); ctx.lineTo(x, 2.22); } ctx.stroke();
    ctx.beginPath(); for (let y = 0.25; y < 2.0; y += 0.28) { ctx.moveTo(-11.12, y); ctx.lineTo(-10.95, y); } ctx.moveTo(-11.12, 0.1); ctx.lineTo(-11.12, 2.15); ctx.stroke();
    box(ctx, -7.6, 1.1, 0.8, 0.5, L('#e9a62e'), { ol }, 0.03); wtxt(ctx, R, -7.2, 1.35, '1202', 0.18, L('#1d1814'));
    wtxt(ctx, R, -4.2, 1.25, 'DIESEL', 0.42, L('#3a3632'));
    ctx.beginPath(); ctx.rect(-8.7, -0.36, 1.3, 0.36); fs(ctx, L('#5a5f63'), ol, 0.03);
    this.trRear(ctx, pal, ol, L, -11.0, 0.0); this.trMarkers(ctx, L, ol, -0.6, -10.6, -0.12);
    this.snowCap(ctx, P, -10.5, -0.2, 2.05, (tr.snowBuild || 0.4) * 0.8);
  }
  trtOver(ctx, R, P, tr, L, ol, pal) { this.trMudflaps(ctx, pal, -10.55); }
  trpBack(ctx, R, P, tr, L, ol, pal) {
    pathPts(ctx, [[1.0, 0.05], [1.0, -0.2], [-0.6, -0.2], [-1.0, -0.36], [-5.6, -0.36], [-6.0, -0.24], [-8.9, -0.24], [-8.9, 0.05]]); fs(ctx, pal.steel, ol);
    ctx.beginPath(); ctx.rect(-1.75, -0.85, 0.12, 0.55); fs(ctx, pal.steelL, ol, 0.03);
    ctx.strokeStyle = ol; ctx.lineWidth = 0.16; ctx.beginPath(); ctx.moveTo(0.35, 0.0); ctx.lineTo(0.55, 1.2); ctx.stroke(); ctx.strokeStyle = L('#c9ced0'); ctx.lineWidth = 0.09; ctx.stroke();
    ctx.beginPath(); ctx.rect(-0.12, -0.12, 0.24, 0.12); fs(ctx, pal.black, ol, 0.025);
  }
  trpFront(ctx, R, P, tr, L, ol, pal) {
    const body = L('#b8732e'), dk = L('#8a5220'), n = tr.bulkUnits || 0;
    if (n > 0) {
      const col = tr.cargoType === 'coal' ? '#2b2a2b' : '#8a8177', top = 1.75 + 0.55 * n / 16, hl = L(shadeHex(col, 0.22));
      ctx.beginPath(); ctx.moveTo(-8.6, 1.7); for (let i = 0; i <= 18; i++) { const u = i / 18, x = -8.6 + u * 9.1; ctx.lineTo(x, 1.7 + (top - 1.7) * Math.pow(Math.sin(Math.PI * u), 0.5) * (0.9 + 0.1 * hashf(i, 7))); } ctx.lineTo(0.5, 1.7); ctx.closePath(); fs(ctx, L(col), ol, 0.035);
      ctx.fillStyle = hl; for (let i = 0; i < 26; i++) { const x = -8.2 + hashf(i, 3) * 8.3; ctx.fillRect(x, 1.72 + hashf(i, 4) * (top - 1.82), 0.09, 0.06); }
    }
    pathPts(ctx, [[0.7, 0.05], [-8.7, 0.05], [-8.9, 1.75], [0.6, 1.75]]); fs(ctx, body, ol);
    ctx.strokeStyle = dk; ctx.lineWidth = 0.06; ctx.beginPath(); for (let x = -7.8; x < 0.4; x += 1.05) { ctx.moveTo(x, 0.1); ctx.lineTo(x - 0.02, 1.7); } ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(-8.6, 1.45, 9.1, 0.22);
    ctx.beginPath(); ctx.rect(-9.05, 0.15, 0.22, 1.5); fs(ctx, dk, ol, 0.03);
    this.trRear(ctx, pal, ol, L, -8.9, 0.05); this.trMarkers(ctx, L, ol, -0.5, -8.5, -0.14);
    if (!n) this.snowCap(ctx, P, -8.7, 0.6, 1.75, 0.4);
  }
  trpOver(ctx, R, P, tr, L, ol, pal) { this.trMudflaps(ctx, pal, -8.45); }
  skLivery(ctx, pal, path) {
    ctx.save(); ctx.clip(path);
    const L2 = pal.c2;
    if (pal.livery === 'lower' || pal.livery === 'two') { ctx.fillStyle = L2; if (pal.livery === 'lower') ctx.fillRect(0.5, -0.4, 4.0, 0.66); else ctx.fillRect(0.5, 1.68, 2.2, 1.0); }
    else if (pal.livery === 'stripe' || pal.livery === 'band') { ctx.fillStyle = L2; ctx.fillRect(0.5, 0.46, 4.0, 0.12); }
    else if (pal.livery === 'company') { ctx.fillStyle = L2; ctx.fillRect(0.5, -0.4, 4.0, 0.42); }
    else if (pal.livery === 'rescue') { ctx.fillStyle = L2; ctx.fillRect(0.5, -0.4, 4.0, 0.5); ctx.fillStyle = pal.c1; for (let x = 0.4; x < 4.4; x += 0.36) { ctx.beginPath(); ctx.moveTo(x, -0.4); ctx.lineTo(x + 0.16, -0.4); ctx.lineTo(x + 0.40, 0.1); ctx.lineTo(x + 0.24, 0.1); ctx.closePath(); ctx.fill(); } }
    ctx.restore();
  }
  // ---------- shared pieces ----------
  liveryBars(ctx, pal, path) {
    ctx.save(); ctx.clip(path);
    if (pal.livery === 'two') { ctx.fillStyle = pal.c2; ctx.fillRect(0.9, 0.86, 1.6, 0.6); }
    else if (pal.livery === 'stripe') { ctx.fillStyle = pal.c2; ctx.fillRect(0.9, 0.62, 1.6, 0.12); }
    else if (pal.livery === 'company' || pal.livery === 'rescue') { ctx.fillStyle = pal.c2; ctx.fillRect(0.9, 0.12, 1.6, 0.2); }
    ctx.restore();
  }
  logo(ctx, L, x, y, r, pal) { // spruce in a ring: the player's company mark
    ctx.fillStyle = pal.c1; ctx.beginPath(); ctx.moveTo(x, y + r * 0.85); ctx.lineTo(x + r * 0.55, y - r * 0.45); ctx.lineTo(x + r * 0.12, y - r * 0.45); ctx.lineTo(x + r * 0.12, y - r * 0.8); ctx.lineTo(x - r * 0.12, y - r * 0.8); ctx.lineTo(x - r * 0.12, y - r * 0.45); ctx.lineTo(x - r * 0.55, y - r * 0.45); ctx.closePath(); ctx.fill();
  }
  beacon(ctx, L, ol, x, y, t, on) {
    rr(ctx, x - 0.1, y, 0.2, 0.05, 0.02); fs(ctx, L('#2a2826'), ol, 0.03);
    ctx.beginPath(); ctx.moveTo(x - 0.08, y + 0.05); ctx.lineTo(x - 0.07, y + 0.17); ctx.quadraticCurveTo(x, y + 0.23, x + 0.07, y + 0.17); ctx.lineTo(x + 0.08, y + 0.05); ctx.closePath();
    const f = on ? 0.5 + 0.5 * Math.sin(t * 9) : 0; fs(ctx, css(mixc(hex('#c9741e'), hex('#ffd46a'), f)), ol, 0.03);
  }
  // ---------- cargo ----------
  cargoBounds(it) {
    if (it.kind === 'logs') { let x0 = 0, x1 = 0, y0 = 0, y1 = 0; for (const g of it.logs) { x0 = Math.min(x0, g.dx - g.len / 2); x1 = Math.max(x1, g.dx + g.len / 2); y0 = Math.min(y0, g.dy - g.d / 2); y1 = Math.max(y1, g.dy + g.d / 2); } return [x0 - 0.06, y0 - 0.06, x1 + 0.06, y1 + 0.06]; }
    if (it.kind === 'pulp') { let top = -it.hh; for (const e of it.ends) top = Math.max(top, e.y + e.r); it.top = top; return [-it.hw - 0.08, -it.hh - 0.08, it.hw + 0.08, top + 0.16]; }
    if (it.kind === 'crate' || it.kind === 'planks') return [-it.hw - 0.07, -it.hh - 0.07, it.hw + 0.07, it.hh + 0.1];
    return [-0.33, -0.48, 0.33, 0.48];
  }
  cargo(ctx, R, P, it, L, ver, ppm, fog) {
    if (!it.sid) it.sid = ++CARGO_SID;
    if (!ver) { ppm = SPR.ppmQ(R.ppm); ver = R.palVer + '@' + ppm.toFixed(2); }
    const b = it.bounds || (it.bounds = this.cargoBounds(it));
    const s = SPR.get('c:' + it.sid + ':' + (it.joint ? 1 : 0) + (fog ? ':f' : ''), ver, b, ppm, g => this.cargoArt(g, it, L, css(P.outline)));
    const p = ipos(it.body);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(iang(it.body)); blit(ctx, s); ctx.restore();
  }
  cargoArt(ctx, it, L, ol) {
    if (it.kind === 'logs') {
      for (const g of it.logs) {
        const x = g.dx - g.len / 2, y = g.dy - g.d / 2;
        rr(ctx, x, y, g.len, g.d, g.d / 2); fs(ctx, L(g.tone > 0.5 ? '#6e4f37' : '#5d4331'), ol, 0.045);
        ctx.strokeStyle = L('#47321f'); ctx.lineWidth = 0.03;
        for (let k = 0; k < 3; k++) { const yy = y + g.d * (0.28 + k * 0.22); ctx.beginPath(); ctx.moveTo(x + 0.3 + k * 0.4, yy); ctx.lineTo(x + g.len - 0.4 - k * 0.3, yy + 0.02); ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(x + g.d * 0.16, g.dy, g.d * 0.16, g.d * 0.47, 0, 0, TAU); fs(ctx, L('#d9b88b'), ol, 0.035);
        ctx.beginPath(); ctx.ellipse(x + g.d * 0.16, g.dy, g.d * 0.07, g.d * 0.22, 0, 0, TAU); ctx.strokeStyle = L('#b38d5c'); ctx.lineWidth = 0.025; ctx.stroke();
      }
    } else if (it.kind === 'pulp') {
      for (const e of it.ends) {
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); fs(ctx, L(e.tone > 0.5 ? '#6e4f37' : '#5d4331'), ol, 0.035);
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.8, 0, TAU); ctx.fillStyle = L(e.tone > 0.3 ? '#d9b88b' : '#cfa877'); ctx.fill();
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.45, 0, TAU); ctx.strokeStyle = L('#b38d5c'); ctx.lineWidth = 0.02; ctx.stroke();
      }
      if (it.joint) {
        const top = it.top;
        ctx.strokeStyle = L('#8e8f8c'); ctx.lineWidth = 0.05; ctx.setLineDash([0.07, 0.05]);
        for (const cx of [-it.hw * 0.42, it.hw * 0.42]) { ctx.beginPath(); ctx.moveTo(cx, -it.hh); ctx.lineTo(cx, top + 0.03); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-it.hw * 0.42, top + 0.03); ctx.quadraticCurveTo(0, top + 0.09, it.hw * 0.42, top + 0.03); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.rect(-it.hw * 0.42 - 0.05, top - 0.3, 0.1, 0.18); fs(ctx, L('#c9a33a'), ol, 0.025);
      }
    } else if (it.kind === 'drum') {
      const c = it.tone ? '#2f5f8a' : '#8a3b2c';
      rr(ctx, -0.29, -0.44, 0.58, 0.88, 0.05); fs(ctx, L(c), ol, 0.045);
      ctx.strokeStyle = L(shadeHex(c, -0.35)); ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(-0.29, -0.15); ctx.lineTo(0.29, -0.15); ctx.moveTo(-0.29, 0.15); ctx.lineTo(0.29, 0.15); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-0.2, -0.4, 0.07, 0.8);
      ctx.beginPath(); ctx.rect(-0.3, 0.42, 0.6, 0.04); fs(ctx, L(shadeHex(c, -0.3)), null);
      if (it.joint) { ctx.strokeStyle = L('#e0a22c'); ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(-0.3, 0.02); ctx.lineTo(0.3, 0.02); ctx.stroke(); }
    } else if (it.kind === 'crate') {
      // nailed wooden crate: frame boards, a brace and a stencilled mark; some are army-green boxes
      const w = it.hw, h = it.hh, green = it.tone > 0.72, wood = green ? '#5d6b45' : it.tone > 0.36 ? '#b08a5c' : '#9c7748', dk = shadeHex(wood, -0.3);
      ctx.beginPath(); ctx.rect(-w, -h, w * 2, h * 2); fs(ctx, L(wood), ol, 0.045);
      ctx.strokeStyle = L(dk); ctx.lineWidth = 0.03; ctx.beginPath();
      for (let y = -h + h * 0.5; y < h - 0.05; y += h * 0.5) { ctx.moveTo(-w, y); ctx.lineTo(w, y); } ctx.stroke();
      ctx.lineWidth = 0.055; ctx.strokeStyle = L(shadeHex(wood, -0.15));
      ctx.strokeRect(-w + 0.04, -h + 0.04, w * 2 - 0.08, h * 2 - 0.08);
      if (!green) { ctx.beginPath(); ctx.moveTo(-w + 0.06, -h + 0.06); ctx.lineTo(w - 0.06, h - 0.06); ctx.stroke(); }
      ctx.fillStyle = L(green ? '#e8e2c4' : '#3a2a1c');
      if (green) { ctx.fillRect(-w * 0.45, -0.035, w * 0.9, 0.07); } else { ctx.beginPath(); ctx.arc(w * 0.38, h * 0.42, 0.07, 0, TAU); ctx.fill(); }
      if (it.joint) { ctx.strokeStyle = L('#e0a22c'); ctx.lineWidth = 0.045; ctx.beginPath(); ctx.moveTo(-w * 0.55, -h); ctx.lineTo(-w * 0.55, h + 0.02); ctx.moveTo(w * 0.55, -h); ctx.lineTo(w * 0.55, h + 0.02); ctx.stroke(); }
    } else if (it.kind === 'planks') {
      // strapped pack of sawn boards: layers on stickers, board ends at the front, steel bands
      const w = it.hw, h = it.hh;
      ctx.beginPath(); ctx.rect(-w, -h, w * 2, h * 2); fs(ctx, L('#d8bc8a'), ol, 0.045);
      ctx.strokeStyle = L('#b39468'); ctx.lineWidth = 0.02; ctx.beginPath();
      for (let y = -h + 0.06; y < h; y += 0.06) { ctx.moveTo(-w, y); ctx.lineTo(w, y); } ctx.stroke();
      ctx.fillStyle = L('#7a5f3e');
      for (let y = -h + 0.19; y < h - 0.05; y += 0.2) for (let x = -w + 0.35; x < w; x += 0.9) ctx.fillRect(x, y - 0.012, 0.12, 0.024);
      ctx.fillStyle = L('#c9a873'); for (let y = -h + 0.01; y < h - 0.03; y += 0.06) ctx.fillRect(w - 0.1, y + 0.005, 0.09, 0.045);
      ctx.strokeStyle = L('#5c5f61'); ctx.lineWidth = 0.035; ctx.beginPath(); for (const x of [-w * 0.62, 0, w * 0.62]) { ctx.moveTo(x, -h); ctx.lineTo(x, h); } ctx.stroke();
    }
  }
  // ---------- wheels: casing drawn live (it flattens), tread and rim are rotating sprites ----------
  wheel(ctx, R, P, w, tr, L, ol, ver, ppm) {
    const r = tr.r, p = ipos(w.body), a = iang(w.body);
    const flat = (w.flat ? 0.13 : 0.075 * clamp((3.2 - tr.pressure) / 2.7, 0, 1)) * (w.touch ? 1 : 0.4);
    const ca0 = iang(tr.chassis), ca = Math.cos(ca0), sa = Math.sin(ca0);
    const look = tr.tire.look, spinF = Math.abs(w.body.getAngularVelocity()) / 60;
    const treadA = clamp(1 - (spinF - 0.09) / 0.1, 0, 1), boltA = clamp(1 - (spinF - 0.22) / 0.18, 0, 1);
    const rr2 = look === 'mt' ? r * 1.015 : r;
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) {
      const th = k / 24 * TAU; let lx = Math.cos(th) * rr2, ly = Math.sin(th) * rr2;
      if (ly < -rr2 * (1 - flat)) { ly = -rr2 * (1 - flat); lx *= 1 + flat * 1.3; }
      const X = p.x + lx * ca - ly * sa, Y = p.y + lx * sa + ly * ca; k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    ctx.closePath(); fs(ctx, L('#272523'), ol);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
    const wk = 'w:' + look + ':' + r.toFixed(3);
    if (treadA > 0.02) { const s = SPR.get(wk, ver, [-rr2, -rr2, rr2, rr2], ppm, g => this.tread(g, r, look, L)); ctx.globalAlpha = treadA; blit(ctx, s); }
    if (treadA < 0.98) { ctx.globalAlpha = (1 - treadA) * 0.8; ctx.strokeStyle = L('#3d3b38'); ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(0, 0, r - 0.06, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const rims = (tr.cfg.paint && tr.cfg.paint.rims) || 'army', hub = tr.id === 'cc' && w.front ? (tr.awd ? 'L' : 'F') : 'R';
    const rk = 'r:' + tr.id + ':' + rims + ':' + r.toFixed(3) + ':' + hub, rb = [-r * 0.6, -r * 0.6, r * 0.6, r * 0.6];
    const sb = SPR.get(rk + ':b', ver, rb, ppm, g => this.rim(g, tr, rims, r, L, ol, true, hub));
    if (boltA < 0.98) {
      blit(ctx, SPR.get(rk + ':n', ver, rb, ppm, g => this.rim(g, tr, rims, r, L, ol, false, hub)));
      if (boltA > 0.02) { ctx.globalAlpha = boltA; blit(ctx, sb); ctx.globalAlpha = 1; }
    } else blit(ctx, sb);
    ctx.restore();
    snowAround(ctx, P, tr, w, p);
  }
  tread(ctx, r, look, L) {
    const tc = L('#3d3b38'); ctx.fillStyle = tc;
    const blk = (n, f) => { for (let k = 0; k < n; k++) { const th = k / n * TAU, c = Math.cos(th), s = Math.sin(th); ctx.save(); ctx.transform(c, s, -s, c, 0, 0); f(k); ctx.restore(); } };
    if (look === 'mt') blk(16, () => ctx.fillRect(r - 0.13, -0.075, 0.13, 0.15));
    else if (look === 'hwy') { ctx.strokeStyle = tc; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.arc(0, 0, r - 0.05, 0, TAU); ctx.stroke(); blk(36, () => ctx.fillRect(r - 0.07, -0.01, 0.06, 0.02)); }
    else if (look === 'mil') blk(18, () => { ctx.beginPath(); ctx.moveTo(r - 0.12, -0.07); ctx.lineTo(r - 0.01, 0); ctx.lineTo(r - 0.12, 0.07); ctx.lineTo(r - 0.08, 0); ctx.closePath(); ctx.fill(); });
    else blk(22, k => { ctx.fillRect(r - 0.1, -0.055, 0.09, 0.11); if (k % 2) ctx.fillRect(r - 0.15, -0.03, 0.05, 0.06); });
    if (look === 'win') { ctx.fillStyle = L('#c9cdd0'); for (let k = 0; k < 22; k++) { const th = k / 22 * TAU + 0.07; ctx.beginPath(); ctx.arc(Math.cos(th) * (r - 0.05), Math.sin(th) * (r - 0.05), 0.014, 0, TAU); ctx.fill(); } }
    if (look === 'chain') { ctx.strokeStyle = L('#9ea2a3'); ctx.lineWidth = 0.035; ctx.setLineDash([0.05, 0.03]); ctx.beginPath(); ctx.arc(0, 0, r - 0.05, 0, TAU); ctx.stroke(); for (let k = 0; k < 12; k++) { const th = k / 12 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(th) * (r - 0.12), Math.sin(th) * (r - 0.12)); ctx.lineTo(Math.cos(th) * r, Math.sin(th) * r); ctx.stroke(); } ctx.setLineDash([]); }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, TAU); ctx.strokeStyle = L('#34322f'); ctx.lineWidth = 0.03; ctx.stroke();
  }
  rim(ctx, tr, rims, r, L, ol, bolts, hub) {
    const rimC = rims === 'polished' ? '#cdd2d4' : rims === 'white' ? '#e9e6de' : rims === 'black' ? '#33312e' : rims === 'bronze' ? '#8a6a48' : '#6f7452';
    const rimD = shadeHex(rimC, -0.28);
    if (tr.id !== 'bars') {
      // disc wheel: flange, dished centre with hand holes, hub with ten nuts
      ctx.beginPath(); ctx.arc(0, 0, r * 0.56, 0, TAU); fs(ctx, L(rimC), ol, 0.045);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.49, 0, TAU); ctx.strokeStyle = L(rimD); ctx.lineWidth = 0.03; ctx.stroke();
      if (rims === 'polished') { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.arc(0, 0, r * 0.43, -2.4, -1.2); ctx.stroke(); }
      ctx.fillStyle = L('#1d1b19'); for (let k = 0; k < 5; k++) { const th = k / 5 * TAU + 0.3; ctx.beginPath(); ctx.ellipse(Math.cos(th) * r * 0.355, Math.sin(th) * r * 0.355, 0.055, 0.034, th + Math.PI / 2, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 0, r * 0.24, 0, TAU); fs(ctx, L(shadeHex(rimC, -0.12)), ol, 0.035);
      if (bolts) { ctx.fillStyle = L('#5c5f61'); for (let k = 0; k < 10; k++) { const th = k / 10 * TAU; ctx.beginPath(); ctx.arc(Math.cos(th) * r * 0.18, Math.sin(th) * r * 0.18, 0.017, 0, TAU); ctx.fill(); } }
      if (hub === 'R') { ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, TAU); fs(ctx, L('#e3e6e7'), ol, 0.03); }
      else { ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, TAU); fs(ctx, L('#3a3c3d'), ol, 0.03); ctx.save(); ctx.rotate(hub === 'L' ? Math.PI / 2 : 0); ctx.fillStyle = L('#e0e2e2'); ctx.fillRect(-r * 0.1, -0.012, r * 0.2, 0.024); ctx.restore(); }
    } else {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, TAU); fs(ctx, L(rimC), ol, 0.05);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, TAU); ctx.strokeStyle = L(rimD); ctx.lineWidth = 0.035; ctx.stroke();
      if (bolts) { ctx.fillStyle = L(shadeHex(rimC, -0.45)); for (let k = 0; k < 8; k++) { const th = k / 8 * TAU; ctx.beginPath(); ctx.arc(Math.cos(th) * r * 0.3, Math.sin(th) * r * 0.3, 0.028, 0, TAU); ctx.fill(); } }
      ctx.beginPath(); ctx.arc(0, 0, r * 0.15, 0, TAU); fs(ctx, L(shadeHex(rimC, 0.15)), ol, 0.035);
      if (bolts) { ctx.beginPath(); ctx.rect(-0.02, 0, 0.04, r * 0.36); fs(ctx, L('#2d2d28'), null); }
    }
  }
  lightsOf(tr, P, t, lights) {
    const G = tr.G, ch = tr.chassis, fw = iwv(ch, 0.995, -0.10);
    if (tr.lights) {
      // dipped beams: aimed a few degrees down at the road
      const hl = iwp(ch, G.head[0], G.head[1]); lights.push({ type: 'beam', x: hl.x, y: hl.y, dx: fw.x, dy: fw.y, len: 30, w: 0.32 });
      if (tr.addons.lightbar) { const lb = iwp(ch, G.lightbarAt[0], G.lightbarAt[1]); const d = iwv(ch, 0.97, -0.24); lights.push({ type: 'beam', x: lb.x, y: lb.y, dx: d.x, dy: d.y, len: 38, w: 0.4 }); }
      // the lamps themselves, where the drawing has them (headlamp, indicator, roof marker)
      if (G.lamps) for (const l of G.lamps) { const q = iwp(ch, l[0], l[1]); lights.push({ type: 'glow', x: q.x, y: q.y, r: l[3], col: l[2], small: 1 }); }
    }
    const tl = iwp(ch, G.tail[0], G.tail[1]), head = tr.towedBy && tr.isTrailer ? tr.towedBy : tr;
    if (!tr.semi) lights.push({ type: 'glow', x: tl.x, y: tl.y, r: head.brk > 0.1 || head.holding ? 2.0 : (head.lights ? 1.1 : 0), col: '#ff4a3a', small: 1 });
    if (P.dark > 0.2 && tr.engineOn) { const cp = iwp(ch, G.cabGlow[0], G.cabGlow[1]); lights.push({ type: 'glow', x: cp.x, y: cp.y, r: 0.7, col: '#ffcf8a', soft: 1 }); }
    if (tr.addons.beacon && tr.lights) { const ba = tr.addons.cage && G.rackBeacon ? G.rackBeacon : G.beaconAt, bp = iwp(ch, ba[0], ba[1] + 0.1); const f = 0.5 + 0.5 * Math.sin(t * 9); lights.push({ type: 'glow', x: bp.x, y: bp.y, r: 1.2 + 1.6 * f, col: '#ffb43a', small: 1 }); }
  }
}
