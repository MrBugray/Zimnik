// ===== truck geometry (local metres: x forward, y up, origin on the frame centre line) =====
// load slots: the centre of each item, bottom tier first
function tiers(xs, ys) { const out = []; for (const y of ys) for (const x of xs) out.push([x, y]); return out; }
const GEOM = {
  bars: {
    mass: 6800, com: [0.35, -0.05], Icom: 30000, engineAt: [3.0, 0.35],
    r: 0.56, wheelMass: 300, axles: [2.6, -0.75, -2.0], anchorY: -0.49,
    hz: [6.4, 6.4, 6.4], damp: 1.1, up: 0.17, down: 0.22, clearance: 0.36,
    final: 7.34, eff: 0.86, brakeT: 9500, cd: 0.85, area: 6.6, tank: 170,
    fixtures: [
      ['box', 3.5, 0.15, 0.2, -0.02, 'frame'], ['box', 1.05, 0.15, 0.78, -0.31, 'belly'], ['box', 2.1, 0.14, -1.25, 0.26, 'bed'],
      ['box', 0.09, 0.68, 0.82, 1.08, 'head'],
      ['poly', [[0.95, 0.12], [2.45, 0.12], [2.45, 0.86], [2.36, 1.30], [2.12, 1.43], [1.05, 1.43], [0.95, 1.32]], 'cab'],
      ['poly', [[2.45, 0.12], [3.72, 0.10], [3.68, 0.70], [3.48, 0.80], [2.45, 0.86]], 'hood'],
    ],
    hitch: [-3.48, -0.12], hook: [3.98, -0.12],
    bed: { x0: -3.4, x1: 0.75, y: 0.40 },
    cargo: {
      logs: { kind: 'logs', hw: 2.3, hh: 0.21, mass: 950, brk: 8, slots: [0, 1, 2, 3].map(k => [-1.62, 0.615 + k * 0.43]) },
      drums: { kind: 'drum', hw: 0.29, hh: 0.44, mass: 200, brk: 4.2, slots: tiers([0.42, -0.21, -0.84, -1.47, -2.10, -2.73], [0.845, 1.735]) },
      crates: { kind: 'crate', hw: 0.46, hh: 0.38, mass: 240, brk: 5, slots: tiers([0.25, -0.70, -1.65, -2.60], [0.785, 1.555]) },
      planks: { kind: 'planks', hw: 2.3, hh: 0.3, mass: 1400, brk: 7, slots: [[-1.45, 0.705], [-1.45, 1.31]] },
    },
    exhaust: [[0.92, 2.02]], head: [3.3, 0.36], tail: [-3.43, 0.06], cabGlow: [1.8, 1.0],
    roof: [1.08, 2.12, 1.43], // roof x0, x1, y
    bullbar: [3.78, 0.04, 0.84], snorkel: [2.38, 0.86],
    lightbarAt: [1.6, 1.63], beaconAt: [1.35, 1.43], antenna: [1.12, 1.43],
  },
  // Polaris 750 '65, Lucas's flat-art F-600-type truck, two bodies on one chassis (3.5 m wheelbase). This one is the
  // single-cab pickup: 35" (0.88 m) road tyres, cab roof 2.27 m above the ground, a 2.5 m bed with high sides and its
  // floor 1.0 m up, 5.7 m long. Measured off his 2K side view (528 px per metre). Origin: 1.0 m above the ground at
  // mid-wheelbase. Each axle hangs at its own height so that, settled on its springs, the wheels rest where the drawing
  // has them. The crew-cab flatbed is GEOM.ccf (the 'cab' part picks the body).
  cc: {
    mass: 2300, com: [0.25, -0.05], Icom: 7600, engineAt: [1.75, -0.05],
    r: 0.442, wheelMass: 200, axles: [1.75, -1.75], anchorY: -0.62, anchorYs: [-0.625, -0.604],
    hz: [5.4, 6.4], damp: 0.9, up: 0.22, down: 0.20, clearance: 0.34,
    final: 4.56, eff: 0.87, brakeT: 6200, cd: 0.75, area: 4.4, tank: 150,
    fixtures: [
      ['box', 2.65, 0.05, -0.35, -0.52, 'frame'],
      ['poly', [[-0.36, -0.53], [1.08, -0.53], [1.08, 0.64], [0.80, 1.16], [0.66, 1.27], [-0.22, 1.27], [-0.36, 1.18]], 'cab'],
      ['poly', [[1.08, -0.45], [2.52, -0.45], [2.52, 0.46], [2.40, 0.54], [1.08, 0.61]], 'hood'],
      ['box', 0.065, 0.125, 2.565, -0.335, 'bumper'],
      ['box', 1.24, 0.05, -1.73, -0.05, 'bed'],
      ['box', 0.02, 0.23, -0.47, 0.23, 'headboard'],
      ['box', 0.02, 0.23, -2.98, 0.23, 'gate'],
      ['box', 0.55, 0.05, 0.35, -0.58, 'belly'],
      ['box', 0.08, 0.08, -3.03, -0.39, 'hitch'],
    ],
    gate: null,
    hitch: [-3.12, -0.39], hook: [2.66, -0.33],
    bed: { x0: -2.95, x1: -0.50, y: 0.0 },
    // in the bed between the tailgate and the bed's front wall (2.45 m): two pulp bundles, four drums or two crates a tier
    cargo: {
      pulp: { kind: 'pulp', hw: 0.5, hh: 0.42, mass: 900, brk: 8, slots: [[-2.43, 0.425], [-1.39, 0.425]] },
      drums: { kind: 'drum', hw: 0.29, hh: 0.44, mass: 200, brk: 4.2, slots: tiers([-2.66, -2.06, -1.46, -0.86], [0.445, 1.335]) },
      crates: { kind: 'crate', hw: 0.46, hh: 0.38, mass: 240, brk: 5, slots: tiers([-2.47, -1.53], [0.385, 1.155]) },
    },
    // stack: [x, y, lean forward, first puff radius, jet speed] (its cap opens up and back)
    exhaust: [[-0.58, 1.43, -0.3, 0.06, 0.5]], head: [2.53, 0.28], tail: [-3.03, 0.12], cabGlow: [0.30, 0.95],
    roof: [-0.22, 0.66, 1.27],
    lamps: [[2.53, 0.28, '#fff1cc', 0.45], [2.47, -0.06, '#ffb43a', 0.25]],
    bullbar: [2.75, -0.1, 0.9], snorkel: [1.15, 0.6],
    lightbarAt: [0.70, 1.37], beaconAt: [-0.12, 1.27], rackBeacon: [0.86, 1.445], antenna: [-0.25, 1.27],
    // on the drawn body: the door number and the company mark on the door, lettering on the bed side above the fender
    decals: { num: [0.62, 0.36, 0.08], logo: [0.62, 0.36, 0.09], name: [-1.72, 0.33, 0.09], rescue: [-1.72, 0.33, 0.11] },
  },
  // the Polaris as a crew-cab flatbed: lifted on 37" (0.95 m) lugged tyres, four doors, a 2.2 m steel deck 1.17 m up
  // behind a headache rack, 5.6 m long. Off his 2K side view (474 px per metre); same origin rule as the pickup.
  ccf: {
    mass: 2700, com: [0.40, 0.05], Icom: 9000, engineAt: [1.75, -0.05],
    r: 0.476, wheelMass: 230, axles: [1.75, -1.75], anchorY: -0.60, anchorYs: [-0.601, -0.561],
    hz: [5.4, 6.4], damp: 0.9, up: 0.22, down: 0.20, clearance: 0.40,
    final: 4.9, eff: 0.87, brakeT: 6800, cd: 0.8, area: 4.8, tank: 150,
    fixtures: [
      ['box', 2.55, 0.08, -0.45, -0.20, 'frame'],
      ['poly', [[-0.33, -0.44], [1.33, -0.44], [1.33, 0.66], [1.10, 1.15], [1.02, 1.18], [-0.30, 1.18], [-0.33, 1.14]], 'cab'],
      ['poly', [[1.33, -0.30], [2.45, -0.30], [2.45, 0.36], [2.36, 0.56], [1.33, 0.65]], 'hood'],
      ['box', 0.06, 0.11, 2.46, -0.25, 'bumper'],
      ['box', 1.11, 0.07, -1.89, 0.10, 'bed'],
      ['box', 0.045, 0.52, -0.655, 0.69, 'headboard'],
      ['box', 0.02, 0.05, -2.99, 0.22, 'gate'],
      ['box', 0.65, 0.05, 0.45, -0.48, 'belly'],
      ['box', 0.05, 0.06, -2.96, -0.06, 'hitch'],
    ],
    gate: null,
    hitch: [-3.03, -0.06], hook: [2.55, -0.25],
    bed: { x0: -2.98, x1: -0.80, y: 0.17 },
    // on the deck, between its back edge and the headache rack (2.2 m): two pulp bundles, three drums or two crates a tier
    cargo: {
      pulp: { kind: 'pulp', hw: 0.5, hh: 0.42, mass: 900, brk: 8, slots: [[-2.46, 0.595], [-1.42, 0.595]] },
      drums: { kind: 'drum', hw: 0.29, hh: 0.44, mass: 200, brk: 4.2, slots: tiers([-2.68, -2.07, -1.46], [0.615, 1.505]) },
      crates: { kind: 'crate', hw: 0.46, hh: 0.38, mass: 240, brk: 5, slots: tiers([-2.49, -1.55], [0.555, 1.325]) },
    },
    exhaust: [[-0.51, 1.37, -0.15, 0.06, 0.5]], head: [2.44, 0.15], tail: [-3.0, -0.03], cabGlow: [0.45, 0.85],
    roof: [-0.30, 1.02, 1.18],
    lamps: [[2.44, 0.15, '#fff1cc', 0.5], [2.21, 0.33, '#ffb43a', 0.22], [1.0, 1.22, '#ffb43a', 0.2], [-0.87, 0.10, '#ffb43a', 0.18]],
    bullbar: [2.65, -0.1, 0.9], snorkel: [1.40, 0.6],
    lightbarAt: [0.95, 1.29], beaconAt: [0.55, 1.18], rackBeacon: [0.90, 1.357], antenna: [-0.2, 1.18],
    // the door number on the front door, the company mark on the rear door, lettering on the bonnet side
    decals: { num: [0.92, 0.10, 0.08], logo: [0.05, 0.10, 0.09], name: [1.86, 0.30, 0.07], rescue: [0.05, 0.10, 0.10] },
  },
  // Skinnerd 143H: Scania T143H-class bonneted cab (front axle under the short bonnet, 1.3 m bumper to axle, 2.4 m axle
  // to back of cab, cab roof 2.9 m and spoiler 3.45 m above the ground, 1.08 m tires) on a 6x4 rigid chassis with a
  // 5.9 m wheelbase to the bogie and a 5.5 m flatbed. Origin: top of the frame (1.08 m above the ground).
  sk: {
    mass: 10500, com: [0.75, 0.06], Icom: 69000, engineAt: [3.2, 0.3],
    r: 0.54, wheelMass: 420, axles: [3.0, -2.22, -3.58], anchorY: -0.525,
    hz: [4.4, 4.9, 4.9], damp: 1.0, up: 0.13, down: 0.17, clearance: 0.29,
    final: 4.1, eff: 0.88, brakeT: 15000, cd: 0.85, area: 8.2, tank: 300,
    fixtures: [
      ['box', 4.56, 0.14, -0.55, -0.14, 'frame'],
      ['poly', [[0.62, -0.05], [2.56, -0.05], [2.56, 0.94], [2.41, 1.68], [2.30, 1.80], [0.62, 1.80]], 'cab'],
      ['poly', [[0.62, 1.80], [1.82, 1.80], [1.0, 2.32], [0.62, 2.38]], 'spoiler'],
      ['poly', [[2.56, -0.12], [4.26, -0.12], [4.26, 0.76], [4.16, 0.86], [2.56, 0.94]], 'hood'],
      ['box', 0.17, 0.23, 4.15, -0.35, 'bumper'],
      ['box', 2.63, 0.15, -2.47, 0.15, 'bed'],
      ['box', 0.06, 1.0, 0.26, 1.30, 'headboard'],
      ['box', 0.82, 0.24, 0.67, -0.49, 'belly'],
      ['box', 0.07, 0.11, -5.12, -0.20, 'hitch'],
    ],
    gate: ['box', 0.035, 0.40, -5.06, 0.70, 'gate'],
    hitch: [-5.24, -0.20], hook: [4.34, -0.40],
    bed: { x0: -5.08, x1: 0.15, y: 0.30 },
    cargo: {
      pulp: { kind: 'pulp', hw: 0.62, hh: 0.62, mass: 1650, brk: 8, slots: [-0.52, -1.80, -3.08, -4.36].map(x => [x, 0.925]) },
      logs: { kind: 'logs', hw: 2.3, hh: 0.21, mass: 1000, brk: 8, slots: [0, 1, 2, 3].map(k => [-2.45, 0.515 + k * 0.43]) },
      drums: { kind: 'drum', hw: 0.29, hh: 0.44, mass: 200, brk: 4.2, slots: tiers([-0.20, -0.83, -1.46, -2.09, -2.72, -3.35, -3.98, -4.61], [0.745, 1.635]) },
      crates: { kind: 'crate', hw: 0.46, hh: 0.38, mass: 240, brk: 5, slots: tiers([-0.40, -1.35, -2.30, -3.25, -4.20], [0.685, 1.455]) },
      planks: { kind: 'planks', hw: 2.3, hh: 0.3, mass: 1400, brk: 7, slots: [[-2.45, 0.605], [-2.45, 1.21]] },
    },
    exhaust: [[0.46, 2.62]], head: [4.27, 0.02], tail: [-5.10, 0.20], cabGlow: [1.8, 1.22],
    roof: [0.62, 2.30, 1.80],
    bullbar: [4.40, -0.55, 0.90], snorkel: [2.6, 0.9],
    lightbarAt: [2.30, 1.96], beaconAt: [2.10, 1.80], antenna: [0.9, 2.33],
  },
};
// Skinnerd 143H tractor, drawn by Lucas: measured from his side view (1.08 m tyres = 490 px per metre). 6x4 with
// 4.07 m from the front axle to the bogie and 1.33 m between the rear axles, fifth wheel just ahead of the bogie
// centre. Each axle hangs at its own height so that, settled on its springs, every wheel rests where the drawing has
// it. Lamps, the stack opening and the lower exhaust outlet are where the drawing has them.
GEOM.skt = Object.assign({}, GEOM.sk, {
  mass: 8600, com: [1.15, 0.08], Icom: 40000, tandem: true,
  axles: [3.0, -1.067, -2.393], anchorYs: [-0.686, -0.606, -0.578],
  fixtures: [
    ['box', 3.275, 0.155, 0.025, -0.165, 'frame'],
    ['poly', [[0.82, 0.0], [2.95, 0.0], [3.0, 0.92], [2.66, 1.84], [0.82, 1.90]], 'cab'],
    ['poly', [[3.0, -0.2], [4.36, -0.2], [4.36, 0.72], [4.25, 0.75], [3.0, 0.95]], 'hood'],
    ['box', 0.21, 0.14, 4.18, -0.38, 'bumper'],
    ['box', 0.95, 0.32, 1.25, -0.35, 'belly'],
    ['box', 0.42, 0.08, -1.55, 0.12, 'fifth'],
    ['box', 0.07, 0.11, -3.22, -0.20, 'hitch'],
  ],
  hitch: [-3.32, -0.20], hook: [4.42, -0.40], fifth: [-1.55, 0.20],
  bed: { x0: -3.2, x1: 0.3, y: 0.14 }, cargo: null, gate: null,
  // stack: [x, y, lean forward, first puff radius, jet speed]; the lower pipe coughs when the throttle comes on
  exhaust: [[0.60, 2.12, 0.35, 0.11, 0.65]], exhaust2: [0.29, -0.62, -1, -0.22],
  head: [4.37, -0.06], tail: [-3.2, -0.19], cabGlow: [2.2, 1.3], roof: [0.82, 2.66, 1.90],
  // lit with the lights on: headlamp and indicator at the front corner, marker lamp on the roof
  lamps: [[4.04, -0.07, '#fff1cc', 0.55], [4.03, 0.03, '#ffb43a', 0.32], [2.45, 1.79, '#ffb43a', 0.38]],
  lightbarAt: [2.45, 2.02], beaconAt: [1.7, 1.95], antenna: [1.0, 1.95], bullbar: [4.45, -0.55, 0.9], snorkel: [0.85, 2.1],
});
GEOM.sk.tandem = true;
// trailers: origin at the kingpin, deck underside at y = 0 (1.30 m above the ground on the tractor's fifth wheel)
function trailerGeom(o) {
  return Object.assign({
    com: [-5.6, 0.1], engineAt: [-5, 0], r: 0.52, wheelMass: 300, anchorY: -0.80, hz: [4.2, 4.2], damp: 1.0, up: 0.13, down: 0.16, clearance: 0.40,
    final: 4.1, eff: 0.88, brakeT: 13000, cd: 0.55, area: 7.5, tank: 0, hitch: [-11.3, -0.35], hook: [0.6, -0.1], kingpin: [0, -0.02],
    exhaust: [[-5, 1]], head: [0.5, 0], tail: [-11.25, -0.12], cabGlow: [-5, 0], roof: [-5, -4, 0], bullbar: [0, 0, 0], snorkel: [0, 0], lightbarAt: [-5, 0], beaconAt: [-5, 0], antenna: [-5, 0], trailer: true,
  }, o);
}
GEOM.tr_flat = trailerGeom({
  mass: 6200, Icom: 70000, axles: [-9.0, -10.3],
  fixtures: [['box', 6.1, 0.17, -5.1, -0.05, 'frame'], ['box', 0.5, 0.25, 0.3, -0.2, 'neck']],
  bed: { x0: -11.2, x1: 1.0, y: 0.12 },
  cargo: {
    crates: { kind: 'crate', hw: 0.46, hh: 0.38, mass: 240, brk: 5, slots: tiers([0.45, -0.52, -1.49, -2.46, -3.43, -4.40, -5.37, -6.34, -7.31], [0.505, 1.275]) },
    planks: { kind: 'planks', hw: 2.3, hh: 0.3, mass: 1400, brk: 7, slots: tiers([-1.65, -6.45], [0.425, 1.03, 1.635]) },
    drums: { kind: 'drum', hw: 0.29, hh: 0.44, mass: 200, brk: 4.2, slots: tiers([0.55, -0.08, -0.71, -1.34, -1.97, -2.60, -3.23, -3.86, -4.49, -5.12, -5.75, -6.38, -7.01, -7.64], [0.565]) },
    pulp: { kind: 'pulp', hw: 0.62, hh: 0.62, mass: 1650, brk: 8, slots: [0.25, -1.03, -2.31, -3.59, -4.87, -6.15, -7.43, -8.71].map(x => [x, 0.745]) },
  },
});
GEOM.tr_logs = trailerGeom({
  mass: 5600, Icom: 62000, axles: [-9.0, -10.3],
  fixtures: [['box', 5.9, 0.15, -4.9, -0.1, 'frame'], ['box', 0.5, 0.25, 0.3, -0.2, 'neck']],
  bed: { x0: -10.9, x1: 0.6, y: 0.2 },
  cargo: { logs: { kind: 'logs', hw: 2.3, hh: 0.21, mass: 1000, brk: 8, slots: tiers([-2.35, -7.75], [0.415, 0.845, 1.275, 1.705]) } },
});
GEOM.tr_tank = trailerGeom({
  mass: 6800, Icom: 68000, axles: [-8.8, -10.1],
  fixtures: [['box', 6.0, 0.14, -5.0, -0.08, 'frame'], ['poly', [[0.6, 0.0], [-11.0, 0.0], [-11.0, 1.6], [-10.4, 2.05], [0.0, 2.05], [0.6, 1.6]], 'tank']],
  bed: { x0: -11.0, x1: 0.6, y: 2.05 },
  cargo: { fuel: { bulk: true, units: 14, mass: 1000, at: [-5.2, 1.0] } },
});
GEOM.tr_tip = trailerGeom({
  mass: 7200, Icom: 52000, axles: [-6.7, -8.0], hitch: [-9.0, -0.35], tail: [-8.95, -0.12], com: [-4.6, 0.3],
  fixtures: [['box', 4.7, 0.15, -4.0, -0.08, 'frame'], ['poly', [[0.7, 0.05], [-8.7, 0.05], [-8.9, 1.75], [0.6, 1.75]], 'box']],
  bed: { x0: -8.8, x1: 0.7, y: 1.75 },
  cargo: { coal: { bulk: true, units: 16, mass: 1000, at: [-4.2, 1.0] }, gravel: { bulk: true, units: 16, mass: 1000, at: [-4.2, 1.0] } },
});
function shapeOf(f) {
  if (f[0] === 'box') return planck.Box(f[1], f[2], planck.Vec2(f[3], f[4]), 0);
  return planck.Polygon(f[1].map(p => planck.Vec2(p[0], p[1])));
}
// v0.6: trucks, trailers and loads a little heavier: the tyres press harder, grip more and push through to the firm
// base under deep snow (see postStep). Tankers and tippers carry a tonne more.
const LOAD_K = { pulp: 1.09, logs: 1.15, drums: 1.05, crates: 1.1, planks: 1.15 };
for (const id in GEOM) {
  const g = GEOM[id]; g.mass = Math.round(g.mass * 1.1 / 50) * 50; g.Icom *= 1.1;
  if (g.cargo) for (const k in g.cargo) { const q = g.cargo[k]; if (q.bulk) q.units += 1; else if (LOAD_K[k]) q.mass = Math.round(q.mass * LOAD_K[k] / 5) * 5; }
}
