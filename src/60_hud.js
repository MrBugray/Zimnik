// ===== HUD: controls, gauges, garage UI, overlays =====
const TABS = [['paint', 'Paint'], ['body', 'Body'], ['engine', 'Engine'], ['gearbox', 'Gearbox'], ['wheels', 'Wheels'], ['chassis', 'Chassis'], ['service', 'Service'], ['fuel', 'Fuel']];
const TAB_CATS = { engine: ['engine', 'tune', 'radiator'], gearbox: ['gearbox'], wheels: ['tires', 'lift', 'ctis'], chassis: ['springs', 'brakes', 'tank'] };
const money = v => Math.round(v).toLocaleString('en-US') + ' ₽';
function partSpec(cat, p) {
  if (cat === 'engine') return Math.round(peakPower(p.torque) / 745.7) + ' hp · ' + curveMax(p.torque) + ' Nm';
  if (cat === 'gearbox') { const nr = (gateOf(p).revs || [0]).length; return (p.type === 'tc' ? p.ratios.length + '-speed auto' : p.ratios.length + ' gears') + (nr > 1 ? ' · ' + nr + ' reverse' : ''); }
  if (cat === 'tires') { const g = p.grip; return 'Snow ×' + g[0].toFixed(2) + ' · Ice ×' + g[2].toFixed(1); }
  if (cat === 'lift') return p.lift ? '+' + Math.round(p.lift * 100) + ' cm body' : 'Stock';
  if (cat === 'springs') return p.hz > 0 ? 'Stiffer' : p.hz < 0 ? 'Softer, more travel' : 'Stock';
  if (cat === 'brakes') return p.k > 1 ? '+' + Math.round((p.k - 1) * 100) + '% force' : 'Stock';
  if (cat === 'tune') return p.k > 1 ? '+' + Math.round((p.k - 1) * 100) + '% torque' : 'Stock';
  if (cat === 'radiator') return p.k > 1 ? '+' + Math.round((p.k - 1) * 100) + '% cooling' : 'Stock';
  if (cat === 'ctis') return p.name.indexOf('Central') === 0 ? 'Adjust while driving' : 'Stop to adjust';
  if (cat === 'tank') return p.extra ? '+' + p.extra + ' L' : 'Stock';
  if (cat === 'cab') { const g = GEOM[p.geom]; return Math.round(g.mass * 1.0) + ' kg · ' + (g.bed.x1 - g.bed.x0).toFixed(1) + ' m ' + (p.geom === 'ccf' ? 'deck' : 'bed') + ' · ' + Math.round(g.r * 2 / 0.0254) + '" tyres'; }
  return '';
}
function truckStats(id, cfg) {
  const Gm = GEOM[geomKey(id, cfg.parts)], p = cfg.parts, a = cfg.addons || {};
  const E = ENGINES[p.engine], GB = GEARBOXES[p.gearbox], lift = LIFTS[p.lift], tune = TUNES[p.tune];
  const r = Gm.r + (lift.dr || 0);
  const cap = Gm.tank + TANKS[p.tank].extra + addonFuel(a);
  let m = Gm.mass + E.mass + (TANKS[p.tank].mass || 0) + Math.min(cfg.fuel !== undefined ? cfg.fuel : cap, cap) * FUEL_KG[E.fuel];
  for (const k in a) if (a[k] && ADDONS[k]) m += ADDONS[k].mass;
  m += Gm.wheelMass * Math.pow(r / Gm.r, 2) * Gm.axles.length;
  const tq = curveMax(E.torque) * tune.k, pw = peakPower(E.torque) * tune.k;
  const top = GB.ratios[GB.ratios.length - 1], first = GB.ratios[0] * (GB.type === 'tc' ? GB.stallTR : 1);
  const vRed = E.red / RPM / (top * Gm.final) * r;
  let v = 5; for (let i = 0; i < 40; i++) { const need = (0.022 * m * 9.81 + 0.5 * 1.25 * Gm.cd * Gm.area * v * v) * v; v *= Math.pow(pw * Gm.eff / need, 0.33); }
  const crawl = E.red / RPM / (GB.ratios[0] * Gm.final) * r;
  const pull = tq * first * Gm.final * Gm.eff / r;
  return { hp: pw / 745.7, tq, gears: GB.ratios.length, auto: GB.type === 'tc', vmax: Math.min(vRed, v) * 3.6, crawl: crawl * 3.6, pull: pull / 1000, mass: m, clear: (Gm.clearance + (r - Gm.r) + lift.lift * 0.5) * 100, tank: cap };
}

