// ===== the gear knob: drag it through the gate, the automated clutch does the rest =====
// The knob shows the truck's own shift pattern (GATES in 05_data). Moving it out of a slot opens the clutch; near the
// end of a slot the gear goes in (Truck.selectGear: revs matched, clutch closed). A downshift that would over-rev
// bounces back the first time; pushed in again within KNOB_ARM seconds it goes in and the engine pays for it.
// With AUTO on the truck shifts by itself and the knob follows. Two looks: the knob face with the pattern on it, or a
// lever moving in a slotted gate.
const KNOB_ARM = 2.5;
const knobFont = (w, px) => w + ' ' + px.toFixed(1) + 'px "Barlow Condensed",sans-serif';
function knobRR(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

class Knob {
  constructor(hud) {
    this.hud = hud; this.G = hud.G; this.cv = document.getElementById('knob'); this.box = document.getElementById('shift');
    this.K = { x: 1, y: 0, mode: 'bar', col: 0, dir: 0, tab: null, pre: null, btn: null, anim: null, shake: 0, refused: null, engaged: null, lastGear: 0, lastSlot: null, arm: null };
    this.gate = null; this.tr = null; this.drag = null; this.key = ''; this.W = 1; this.H = 1; this.u = 4; this.hold = false; this.t = 0;
    const cv = this.cv;
    cv.addEventListener('pointerdown', e => this.down(e)); cv.addEventListener('pointermove', e => this.move(e));
    const end = e => this.up(e); cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }
  get look() { return this.G.settings.knobLook === 'gate' ? 'gate' : 'face'; }
  resize(u) {
    const r = this.cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    this.u = u; this.W = Math.max(2, r.width); this.H = Math.max(2, r.height); this.d = d;
    this.cv.width = Math.max(2, Math.round(this.W * d)); this.cv.height = Math.max(2, Math.round(this.H * d)); this.key = '';
  }
  // a new drive or truck: the gate for its gearbox, the knob where its gear is
  attach(tr) {
    this.tr = tr; this.gate = tr.gate; const G = this.gate, K = this.K;
    Object.assign(K, { anim: null, shake: 0, refused: null, arm: null, lastGear: 0, lastSlot: null, pre: null, tab: G.tab ? G.tab.pos[0] : null, btn: G.btn ? G.btn.pos[0] : null });
    this.hold = tr.mode === 'M' && G.look === 'auto';
    this.place(tr.shifting ? tr.nextGear : tr.gear); this.drag = null; this.key = '';
  }
  slotAt(c, d) { const col = this.gate.cols[c]; return col ? col[d < 0 ? 0 : 1] : null; }
  // where a gear sits: slot and switch positions, preferring the switches as they are
  inv(g) {
    const G = this.gate, K = this.K;
    if (G.look === 'auto') return g < 0 ? { col: 0, dir: -1, slot: 'R' } : g > 0 ? { col: 0, dir: 1, slot: 'D' } : null;
    const ts = G.tab ? [K.pre || K.tab].concat(G.tab.pos) : [null], bs = G.btn ? [K.btn].concat(G.btn.pos) : [null];
    for (const t of ts) for (const b of bs) for (let c = 0; c < G.cols.length; c++) for (const d of [-1, 1]) { const s = this.slotAt(c, d); if (s && G.gear(s, t, b) === g) return { col: c, dir: d, slot: s, t, b }; }
    return null;
  }
  place(g) {
    const K = this.K, o = g ? this.inv(g) : null;
    if (o) { Object.assign(K, { mode: 'slot', col: o.col, dir: o.dir, x: o.col, y: o.dir, engaged: o.slot, lastSlot: o.slot }); if (o.t) K.tab = o.t; if (o.b) K.btn = o.b; if (g > 0) K.lastGear = g; }
    else Object.assign(K, { mode: 'bar', x: this.gate.home, y: 0, engaged: null });
  }
  engagedGear() { const K = this.K; return K.engaged ? this.gate.gear(K.engaged, K.tab, K.btn) : 0; }
  path(g, then) { const o = this.inv(g); if (!o) return false; this.K.engaged = null; this.K.anim = { k: 'path', x0: this.K.x, y0: this.K.y, to: o, t: 0, dur: Math.max(0.26, Math.min(0.5, this.tr.shiftTime())), then }; return true; }
  finish() {
    const K = this.K, a = K.anim; if (!a) return;
    K.anim = null;
    if (a.k === 'path') { const o = a.to; Object.assign(K, { mode: 'slot', col: o.col, dir: o.dir, x: o.col, y: o.dir }); if (o.t) K.tab = o.t; if (o.b) K.btn = o.b; K.pre = null; if (a.then === 'engage') this.engage(o.slot, true); else { K.engaged = o.slot; K.lastSlot = o.slot; const g = this.engagedGear(); if (g > 0) K.lastGear = g; } }
  }
  toast(msg, cls) { this.hud.toast(msg, cls || 'warn', 2.8); }
  refuse(msg) {
    const K = this.K, tr = this.tr; this.toast(msg); this.G.sound.sfx('grind');
    K.shake = 0.3; this.drag = null;
    // still in a gear (a keyboard shift that didn't go): the knob goes back to it; otherwise back to neutral
    const g = tr.shifting ? tr.nextGear : tr.gear;
    if (g && this.inv(g)) { this.place(g); K.anim = null; return false; }
    K.refused = this.slotAt(K.col, K.dir); K.anim = { k: 'to', x: K.col, y: 0, sp: 16 };
    return false;
  }
  // the knob reached the end of a slot (exact: a keyboard shift to a set gear, the switches as the path left them)
  engage(slot, exact) {
    const G = this.gate, K = this.K, tr = this.tr;
    if (G.look === 'auto') {
      // D: the automatic picks the gear for the speed; R: only from a stop
      if (slot === 'D') { if (tr.gear <= 0) { if (tr.vF < -1.2) return this.refuse('Stop before going forward'); tr.setAuto(true); } tr.mode = this.hold ? 'M' : 'A'; }
      else { const w = tr.selectGear(-1); if (w) return this.refuse(w); }
      K.engaged = slot; K.lastSlot = slot; return true;
    }
    let t = K.pre || K.tab, b = K.btn;
    // a split or axle switch takes the half that follows on from the last gear, so moving the knob up a slot is the
    // next gear and down a slot the one before (it never changes going back into the slot you just left)
    if (!exact && slot !== 'R' && K.lastGear > 0 && slot !== K.lastSlot) {
      const near = (opts, f) => { let best = null, bd = 1e9; for (const o of opts) { const g = f(o); if (typeof g === 'number' && g > 0 && g !== K.lastGear && Math.abs(g - K.lastGear) < bd) { bd = Math.abs(g - K.lastGear); best = o; } } return best; };
      if (G.btn) { const o = near(G.btn.pos, x => G.gear(slot, t, x)); if (o) b = o; }
      else if (G.tab && G.tab.split) { const o = near(G.tab.pos, x => G.gear(slot, x, b)); if (o) t = o; }
    }
    const g = G.gear(slot, t, b);
    if (g === null || g === undefined) return this.refuse('Nothing in that slot in ' + t);
    const armed = !!(K.arm && K.arm.slot === slot && K.arm.until > this.t);
    const w = tr.selectGear(g, armed);
    if (w === 'over') { K.arm = { slot, until: this.t + KNOB_ARM }; return this.refuse('Too fast for ' + tr.gearLabel(g) + ' · ' + (Math.round(tr.rpmIfGear(g) / 50) * 50).toLocaleString('en-US') + ' rpm. Push again to force it'); }
    if (w) return this.refuse(w === 'none' ? 'No gear there' : w);
    K.arm = null; if (g > 0) K.lastGear = g;
    K.tab = t; K.btn = b; K.pre = null; K.engaged = slot; K.lastSlot = slot;
    return true;
  }
  disengage() { this.K.engaged = null; if (this.tr.gear !== 0 || this.tr.shifting) this.tr.toNeutral(); }
  // a switch flipped: a range lever waits for the next slot, a split or axle switch shifts at once
  setTab(p) {
    const G = this.gate, K = this.K; if (!G.tab || (p === K.tab && !K.pre)) return;
    this.G.sound.sfx('click');
    if (!G.tab.split) {
      if (K.engaged && K.engaged !== 'R') { K.pre = p === K.tab ? null : p; if (K.pre) this.toast('Range ' + p + ' set: it goes in with the next slot', ''); }
      else { K.tab = p; K.pre = null; }
      return;
    }
    const old = K.tab; K.tab = p; if (K.engaged && !this.reselect()) K.tab = old;
  }
  setBtn(p) { const K = this.K, old = K.btn; this.G.sound.sfx('click'); K.btn = p; if (K.engaged && !this.reselect()) K.btn = old; }
  reselect() {
    const K = this.K, tr = this.tr, g = this.gate.gear(K.engaged, K.pre || K.tab, K.btn); if (typeof g !== 'number') return false;
    const armed = !!(K.arm && K.arm.slot === 'split' && K.arm.until > this.t), w = tr.selectGear(g, armed);
    if (w === 'over') { K.arm = { slot: 'split', until: this.t + KNOB_ARM }; this.toast('Too fast for ' + tr.gearLabel(g) + '. Flip again to force it'); this.G.sound.sfx('grind'); return false; }
    if (w) { this.toast(w); return false; }
    if (g > 0) K.lastGear = g; K.arm = null; return true;
  }
  setAuto() {
    const tr = this.tr;
    if (this.gate.look === 'auto') { this.hold = !this.hold; if (this.K.engaged === 'D') tr.mode = this.hold ? 'M' : 'A'; this.toast(this.hold ? 'M: holds the gear, + and − change it' : 'D: shifts by itself', ''); return; }
    const on = tr.mode !== 'A'; tr.setAuto(on);
    this.toast(on ? 'AUTO: the truck shifts, the knob follows' : 'Manual', '');
  }
  toGear(g) {   // keyboard: straight to a gear (0: neutral)
    const tr = this.tr; if (!tr || tr.towed) return;
    if (this.gate.look === 'auto') { if (g < 0) this.path(-1, 'engage'); else if (g === 0) { this.disengage(); this.K.anim = { k: 'to', x: 0, y: 0, sp: 14 }; } return; }
    tr.mode = 'M';
    if (g === 0) { this.disengage(); this.K.anim = { k: 'to', x: this.K.col, y: 0, sp: 14 }; return; }
    this.path(g, 'engage');
  }
  step(d) {   // keyboard: the next gear up or down through the pattern
    const tr = this.tr; if (!tr || tr.towed) return;
    if (this.gate.look === 'auto') { if (this.K.engaged === 'D' && this.hold) this.plusMinus(d); return; }
    tr.mode = 'M';
    const cur = tr.shifting ? tr.nextGear : tr.gear, N = tr.gb.ratios.length;
    let g = cur + d; if (cur < 0) g = d > 0 ? 0 : Math.max(-tr.revs.length, cur - 1); if (g > N) return;
    if (g === 0) { this.disengage(); this.K.anim = { k: 'to', x: this.K.col, y: 0, sp: 14 }; return; }
    if (g < -tr.revs.length) return;
    this.path(g, 'engage');
  }
  plusMinus(d) {
    const tr = this.tr, g = tr.gear + d; if (tr.gear < 1 || g < 1 || g > tr.gb.ratios.length) return;
    const armed = !!(this.K.arm && this.K.arm.slot === 'pm' && this.K.arm.until > this.t), w = tr.selectGear(g, armed);
    if (w === 'over') { this.K.arm = { slot: 'pm', until: this.t + KNOB_ARM }; this.toast('Too fast for ' + g + '. Tap again to force it'); return; }
    if (w) this.toast(w); else this.K.arm = null;
  }
  // ---------- touch ----------
  lay() {
    const G = this.gate, u = this.u, W = this.W, H = this.H, tabW = G.tab ? 8.4 * u : 0, sideW = 10 * u;
    const ax = tabW + 0.4 * u, aw = W - tabW - sideW - 0.8 * u;
    return { W, H, u, tabW, sideW, ax, aw, cx: ax + aw / 2, cy: H / 2, R: Math.min(H / 2 - 0.8 * u, aw / 2) };
  }
  sideRects(L) {
    const u = L.u, x = L.W - L.sideW + 0.3 * u, w = L.sideW - 1.1 * u, o = { auto: { x, y: 1 * u, w, h: 7.4 * u } };
    if (this.gate.btn) o.split = { x, y: L.H - 12.4 * u, w, h: 11.4 * u };
    if (this.gate.look === 'auto' && this.hold) { o.plus = { x, y: 9.6 * u, w, h: 8.6 * u }; o.minus = { x, y: 19.4 * u, w, h: 8.6 * u }; }
    return o;
  }
  tabRects(L) {
    const T = this.gate.tab; if (!T) return [];
    const u = L.u, n = T.pos.length, gap = 0.9 * u, h = (L.H - 2 * u - gap * (n - 1)) / n, o = [];
    for (let i = 0; i < n; i++) o.push({ p: T.pos[n - 1 - i], x: 0.6 * u, y: 1 * u + i * (h + gap), w: L.tabW - 1 * u, h });
    return o;
  }
  down(e) {
    e.preventDefault(); this.G.sound.init();
    if (this.G.state !== 'drive' || !this.tr) return;
    const b = this.cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, L = this.lay(), sr = this.sideRects(L);
    const inR = r => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (x > L.W - L.sideW) {
      if (inR(sr.auto)) { this.G.sound.sfx('click'); this.setAuto(); }
      else if (inR(sr.split)) this.setBtn(this.K.btn === 'L' ? 'H' : 'L');
      else if (inR(sr.plus)) this.plusMinus(1); else if (inR(sr.minus)) this.plusMinus(-1);
      return;
    }
    if (this.gate.tab && x < L.tabW) { const r = this.tabRects(L).find(r => y >= r.y - 2 && y <= r.y + r.h + 2); if (r) this.setTab(r.p); this.drag = { k: 'tab', id: e.pointerId }; try { this.cv.setPointerCapture(e.pointerId); } catch (er) { } return; }
    if (this.tr.towed) return;
    if (this.tr.mode === 'A' && this.gate.look !== 'auto') { this.tr.mode = 'M'; this.toast('Manual: the knob is yours', ''); }
    this.finish();
    this.drag = { k: 'knob', id: e.pointerId, x0: e.clientX, y0: e.clientY, kx: this.K.x, ky: this.K.y };
    try { this.cv.setPointerCapture(e.pointerId); } catch (er) { }
  }
  move(e) {
    const D = this.drag; if (!D || D.id !== e.pointerId) return;
    if (D.k === 'tab') { const b = this.cv.getBoundingClientRect(), L = this.lay(), y = e.clientY - b.top, r = this.tabRects(L).find(r => y >= r.y && y <= r.y + r.h); if (r && r.p !== (this.K.pre || this.K.tab)) this.setTab(r.p); return; }
    const auto = this.gate.look === 'auto', sx = (auto ? 10 : 11.5) * this.u, sy = (auto ? 8 : 9) * this.u;
    this.dragTo(D.kx + (e.clientX - D.x0) / sx, D.ky + (e.clientY - D.y0) / sy);
  }
  up(e) {
    const D = this.drag; if (!D || D.id !== e.pointerId) return; this.drag = null;
    if (D.k !== 'knob') return;
    const K = this.K;
    if (K.mode === 'slot') K.anim = { k: 'to', x: K.col, y: (Math.abs(K.y) > 0.45 ? 1 : 0) * K.dir, sp: 14 };
    else K.anim = { k: 'to', x: this.gate.home, y: 0, sp: 6 };
  }
  // the knob follows the finger along the gate: along a slot, or along the neutral bar between them
  dragTo(gx, gy) {
    const K = this.K, nc = this.gate.cols.length;
    if (K.mode === 'slot') {
      const y = clamp(gy * K.dir, 0, 1);
      if (y > 0.035) { K.y = y * K.dir; K.x = K.col; return; }
      K.mode = 'bar'; K.y = 0;
    }
    const x = clamp(gx, 0, nc - 1), c = Math.round(x), d = gy < 0 ? -1 : 1;
    if (Math.abs(gy) > 0.12 && Math.abs(x - c) < 0.34 && this.slotAt(c, d)) { K.mode = 'slot'; K.col = c; K.dir = d; K.x = c; K.y = clamp(Math.abs(gy), 0, 1) * d; }
    else { K.x = x; K.y = 0; }
  }
  // ---------- per frame ----------
  update(dt) {
    const tr = this.tr, K = this.K; if (!tr) return;
    this.t += dt;
    if (tr.gate !== this.gate) this.attach(tr);
    const a = K.anim;
    if (a && a.k === 'path') {
      a.t += dt / a.dur; const t = Math.min(1, a.t), o = a.to;
      if (t < 0.35) { K.y = lerp(a.y0, 0, t / 0.35); K.x = a.x0; K.mode = Math.abs(K.y) > 0.035 ? 'slot' : 'bar'; }
      else if (t < 0.65) { K.mode = 'bar'; K.y = 0; K.x = lerp(a.x0, o.col, (t - 0.35) / 0.3); if (t > 0.5) { if (o.t) K.tab = o.t; if (o.b) K.btn = o.b; K.pre = null; } }
      else { K.mode = 'slot'; K.col = o.col; K.dir = o.dir; K.x = o.col; K.y = lerp(0, o.dir, (t - 0.65) / 0.35); }
      if (t >= 1) this.finish();
    } else {
      if (a && a.k === 'to') {
        const f = Math.min(1, dt * a.sp);
        if (K.mode === 'slot') { K.y += (a.y - K.y) * f; if (Math.abs(K.y) < 0.035 && a.y === 0) { K.mode = 'bar'; K.y = 0; K.anim = { k: 'to', x: this.gate.home, y: 0, sp: 6 }; } else if (Math.abs(a.y - K.y) < 0.004) { K.y = a.y; K.anim = null; } }
        else { K.x += (a.x - K.x) * f; if (Math.abs(a.x - K.x) < 0.004) { K.x = a.x; K.anim = null; } }
      }
      // AUTO: the truck picked a gear, the knob goes there
      if (tr.mode === 'A' && this.gate.look !== 'auto' && !this.drag) {
        const want = tr.shifting ? tr.nextGear : tr.gear;
        if (want > 0 && want !== this.engagedGear() && !(K.anim && K.anim.k === 'path')) this.path(want);
      } else if (K.mode === 'slot') {
        const ay = Math.abs(K.y), s = this.slotAt(K.col, K.dir);
        if (!K.engaged && ay >= 0.82 && K.refused !== s) this.engage(s);
        if (K.engaged && ay < 0.7) this.disengage();
        if (K.refused && ay < 0.45) K.refused = null;
      } else if (K.engaged) this.disengage();
      // the truck went to neutral by itself (a tow, a reset): the knob comes out too
      if (K.engaged && tr.gear === 0 && !tr.shifting && !this.drag && this.gate.look !== 'auto' && !(K.anim && K.anim.k === 'path')) { K.engaged = null; K.anim = { k: 'to', x: K.col, y: 0, sp: 12 }; }
    }
    if (K.shake > 0) K.shake -= dt;
  }
  draw() {
    if (!this.tr) return;
    const K = this.K, blink = (K.pre || (K.arm && K.arm.until > this.t)) ? (performance.now() % 700 < 420 ? 1 : 2) : 0;
    const key = this.look + '|' + K.x.toFixed(3) + '|' + K.y.toFixed(3) + '|' + K.engaged + K.tab + K.pre + K.btn + '|' + this.tr.mode + this.hold + this.tr.gear + '|' + blink + '|' + (K.shake > 0 ? performance.now() : 0) + '|' + this.cv.width;
    if (key === this.key) return; this.key = key;
    const c = this.cv.getContext('2d'), L = this.lay(), u = L.u, G = this.gate;
    c.setTransform(this.d, 0, 0, this.d, 0, 0); c.clearRect(0, 0, L.W, L.H);
    for (const r of this.tabRects(L)) {
      const on = K.tab === r.p && !K.pre, pre = K.pre === r.p;
      knobRR(c, r.x, r.y, r.w, r.h, 1.4 * u); c.fillStyle = on ? '#f0ad3a' : (pre && blink === 1) ? '#7a5a22' : '#3d3a35'; c.fill(); c.lineWidth = 0.55 * u; c.strokeStyle = '#1d1814'; c.stroke();
      c.fillStyle = on ? '#2a2018' : '#e6dfd0'; c.font = knobFont(700, (r.p.length > 2 ? 3.4 : 4.2) * u); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(r.p, r.x + r.w / 2, r.y + r.h / 2 + 0.2 * u);
    }
    const sr = this.sideRects(L);
    this.button(c, sr.auto, G.look === 'auto' ? 'M' : 'AUTO', G.look === 'auto' ? this.hold : this.tr.mode === 'A', u);
    if (sr.split) this.button(c, sr.split, K.btn, K.btn === 'H', u, 'SPLIT');
    if (sr.plus) { this.button(c, sr.plus, '+', false, u); this.button(c, sr.minus, '−', false, u); }
    if (G.look === 'auto') this.drawSelector(c, L);
    else if (this.look === 'gate') this.drawGate(c, L);
    else this.drawFace(c, L, blink === 1);
  }
  button(c, r, txt, on, u, sub) {
    knobRR(c, r.x, r.y, r.w, r.h, 1.5 * u); c.fillStyle = on ? '#f0ad3a' : '#dcd5c7'; c.fill(); c.lineWidth = 0.55 * u; c.strokeStyle = '#1d1814'; c.stroke();
    c.fillStyle = '#2a2520'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (sub) { c.font = knobFont(700, 2.6 * u); c.fillText(sub, r.x + r.w / 2, r.y + 2.4 * u); c.font = knobFont(700, 5.4 * u); c.fillText(txt, r.x + r.w / 2, r.y + r.h / 2 + 1.4 * u); }
    else { c.font = knobFont(700, (txt.length > 3 ? 3.3 : 4.6) * u); c.fillText(txt, r.x + r.w / 2, r.y + r.h / 2 + 0.2 * u); }
  }
  entries(s) {
    const G = this.gate, tr = this.tr, out = [], ts = G.tab ? G.tab.pos : [null], bs = G.btn ? G.btn.pos : [null];
    if (s === 'D') return [{ n: 'D' }];
    for (const t of ts) for (const b of bs) { const g = G.gear(s, t, b); if (typeof g === 'number') out.push({ t, b, n: tr.gearLabel(g), g }); }
    // a slot with one reverse gear reads plain R
    if (s === 'R' && out.length && out.every(e => e.g === out[0].g)) return [{ n: 'R' }];
    return out;
  }
  geo() {
    const G = this.gate, nc = G.cols.length, chrome = G.look === 'chrome';
    const sx = nc === 3 ? 0.5 : nc === 2 ? 0.6 : 0, sy = chrome ? 0.46 : 0.36, rp = chrome ? (nc === 3 ? 0.235 : 0.27) : 0;
    return { nc, chrome, sx, sy, rp, colX: i => (i - (nc - 1) / 2) * sx + (chrome && G.tab ? 0.04 : 0) };
  }
  body(c, cx, cy, R, chrome, hx, hy) {
    c.beginPath(); c.arc(cx + R * 0.05, cy + R * 0.09, R, 0, TAU); c.fillStyle = 'rgba(0,0,0,.35)'; c.fill();
    const gr = c.createRadialGradient(cx - R * 0.32 + hx, cy - R * 0.36 + hy, R * 0.05, cx, cy, R);
    if (chrome) { gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.28, '#dfe3e7'); gr.addColorStop(0.58, '#a3abb3'); gr.addColorStop(0.82, '#d3d8dc'); gr.addColorStop(1, '#6c747c'); }
    else { gr.addColorStop(0, '#5a5a5a'); gr.addColorStop(0.3, '#222'); gr.addColorStop(0.75, '#0c0c0c'); gr.addColorStop(1, '#030303'); }
    c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fillStyle = gr; c.fill(); c.lineWidth = R * 0.035; c.strokeStyle = chrome ? '#3b4147' : '#000'; c.stroke();
  }
  shine(c, cx, cy, R, chrome, hx, hy) {
    c.save(); c.globalAlpha = chrome ? 0.55 : 0.22; c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(cx - R * 0.36 + hx, cy - R * 0.48 + hy, R * 0.32, R * 0.13, -0.55, 0, TAU); c.fill();
    c.globalAlpha = chrome ? 0.8 : 0.55; c.beginPath(); c.arc(cx - R * 0.5 + hx, cy - R * 0.5 + hy, R * 0.05, 0, TAU); c.fill(); c.restore();
  }
  pinX(g, X) { const K = this.K; return K.x <= 0 ? X(0) : K.x >= g.nc - 1 ? X(g.nc - 1) : lerp(X(Math.floor(K.x)), X(Math.ceil(K.x)), K.x - Math.floor(K.x)); }
  drawFace(c, L, blink) {
    const G = this.gate, K = this.K, g = this.geo(), R = L.R;
    const pinx = this.pinX(g, g.colX), piny = K.y * (g.sy - g.rp * 0.92), sh = K.shake > 0 ? Math.sin(performance.now() / 18) * R * 0.03 : 0;
    const cx = L.cx + pinx * R * 0.14 + sh, cy = L.cy + piny * R * 0.14, hx = -pinx * R * 0.08, hy = -piny * R * 0.08;
    // the range lever sticks out of the knob's side, as on the Fuller knobs
    if (G.tab) {
      const n = G.tab.pos.length, i = G.tab.pos.indexOf(K.tab), oy = n === 3 ? (1 - i) * 0.36 : (i === 0 ? 0.22 : -0.22);
      c.save(); c.translate(cx - R * 0.93, cy + oy * R); knobRR(c, -R * 0.12, -R * 0.1, R * 0.24, R * 0.2, R * 0.05); c.fillStyle = '#1b1b1b'; c.fill(); c.strokeStyle = '#000'; c.lineWidth = R * 0.02; c.stroke();
      c.strokeStyle = '#444'; c.lineWidth = R * 0.015; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-R * 0.07 + k * R * 0.05, -R * 0.07); c.lineTo(-R * 0.07 + k * R * 0.05, R * 0.07); c.stroke(); } c.restore();
    }
    this.body(c, cx, cy, R, g.chrome, hx, hy);
    const ink = g.chrome ? '#15171a' : '#f1eee6', dim = g.chrome ? '#5f666d' : '#8d8a83';
    const X = i => cx + g.colX(i) * R, Yend = d => cy + d * g.sy * R;
    c.lineCap = 'round'; c.strokeStyle = ink; c.lineWidth = R * (g.chrome ? 0.035 : 0.045);
    c.beginPath(); c.moveTo(X(0), cy); c.lineTo(X(g.nc - 1), cy);
    for (let i = 0; i < g.nc; i++) for (const d of [-1, 1]) if (this.slotAt(i, d)) { c.moveTo(X(i), cy); c.lineTo(X(i), Yend(d) - d * g.rp * R); }
    c.stroke();
    const showT = K.pre || K.tab, isCur = e => (!e.t || e.t === showT) && (!e.b || e.b === K.btn);
    for (let i = 0; i < g.nc; i++) for (const d of [-1, 1]) {
      const s = this.slotAt(i, d); if (!s) continue;
      const ents = this.entries(s), engaged = K.engaged === s;
      if (g.chrome) {
        const px = X(i), py = Yend(d), rp = g.rp * R, n = ents.length;
        c.beginPath(); c.arc(px, py, rp, 0, TAU); c.fillStyle = 'rgba(255,255,255,.18)'; c.fill();
        // one sector per gear in the slot: LO at the bottom, the higher positions on top; the one the switches point at lit
        const sect = n === 4 ? [[0.5 * Math.PI, Math.PI], [0, 0.5 * Math.PI], [Math.PI, 1.5 * Math.PI], [1.5 * Math.PI, 2 * Math.PI]]
          : n === 3 ? [[Math.PI / 6, 5 * Math.PI / 6], [5 * Math.PI / 6, 1.5 * Math.PI], [1.5 * Math.PI, 2 * Math.PI + Math.PI / 6]]
            : n === 2 ? [[0.5 * Math.PI, 1.5 * Math.PI], [-0.5 * Math.PI, 0.5 * Math.PI]] : [[0, TAU]];
        const pos = n === 4 ? [[-0.42, 0.36], [0.42, 0.36], [-0.42, -0.36], [0.42, -0.36]] : n === 3 ? [[0, 0.5], [-0.44, -0.24], [0.44, -0.24]] : n === 2 ? [[-0.42, 0.04], [0.42, 0.04]] : [[0, 0.04]];
        ents.forEach((e, k) => { if (!isCur(e) && n > 1) return; const a = sect[k] || [0, TAU]; c.beginPath(); c.moveTo(px, py); c.arc(px, py, rp * 0.96, a[0], a[1]); c.closePath(); c.fillStyle = engaged ? 'rgba(240,173,58,.95)' : (K.pre && blink ? 'rgba(240,173,58,.55)' : 'rgba(255,255,255,.55)'); c.fill(); });
        c.strokeStyle = ink; c.lineWidth = R * 0.028; c.beginPath(); c.arc(px, py, rp, 0, TAU); c.stroke();
        c.lineWidth = R * 0.018; c.beginPath();
        if (n === 3) { for (const a of [-0.5 * Math.PI, Math.PI / 6, 5 * Math.PI / 6]) { c.moveTo(px, py); c.lineTo(px + Math.cos(a) * rp, py + Math.sin(a) * rp); } }
        else if (n === 4) { c.moveTo(px - rp, py); c.lineTo(px + rp, py); c.moveTo(px, py - rp); c.lineTo(px, py + rp); }
        else if (n === 2) { c.moveTo(px, py - rp); c.lineTo(px, py + rp); }
        c.stroke();
        ents.forEach((e, k) => {
          const p = pos[k] || [0, 0], on = isCur(e) || n === 1, long = e.n.length > 1;
          c.fillStyle = on ? '#111' : dim; c.font = knobFont(700, R * (on ? (n === 1 ? 0.24 : long ? 0.15 : 0.19) : 0.1)); c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(e.n, px + p[0] * rp, py + p[1] * rp);
        });
      } else {
        const px = X(i), py = Yend(d) + d * R * 0.2;
        if (ents.length === 1) { c.fillStyle = engaged ? '#f0ad3a' : ink; c.font = knobFont(700, R * 0.25); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ents[0].n, px, py); }
        else ents.forEach((e, k) => { const on = isCur(e); c.fillStyle = on ? (engaged ? '#f0ad3a' : ink) : dim; c.font = knobFont(700, R * (on ? (e.n.length > 1 ? 0.17 : 0.2) : 0.12)); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e.n, px + (k === 0 ? -1 : 1) * R * 0.12, py); });
      }
    }
    this.shine(c, cx, cy, R, g.chrome, hx, hy);
    const qx = cx + pinx * R, qy = cy + piny * R;
    c.beginPath(); c.arc(qx, qy, R * 0.075, 0, TAU); c.fillStyle = K.engaged ? '#f0ad3a' : '#ffd88a'; c.fill(); c.lineWidth = R * 0.025; c.strokeStyle = '#1d1814'; c.stroke();
  }
  drawGate(c, L) {
    const G = this.gate, K = this.K, nc = G.cols.length, u = L.u, chrome = G.look === 'chrome';
    const px = L.ax, pw = L.aw, py = 0.7 * u, ph = L.H - 1.4 * u;
    knobRR(c, px, py, pw, ph, 2 * u); c.fillStyle = '#26241f'; c.fill(); c.lineWidth = 0.5 * u; c.strokeStyle = '#141210'; c.stroke();
    const sp = Math.min(pw * 0.3, 11 * u), ry = ph / 2 - 5.6 * u, X = i => L.cx + (i - (nc - 1) / 2) * sp, Y = y => L.cy + y * ry;
    c.lineCap = 'round';
    const groove = () => { c.beginPath(); c.moveTo(X(0), L.cy); c.lineTo(X(nc - 1), L.cy); for (let i = 0; i < nc; i++) for (const d of [-1, 1]) if (this.slotAt(i, d)) { c.moveTo(X(i), L.cy); c.lineTo(X(i), Y(d)); } c.stroke(); };
    c.strokeStyle = '#0b0a09'; c.lineWidth = 3.4 * u; groove(); c.strokeStyle = '#3a362f'; c.lineWidth = 0.5 * u; groove();
    const showT = K.pre || K.tab;
    for (let i = 0; i < nc; i++) for (const d of [-1, 1]) {
      const s = this.slotAt(i, d); if (!s) continue;
      const ents = this.entries(s), e = ents.find(e => (!e.t || e.t === showT) && (!e.b || e.b === K.btn)) || ents[0];
      c.fillStyle = K.engaged === s ? '#f0ad3a' : '#efe8da'; c.font = knobFont(700, 3.6 * u); c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(e ? e.n : s, X(i) + 2.4 * u, Y(d) + d * 0.6 * u);
    }
    const g = { nc }, fx = this.pinX(g, X), sh = K.shake > 0 ? Math.sin(performance.now() / 18) * u * 0.5 : 0, kx = fx + sh, ky = Y(K.y), R = 4.8 * u;
    this.body(c, kx, ky, R, chrome, 0, 0);
    c.strokeStyle = chrome ? '#15171a' : '#e9e5dc'; c.lineWidth = R * 0.07; c.lineCap = 'round'; c.beginPath();
    const s2 = R * 0.34, g2 = R * 0.32; c.moveTo(kx - s2, ky); c.lineTo(kx + s2, ky); for (let i = -1; i <= 1; i++) { c.moveTo(kx + i * s2, ky - g2); c.lineTo(kx + i * s2, ky + g2); } c.stroke();
    this.shine(c, kx, ky, R, chrome, 0, 0);
  }
  drawSelector(c, L) {
    const K = this.K, tr = this.tr, u = L.u, px = L.ax, pw = L.aw, py = 0.7 * u, ph = L.H - 1.4 * u, ry = ph / 2 - 5 * u, X = L.cx - 2 * u;
    knobRR(c, px, py, pw, ph, 2 * u); c.fillStyle = '#26241f'; c.fill(); c.lineWidth = 0.5 * u; c.strokeStyle = '#141210'; c.stroke();
    c.lineCap = 'round'; c.strokeStyle = '#0b0a09'; c.lineWidth = 3.4 * u; c.beginPath(); c.moveTo(X, L.cy - ry); c.lineTo(X, L.cy + ry); c.stroke();
    const tag = (t, y, on) => { c.fillStyle = on ? '#f0ad3a' : '#efe8da'; c.font = knobFont(700, 4.4 * u); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(t, X + 5.6 * u, y); };
    tag('R', L.cy - ry, tr.gear < 0); tag('N', L.cy, tr.gear === 0); tag(this.hold ? 'M' : 'D', L.cy + ry, tr.gear > 0);
    const hy = L.cy + K.y * ry, sh = K.shake > 0 ? Math.sin(performance.now() / 18) * u * 0.5 : 0;
    c.save(); c.translate(X + sh, hy);
    knobRR(c, -4.4 * u, -2.4 * u, 8.8 * u, 6 * u, 1.6 * u); c.fillStyle = 'rgba(0,0,0,.4)'; c.fill();
    const gr = c.createLinearGradient(0, -3 * u, 0, 3 * u); gr.addColorStop(0, '#5b5a57'); gr.addColorStop(1, '#1f1e1c');
    knobRR(c, -4.4 * u, -3 * u, 8.8 * u, 6 * u, 1.6 * u); c.fillStyle = gr; c.fill(); c.lineWidth = 0.5 * u; c.strokeStyle = '#000'; c.stroke();
    knobRR(c, -1.3 * u, -2.2 * u, 2.6 * u, 1.4 * u, 0.6 * u); c.fillStyle = '#8b8984'; c.fill(); c.restore();
  }
}
