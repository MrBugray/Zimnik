// ===== data: parts, trucks, jobs, finds =====
const RPM = 60 / TAU; // rad/s -> rpm
// surface order for grip tables: snow, deep, ice, gravel, ruts, rock, wood, slabs

const ENGINES = {
  zil60: { name: '6.0 V8 petrol', trucks: ['bars'], price: 0, fuel: 'gas', idle: 650, red: 3200, I: 1.0, f0: 26, f1: 0.042, stall: 1700,
    torque: [[400, 200], [800, 300], [1200, 365], [1800, 410], [2400, 398], [2800, 372], [3200, 330], [3600, 150]],
    up: [1650, 2850], down: [950, 1500], clutch: [820, 1300], launch: 450, lpk: 0.33, mass: 0, desc: 'Stock army V8. Thirsty and short of breath.' },
  kd108: { name: '10.8 V8 diesel', trucks: ['bars'], price: 9800, fuel: 'diesel', idle: 600, red: 2600, I: 2.2, f0: 38, f1: 0.05, stall: 1300,
    torque: [[400, 380], [800, 600], [1200, 690], [1600, 680], [2000, 625], [2400, 560], [2600, 520], [2800, 140]],
    up: [1300, 2300], down: [800, 1150], clutch: [720, 1100], launch: 300, lpk: 0.25, mass: 260, desc: 'Pulls hard from idle and saves fuel.' },
  v862: { name: '6.2 V8 petrol', trucks: ['cc'], price: 0, fuel: 'gas', idle: 700, red: 4000, I: 0.75, f0: 22, f1: 0.03, stall: 2100,
    torque: [[500, 250], [1000, 380], [1600, 450], [2400, 480], [3000, 465], [3600, 420], [4000, 360], [4400, 140]],
    up: [2000, 3700], down: [1100, 2100], clutch: [900, 1400], launch: 500, lpk: 0.34, mass: 0, desc: 'Stock small-block. Revs freely, drinks freely.' },
  v875: { name: '7.5 V8 big-block', trucks: ['cc'], price: 6400, fuel: 'gas', idle: 650, red: 3800, I: 0.95, f0: 26, f1: 0.035, stall: 1950,
    torque: [[500, 320], [1000, 520], [1600, 620], [2400, 650], [3000, 610], [3400, 560], [3800, 480], [4200, 160]],
    up: [1900, 3500], down: [1050, 2000], clutch: [850, 1300], launch: 450, lpk: 0.36, mass: 90, desc: 'More torque everywhere, more fuel too.' },
  v8sk: { name: '14.2 V8 diesel 450', trucks: ['sk'], price: 0, fuel: 'diesel', idle: 550, red: 2000, I: 3.4, f0: 50, f1: 0.06, stall: 1200,
    torque: [[400, 700], [700, 1500], [1000, 2050], [1300, 2100], [1500, 1960], [1800, 1720], [2000, 1580], [2200, 300]],
    up: [1250, 1850], down: [780, 1100], clutch: [620, 950], launch: 250, lpk: 0.23, mass: 0, desc: 'Stock. Effortless torque from idle.' },
  v8sk5: { name: '14.2 V8 diesel 500', trucks: ['sk'], price: 12500, fuel: 'diesel', idle: 550, red: 2000, I: 3.5, f0: 52, f1: 0.06, stall: 1200,
    torque: [[400, 760], [700, 1650], [1000, 2250], [1300, 2300], [1500, 2160], [1800, 1900], [2000, 1740], [2200, 320]],
    up: [1250, 1850], down: [780, 1100], clutch: [620, 950], launch: 250, lpk: 0.235, mass: 20, desc: 'More boost: 2300 Nm.' },
  i683: { name: '8.3 turbo diesel I6', trucks: ['cc'], price: 11500, fuel: 'diesel', idle: 600, red: 2600, I: 1.9, f0: 34, f1: 0.045, stall: 1500,
    torque: [[500, 450], [800, 700], [1100, 900], [1400, 960], [1800, 920], [2200, 820], [2600, 700], [2800, 180]],
    up: [1300, 2350], down: [800, 1200], clutch: [700, 1050], launch: 300, lpk: 0.24, mass: 320, desc: 'Huge low-end torque, lower top speed.' },
};
const GEARBOXES = {
  g5zil: { name: '5-speed manual', trucks: ['bars'], price: 0, type: 'amt', ratios: [9.6, 4.10, 2.29, 1.47, 1.00], rev: 9.0, shift: 0.42, desc: 'Stock. A crawler first, then big jumps between gears.' },
  g10kz: { name: '10-speed range-splitter', trucks: ['bars'], price: 6800, type: 'amt', ratios: [10.1, 8.25, 5.70, 4.65, 3.20, 2.61, 1.80, 1.47, 1.00, 0.815], rev: 9.5, shift: 0.36, desc: 'Close ratios, small rpm drop per shift.' },
  g5cc: { name: '5-speed manual', trucks: ['cc'], price: 0, type: 'amt', ratios: [6.40, 3.84, 2.36, 1.48, 1.00], rev: 6.0, shift: 0.42, desc: 'Stock gearbox.' },
  g10cc: { name: '5-speed + 2-speed axle', trucks: ['cc'], price: 3600, type: 'amt', ratios: [6.40, 4.84, 3.84, 2.90, 2.36, 1.78, 1.48, 1.12, 1.00, 0.755], labels: ['1', '1+', '2', '2+', '3', '3+', '4', '4+', '5', '5+'], rev: 6.0, shift: 0.38, desc: 'Splits every gear in two.' },
  g12sk: { name: '12-speed range-splitter', trucks: ['sk'], price: 0, type: 'amt', ratios: [11.32, 9.16, 7.19, 5.82, 4.57, 3.70, 2.90, 2.35, 1.86, 1.50, 1.17, 1.00], rev: 10.8, shift: 0.48, desc: 'Stock. Close steps, slow heavy shifts.' },
  g14sk: { name: '12-speed + 2 crawlers', trucks: ['sk'], price: 4800, type: 'amt', ratios: [15.9, 13.4, 11.32, 9.16, 7.19, 5.82, 4.57, 3.70, 2.90, 2.35, 1.86, 1.50, 1.17, 1.00], labels: ['C1', 'C2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], rev: 15.0, shift: 0.48, desc: 'Two extra-low gears instead of a low range.' },
  g6cc: { name: '6-speed automatic', trucks: ['cc'], price: 7900, type: 'tc', ratios: [3.49, 1.86, 1.41, 1.00, 0.75, 0.65], rev: 5.03, shift: 0.22, stallTR: 2.1, desc: 'Torque converter. Smooth shifts, no torque gaps.' },
};
for (const id in GEARBOXES) GEARBOXES[id].id = id;
// The gear knob: where each gearbox's gears sit. cols is the H, one [up, down] pair of slots per column. tab is the
// lever on the knob's side: a range lever takes effect when the knob next goes into a slot, a split or axle lever
// (split: true) shifts at once. btn is a splitter switch. gear(slot, tab, btn) gives the gear in that slot: negative
// numbers are the reverse gears (-1 the lowest), null nothing. revs: the reverse ratios, split where the gearbox
// splits its gears, so a splitter or range box has more than one reverse.
const KNOB_PREF = { sk12: 'a' };   // the Skinnerd 12-speed: 'a' Lucas's LO / INT / DIR lever, 'b' range lever + splitter
const H5 = [['1', '2'], ['3', '4'], ['5', 'R']];
const GATES = {
  g5zil: { look: 'ball', cols: H5, home: 1, gear: s => s === 'R' ? -1 : +s },
  g5cc: { look: 'ball', cols: H5, home: 1, gear: s => s === 'R' ? -1 : +s },
  g10cc: { look: 'ball', cols: H5, home: 1, tab: { name: 'AXLE', pos: ['LO', 'HI'], split: true }, revs: [6.0, 4.54], revLabels: ['R', 'R+'],
    gear: (s, t) => s === 'R' ? (t === 'HI' ? -2 : -1) : (+s - 1) * 2 + (t === 'HI' ? 2 : 1) },
  g10kz: { look: 'ball', cols: H5, home: 1, tab: { name: 'SPLIT', pos: ['L', 'H'], split: true }, revs: [9.5, 7.76],
    gear: (s, t) => s === 'R' ? (t === 'H' ? -2 : -1) : (+s - 1) * 2 + (t === 'H' ? 2 : 1) },
  g12sk_a: { look: 'chrome', cols: [['R', 'a'], ['b', 'c'], ['d', null]], home: 1, tab: { name: 'RANGE', pos: ['LO', 'INT', 'DIR'] }, revs: [10.8, 8.74, 7.07],
    gear: (s, t) => s === 'R' ? -1 - ['LO', 'INT', 'DIR'].indexOf(t) : { LO: 0, INT: 4, DIR: 8 }[t] + { a: 1, b: 2, c: 3, d: 4 }[s] },
  g12sk_b: { look: 'chrome', cols: [['R', '1'], ['2', '3']], home: 0.5, tab: { name: 'RANGE', pos: ['LO', 'HI'] }, btn: { name: 'SPLIT', pos: ['L', 'H'] }, revs: [10.8, 8.74, 2.77, 2.24],
    gear: (s, t, b) => s === 'R' ? -1 - (t === 'HI' ? 2 : 0) - (b === 'H' ? 1 : 0) : (t === 'HI' ? 6 : 0) + (+s - 1) * 2 + (b === 'H' ? 2 : 1) },
  // with the two crawlers: the free bottom-right slot (a) or a slot of their own (b) takes C1 and C2
  g14sk_a: { look: 'chrome', cols: [['R', 'a'], ['b', 'c'], ['d', 'C']], home: 1, tab: { name: 'RANGE', pos: ['LO', 'INT', 'DIR'] }, revs: [15.0, 12.1, 9.8],
    gear: (s, t) => s === 'R' ? -1 - ['LO', 'INT', 'DIR'].indexOf(t) : s === 'C' ? (t === 'LO' ? 1 : t === 'INT' ? 2 : null) : 2 + { LO: 0, INT: 4, DIR: 8 }[t] + { a: 1, b: 2, c: 3, d: 4 }[s] },
  g14sk_b: { look: 'chrome', cols: [['R', '1'], ['2', '3'], ['C', null]], home: 1, tab: { name: 'RANGE', pos: ['LO', 'HI'] }, btn: { name: 'SPLIT', pos: ['L', 'H'] }, revs: [15.0, 12.1, 3.85, 3.11],
    gear: (s, t, b) => s === 'R' ? -1 - (t === 'HI' ? 2 : 0) - (b === 'H' ? 1 : 0) : s === 'C' ? (t === 'LO' ? (b === 'H' ? 2 : 1) : null) : 2 + (t === 'HI' ? 6 : 0) + (+s - 1) * 2 + (b === 'H' ? 2 : 1) },
  g6cc: { look: 'auto', cols: [['R', 'D']], home: 0, gear: s => s === 'R' ? -1 : s === 'D' ? 1 : null },
};
function gateOf(gb) { const id = gb.id || gb; return GATES[id] || GATES[id + '_' + KNOB_PREF.sk12] || GATES.g5cc; }
function revLabel(gate, i) { const n = gate.revs ? gate.revs.length : 1; return gate.revLabels ? gate.revLabels[i] : n > 1 ? 'R' + (i + 1) : 'R'; }
const TIRES = {
  mil: { name: 'Military cross-country', trucks: ['bars'], price: 0, grip: [1.05, 1.10, 0.95, 0.98, 1.08, 1.0, 1.0, 0.95], roll: 1.05, wear: 1.0, look: 'mil', desc: 'Stock. Good all round in snow.' },
  at: { name: 'All-terrain', trucks: ['cc', 'sk'], price: 0, grip: [1, 1, 1, 1, 1, 1, 1, 1], roll: 1, wear: 1, look: 'at', desc: 'Stock. Balanced everywhere.' },
  mt: { name: 'Mud-terrain', trucks: ['cc', 'bars', 'sk'], price: 2200, grip: [1.08, 1.18, 0.85, 0.95, 1.14, 1.06, 0.98, 0.92], roll: 1.15, wear: 1.2, look: 'mt', desc: 'Big lugs bite deep snow and ruts. Poor on ice.' },
  win: { name: 'Studded winter', trucks: ['cc', 'bars', 'sk'], price: 2600, grip: [1.06, 1.0, 2.1, 0.96, 1.0, 0.94, 1.05, 1.0], roll: 1.05, wear: 1.1, look: 'win', desc: 'Studs grip ice. Average in deep snow.' },
  hwy: { name: 'Highway', trucks: ['cc', 'sk'], price: 1200, grip: [0.86, 0.8, 0.92, 1.08, 0.85, 1.0, 1.05, 1.12], roll: 0.85, wear: 0.8, look: 'hwy', desc: 'Low rolling resistance, weak off-road.' },
  chains: { name: 'Snow chains', trucks: ['cc', 'bars', 'sk'], price: 900, grip: [1.2, 1.15, 2.8, 0.9, 1.15, 0.86, 0.9, 0.8], roll: 1.25, wear: 2.5, look: 'chain', maxKmh: 45, desc: 'Best on ice and snow. Over 45 km/h on rock or concrete they tear.' },
};
const LIFTS = {
  // dr: tire radius added to the stock size (Polaris pickup 35", flatbed 37.5"); on the pickup a lift brings the
  // lugged off-road tyres (the picture changes too)
  l0: { name: 'Stock height', trucks: ['cc', 'bars', 'sk'], price: 0, lift: 0, dr: 0, desc: 'Stock ride height and tire size.' },
  l2: { name: 'Lift + 2" bigger tires', trucks: ['cc'], price: 2400, lift: 0.06, dr: 0.025, desc: 'Lugged off-road tyres, 5 cm taller. More clearance, slightly taller gearing.' },
  l4: { name: 'Lift + 4" bigger tires', trucks: ['cc'], price: 4200, lift: 0.12, dr: 0.05, desc: 'The biggest lugged tyres. Most clearance, higher centre of gravity.' },
};
const SPRINGS = {
  s0: { name: 'Stock springs', trucks: ['cc', 'bars', 'sk'], price: 0, hz: 0, damp: 0, travel: 1, desc: 'Stock.' },
  sh: { name: 'Heavy-duty springs', trucks: ['cc', 'bars', 'sk'], price: 1600, hz: 1.2, damp: 0.15, travel: 0.95, desc: 'Less sag with cargo, harsher on bumps.' },
  sl: { name: 'Long-travel springs', trucks: ['cc', 'bars', 'sk'], price: 2300, hz: -0.9, damp: -0.05, travel: 1.4, desc: 'More wheel travel over rough ground.' },
};
const BRAKES = {
  b0: { name: 'Stock brakes', trucks: ['cc', 'bars', 'sk'], price: 0, k: 1, desc: 'Stock.' },
  bh: { name: 'Heavy-duty brakes', trucks: ['cc', 'bars', 'sk'], price: 1400, k: 1.35, desc: 'Stronger stopping and hill hold.' },
};
const TUNES = {
  t0: { name: 'Stock tune', trucks: ['cc', 'bars', 'sk'], price: 0, k: 1, fuel: 1, heat: 1, desc: 'Factory settings.' },
  t1: { name: 'Tune stage 1', trucks: ['cc', 'bars', 'sk'], price: 1500, k: 1.06, fuel: 1.04, heat: 1.05, needs: 't0', desc: '+6% torque.' },
  t2: { name: 'Tune stage 2', trucks: ['cc', 'bars', 'sk'], price: 3200, k: 1.12, fuel: 1.09, heat: 1.12, needs: 't1', desc: '+12% torque, runs hotter.' },
  t3: { name: 'Tune stage 3', trucks: ['cc', 'bars', 'sk'], price: 5400, k: 1.18, fuel: 1.15, heat: 1.22, needs: 't2', desc: '+18% torque. Needs a good radiator.' },
};
const RADIATORS = {
  r0: { name: 'Stock radiator', trucks: ['cc', 'bars', 'sk'], price: 0, k: 1, desc: 'Stock cooling.' },
  rh: { name: 'Heavy-duty radiator', trucks: ['cc', 'bars', 'sk'], price: 1300, k: 1.6, desc: 'Keeps a hard-working engine cool.' },
};
const CTISS = {
  none: { name: 'No CTIS', trucks: ['cc', 'sk'], price: 0, desc: 'Tire pressure can only be changed when stopped.' },
  ctis: { name: 'Central tire inflation', trucks: ['cc', 'bars', 'sk'], price: 3200, desc: 'Change tire pressure while driving.' },
};
// the Polaris's body: Lucas's single-cab pickup or crew-cab flatbed on the same chassis (geom: its geometry and picture)
const CABS = {
  sc: { name: 'Single-cab pickup', trucks: ['cc'], price: 0, geom: 'cc', cls: '4×4 single-cab pickup', desc: 'Stock. A 2.5 m bed with high sides: loads stay in. Road tyres.' },
  cf: { name: 'Crew-cab flatbed', trucks: ['cc'], price: 5800, geom: 'ccf', cls: '4×4 crew-cab flatbed', desc: 'Four doors, a 2.2 m steel deck behind a headache rack, lifted on 37" lugged tyres. Heavier; nothing but a low lip keeps loads on.' },
};
const TANKS = {
  k1: { name: 'Standard tank', trucks: ['cc', 'bars', 'sk'], price: 0, extra: 0, desc: 'Stock fuel tank.' },
  k2: { name: 'Extra tank', trucks: ['cc', 'bars', 'sk'], price: 1500, extra: 130, mass: 45, desc: '+130 L range.' },
};
const PARTCATS = { engine: ENGINES, gearbox: GEARBOXES, tires: TIRES, lift: LIFTS, springs: SPRINGS, brakes: BRAKES, tune: TUNES, radiator: RADIATORS, ctis: CTISS, tank: TANKS, cab: CABS };
const CATNAME = { engine: 'Engine', gearbox: 'Gearbox', tires: 'Tires', lift: 'Lift & tire size', springs: 'Springs', brakes: 'Brakes', tune: 'Engine tune', radiator: 'Radiator', ctis: 'Tire inflation', tank: 'Fuel tank', cab: 'Cab & bed' };
const WEARCATS = ['engine', 'gearbox', 'tires', 'springs'];
const ADDONS = {
  // the Polaris's expedition kit, off Lucas's parts sheet: cage, a loaded rack on top of it, rock sliders with a tank
  cage: { name: 'Expedition cage', trucks: ['cc'], price: 1900, mass: 160, desc: 'Roll cage over the cab and bed, with a ladder and a rack frame on top. Carries the roof rack.' },
  rack: { name: 'Loaded roof rack', trucks: ['cc'], price: 900, mass: 140, needs: 'cage', desc: 'Crates and 60 L in jerry cans on top of the cage. Fitting it fits the cage too. Raises the centre of gravity.' },
  sliders: { name: 'Rock sliders + tank', trucks: ['cc'], price: 1400, mass: 90, desc: 'Steel sliders under the cab with an 80 L side tank. Saves the sills on rocks.' },
  bullbar: { name: 'Bull bar', trucks: ['cc', 'bars', 'sk'], price: 900, mass: 110, desc: 'Cuts front damage in hard hits. Adds weight up front.' },
  lightbar: { name: 'Roof light bar', trucks: ['cc', 'bars', 'sk'], price: 650, mass: 20, desc: 'Four extra lamps for night and fog.' },
  beacon: { name: 'Amber beacon', trucks: ['cc', 'bars', 'sk', 'skt'], price: 300, mass: 5, desc: 'Rescue jobs pay 10% more.' },
  stakes: { name: 'Stake bed + tailgate', trucks: ['sk'], price: 700, mass: 150, desc: 'Stops loose cargo sliding off the back.' },
  snorkel: { name: 'Raised air intake', trucks: ['cc', 'bars', 'sk'], price: 1200, mass: 15, desc: 'No power loss from snow in the air filter.' },
};
// fuel the add-ons carry: jerry cans on the rack, the side tank on the sliders
function addonFuel(a) { return a ? (a.rack ? 60 : 0) + (a.sliders ? 80 : 0) : 0; }
const COLORS = [['#2f8f8a', 'Teal'], ['#b8322a', 'Fire red'], ['#2f5d3a', 'Forest'], ['#e6e2d6', 'Arctic white'], ['#2d5d9a', 'Cobalt'], ['#d9741f', 'Hunter orange'],
  ['#2a2a2c', 'Black'], ['#c9a227', 'Mustard'], ['#6b7552', 'Army green'], ['#7d8794', 'Steel grey'], ['#5b2f4a', 'Plum'], ['#b56e3e', 'Copper']];
const LIVERIES = { plain: 'Plain', two: 'Two-tone', lower: 'Two-tone lower', band: 'Door band', stripe: 'Side stripe', company: 'Company', rescue: 'Rescue' };
const RIMS = { polished: 'Polished alloy', white: 'White steel', black: 'Black steel', army: 'Army green', bronze: 'Bronze steel' };
const RIM_HEX = { polished: '#cdd2d4', white: '#e9e6de', black: '#3a3836', army: '#6f7452', bronze: '#8a6a48' };

const TRUCKS = {
  // Lucas's flat-art F-600-type truck: a single-cab pickup (stock) or a crew-cab flatbed, cargo in the bed or on the deck
  cc: { id: 'cc', name: "Polaris 750 '65", cls: '4×4 single-cab pickup', drive: '4×4', price: 0, art: true,
    stock: { engine: 'v862', gearbox: 'g5cc', tires: 'at', lift: 'l0', springs: 's0', brakes: 'b0', tune: 't0', radiator: 'r0', ctis: 'none', tank: 'k1', cab: 'sc' },
    paint: { c1: '#b56e3e', c2: '#e6e2d6', livery: 'plain', rims: 'bronze', num: 18 } },
  bars: { id: 'bars', name: 'Bars-131', cls: '6×6 army truck', drive: '6×6', price: 24000,
    stock: { engine: 'zil60', gearbox: 'g5zil', tires: 'mil', lift: 'l0', springs: 's0', brakes: 'b0', tune: 't0', radiator: 'r0', ctis: 'ctis', tank: 'k1' },
    paint: { c1: '#6b7552', c2: '#545d40', livery: 'plain', rims: 'army', num: 7 } },
  // Scania T143H-class bonneted truck as a 6x4 rigid with a 5.5 m flatbed: fast on roads, no front drive
  sk: { id: 'sk', name: 'Skinnerd 143H', cls: '6×4 timber flatbed', drive: '6×4', awd: false, price: 38000,
    stock: { engine: 'v8sk', gearbox: 'g12sk', tires: 'hwy', lift: 'l0', springs: 's0', brakes: 'b0', tune: 't0', radiator: 'r0', ctis: 'none', tank: 'k1' },
    paint: { c1: '#d8cfa5', c2: '#7a2a2e', livery: 'lower', rims: 'polished', num: 43 } },
  // the same truck as a 6x4 tractor: fifth wheel over the bogie, pulls whatever trailer the job needs. Drawn by Lucas
  // (art: the picture in src/44_art_img.js; the magenta in it takes the body colour)
  skt: { id: 'skt', name: 'Skinnerd 143H tractor', cls: '6×4 tractor · trailers', drive: '6×4', awd: false, price: 52000, tractor: true, art: true,
    stock: { engine: 'v8sk', gearbox: 'g12sk', tires: 'hwy', lift: 'l0', springs: 's0', brakes: 'b0', tune: 't0', radiator: 'r0', ctis: 'none', tank: 'k1' },
    paint: { c1: '#2d5d9a', c2: '#e6e2d6', livery: 'band', rims: 'polished', num: 44 } },
};
// the tractor shares every Skinnerd part (no stake bed: it pulls trailers)
for (const cat in PARTCATS) for (const pid in PARTCATS[cat]) { const p = PARTCATS[cat][pid]; if (p.trucks.includes('sk') && !p.trucks.includes('skt')) p.trucks.push('skt'); }
for (const k in ADDONS) if (ADDONS[k].trucks.includes('sk') && k !== 'stakes') ADDONS[k].trucks.push('skt');
// trailers: which one the yard hitches up for a cargo
const TRAILERS = {
  tr_flat: { id: 'tr_flat', name: 'Flatbed trailer', cargo: ['crates', 'planks', 'drums', 'pulp'], awd: false, drive: 'trailer' },
  tr_logs: { id: 'tr_logs', name: 'Log trailer', cargo: ['logs'], awd: false, drive: 'trailer' },
  tr_tank: { id: 'tr_tank', name: 'Tanker trailer', cargo: ['fuel'], awd: false, drive: 'trailer' },
  tr_tip: { id: 'tr_tip', name: 'Tipper trailer', cargo: ['coal', 'gravel'], awd: false, drive: 'trailer' },
};
const TRAILER_FOR = {}; for (const id in TRAILERS) for (const c of TRAILERS[id].cargo) TRAILER_FOR[c] = id;
const TRAILER_PARTS = { engine: 'v8sk', gearbox: 'g12sk', tires: 'hwy', lift: 'l0', springs: 's0', brakes: 'b0', tune: 't0', radiator: 'r0', ctis: 'none', tank: 'k1' };
function trailerCfg(id) { return { parts: Object.assign({}, TRAILER_PARTS), addons: {}, pcond: {}, paint: { c1: '#5b6066', c2: '#c8372c', livery: 'plain', rims: 'white', num: 0 }, body: 1, dirt: 0.15 }; }
// how many of a cargo a truck carries (the load slots in its geometry)
// (parts: the truck's fitted parts, for a truck whose body is a part: the Polaris pickup or flatbed)
function capOf(id, cargo, parts) {
  if (id === 'skt') { const t = TRAILER_FOR[cargo]; return t ? capOf(t, cargo) : 0; }
  const g = GEOM[geomKey(id, parts)], k = g && g.cargo && g.cargo[cargo]; return k ? (k.bulk ? k.units : k.slots.length) : 0;
}
function unitKg(id, cargo, parts) {
  if (id === 'skt') { const t = TRAILER_FOR[cargo]; return t ? unitKg(t, cargo) : UNIT_KG[cargo]; }
  const g = GEOM[geomKey(id, parts)], k = g && g.cargo && g.cargo[cargo]; return k && k.mass ? k.mass : UNIT_KG[cargo];
}
// which geometry and picture a truck uses: the Polaris's cab part picks its body (GEOM.cc pickup, GEOM.ccf flatbed)
function geomKey(id, parts) { return id === 'cc' && parts && CABS[parts.cab] && CABS[parts.cab].geom ? CABS[parts.cab].geom : id; }
function truckCls(id, parts) { const c = parts && CABS[parts.cab]; return c && c.trucks.indexOf(id) >= 0 && c.cls ? c.cls : TRUCKS[id].cls; }
function stockCfg(id) { const d = TRUCKS[id]; return { parts: Object.assign({}, d.stock), addons: {}, pcond: {}, paint: Object.assign({}, d.paint), body: 1, dirt: 0 }; }