class Hud {
  constructor(G) {
    this.G = G; const $ = id => document.getElementById(id); this.$ = $;
    this.root = $('hud'); this.ov = $('ov'); this.gc = $('gc'); this.toastBox = $('toasts'); this.gar = $('garage');
    this.input = { throttle: 0, brake: 0 }; this.touchIn = { throttle: 0, brake: 0 }; this.keys = {};
    this.pedal($('pGas'), 'throttle'); this.pedal($('pBrake'), 'brake');
    const tap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); G.sound.init(); if (G.state === 'drive') fn(); });
    tap('tAwd', () => G.truck.cmdAwd()); tap('tDiff', () => G.truck.cmdDiff()); tap('tLights', () => G.truck.cmdLights());
    this.knob = new Knob(this);
    tap('bMenu', () => G.pause()); tap('bMap', () => G.openDriveMap()); tap('bAct', () => G.doAction());
    const gtap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); G.sound.init(); fn(); });
    gtap('gPrev', () => G.switchTruck(-1)); gtap('gNext', () => G.switchTruck(1)); gtap('gGo', () => { if (!G.ownsTruck()) G.buyTruck(); else G.openJobs(); }); gtap('gMap', () => G.openMap('garage'));
    this.tireSlider();
    window.addEventListener('keydown', e => this.key(e, true)); window.addEventListener('keyup', e => this.key(e, false));
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('contextmenu', e => e.preventDefault());
    this.resize(); this.lastDom = 0; this.lastG = 0; this.forkKey = ''; this.actKey = '';
  }
  resize() {
    layoutView();
    const u = Math.min(VIEW.h / 100, VIEW.w / 190);
    document.documentElement.style.setProperty('--u', u.toFixed(3) + 'px');
    this.G.R.resize();
    if (this.mapResize && this.ov.querySelector('#mapCv')) this.mapResize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.gc.width = Math.max(1, Math.round(this.gc.offsetWidth * dpr)); this.gc.height = Math.max(1, Math.round(this.gc.offsetHeight * dpr));
    this.gKey = ''; if (this.knob) this.knob.resize(u);
  }
  pedal(el, k) {
    let pid = null; const fill = el.querySelector('.fill');
    const upd = e => { const v = clamp(0.15 + fracUp(el, e) / 0.8 * 0.85, 0.15, 1); this.touchIn[k] = v; fill.style.height = (v * 100).toFixed(0) + '%'; };
    el.addEventListener('pointerdown', e => { e.preventDefault(); this.G.sound.init(); pid = e.pointerId; try { el.setPointerCapture(pid); } catch (er) { } el.classList.add('on'); upd(e); });
    el.addEventListener('pointermove', e => { if (e.pointerId === pid) upd(e); });
    const end = e => { if (e.pointerId !== pid) return; pid = null; this.touchIn[k] = 0; el.classList.remove('on'); fill.style.height = '0'; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  }
  tireSlider() {
    const box = this.$('tires'), track = this.$('tTrack'); let pid = null;
    const upd = e => {
      const f = clamp(fracUp(track, e), 0, 1); if (this.G.state !== 'drive') return;
      const tr = this.G.truck; tr.setPressure(0.5 + f * 2.7);
      if (!tr.hasCtis && Math.abs(tr.vF) > 0.3 && !this.ctisHint) { this.ctisHint = true; this.toast('No tire inflation system fitted: stop to change pressure', 'warn', 3.4); }
    };
    box.addEventListener('pointerdown', e => { e.preventDefault(); pid = e.pointerId; try { box.setPointerCapture(pid); } catch (er) { } upd(e); });
    box.addEventListener('pointermove', e => { if (e.pointerId === pid) upd(e); });
    const end = e => { if (e.pointerId === pid) pid = null; };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  }
  key(e, down) {
    const G = this.G, k = e.key.toLowerCase();
    if (['arrowright', 'arrowleft', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
    this.keys[k] = down;
    if (!down || e.repeat) return;
    if (k === 'escape' || k === 'p') { if (G.state === 'drive') G.pause(); else if (G.state === 'pause') G.resume(); return; }
    if (G.state !== 'drive') return;
    const t = G.truck, kb = this.knob;
    if (k === 'e' || k === 'w') kb.step(1); if (k === 'q' || k === 's') kb.step(-1);
    if (k === 'r') kb.toGear(-1); if (k === 'n') kb.toGear(0); if (k === 'd') kb.setAuto();
    if (k === 'f') t.cmdAwd(); if (k === 'g') t.cmdDiff(); if (k === 'h') t.cmdLights();
    if (k === '[') t.setPressure(t.pTarget - 0.3); if (k === ']') t.setPressure(t.pTarget + 0.3);
    if (k === 'm') G.openDriveMap(); if (k === 'u') G.doAction();
  }
  readInput() {
    const k = this.keys;
    this.input.throttle = Math.max(this.touchIn.throttle, k['arrowright'] || k['arrowup'] ? 1 : 0);
    this.input.brake = Math.max(this.touchIn.brake, k['arrowleft'] || k['arrowdown'] || k[' '] ? 1 : 0);
    return this.input;
  }
  toast(msg, cls, dur) {
    const el = document.createElement('div'); el.className = 'toast ' + (cls || ''); el.textContent = msg;
    this.toastBox.appendChild(el);
    while (this.toastBox.children.length > 3) this.toastBox.removeChild(this.toastBox.firstChild);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, (dur || 2.6) * 1000);
  }
  // ---------- drive HUD per frame ----------
  update(t) {
    const G = this.G;
    if (G.state !== 'drive' && G.state !== 'pause') return;
    const tr = G.truck;
    if (this.gc.width < 4 && !this.root.hidden) this.resize();
    // the knob every frame: it follows a finger
    const kdt = Math.min(0.05, Math.max(0, t - (this.lastK || t))); this.lastK = t;
    if (this.knob.tr !== tr) this.knob.attach(tr);
    if (G.state === 'drive') this.knob.update(kdt);
    this.knob.draw();
    if (t - this.lastG > 1 / 30) {
      this.lastG = t;
      // redraw the cluster only when something on it visibly changed
      const gk = Math.round(tr.rpm / 25) + '|' + Math.round(Math.abs(tr.vF) * 7.2) + '|' + tr.gearLabel() + tr.mode + tr.gear + (tr.shifting ? 's' : '') + '|' + Math.round(tr.fuel) + '|' + Math.round(tr.temp) + '|' + (tr.ctisDir !== 0 && Date.now() % 600 < 380 ? 1 : 0) + (tr.holding ? 1 : 0) + (tr.temp > 104 ? 1 : 0) + (tr.intake > 0.35 ? 1 : 0) + '|' + this.gc.width;
      if (gk !== this.gKey) { this.gKey = gk; this.drawGauges(tr); }
    }
    if (t - this.lastDom < 1 / 12) return; this.lastDom = t;
    const $ = this.$, set = (id, on) => $(id).classList.toggle('on', !!on);
    const put = (id, prop, v) => { const k = id + prop; if (this.domC[k] !== v) { this.domC[k] = v; if (prop === 'text') $(id).textContent = v; else if (prop === 'html') $(id).innerHTML = v; else $(id).style[prop] = v; } };
    if (!this.domC) this.domC = {};
    set('tAwd', tr.awd); set('tDiff', tr.diff); set('tLights', tr.lights);
    put('tAwd', 'opacity', tr.def.awd === false ? '0.45' : '');
    const f = (tr.pressure - 0.5) / 2.7, ft = (tr.pTarget - 0.5) / 2.7;
    put('tFill', 'height', (f * 100).toFixed(0) + '%'); put('tThumb', 'bottom', (ft * 100).toFixed(0) + '%');
    const waiting = !tr.hasCtis && Math.abs(tr.pTarget - tr.pressure) > 0.05 && Math.abs(tr.vF) > 0.3;
    put('tVal', 'html', waiting ? '<span style="color:#f0ad3a">STOP</span>' : tr.pressure.toFixed(1) + '<small> bar</small>');
    put('cash', 'text', money(G.cash));
    const P = G.progress();
    put('progFill', 'width', (P.f * 100).toFixed(1) + '%');
    put('progTruck', 'left', (P.f * 100).toFixed(1) + '%');
    const key = P.marks.map(m => m.k + m.f.toFixed(3)).join();
    if (key !== this.forkKey) { this.forkKey = key; $('progMarks').innerHTML = P.marks.map(m => '<div class="pm ' + m.k + '" style="left:' + (m.f * 100).toFixed(1) + '%"></div>').join(''); }
    put('progLbl', 'html', P.label);
    const act = G.actionLabel();
    const ak = act || ''; if (ak !== this.actKey) { $('act').hidden = !act; if (act) $('bAct').textContent = act; this.actKey = ak; }
    // rolled over or dead: the menu lights up, that's where the tow is
    const bad = tr.crashed || !tr.engineOn; if (bad !== this.badK) { this.badK = bad; $('bMenu').classList.toggle('amber', bad); $('bMenu').classList.toggle('light', !bad); }
  }
  drawGauges(tr) {
    const c = this.gc, ctx = c.getContext('2d'), w = c.width, h = c.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    const r = Math.min(h * 0.44, w * 0.19), E = tr.eng;
    const rmax = Math.ceil(E.red * 1.22 / 1000) * 10, nums = []; for (let v = 0; v <= rmax; v += 10) nums.push(v);
    this.dial(ctx, w * 0.19, h * 0.5, r, 0, rmax, 5, tr.rpm / 100, E.red / 100, 'RPM ×100', nums);
    this.dial(ctx, w * 0.81, h * 0.5, r, 0, 100, 10, Math.abs(tr.vF) * 3.6, 999, 'km/h', [0, 20, 40, 60, 80, 100]);
    const cx = w * 0.5, u = h / 100, gw = w * 0.2, gh = h * 0.26, gy = h * 0.1;
    this.rrect(ctx, cx - gw / 2, gy, gw, gh, 4 * u); ctx.fillStyle = '#26271d'; ctx.fill(); ctx.lineWidth = 2.2 * u; ctx.strokeStyle = '#141210'; ctx.stroke();
    const g = tr.shifting && tr.nextGear ? tr.nextGear : tr.gear, lbl = tr.gearLabel(g), gtxt = g > 0 ? (tr.mode === 'A' ? 'D' : 'M') + lbl : lbl;
    ctx.fillStyle = tr.shifting ? '#8a7a40' : '#f2c14e'; ctx.font = '700 ' + ((gtxt.length > 3 ? 15 : 19) * u).toFixed(1) + 'px "Barlow Condensed",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(gtxt, cx, gy + gh / 2 + u);
    const bar = (y, label, v, col, txt) => {
      const bx = cx - gw * 0.62, bw = gw * 1.24, bh = 7 * u;
      ctx.font = '600 ' + (8.5 * u).toFixed(1) + 'px "Barlow Condensed",sans-serif'; ctx.fillStyle = '#d9d1c1'; ctx.textAlign = 'left'; ctx.fillText(label, bx, y - 5.5 * u);
      ctx.textAlign = 'right'; ctx.fillText(txt, bx + bw, y - 5.5 * u);
      this.rrect(ctx, bx, y, bw, bh, 2 * u); ctx.fillStyle = '#1c1a17'; ctx.fill();
      this.rrect(ctx, bx, y, bw * clamp(v, 0, 1), bh, 2 * u); ctx.fillStyle = col; ctx.fill();
      this.rrect(ctx, bx, y, bw, bh, 2 * u); ctx.lineWidth = 1.6 * u; ctx.strokeStyle = '#141210'; ctx.stroke();
    };
    bar(h * 0.5, 'FUEL', tr.fuel / tr.tank, tr.fuel < 15 ? '#e0583c' : '#e9b949', Math.round(tr.fuel) + ' L');
    bar(h * 0.69, 'TEMP', (tr.temp - 30) / 85, tr.temp > 104 ? '#e0583c' : tr.temp < 60 ? '#7fb4d8' : '#a8d07a', Math.round(tr.temp) + '°');
    const blink = Date.now() % 600 < 380;
    const lamps = [['CTIS', tr.ctisDir !== 0 && blink, '#7fd0f0'], ['HOLD', tr.holding, '#e0583c'], ['HOT', tr.temp > 104, '#e0583c'], ['AIR', tr.intake > 0.35, '#f0ad3a']];
    // warning lamps as small pills that light up, so the labels never run into each other
    const span = gw * 1.3, lw = span / lamps.length, ph = 9.5 * u, py = h * 0.875 - ph / 2;
    ctx.font = '700 ' + (6.9 * u).toFixed(1) + 'px "Barlow Condensed",sans-serif'; ctx.textAlign = 'center';
    lamps.forEach((l, i) => {
      const px = cx - span / 2 + lw * i + lw * 0.07, pw = lw * 0.86;
      this.rrect(ctx, px, py, pw, ph, 2.5 * u); ctx.fillStyle = l[1] ? l[2] : '#1c1a17'; ctx.fill();
      ctx.lineWidth = 1.2 * u; ctx.strokeStyle = '#141210'; ctx.stroke();
      ctx.fillStyle = l[1] ? '#1a1612' : '#5a544a'; ctx.fillText(l[0], px + pw / 2, py + ph / 2 + 0.4 * u);
    });
  }
  rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  dial(ctx, cx, cy, r, min, max, step, val, red, label, nums) {
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, A = v => a0 + (a1 - a0) * clamp((v - min) / (max - min), 0, 1.04);
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.06, 0, TAU); ctx.fillStyle = '#2a2723'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = '#ece3cc'; ctx.fill(); ctx.lineWidth = r * 0.05; ctx.strokeStyle = '#141210'; ctx.stroke();
    if (red < max) { ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, A(red), A(max)); ctx.lineWidth = r * 0.12; ctx.strokeStyle = '#c94a32'; ctx.stroke(); }
    ctx.strokeStyle = '#2a2520'; ctx.lineCap = 'butt';
    for (let v = min; v <= max + 1e-6; v += step) { const a = A(v), big = nums.includes(v); ctx.lineWidth = r * (big ? 0.05 : 0.03); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * (big ? 0.72 : 0.8), cy + Math.sin(a) * r * (big ? 0.72 : 0.8)); ctx.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); ctx.stroke(); }
    ctx.fillStyle = '#2a2520'; ctx.font = '700 ' + (r * 0.24).toFixed(1) + 'px "Barlow Condensed",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const v of nums) { const a = A(v); ctx.fillText(String(v), cx + Math.cos(a) * r * 0.54, cy + Math.sin(a) * r * 0.54); }
    ctx.font = '600 ' + (r * 0.17).toFixed(1) + 'px "Barlow Condensed",sans-serif'; ctx.fillStyle = '#6b6152'; ctx.fillText(label, cx, cy + r * 0.62);
    const a = A(val); ctx.lineCap = 'round'; ctx.strokeStyle = '#c23b26'; ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * r * 0.15, cy - Math.sin(a) * r * 0.15); ctx.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.11, 0, TAU); ctx.fillStyle = '#3a342d'; ctx.fill();
  }
  // ---------- junction card ----------
  showFork(card) {
    const box = this.$('forkOpts');
    box.innerHTML = card.opts.map(o => '<button class="fo ' + (o.secret ? 'secret ' : '') + (o.target ? 'target ' : '') + (o.best ? 'best' : '') + '" data-id="' + o.id + '"><em>' + o.km + '</em><b>' + o.name + '</b>' + (o.best ? '<i>shortest</i>' : '') + '<span>' + o.toward + (o.traits ? ' · ' + o.traits : '') + '</span>' +
      (o.target ? '<span style="color:#a8321f;font-weight:700">● ' + o.targetText + '</span>' : '') + (o.warn ? '<span style="color:#9a3b22;font-weight:700">⚠ ' + o.warn + '</span>' : '') + '</button>').join('');
    box.querySelectorAll('.fo').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); this.G.chooseRoad(b.dataset.id); }));
    this.$('forkTtl').textContent = card.title; this.$('forkSub').textContent = card.sub || '';
    this.$('fork').hidden = false;
  }
  hideFork() { this.$('fork').hidden = true; }
  // ---------- screens ----------
  show(which) {
    this.root.hidden = which !== 'drive'; this.gar.hidden = which !== 'garage';
    if (which === 'drive' || which === 'garage') { this.ov.hidden = true; this.ov.innerHTML = ''; }
    this.resize();
  }
  segs(k, cur, items) { return '<div class="seg" data-k="' + k + '">' + items.map(([v, n]) => '<button data-v="' + v + '" class="' + (v === cur ? 'on' : '') + '">' + n + '</button>').join('') + '</div>'; }
  conditionsHTML() {
    const G = this.G, w = G.data.wx;
    const now = '<p class="wxnow">Now: <b>' + WEATHER[G.weather].name + '</b>' + (w && G.wxF > 0 && w.next !== G.weather ? ', turning ' + WEATHER[w.next].name.toLowerCase() : w && w.next ? ' · next: ' + WEATHER[w.next].name.toLowerCase() : '') + '. It changes as time goes by.</p>';
    return '<h2>Weather</h2>' + now +
      '<h2>Time of day</h2><p class="wxnow"><b>' + TIMES[G.timeKey].name + '</b> — the day moves on its own while you drive.</p>';
  }
  wireSegs(after) {
    this.ov.querySelectorAll('.seg').forEach(seg => seg.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => {
      e.preventDefault(); seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); this.G.setOption(seg.dataset.k, b.dataset.v); if (after) after(seg.dataset.k);
    })));
  }
  confirm(id, fn) {
    const b = this.ov.querySelector('#' + id); if (!b) return;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); this.G.sound.init();
      if (b.classList.contains('arm')) { fn(); return; }
      b.classList.add('arm'); const em = b.querySelector('em'), was = em ? em.textContent : '';
      if (em) em.textContent = 'Tap again';
      setTimeout(() => { b.classList.remove('arm'); if (em) em.textContent = was; }, 3000);
    });
  }
  btn(id, fn) { const b = this.ov.querySelector('#' + id); if (b) b.addEventListener('pointerdown', e => { e.preventDefault(); this.G.sound.init(); fn(); }); }
  showTitle() {
    const G = this.G, started = !!G.data.started;
    this.root.hidden = true; this.gar.hidden = true;
    this.ov.innerHTML = '<div class="panel full"><div class="tfill"><h1>ZIM<span>NIK</span></h1><div class="sub">Haulage in the far north · v0.9</div>' +
      '<div class="tcol">' +
      (started ? '<button class="btn amber" id="oCont">Continue</button>' : '') +
      '<button class="btn ' + (started ? 'light' : 'amber') + '" id="' + (started ? 'oNew' : 'oCont') + '">Start new game</button>' +
      '<button class="btn light" id="oSet">Settings</button>' +
      '</div></div></div>';
    this.ov.hidden = false;
    this.btn('oCont', () => { G.data.started = 1; G.saveNow(); G.toHub(); });
    if (started) this.confirm('oNew', () => G.newGame());
    this.btn('oSet', () => this.showSettings());
  }
  showSettings() {
    const G = this.G, s = G.settings, gap = '<div style="height:calc(var(--u)*1.5)"></div>';
    this.ov.innerHTML = '<div class="panel full"><div class="tfill"><h1 style="font-size:calc(var(--u)*9)">Settings</h1><div class="tcol">' +
      '<h2>Gear knob</h2>' + this.segs('gear', s.autoGear ? 'auto' : 'man', [['auto', 'Start in AUTO'], ['man', 'Start in neutral, manual']]) +
      gap + this.segs('knob', s.knobLook === 'gate' ? 'gate' : 'face', [['face', 'Pattern on the knob'], ['gate', 'Lever in a gate']]) +
      gap + this.segs('sk12', s.sk12 === 'b' ? 'b' : 'a', [['a', 'Skinnerd 12: LO · INT · DIR'], ['b', 'Skinnerd 12: range + splitter']]) +
      '<h2>Game</h2>' + this.segs('sound', s.sound ? 'on' : 'off', [['on', 'Sound on'], ['off', 'Sound off']]) +
      gap + this.segs('quality', s.quality, [['auto', 'Graphics auto'], ['high', 'High'], ['low', 'Low']]) +
      gap + this.segs('fps', s.fps, [['auto', 'Frame rate auto'], ['60', '60 fps'], ['30', '30 fps · battery']]) +
      gap + this.segs('hold', s.autoHold ? 'on' : 'off', [['on', 'Auto-hold on'], ['off', 'Auto-hold off']]) +
      '<div class="row" style="justify-content:center"><button class="btn amber" id="oBack">Back</button></div></div></div></div>';
    this.ov.hidden = false;
    this.wireSegs();
    this.btn('oBack', () => this.showTitle());
  }
  // the board at the truck's yard: hauls, breakdowns, and driving empty to somewhere else
  showJobs() {
    if (this.G.roadOf() || this.G.cfg().job) { this.showMyJob(); return; }
    const G = this.G, loc = G.loc, N = NODES[loc], id = G.gid, jobs = G.econ.board(loc, G).concat(G.recoverJobs(loc)), found = s => G.secret(s);
    const travel = Object.keys(NODES).filter(n => NODES[n].kind === 'yard' && n !== loc).map(n => ({ n, d: route(loc, n, null, found).d })).filter(q => q.d < Infinity).sort((a, b) => a.d - b.d);
    const ids = jobs.map(j => j.id).concat(travel.map(q => 'go:' + q.n), ['free']);
    if (!ids.includes(G.jobSel)) G.jobSel = (jobs.find(j => G.jobEstimate(j) !== null) || {}).id || 'go:' + travel[0].n;
    const fits = c => Object.keys(TRUCKS).filter(t => capOf(t, c, G.cfg(t).parts)).map(t => t === 'skt' ? 'Skinnerd tractor' : TRUCKS[t].name.split(' ')[0]).join(', ');
    // fuel each drive will likely take, and a warning when the tank won't cover it
    const fuel = Math.round(G.cfg().fuel), fneed = d => G.fuelNeed(d), fwarn = d => fneed(d) > fuel ? '<small class="lowf">Fuel: about ' + fneed(d) + ' L needed, ' + fuel + ' L in the tank</small>' : '';
    const card = j => {
      const est = G.jobEstimate(j), on = j.id === G.jobSel ? ' on' : '';
      if (j.kind === 'haul') {
        const C = CARGO[j.cargo], pp = G.cfg(id).parts, n = capOf(id, j.cargo, pp), t = n * unitKg(id, j.cargo, pp) / 1000, rig = id === 'skt' && TRAILER_FOR[j.cargo] ? TRAILERS[TRAILER_FOR[j.cargo]].name + ' · ' : '';
        const st = G.econ.stock(j.from, j.cargo), stock = st < Infinity ? ' · ' + Math.floor(st) + ' t in stock' : '';
        return '<button class="job' + on + (est === null ? ' dis' : '') + '" data-k="' + j.id + '"><em>' + (est === null ? '—' : '~' + money(est)) + '</em><b>' + C.name + ' → ' + NODES[j.to].name + '</b><i class="dem">' + G.econ.demandWord(j.dem) + '</i>' +
          '<span>' + (n ? rig + (C.bulk ? t.toFixed(0) + ' t' : n + ' ' + (n === 1 ? C.unit : C.units) + ' · ' + t.toFixed(1) + ' t') : 'Not for the ' + TRUCKS[id].name.split(' ')[0] + ' · fits: ' + (fits(j.cargo) || 'a tractor and trailer')) + ' · ' + km(j.dist) + ' km' + (n ? ' · ≈' + fneed(j.dist) + ' L' : '') + stock + '</span>' + (C.bulk ? '<small>Bulk load in a trailer · heavy on hills and ice</small>' : C.fragile ? '<small>Fragile load · paid per ' + C.unit + ' delivered</small>' : '<small>Heavy load · paid per ' + C.unit + ' delivered</small>') + (n ? fwarn(j.dist) : '') + '</button>';
      }
      if (j.kind === 'recover') {
        const tc = G.data.trucks[j.truck], cj = tc.job, heavy = j.truck === 'skt' && cj ? ' · tractor and loaded trailer: heavy on the bar' : cj ? ' · loaded: ' + cj.left + ' ' + (cj.left === 1 ? CARGO[cj.cargo].unit : CARGO[cj.cargo].units) : '';
        return '<button class="job' + on + '" data-k="' + j.id + '"><em>' + km(j.dist) + ' km</em><b>Fetch your ' + TRUCKS[j.truck].name + '</b><span>' + G.whereText(j.truck) + ' · tow it to ' + j.why + ' at ' + NODES[j.to].name + ' · ≈' + fneed(j.dist) + ' L</span><small>Your own truck' + heavy + '. Hook up the tow bar and bring it in</small>' + fwarn(j.dist) + '</button>';
      }
      const what = j.kind === 'rescue' ? 'Stranded truck on the ' + EDGES[j.edge].name : 'Broken truck in the yard';
      return '<button class="job' + on + '" data-k="' + j.id + '"><em>~' + money(est) + '</em><b>' + what + '</b><span>Tow it to the workshop at ' + NODES[j.to].name + ' · about ' + km(j.dist) + ' km · ≈' + fneed(j.dist) + ' L' + (G.addons().beacon ? ' · beacon +10%' : '') + '</span><small>Hook up the tow bar and bring it in. A snapped bar can be put back on.</small>' + fwarn(j.dist) + '</button>';
    };
    const tcard = q => '<button class="job' + ('go:' + q.n === G.jobSel ? ' on' : '') + '" data-k="go:' + q.n + '"><em>' + km(q.d) + ' km</em><b>To ' + NODES[q.n].name + '</b><span>' + NODES[q.n].sub + ' · ' + G.econ.board(q.n, G).length + ' jobs there · ≈' + fneed(q.d) + ' L of fuel</span>' + fwarn(q.d) + '</button>';
    const work = jobs.filter(j => j.kind !== 'recover'), mine = jobs.filter(j => j.kind === 'recover');
    const list = '<div class="jh">WORK FROM ' + N.name.toUpperCase() + '</div>' + (work.length ? work.map(card).join('') : '<p>Nothing to haul from here today.</p>') +
      (mine.length ? '<div class="jh">YOUR TRUCKS OUT ON THE ROADS</div>' + mine.map(card).join('') : '') +
      '<div class="jh">DRIVE EMPTY</div>' + travel.slice(0, 8).map(tcard).join('') +
      '<button class="job' + (G.jobSel === 'free' ? ' on' : '') + '" data-k="free"><em>—</em><b>Free drive</b><span>Explore the roads, look for salvage and park in any yard you like</span></button>';
    const mult = G.payMult();
    this.ov.innerHTML = '<div class="panel"><h1 style="font-size:calc(var(--u)*8)">' + N.name + '</h1><div class="sub">' + N.sub + ' · ' + TRUCKS[id].name + ' · ' + truckCls(id, G.cfg(id).parts) + '</div><div class="cols"><div><div class="jobs">' + list + '</div></div><div>' +
      this.conditionsHTML() + '<p style="margin-top:calc(var(--u)*2.2)">Pay for these conditions: <b style="color:var(--amber)">×' + mult.toFixed(2) + '</b></p>' +
      '<div class="row"><button class="btn amber" id="oStart" style="height:calc(var(--u)*10);font-size:calc(var(--u)*5);padding:0 calc(var(--u)*6)">Start</button><button class="btn light" id="oMap">Map</button><button class="btn light" id="oBack">Back</button></div></div></div></div>';
    this.ov.hidden = false; this.gar.hidden = true;
    this.wireSegs(() => this.showJobs());
    const jl = this.ov.querySelector('.jobs'); if (this.jobScroll) jl.scrollTop = this.jobScroll;
    this.ov.querySelectorAll('.job').forEach(b => b.addEventListener('pointerup', e => { if (this.jobDrag) return; e.preventDefault(); this.jobScroll = jl.scrollTop; G.jobSel = b.dataset.k; this.showJobs(); }));
    jl.addEventListener('pointerdown', () => { this.jobDrag = false; this.jobY = jl.scrollTop; }); jl.addEventListener('scroll', () => { if (Math.abs(jl.scrollTop - (this.jobY || 0)) > 6) this.jobDrag = true; });
    this.btn('oStart', () => {
      const k = G.jobSel; this.jobScroll = 0;
      if (k === 'free') G.startTravel(null); else if (k.indexOf('go:') === 0) G.startTravel(k.slice(3));
      else { const j = jobs.find(q => q.id === k); if (j && G.jobEstimate(j) !== null) G.startJob(j); else this.toast('This truck can\'t carry that', 'warn'); }
    });
    this.btn('oMap', () => G.openMap('jobs')); this.btn('oBack', () => G.toHub());
  }
  showMyJob() {
    const G = this.G, id = G.gid, cfg = G.cfg(), R = G.roadOf(), J = cfg.job, N = NODES[G.loc];
    const fuel = Math.round(cfg.fuel), fneed = d => G.fuelNeed(d), fwarn = d => fneed(d) > fuel ? '<small class="lowf">Fuel: about ' + fneed(d) + ' L needed, ' + fuel + ' L in the tank</small>' : '';
    const go = [], other = [];
    if (J) {
      const C = CARGO[J.cargo], atDest = !R && cfg.loc === J.to, d = atDest ? 0 : G.distFrom(J.to);
      const aboard = J.left + ' / ' + J.units + ' ' + C.units + ' aboard';
      if (atDest) go.push({ k: 'unload', em: '~' + money(G.jobValue(J) * J.left / J.units), b: 'Unload here', span: C.name + ' for ' + N.name + ' · ' + aboard, small: 'Drive in from the gate and unload' });
      else go.push({ k: 'go', em: km(d) + ' km', b: 'Carry on to ' + NODES[J.to].name, span: C.name + ' · ' + aboard + ' · ≈' + fneed(d) + ' L', small: R ? 'From where it stands, ' + G.whereText() : 'From ' + N.name, warn: fwarn(d) });
      const fee = Math.round(G.jobValue(J) * ABANDON_FEE / 10) * 10;
      other.push({ k: 'abandon', em: '−' + money(fee), b: 'Abandon the job', span: 'A ' + Math.round(ABANDON_FEE * 100) + '% fee. The load goes back to ' + NODES[J.from].name + ' and the truck stays ' + (R ? 'where it is' : 'here') + ', empty' });
    } else if (R) {
      const travel = Object.keys(NODES).filter(n => NODES[n].kind === 'yard').map(n => ({ n, d: G.distFrom(n) })).filter(q => q.d < Infinity).sort((a, b) => a.d - b.d);
      for (const q of travel.slice(0, 6)) go.push({ k: 'go:' + q.n, em: km(q.d) + ' km', b: 'Drive on to ' + NODES[q.n].name, span: NODES[q.n].sub + ' · ≈' + fneed(q.d) + ' L of fuel', warn: fwarn(q.d) });
      go.push({ k: 'free', em: '—', b: 'Free drive', span: 'Drive on from here and park in any yard you like' });
    }
    if (R) {
      const q = G.closestFrom({ edge: R.edge, s: R.s, dir: R.dir }, id === 'skt' && !!J);
      other.unshift({ k: 'tow', em: '−' + money(q.cost), b: 'Call a tow to ' + NODES[q.node].name, span: '+' + fmtTime(q.time) + ' on the clock' + (J ? (q.node === J.to ? ' · there you drive in and unload yourself' : ' · the job carries on from there') : '') });
    }
    if (!go.some(o => o.k === G.jobSel)) G.jobSel = go[0].k;
    if (R && R.crashed) for (const o of go) { o.dis = true; o.warn = '<small class="lowf">On its side: it needs a tow, or another of your trucks to fetch it</small>'; }
    const cardH = o => '<button class="job' + (o.k === G.jobSel ? ' on' : '') + (o.dis ? ' dis' : '') + '" data-k="' + o.k + '"><em>' + o.em + '</em><b>' + o.b + '</b><span>' + o.span + '</span>' + (o.small ? '<small>' + o.small + '</small>' : '') + (o.warn || '') + '</button>';
    const actH = o => '<button class="job act" id="j_' + o.k + '"><em>' + o.em + '</em><b>' + o.b + '</b><span>' + o.span + '</span></button>';
    const head = R ? 'On the road' : J && cfg.loc === J.to ? 'Delivery waiting' : 'Your load';
    const list = '<div class="jh">' + (J ? 'THE JOB' : 'DRIVE ON') + '</div>' + go.map(cardH).join('') + (other.length ? '<div class="jh">OR</div>' + other.map(actH).join('') : '') +
      (J ? '<p class="jnote">Deliver this load or give the job up to take other work.</p>' : '');
    this.ov.innerHTML = '<div class="panel"><h1 style="font-size:calc(var(--u)*8)">' + head + '</h1><div class="sub">' + TRUCKS[id].name + ' · ' + G.whereText() + (R && R.crashed ? ' · on its side' : '') + '</div><div class="cols"><div><div class="jobs">' + list + '</div></div><div>' +
      this.conditionsHTML() + '<p style="margin-top:calc(var(--u)*2.2)">The district clock moves while you drive, and tows and fuel calls add their time.</p>' +
      '<div class="row"><button class="btn amber" id="oStart" style="height:calc(var(--u)*10);font-size:calc(var(--u)*5);padding:0 calc(var(--u)*6)">Start</button><button class="btn light" id="oMap">Map</button><button class="btn light" id="oBack">Back</button></div></div></div></div>';
    this.ov.hidden = false; this.gar.hidden = true;
    this.wireSegs(() => this.showMyJob());
    this.ov.querySelectorAll('.job:not(.act)').forEach(b => b.addEventListener('pointerup', e => { e.preventDefault(); G.jobSel = b.dataset.k; this.showMyJob(); }));
    this.confirm('j_tow', () => G.towFromRoad()); this.confirm('j_abandon', () => G.abandonParked());
    this.btn('oStart', () => {
      const k = G.jobSel;
      if (k === 'go') G.continueJob(); else if (k === 'unload') G.unloadHere();
      else if (k === 'free') G.startTravel(null); else if (k.indexOf('go:') === 0) G.startTravel(k.slice(3));
    });
    this.btn('oMap', () => G.openMap('jobs')); this.btn('oBack', () => G.toHub());
  }
  showPause() {
    const G = this.G, s = G.settings, J = G.job, tr = G.truck, sp = G.spotHere();
    const keep = this.ov.querySelector('.panel'), top = keep && !this.ov.hidden ? keep.scrollTop : 0;
    const to = J.to ? NODES[J.to].name : '', loaded = J.kind === 'haul';
    const name = loaded ? CARGO[J.cargo].name + ' → ' + to : J.kind === 'recover' ? 'Fetch the ' + TRUCKS[J.truck].name + ' → ' + to : J.kind === 'rescue' ? 'Rescue → ' + to : J.kind === 'tow' ? 'Tow → ' + to : J.kind === 'travel' ? 'Driving to ' + to : 'Free drive';
    const card = '<div class="pcard"><b>' + name + '</b><span>' + TRUCKS[G.gid].name + ' · ' + G.spotText(sp) + ' · ' + fmtTime(G.runT) + ' driving</span></div>';
    // what you can do with the truck from here, and with the job
    const acts = [], cl = sp.node ? null : G.closestPlace();
    const giveUp = J.kind === 'rescue' || J.kind === 'tow' ? '. The tow job is given up' : '';
    acts.push({ id: 'oLeave', b: sp.node ? 'Park it here' : 'Leave it here', em: '', span: sp.node ? 'The drive ends in ' + NODES[sp.node].name + (loaded ? '. The job waits with the truck' : '') + giveUp : 'It waits at the roadside' + (loaded ? ', load and all' : '') + (tr.crashed ? ', on its side: it will need a tow' : '. Drive it on later, or fetch it with another of your trucks') + giveUp });
    if (cl) acts.push({ id: 'oTow', b: 'Tow to ' + NODES[cl.node].name, em: '−' + money(cl.cost) + ' · +' + fmtTime(cl.time), span: J.to && cl.node === J.to && J.kind !== 'free' ? 'It drops you at the gate: drive in and finish the job yourself' : loaded ? 'The drive ends there; the job carries on from there' : 'The drive ends there', confirm: true });
    if (tr.fuel < Math.max(15, tr.tank * 0.25)) { const q = G.fuelQuote(); if (q.add > 0) acts.push({ id: 'oFuel', b: 'Call a fuel truck', em: '−' + money(q.cost) + ' · +' + fmtTime(FUEL_CALL.time), span: q.add + ' L brought out to you, at fuel-truck prices', confirm: true }); }
    if (J.kind !== 'free' && J.kind !== 'travel') { const fee = loaded ? Math.round(G.jobValue(J) * ABANDON_FEE / 10) * 10 : 0; acts.push({ id: 'oAbandon', b: 'Abandon the job', em: fee ? '−' + money(fee) : '', span: loaded ? 'A ' + Math.round(ABANDON_FEE * 100) + '% fee. The load goes back to the sender and you drive on empty' : J.kind === 'recover' ? 'Unhook and leave the truck where it is' : 'Give it up and drive on', confirm: true }); }
    const actH = a => '<button class="job act" id="' + a.id + '"><em>' + a.em + '</em><b>' + a.b + '</b><span>' + a.span + '</span></button>';
    const gap = '<div style="height:calc(var(--u)*1.5)"></div>';
    this.ov.innerHTML = '<div class="panel"><div class="phead"><h1 style="font-size:calc(var(--u)*8)">Paused</h1><div class="row"><button class="btn amber" id="oResume">Resume</button><button class="btn light" id="oMap">Map</button><button class="btn light" id="oRestart">Restart drive</button></div></div><div class="cols"><div>' + card + '<div class="jobs pacts">' + acts.map(actH).join('') + '</div></div><div>' +
      this.conditionsHTML() +
      '<h2>Settings</h2>' + this.segs('sound', s.sound ? 'on' : 'off', [['on', 'Sound on'], ['off', 'Sound off']]) +
      gap + this.segs('quality', s.quality, [['auto', 'Graphics auto'], ['high', 'High'], ['low', 'Low']]) +
      gap + this.segs('fps', s.fps, [['auto', 'Frame rate auto'], ['60', '60 fps'], ['30', '30 fps · battery']]) +
      gap + this.segs('hold', s.autoHold ? 'on' : 'off', [['on', 'Auto-hold on'], ['off', 'Auto-hold off']]) +
      '<p style="margin-top:calc(var(--u)*2);font-size:calc(var(--u)*3.2);color:#cfc5b2">The gear knob and gearbox layouts are set on the start screen.</p>' +
      '</div></div></div>';
    this.ov.hidden = false;
    const pn = this.ov.querySelector('.panel'); if (pn && top) pn.scrollTop = top;
    this.wireSegs();
    this.btn('oResume', () => G.resume()); this.btn('oMap', () => G.openMap('pause')); this.btn('oRestart', () => G.restartJob());
    this.btn('oLeave', () => G.leaveHere()); this.confirm('oTow', () => G.towToClosest()); this.confirm('oFuel', () => G.fuelHelp()); this.confirm('oAbandon', () => G.abandonJob());
  }
  uPx() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 4; }
  // ---------- region map ----------
  showMap(here) {
    const G = this.G;
    this.ov.innerHTML = '<div class="mapwrap"><canvas id="mapCv"></canvas>' +
      '<div class="mapbar"><button class="btn light mz" id="mIn">+</button><button class="btn light mz" id="mOut">−</button><button class="btn light" id="mFit">Fit</button><button class="btn amber" id="mClose">Back</button></div>' +
      '<div class="mtitle"><b>ZIMNYAYA DISTRICT</b><span>' + (here ? 'Your drive so far' : 'Tap a place or a road') + '</span></div>' +
      '<div class="mapinfo" id="mInfo" hidden></div><div class="mhint" id="mHint">Tap a road or a place</div></div>';
    this.ov.hidden = false; this.gar.hidden = true; this.root.hidden = true;
    const cv = this.ov.querySelector('#mapCv'), mv = this.mapView || (this.mapView = new MapView(this));
    mv.sel = null; mv.open(cv, here);
    const redraw = () => { mv.render(); };
    let raf = 0; const soon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; mv.quick(); }); };
    const info = this.ov.querySelector('#mInfo'), hint = this.ov.querySelector('#mHint');
    mv.padR = 0; setTimeout(() => { hint.hidden = true; }, 3500);
    const select = sel => {
      mv.sel = sel;
      if (!sel) { info.hidden = true; mv.padR = 0; mv.clampView(); redraw(); return; }
      mv.render(); info.innerHTML = mv.infoHTML(sel) + '<button class="btn light mx" id="mX">Close</button>'; info.hidden = false; hint.hidden = true;
      const ir = info.getBoundingClientRect(), cr = cv.getBoundingClientRect(); mv.padR = Math.max(0, (cr.right - ir.left) * mv.dpr); mv.reveal(sel); redraw();
      const pc = info.querySelector('.mprof'); if (pc && sel.road) mv.drawProfile(pc, sel.road);
      info.querySelector('#mX').addEventListener('pointerdown', e => { e.preventDefault(); select(null); });
      const go = info.querySelector('#mGo'); if (go) go.addEventListener('pointerdown', e => { e.preventDefault(); const p = mv.M.places.find(q => q.id === sel.place); G.mapOpen = false; this.mapResize = null; G.startTravel(p.node); });
    };
    // pan with one finger, pinch with two, tap to pick
    const pts = new Map(); let start = null, moved = 0;
    cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {} pts.set(e.pointerId, [e.clientX, e.clientY]); start = { cx: mv.cx, cy: mv.cy, z: mv.zoom, p: [...pts.values()].map(q => q.slice()) }; moved = 0; });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId) || !start) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      const P = [...pts.values()], d = mv.dpr;
      if (P.length === 1 && start.p.length === 1) { const dx = (P[0][0] - start.p[0][0]) * d, dy = (P[0][1] - start.p[0][1]) * d; moved = Math.max(moved, Math.hypot(dx, dy)); mv.cx = start.cx - dx / mv.sc; mv.cy = start.cy + dy / mv.sc; mv.clampView(); soon(); }
      else if (P.length >= 2 && start.p.length >= 2) {
        const d0 = Math.hypot(start.p[0][0] - start.p[1][0], start.p[0][1] - start.p[1][1]), d1 = Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]);
        moved = 99; mv.cx = start.cx; mv.cy = start.cy; mv.zoom = start.z; mv.setZoom(start.z * d1 / Math.max(10, d0), (P[0][0] + P[1][0]) / 2 * d, (P[0][1] + P[1][1]) / 2 * d); soon();
      }
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
      if (moved < 8 * mv.dpr && start && start.p.length === 1 && pts.size === 0) { const r = cv.getBoundingClientRect(); select(mv.pick((e.clientX - r.left) * mv.dpr, (e.clientY - r.top) * mv.dpr)); }
      start = pts.size ? { cx: mv.cx, cy: mv.cy, z: mv.zoom, p: [...pts.values()].map(q => q.slice()) } : null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); mv.setZoom(mv.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), (e.clientX - r.left) * mv.dpr, (e.clientY - r.top) * mv.dpr); soon(); }, { passive: false });
    this.btn('mIn', () => { mv.setZoom(mv.zoom * 1.5); redraw(); }); this.btn('mOut', () => { mv.setZoom(mv.zoom / 1.5); redraw(); });
    this.btn('mFit', () => { mv.fit(); redraw(); }); this.btn('mClose', () => G.closeMap());
    this.mapResize = () => { mv.resize(); mv.clampView(); redraw(); };
  }
  showResults(r) {
    const G = this.G;
    const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v));
    const pay = r.pay.filter(p => Math.round(p[1]) !== 0).map(p => '<span>' + p[0] + '</span><span>' + sg(Math.round(p[1])) + '</span>').join('');
    const rows = r.rows.map(x => '<span>' + x[0] + '</span><span>' + x[1] + '</span>').join('');
    this.ov.innerHTML = '<div class="panel"><h1 style="font-size:calc(var(--u)*8)">' + r.title + '</h1>' + (r.note ? '<p>' + r.note + '</p>' : '') + '<div class="cols"><div><div class="stats">' + rows + '</div></div><div><div class="stats">' + pay +
      '<span class="tot">Total</span><span class="tot">' + sg(Math.round(r.total)) + '</span></div>' + (r.wear ? '<p style="margin-top:calc(var(--u)*2)">' + r.wear + '</p>' : '') + '</div></div>' +
      '<div class="row"><button class="btn amber" id="oGar">' + (r.ok ? 'Continue' : 'Back to the yard') + '</button><button class="btn light" id="oAgain">' + (r.ok ? 'Jobs here' : 'Try again') + '</button></div></div>';
    this.ov.hidden = false; this.root.hidden = true;
    this.btn('oGar', () => G.toHub()); this.btn('oAgain', () => { if (r.ok) { G.toHub(); G.openJobs(); } else G.restartJob(); });
  }
  // ---------- garage ----------
  renderGarage() {
    const G = this.G, id = G.gid, d = TRUCKS[id], cfg = G.cfg();
    const owned = G.ownsTruck(id);
    this.$('gName').textContent = d.name; this.$('gCls').textContent = truckCls(d.id, G.cfg(d.id).parts) + (owned ? '' : ' · for sale');
    const N = NODES[G.loc], R = G.roadOf(), J = cfg.job;
    this.$('gLoc').textContent = R ? G.whereText() : 'at ' + N.name + (N.garage ? ' · workshop' : '');
    this.$('gGo').textContent = owned ? (R ? 'On the road ▶' : J ? (G.loc === J.to ? 'Unload here ▶' : 'Your load ▶') : 'Jobs here ▶') : 'Buy · ' + money(d.price || 0);
    this.$('gCash').textContent = money(G.cash);
    const box = this.$('gCards');
    if (!owned) {
      this.$('gTabs').innerHTML = '';
      box.innerHTML = '<div class="gcard" style="width:calc(var(--u)*72)"><span class="cat">FOR SALE</span><b>' + d.name + '</b><p>' + truckCls(id, cfg.parts) + '. The district motor pool asks <b style="display:inline;color:#7a4d0e">' + money(d.price || 0) + '</b> for it — you have ' + money(G.cash) + '. Parts, fuel and repairs are extra once it is yours.</p><span class="ft"><span class="tag"></span><button class="sbtn" data-act="buytruck"' + (G.cash < (d.price || 0) ? ' disabled' : '') + '>Buy · ' + money(d.price || 0) + '</button></span></div>';
      box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.garageAct(b.dataset.act, b.dataset.cat, b.dataset.id); }));
      this.renderStats();
      return;
    }
    // the fuel tab shows what is in the tank, red when it is getting low
    const cap = G.tankCap(), fl = Math.min(cfg.fuel, cap), low = fl < cap * 0.2;
    this.$('gTabs').innerHTML = TABS.map(([k, n]) => '<button class="gtab ' + (k === G.gTab ? 'on' : '') + (k === 'fuel' && low ? ' low' : '') + '" data-k="' + k + '">' + (k === 'fuel' ? n + ' · ' + Math.round(fl) + ' L' : n) + '</button>').join('');
    this.$('gTabs').querySelectorAll('.gtab').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); if (b.dataset.k === 'fuel' && G.gTab !== 'fuel') G.fuelSel = null; G.gTab = b.dataset.k; G.gSel = null; this.renderGarage(); }));
    if (G.gTab === 'paint') box.innerHTML = this.paintHTML(cfg);
    else if (G.gTab === 'body') box.innerHTML = (id === 'skt' ? '<div class="gnote">These work on the drawn 143H; only the beacon is drawn on it so far.</div>' : '') + Object.keys(CABS).filter(pid => CABS[pid].trucks.includes(id)).map(pid => this.partCard('cab', pid, cfg)).join('') + (Object.keys(ADDONS).filter(k => ADDONS[k].trucks.includes(id)).map(k => this.addonCard(k, cfg)).join('') || '<div class="gnote">No add-ons for this truck.</div>');
    else if (G.gTab === 'service') box.innerHTML = this.serviceHTML(cfg);
    else if (G.gTab === 'fuel') box.innerHTML = this.fuelHTML();
    else box.innerHTML = TAB_CATS[G.gTab].map(cat => Object.keys(PARTCATS[cat]).filter(pid => PARTCATS[cat][pid].trucks.includes(id)).map(pid => this.partCard(cat, pid, cfg)).join('')).join('');
    if (!G.workshopHere() && G.gTab !== 'paint' && G.gTab !== 'fuel') box.innerHTML = '<div class="gnote">' + (R ? 'Out on the road: no workshop here.' : 'No workshop at ' + N.name + '.') + ' Parts and repairs at Camp No 7 or Sawmill No 3.</div>' + box.innerHTML;
    if (G.gTab === 'fuel') this.wireFuel(box);
    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.garageAct(b.dataset.act, b.dataset.cat, b.dataset.id); }));
    box.querySelectorAll('.gcard[data-cat]').forEach(b => b.addEventListener('pointerdown', e => { if (e.target.closest('[data-act]')) return; G.gSel = [b.dataset.cat, b.dataset.id]; this.renderStats(); box.querySelectorAll('.gcard').forEach(x => x.classList.toggle('sel', x === b)); }));
    this.renderStats();
  }
  partCard(cat, pid, cfg) {
    const G = this.G, p = PARTCATS[cat][pid], st = G.partState(cat, pid);
    let act = '';
    if (st === 'fitted') act = '<span class="tag ok">Fitted ✓</span>';
    else if (st === 'owned') act = '<span class="tag find">' + (G.isFound(cat, pid) ? 'Salvaged' : 'Owned') + '</span><button class="sbtn gr" data-act="fit" data-cat="' + cat + '" data-id="' + pid + '">Fit</button>';
    else if (st === 'locked') act = '<span class="tag">Needs ' + TUNES[p.needs].name.replace('Tune ', '') + '</span>';
    else act = '<span class="tag"></span><button class="sbtn" data-act="buy" data-cat="' + cat + '" data-id="' + pid + '"' + (G.cash < p.price ? ' disabled' : '') + '>Buy · ' + money(p.price) + '</button>';
    const sel = G.gSel && G.gSel[0] === cat && G.gSel[1] === pid ? ' sel' : '';
    return '<div class="gcard' + sel + '" data-cat="' + cat + '" data-id="' + pid + '"><span class="cat">' + CATNAME[cat].toUpperCase() + '</span><b>' + p.name + '</b><p>' + p.desc + '<br><span style="color:#2a2520;font-weight:700">' + partSpec(cat, p) + '</span></p><span class="ft">' + act + '</span></div>';
  }
  addonCard(k, cfg) {
    const G = this.G, a = ADDONS[k], on = !!(cfg.addons && cfg.addons[k]), owned = G.ownsAddon(k);
    let act;
    if (on) act = '<span class="tag ok">Fitted ✓</span><button class="sbtn gr" data-act="addon" data-id="' + k + '">Remove</button>';
    else if (owned) act = '<span class="tag">Owned</span><button class="sbtn gr" data-act="addon" data-id="' + k + '">Fit</button>';
    else act = '<span class="tag"></span><button class="sbtn" data-act="buyaddon" data-id="' + k + '"' + (G.cash < a.price ? ' disabled' : '') + '>Buy · ' + money(a.price) + '</button>';
    // an add-on that sits on another one (the loaded rack on the cage) waits until that one is owned
    if (!on && a.needs && !G.ownsAddon(a.needs)) act = '<span class="tag">Needs the ' + ADDONS[a.needs].name.toLowerCase() + '</span><button class="sbtn" disabled>' + (owned ? 'Fit' : 'Buy · ' + money(a.price)) + '</button>';
    return '<div class="gcard"><span class="cat">BODY</span><b>' + a.name + '</b><p>' + a.desc + '<br><span style="color:#2a2520;font-weight:700">+' + a.mass + ' kg</span></p><span class="ft">' + act + '</span></div>';
  }
  paintHTML(cfg) {
    const p = cfg.paint, sw = (k, cur) => '<div class="sw">' + COLORS.map(([h, n]) => '<button class="swatch ' + (h === cur ? 'on' : '') + '" style="background:' + h + '" data-act="paint" data-cat="' + k + '" data-id="' + h + '" aria-label="' + n + '"></button>').join('') + '</div>';
    const chips = (k, obj, cur) => '<div class="chips">' + Object.keys(obj).map(v => '<button class="chipb ' + (v === cur ? 'on' : '') + '" data-act="paint" data-cat="' + k + '" data-id="' + v + '">' + obj[v] + '</button>').join('') + '</div>';
    // a drawn truck without livery zones takes one colour: the magenta in the drawing
    const ak = geomKey(this.G.gid, cfg.parts);
    if (TRUCKS[this.G.gid].art && !(ART_IMG[ak] && ART_IMG[ak].src.zones)) return '<div class="pgrp"><h4>Body colour</h4>' + sw('c1', p.c1) + '</div><div class="gnote">Drawn truck: the magenta parts of the drawing take this colour.</div>';
    return '<div class="pgrp"><h4>Body colour</h4>' + sw('c1', p.c1) + '</div><div class="pgrp"><h4>Trim colour</h4>' + sw('c2', p.c2) + '</div>' +
      '<div class="pgrp"><h4>Livery</h4>' + chips('livery', LIVERIES, p.livery) + '</div><div class="pgrp"><h4>Rims</h4>' + chips('rims', RIMS, p.rims) + '</div>' +
      '<div class="pgrp"><h4>Door number</h4><div class="num"><button class="sbtn gr" data-act="num" data-id="-1">−</button><span>' + p.num + '</span><button class="sbtn gr" data-act="num" data-id="1">+</button></div><p style="margin:0;font-size:calc(var(--u)*3.1);color:#cfc5b2">Paint and liveries are free.</p></div>';
  }
  serviceHTML(cfg) {
    const G = this.G, rows = [];
    const bar = c => '<div class="cond"><i class="' + (c < 0.35 ? 'b' : c < 0.7 ? 'w' : '') + '" style="width:' + Math.round(c * 100) + '%"></i></div>';
    const eff = { engine: c => 'Power −' + Math.round(28 * (1 - c)) + '%', gearbox: c => c < 0.45 ? 'Slow shifts, misses gears' : 'Shifts ' + Math.round(80 * (1 - c)) + '% slower', tires: c => 'Grip −' + Math.round(14 * (1 - c)) + '%' + (c < 0.25 ? ', punctures' : ''), springs: c => 'Damping −' + Math.round(35 * (1 - c)) + '%' };
    for (const cat of WEARCATS) {
      const pid = cfg.parts[cat], c = G.partCond(cat), cost = G.repairCost(cat);
      rows.push('<div class="gcard"><span class="cat">' + CATNAME[cat].toUpperCase() + '</span><b>' + PARTCATS[cat][pid].name + '</b>' + bar(c) + '<p>' + Math.round(c * 100) + '% · ' + eff[cat](c) + '</p><span class="ft"><span class="tag"></span>' + (cost > 0 ? '<button class="sbtn" data-act="repair" data-cat="' + cat + '"' + (G.cash < cost ? ' disabled' : '') + '>Repair · ' + money(cost) + '</button>' : '<span class="tag ok">Like new</span>') + '</span></div>');
    }
    const bc = cfg.body === undefined ? 1 : cfg.body, bcost = G.repairCost('body');
    rows.push('<div class="gcard"><span class="cat">BODY</span><b>Cab and frame</b>' + bar(bc) + '<p>' + Math.round(bc * 100) + '% · ' + (bc < 0.5 ? 'Rusty and bent' : 'Dents and scrapes') + '</p><span class="ft"><span class="tag"></span>' + (bcost > 0 ? '<button class="sbtn" data-act="repair" data-cat="body"' + (G.cash < bcost ? ' disabled' : '') + '>Repair · ' + money(bcost) + '</button>' : '<span class="tag ok">Like new</span>') + '</span></div>');
    const dirt = cfg.dirt || 0;
    rows.push('<div class="gcard"><span class="cat">WASH</span><b>Pressure wash</b>' + bar(1 - dirt) + '<p>' + (dirt > 0.05 ? 'Mud and slush ' + Math.round(dirt * 100) + '%' : 'Clean') + '</p><span class="ft"><span class="tag"></span>' + (dirt > 0.05 ? '<button class="sbtn gr" data-act="wash">Wash · ' + money(60) + '</button>' : '<span class="tag ok">Clean</span>') + '</span></div>');
    const all = WEARCATS.reduce((s, c) => s + G.repairCost(c), 0) + bcost;
    if (all > 0) rows.push('<div class="gcard"><span class="cat">SERVICE</span><b>Full service</b><p>Repair everything in one go.</p><span class="ft"><span class="tag"></span><button class="sbtn" data-act="repairall"' + (G.cash < all ? ' disabled' : '') + '>Repair all · ' + money(all) + '</button></span></div>');
    return rows.join('');
  }
  // ---------- fuel: as much as you like, wherever it is sold; a fuel truck comes out where it isn't ----------
  fuelHTML() {
    const G = this.G, o = G.fuelOffer(), N = NODES[G.loc], T = FUEL_NAME[o.type], lpkm = G.cfg().lpkm;
    if (G.fuelSel === undefined || G.fuelSel === null || G.fuelSel > o.buyMax) G.fuelSel = o.buyMax;
    const pct = v => (v / o.cap * 100).toFixed(2) + '%';
    const tank = '<div class="gcard"><span class="cat">TANK · ' + T.toUpperCase() + '</span><b>' + Math.round(o.have) + ' / ' + o.cap + ' L</b>' +
      '<div class="cond"><i class="' + (o.have < o.cap * 0.2 ? 'b' : o.have < o.cap * 0.4 ? 'w' : '') + '" style="width:' + pct(o.have) + '"></i></div>' +
      '<p>About ' + Math.floor(o.have / lpkm) + ' km left at ' + lpkm.toFixed(1) + ' L/km. ' + Math.round(o.have * FUEL_KG[o.type]) + ' kg of fuel aboard: less fuel, lighter truck.</p></div>';
    const head = o.pump ? 'PUMP · ' + N.name.toUpperCase() : 'FUEL TRUCK FROM THE DEPOT · UP TO ' + FUEL_TRUCK.max + ' L';
    const what = o.pump ? T + ' · ' + o.unit.toFixed(1) + ' ₽/L' : o.other ? 'No ' + T.toLowerCase() + ' here' : 'No pump here';
    const sub = o.pump ? G.econ.fuelWord(G.loc) : o.unit.toFixed(1) + ' ₽/L + ' + money(o.fee) + ' call-out';
    const pre = [[25, '+25 L'], [50, '+50 L'], [100, '+100 L'], [o.max, o.pump ? 'Fill up' : 'Max']].map(([v, n]) => '<button class="sbtn gr fp" data-fl="' + Math.min(v, o.buyMax) + '"' + (o.buyMax <= 0 ? ' disabled' : '') + '>' + n + '</button>').join('');
    const pump = '<div class="gcard fuel"><span class="cat">' + head + '</span><b>' + what + ' <small>' + sub + '</small></b>' +
      '<div class="fpre">' + pre + '</div>' +
      '<div class="fsl" id="fSl"><i style="width:' + pct(o.have) + '"></i><em id="fSel"></em><u style="left:' + pct(Math.min(o.cap, o.have + o.buyMax)) + '"></u><span class="th" id="fTh"></span></div>' +
      '<span class="ft"><span class="tag" id="fTxt"></span><button class="sbtn" id="fBuy"></button></span></div>';
    const near = G.nearestPumps(4).map(q => '<li><span>' + NODES[q.id].name + '</span><span>' + q.price.toFixed(1) + ' ₽/L · ' + km(q.d) + ' km</span></li>').join('');
    const pumps = '<div class="gcard near"><span class="cat">NEAREST ' + T.toUpperCase() + ' PUMPS</span><ul class="fnear">' + (near || '<li><span>None you can reach</span></li>') + '</ul></div>';
    return tank + pump + pumps;
  }
  fuelUpdate() {
    const G = this.G, o = G.fuelOffer(), L = Math.round(clamp(G.fuelSel || 0, 0, o.buyMax));
    const e = this.$('fSel'), th = this.$('fTh'), tx = this.$('fTxt'), b = this.$('fBuy'); if (!e) return;
    const p = v => (v / o.cap * 100).toFixed(2) + '%';
    e.style.left = p(o.have); e.style.width = p(L); th.style.left = p(o.have + L);
    tx.textContent = o.room <= 0 ? 'Tank full' : '+' + L + ' L → ' + Math.round(o.have + L) + ' L' + (o.credit && L > 0 ? ' · on credit' : '');
    b.textContent = o.room <= 0 ? 'Full' : (o.pump ? 'Refuel' : 'Order') + (L > 0 ? ' · ' + money(o.fee + L * o.unit) : '');
    b.disabled = L <= 0;
  }
  wireFuel(box) {
    const G = this.G, sl = box.querySelector('#fSl'); if (!sl) return;
    // drag along the tank to pick how full it should be; it snaps to 5 L, and to the top when close
    const set = e => {
      const r = sl.getBoundingClientRect(), o = G.fuelOffer(), v = clamp((e.clientX - r.left) / r.width, 0, 1) * o.cap - o.have;
      G.fuelSel = v >= o.buyMax - 2.5 ? o.buyMax : clamp(Math.round(v / 5) * 5, 0, o.buyMax); this.fuelUpdate();
    };
    sl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { sl.setPointerCapture(e.pointerId); } catch (_) { } this.fDrag = true; set(e); });
    sl.addEventListener('pointermove', e => { if (this.fDrag) set(e); });
    const up = () => { this.fDrag = false; }; sl.addEventListener('pointerup', up); sl.addEventListener('pointercancel', up);
    box.querySelectorAll('.fp').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.fuelSel = +b.dataset.fl; this.fuelUpdate(); }));
    this.$('fBuy').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.refuel(G.fuelSel); });
    this.fuelUpdate();
  }
  renderStats() {
    const G = this.G, id = G.gid, cfg = G.cfg(), s = truckStats(id, cfg);
    let p = null, label = '';
    if (G.gSel && PARTCATS[G.gSel[0]]) { const pc = JSON.parse(JSON.stringify(cfg)); pc.parts[G.gSel[0]] = G.gSel[1]; p = truckStats(id, pc); label = PARTCATS[G.gSel[0]][G.gSel[1]].name; }
    const row = (n, v, pv, unit, dec, better) => {
      const f = x => (dec ? x.toFixed(dec) : Math.round(x).toLocaleString('en-US')) + (unit || '');
      let d = '';
      if (pv !== undefined && Math.abs(pv - v) > (dec ? 0.05 : 0.5)) { const up = (pv > v) === (better !== false); d = '<span class="' + (up ? 'up' : 'dn') + '">' + (pv > v ? '+' : '−') + (dec ? Math.abs(pv - v).toFixed(dec) : Math.round(Math.abs(pv - v))) + '</span>'; }
      return '<span>' + n + '</span><span>' + f(v) + '</span>' + (d || '<span></span>');
    };
    const P = p || {};
    this.$('gStats').innerHTML = '<h3>' + (label ? 'If you fit: ' + label : 'Truck stats') + '</h3><div class="st">' +
      row('Power', s.hp, P.hp, ' hp') + row('Torque', s.tq, P.tq, ' Nm') +
      row('Gears', s.gears, P.gears, s.auto ? ' auto' : '') + row('Top speed', s.vmax, P.vmax, ' km/h') +
      row('Crawl (1st)', s.crawl, P.crawl, ' km/h', 1, false) + row('Pull (1st)', s.pull, P.pull, ' kN') +
      row('Weight', s.mass, P.mass, ' kg', 0, false) + row('Clearance', s.clear, P.clear, ' cm') + '</div>';
  }
}
