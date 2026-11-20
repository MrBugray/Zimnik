// ===== world: the road network around Lespromkhoz No 7 =====
// Places (yards) and junctions are nodes; roads are edges with a hand-made side-on profile. A drive is assembled
// from them as you go: the start yard, then a road, the junction pad, the road you pick there, and so on until the
// yard you are heading for, which ends in a wall, a fence or the riverbank. Every road can be driven both ways.
// Map positions are metres (x east, y north); alt is the height above the camp yard.
const NODES = {
  camp: { name: 'Lespromkhoz No 7', sub: 'logging camp · garage', kind: 'yard', at: [-40, -6], alt: 0, icon: 'camp', garage: true },
  xjct: { name: 'Crossroads', sub: 'camp road junction', kind: 'jct', at: [320, 42], alt: 6, pad: 'snow' },
  fork: { name: 'The fork', sub: 'three roads east', kind: 'jct', at: [760, 90], alt: 4, pad: 'snow' },
  sjct: { name: 'Mill junction', sub: 'where the east roads meet', kind: 'jct', at: [1700, 235], alt: 8, pad: 'snow' },
  mill: { name: 'Sawmill No 3', sub: 'sawmill · workshop', kind: 'yard', at: [2160, 300], alt: 10, icon: 'mill', garage: true },
  icej: { name: 'Ice junction', sub: 'on the river ice', kind: 'jct', at: [1330, -510], alt: -6, pad: 'ice' },
  bridgej: { name: 'Bridge junction', sub: 'past the old bridge', kind: 'jct', at: [1880, -60], alt: 13.2, pad: 'gravel' },
  depot: { name: 'Fuel depot', sub: 'Neftebaza', kind: 'yard', at: [-600, -260], alt: -2, icon: 'tank' },
  port: { name: 'River landing', sub: 'winter port', kind: 'yard', at: [230, -690], alt: -4, icon: 'port' },
  cut12: { name: 'Cutting No 12', sub: 'logging site', kind: 'yard', at: [560, 800], alt: 30, icon: 'cut' },
  mine: { name: 'Rudnik Severny', sub: 'coal mine', kind: 'yard', at: [-430, 560], alt: 22, icon: 'mine' },
  lesnoy: { name: 'Lesnoy', sub: 'forest village', kind: 'yard', at: [-760, 170], alt: 9, icon: 'village' },
  sosn: { name: 'Sosnovka', sub: 'village', kind: 'yard', at: [1180, -880], alt: -1, icon: 'village' },
  rail: { name: 'Tayozhny', sub: 'railway siding', kind: 'yard', at: [2840, 450], alt: 9, icon: 'rail' },
  pit: { name: 'Gravel pit', sub: 'quarry', kind: 'yard', at: [2330, 700], alt: 18, icon: 'pit' },
  pulp: { name: 'Zarechny pulp mill', sub: 'pulp and paper', kind: 'yard', at: [2620, -360], alt: 4, icon: 'pulp' },
  zar: { name: 'Zarechye', sub: 'village beyond the river', kind: 'yard', at: [2990, -650], alt: -2, icon: 'village' },
};
// kind: map style (main road, pass, river road, winter road, ice road, track). secret: found how (see SECRETS)
const EDGES = {
  e1: { a: 'camp', b: 'xjct', name: 'Camp road', short: 'CAMP RD', kind: 'main', len: 380, forest: 'taiga', way: [[-40, -6], [150, 62], [320, 42]],
    traits: 'Forest road past the creek culvert',
    build(c, P) {
      c.sec(120, 5, S_SNOW, { amp: 0.5, wl: 40, rough: 0.035 });
      c.sec(90, -6, S_RUTS, { amp: 0.4, wl: 30, rough: 0.05 });
      c.sec(40, 1, S_RUTS, { amp: 0.2, wl: 20, rough: 0.05 });
      c.sec(130, 6, S_SNOW, { amp: 0.5, wl: 44, rough: 0.035 });
      c.add('culvert', 188); P.block(182, 196);
      c.add('oldsign', 300, { secret: 'zimnik' }); P.block(294, 306);
      P.poles(12, 372, 40, [300]);
    } },
  e2: { a: 'xjct', b: 'fork', name: 'Camp road', short: 'CAMP RD', kind: 'main', len: 420, forest: 'taiga', way: [[320, 42], [540, 96], [760, 90]],
    traits: 'Forest road to the fork',
    build(c, P) {
      c.sec(100, -3, S_SNOW, { amp: 0.5, wl: 40, rough: 0.04, surfFn: (t, x) => fbm1(x / 26, 5, 2) > 0.22 ? S_RUTS : S_SNOW });
      c.sec(140, 2, S_SNOW, { amp: 0.7, wl: 46, rough: 0.035 });
      c.sec(180, -1, S_SNOW, { amp: 0.4, wl: 40, rough: 0.03 });
      P.poles(20, 412, 40);
    } },
  e3: { a: 'fork', b: 'sjct', name: 'Pass road', short: 'PASS', kind: 'pass', len: 1400, forest: 'taiga', way: [[760, 90], [880, 300], [1110, 520], [1400, 600], [1590, 450], [1700, 235]],
    traits: 'Shortest proper road · climbs up to 26% · deep snow on top',
    build(c, P) {
      c.sec(60, 3, S_SNOW, { amp: 0.15, wl: 22, rough: 0.03 });
      c.sec(140, 24, S_SNOW, { shape: 'steps', n: 2, r: 0.85, amp: 0.15, wl: 22, rough: 0.035, surfFn: rockMix });
      c.sec(30, 1, S_SNOW, { amp: 0.1, rough: 0.03 });
      c.sec(120, 21, S_RUTS, { shape: 'steps', n: 2, r: 0.85, amp: 0.15, wl: 22, rough: 0.04, surfFn: (t, x) => rockMix(t, x) === S_ROCK ? S_ROCK : S_RUTS });
      c.sec(30, 1, S_SNOW, { amp: 0.1, rough: 0.03 });
      c.sec(80, 15, S_SNOW, { shape: 'ramp', amp: 0.15, wl: 22, rough: 0.035, surfFn: rockMix }).mark('summit');
      c.sec(220, 2, S_DEEP, { amp: 1.0, wl: 34, rough: 0.06, softFn: deepSoft });
      c.sec(50, -3, S_SNOW, { amp: 0.2, wl: 20, rough: 0.03 });
      c.sec(130, -24, S_GRAVEL, { shape: 'steps', n: 2, r: 0.85, amp: 0.15, wl: 22, rough: 0.045, surfFn: screeMix });
      c.sec(40, -1, S_SNOW, { amp: 0.1, rough: 0.03 });
      c.sec(130, -22, S_SNOW, { shape: 'steps', n: 2, r: 0.85, amp: 0.15, wl: 22, rough: 0.04, surfFn: rockMix });
      c.sec(220, -13, S_SNOW, { amp: 0.6, wl: 46, rough: 0.035 });
      c.sec(150, 0, S_SNOW, { amp: 0.5, wl: 40, rough: 0.03 });
      const M = c.marks;
      P.rocks(70, 450, 0.55); c.add('cairn', M.summit + 6); P.block(M.summit, M.summit + 12);
      for (let x = M.summit + 20; x < M.summit + 230; x += 24) c.add('snowpole', x);
      P.rocks(740, 1030, 0.5); P.zone(M.summit, M.summit + 230, 'sparse');
    } },
  e4: { a: 'fork', b: 'icej', name: 'River road', short: 'RIVER', kind: 'river', len: 860, forest: 'taiga', way: [[760, 90], [860, -120], [1020, -330], [1190, -470], [1330, -510]],
    traits: 'Easy gravel road down to the river ice',
    build(c, P) {
      c.sec(160, 5, S_GRAVEL, { amp: 0.5, wl: 40, rough: 0.03 });
      c.sec(140, -4, S_GRAVEL, { amp: 0.5, wl: 40, rough: 0.03 });
      c.sec(180, 6, S_GRAVEL, { shape: 'ramp', amp: 0.5, wl: 44, rough: 0.03 });
      c.sec(220, -1, S_GRAVEL, { amp: 0.6, wl: 50, rough: 0.03 });
      c.sec(120, -16, S_RUTS, { shape: 'ramp', amp: 0.15, wl: 24, rough: 0.04 });
      c.sec(40, 0, S_SNOW, { amp: 0.05, rough: 0.02 });
      P.poles(20, 680, 42); P.zone(810, 860, 'none');
    } },
  e5: { a: 'icej', b: 'bridgej', name: 'River road', short: 'RIVER', kind: 'river', len: 820, forest: 'taiga', way: [[1330, -510], [1500, -555], [1640, -500], [1720, -400], [1850, -190], [1880, -60]],
    traits: 'Along the river ice, up the bank, over the old bridge',
    build(c, P) {
      iceSec(c, 270, { patches: [[60, 100]], bumps: [[30, 0.22, 2.2], [150, 0.28, 2.6]] });
      c.sec(30, 0, S_SNOW, { amp: 0.05, rough: 0.02 });
      c.sec(120, 17, S_RUTS, { shape: 'ramp', amp: 0.15, wl: 24, rough: 0.04 });
      c.sec(260, 2, S_GRAVEL, { amp: 0.5, wl: 44, rough: 0.03 });
      c.sec(60, 0, S_GRAVEL, { amp: 0.1, rough: 0.02 }).mark('bridge0');
      c.sec(60, 0.2, S_WOOD, { shape: 'l', amp: 0, under: 2, visFn: (t, x, y) => y - 4 - 9 * Math.sin(Math.PI * t) }).mark('bridge1');
      c.sec(20, 0, S_GRAVEL, { amp: 0.1, rough: 0.02 });
      const M = c.marks;
      P.firs(6, 266, 26); c.add('fishhut', 118, { secret: 'forest' }); P.zone(0, 300, 'none');
      P.poles(340, 640, 42);
      c.add('bridge', M.bridge0, { x1: M.bridge1 }); P.block(M.bridge0 - 6, M.bridge1 + 6);
    } },
  e6: { a: 'bridgej', b: 'sjct', name: 'River road', short: 'RIVER', kind: 'river', len: 360, forest: 'taiga', way: [[1880, -60], [1830, 60], [1700, 235]],
    traits: 'Gravel road up to the mill junction',
    build(c, P) { c.sec(360, -5.2, S_GRAVEL, { amp: 0.6, wl: 48, rough: 0.03 }); P.poles(20, 352, 42); } },
  e7: { a: 'fork', b: 'sjct', name: 'Old zimnik', short: 'ZIMNIK', kind: 'zimnik', len: 1000, secret: 'zimnik', forest: 'swamp', way: [[760, 90], [1000, 130], [1290, 70], [1520, 170], [1700, 235]],
    traits: 'Forgotten winter road · frozen swamp · ice and drifts',
    build(c, P) {
      c.sec(60, -7, S_SNOW, { shape: 'ramp', amp: 0.1, rough: 0.03 });
      const sw = c.x;
      c.sec(780, 0, S_SNOW, { amp: 0.25, wl: 24, rough: 0.05,
        surfFn: (t, x) => { if (x > sw + 318 && x < sw + 336) return S_WOOD; const v = fbm1(x / 34, 41, 2); return v > 0.3 ? S_ICE : v < -0.32 ? S_DEEP : S_SNOW; },
        softFn: (t, x, sf) => sf === S_DEEP ? 0.36 + 0.14 * fbm1(x / 12, 8, 2) : SURF[sf].soft });
      c.sec(80, 11, S_RUTS, { shape: 'ramp', amp: 0.12, rough: 0.04 });
      c.sec(80, 0, S_SNOW, { amp: 0.2, rough: 0.03 });
      for (let i = c.ii(sw + 318); i <= c.ii(sw + 336); i++) c.under[i] = 1;
      for (let i = c.ii(sw); i <= c.ii(sw + 780); i++) if (c.s[i] === S_ICE) c.under[i] = 3;
      for (let x = 12; x < 912; x += 28) c.add('marker', x);
      c.add('wreck', 490); P.block(482, 500);
      c.add('corduroy', sw + 318, { x1: sw + 336 }); P.block(sw + 308, sw + 346);
      P.zone(60, 840, 'swamp');
    } },
  e8: { a: 'sjct', b: 'mill', name: 'Sawmill road', short: 'SAWMILL', kind: 'main', len: 400, forest: 'taiga', way: [[1700, 235], [1900, 290], [2160, 300]],
    traits: 'Last stretch into the sawmill',
    build(c, P) { c.sec(200, 3, S_SNOW, { amp: 0.5, wl: 40, rough: 0.03 }); c.sec(200, -1, S_GRAVEL, { amp: 0.4, wl: 40, rough: 0.03 }); P.poles(20, 392, 40); } },
  e9: { a: 'camp', b: 'depot', name: 'Depot road', short: 'DEPOT', kind: 'main', len: 640, forest: 'taiga', way: [[-40, -6], [-230, -90], [-430, -190], [-600, -260]],
    traits: 'Wide gravel road with the fuel pipe alongside',
    build(c, P) {
      c.sec(130, 3, S_GRAVEL, { amp: 0.4, wl: 40, rough: 0.03 });
      c.sec(110, -7, S_GRAVEL, { shape: 'ramp', amp: 0.3, wl: 30, rough: 0.03 });
      c.sec(80, 0, S_RUTS, { amp: 0.2, wl: 20, rough: 0.05, softFn: () => 0.16 });
      c.sec(140, 4, S_GRAVEL, { amp: 0.5, wl: 40, rough: 0.03 });
      c.sec(180, -2, S_GRAVEL, { amp: 0.5, wl: 44, rough: 0.03 });
      P.pipe(16, 620);
    } },
  e10: { a: 'camp', b: 'mine', name: 'Mine road', short: 'MINE', kind: 'main', len: 820, forest: 'taiga', way: [[-40, -6], [-110, 210], [-300, 400], [-430, 560]],
    traits: 'Climbs to the coal mine · rocky, up to 15%',
    build(c, P) {
      c.sec(120, 2, S_SNOW, { amp: 0.4, wl: 40, rough: 0.035 });
      c.sec(160, 9, S_GRAVEL, { shape: 'ramp', amp: 0.3, wl: 30, rough: 0.035 });
      c.sec(60, 1, S_GRAVEL, { amp: 0.2, rough: 0.03 });
      c.sec(140, 12, S_GRAVEL, { shape: 'steps', n: 2, r: 0.8, amp: 0.15, wl: 22, rough: 0.04, surfFn: screeMix });
      c.sec(120, -3, S_SNOW, { amp: 0.4, wl: 30, rough: 0.035 });
      c.sec(220, 1, S_RUTS, { amp: 0.3, wl: 26, rough: 0.05, softFn: (t, x) => 0.12 + 0.08 * fbm1(x / 14, 6, 2) });
      P.rocks(300, 480, 0.4); P.poles(10, 800, 44);
    } },
  e11: { a: 'depot', b: 'lesnoy', name: 'Western track', short: 'LESNOY', kind: 'track', len: 560, forest: 'dense', way: [[-600, -260], [-690, -110], [-740, 40], [-760, 170]],
    traits: 'Forest track · deep snow · log crossing over a creek',
    build(c, P) {
      c.sec(150, 4, S_SNOW, { amp: 0.5, wl: 30, rough: 0.045 });
      c.sec(200, 6, S_DEEP, { amp: 0.7, wl: 30, rough: 0.06, softFn: deepSoft });
      c.sec(40, -3, S_RUTS, { shape: 'ramp', amp: 0.1, rough: 0.05 });
      const cx = c.x; c.sec(30, 0, S_WOOD, { shape: 'l', amp: 0, rough: 0 }); for (let i = c.ii(cx); i <= c.ii(cx + 30); i++) c.under[i] = 1;
      c.add('corduroy', cx, { x1: cx + 30 }); P.block(cx - 8, cx + 38);
      c.sec(140, 4, S_RUTS, { shape: 'ramp', amp: 0.15, rough: 0.05 });
    } },
  e12: { a: 'lesnoy', b: 'mine', name: 'Western track', short: 'MINE', kind: 'track', len: 560, forest: 'dense', way: [[-760, 170], [-680, 330], [-550, 460], [-430, 560]],
    traits: 'Forest track climbing to the mine',
    build(c, P) {
      c.sec(200, 8, S_SNOW, { shape: 'ramp', amp: 0.4, wl: 30, rough: 0.04 });
      c.sec(160, 1, S_DEEP, { amp: 0.8, wl: 28, rough: 0.06, softFn: deepSoft });
      c.sec(200, 4, S_SNOW, { amp: 0.6, wl: 34, rough: 0.045, surfFn: (t, x) => fbm1(x / 20, 13, 2) > 0.25 ? S_DEEP : S_SNOW, softFn: deepSoft });
    } },
  e13: { a: 'depot', b: 'port', name: 'Landing road', short: 'LANDING', kind: 'main', len: 1050, forest: 'taiga', way: [[-600, -260], [-450, -430], [-200, -570], [60, -650], [230, -690]],
    traits: 'Along the riverbank · glazed ice patches · drifts',
    build(c, P) {
      c.sec(200, 2, S_GRAVEL, { amp: 0.4, wl: 40, rough: 0.03 });
      c.sec(150, -4, S_GRAVEL, { amp: 0.3, wl: 30, rough: 0.03, surfFn: (t, x) => fbm1(x / 16, 23, 2) > 0.2 ? S_ICE : S_GRAVEL });
      c.sec(300, 2, S_SNOW, { amp: 0.6, wl: 30, rough: 0.04, surfFn: (t, x) => fbm1(x / 22, 29, 2) > 0.3 ? S_DEEP : S_SNOW, softFn: deepSoft });
      c.sec(200, -2, S_GRAVEL, { amp: 0.4, wl: 40, rough: 0.03 });
      c.sec(200, 0, S_SNOW, { amp: 0.4, wl: 40, rough: 0.03 });
      c.add('boat', 520); P.block(512, 530);
      P.poles(30, 1030, 44, [520]);
    } },
  e14: { a: 'xjct', b: 'port', name: 'Landing road', short: 'LANDING', kind: 'main', len: 880, forest: 'taiga', way: [[320, 42], [300, -150], [260, -400], [230, -690]],
    traits: 'Down through the forest to the river landing',
    build(c, P) {
      c.sec(200, 2, S_SNOW, { amp: 0.5, wl: 40, rough: 0.035 });
      c.sec(120, -2, S_RUTS, { amp: 0.3, wl: 26, rough: 0.05 });
      c.sec(160, -9, S_SNOW, { shape: 'ramp', amp: 0.3, wl: 30, rough: 0.035 });
      c.sec(100, -1, S_GRAVEL, { amp: 0.3, rough: 0.03 });
      c.sec(300, 0, S_GRAVEL, { amp: 0.5, wl: 40, rough: 0.03, surfFn: (t, x) => fbm1(x / 30, 31, 2) > 0.25 ? S_SNOW : S_GRAVEL });
      P.poles(20, 862, 42);
    } },
  e15: { a: 'xjct', b: 'cut12', name: 'Cutting road', short: 'CUTTING', kind: 'track', len: 980, forest: 'taiga', way: [[320, 42], [400, 300], [500, 560], [560, 800]],
    traits: 'Logging road into the hills · steep rutted climbs',
    build(c, P) {
      c.sec(150, 3, S_RUTS, { amp: 0.4, wl: 28, rough: 0.05 });
      c.sec(180, 11, S_SNOW, { shape: 'steps', n: 2, r: 0.8, amp: 0.2, wl: 24, rough: 0.04, surfFn: (t, x) => fbm1(x / 18, 37, 2) > 0.15 ? S_RUTS : S_SNOW });
      c.sec(120, 1, S_RUTS, { amp: 0.3, wl: 24, rough: 0.05, softFn: () => 0.18 });
      c.sec(200, 8, S_SNOW, { shape: 'ramp', amp: 0.3, wl: 26, rough: 0.04, surfFn: rockMix });
      c.sec(330, 1, S_DEEP, { amp: 0.8, wl: 30, rough: 0.06, softFn: deepSoft });
      P.stumps(680, 975, 0.5); P.zone(650, 980, 'sparse');
    } },
  e16: { a: 'cut12', b: 'mine', name: 'Ridge track', short: 'RIDGE', kind: 'track', len: 1180, forest: 'sparse', way: [[560, 800], [300, 880], [0, 820], [-250, 720], [-430, 560]],
    traits: 'Over the bare hilltops · drifting snow · steep scree descent',
    build(c, P) {
      c.sec(200, 6, S_DEEP, { amp: 0.8, wl: 30, rough: 0.06, softFn: deepSoft });
      c.sec(160, -2, S_SNOW, { amp: 0.5, wl: 30, rough: 0.04 });
      c.sec(250, 4, S_SNOW, { amp: 0.6, wl: 30, rough: 0.05, surfFn: rockMix });
      c.sec(150, -12, S_GRAVEL, { shape: 'steps', n: 2, r: 0.8, amp: 0.15, wl: 22, rough: 0.045, surfFn: screeMix });
      c.sec(420, -4, S_SNOW, { amp: 0.6, wl: 34, rough: 0.04, surfFn: (t, x) => fbm1(x / 24, 43, 2) > 0.28 ? S_DEEP : S_SNOW, softFn: deepSoft });
      for (let x = 20; x < 600; x += 26) c.add('snowpole', x);
      P.rocks(380, 760, 0.5); c.add('hut', 300); P.block(292, 308);
    } },
  e17: { a: 'cut12', b: 'mill', name: 'North road', short: 'NORTH RD', kind: 'main', len: 2050, forest: 'taiga', way: [[560, 800], [900, 900], [1300, 950], [1700, 880], [2000, 700], [2150, 450], [2160, 300]],
    traits: 'Long gravel haul road round the north of the ridge · fast',
    build(c, P) {
      c.sec(300, 5, S_GRAVEL, { amp: 0.5, wl: 50, rough: 0.025 });
      c.sec(400, -8, S_GRAVEL, { amp: 0.6, wl: 60, rough: 0.025 });
      c.sec(350, 3, S_GRAVEL, { amp: 0.6, wl: 60, rough: 0.025 });
      c.sec(300, -6, S_GRAVEL, { amp: 0.5, wl: 50, rough: 0.025, surfFn: (t, x) => fbm1(x / 40, 47, 2) > 0.3 ? S_SNOW : S_GRAVEL });
      c.sec(400, -10, S_GRAVEL, { shape: 'ramp', amp: 0.4, wl: 50, rough: 0.025 });
      c.sec(300, -4, S_GRAVEL, { amp: 0.5, wl: 50, rough: 0.025 });
      P.poles(20, 2030, 46);
    } },
  e18: { a: 'port', b: 'icej', name: 'Ice road', short: 'ICE ROAD', kind: 'ice', len: 1250, forest: 'taiga', way: null, river: [0.18, 0.43],
    traits: 'Winter road on the river ice · flat and fast · weight limit',
    build(c, P) {
      c.sec(60, -2, S_RUTS, { shape: 'ramp', amp: 0.1, rough: 0.04 });
      iceSec(c, 1190, { patches: [[160, 200], [420, 470], [700, 730], [930, 990]], bumps: [[90, 0.25, 2.4], [330, 0.3, 2.8], [610, 0.22, 2.2], [860, 0.3, 2.6], [1080, 0.2, 2.0]] });
      P.firs(66, 1246, 26); P.zone(40, 1250, 'none');
    } },
  e19: { a: 'icej', b: 'sosn', name: 'Sosnovka crossing', short: 'SOSNOVKA', kind: 'ice', len: 520, forest: 'birch', way: [[1330, -510], [1250, -555], [1215, -650], [1195, -770], [1180, -880]],
    traits: 'Across the ice and up the far bank to the village',
    build(c, P) {
      iceSec(c, 180, { patches: [[80, 100]], bumps: [[50, 0.22, 2.2]] });
      c.sec(30, 0, S_SNOW, { amp: 0.05, rough: 0.02 });
      c.sec(70, 6, S_RUTS, { shape: 'ramp', amp: 0.12, rough: 0.045 });
      c.sec(240, -1, S_SNOW, { amp: 0.4, wl: 34, rough: 0.035 });
      P.firs(6, 176, 24); P.zone(0, 215, 'none');
    } },
  e20: { a: 'mill', b: 'rail', name: 'Siding road', short: 'SIDING', kind: 'main', len: 800, forest: 'taiga', way: [[2160, 300], [2450, 380], [2650, 420], [2840, 450]],
    traits: 'Concrete slabs and gravel to the railway',
    build(c, P) {
      c.sec(200, 2, S_SLABS, { amp: 0.3, wl: 40, rough: 0 });
      c.sec(300, -2, S_GRAVEL, { amp: 0.5, wl: 50, rough: 0.025 });
      c.sec(300, -1, S_SLABS, { amp: 0.3, wl: 40, rough: 0 });
      P.poles(10, 792, 40);
    } },
  e21: { a: 'mill', b: 'pit', name: 'Quarry road', short: 'QUARRY', kind: 'main', len: 500, forest: 'taiga', way: [[2160, 300], [2200, 470], [2330, 700]],
    traits: 'Short steep gravel climb to the quarry',
    build(c, P) {
      c.sec(100, 1, S_GRAVEL, { amp: 0.3, rough: 0.03 });
      c.sec(150, 6, S_GRAVEL, { shape: 'steps', n: 2, r: 0.75, amp: 0.15, rough: 0.035 });
      c.sec(250, 1, S_GRAVEL, { amp: 0.4, wl: 30, rough: 0.04, surfFn: (t, x) => fbm1(x / 16, 53, 2) > 0.25 ? S_RUTS : S_GRAVEL });
    } },
  e22: { a: 'bridgej', b: 'pulp', name: 'Pulp mill road', short: 'PULP MILL', kind: 'main', len: 980, forest: 'taiga', way: [[1880, -60], [2100, -120], [2350, -230], [2500, -330], [2620, -360]],
    traits: 'Gravel road down towards the pulp mill',
    build(c, P) {
      c.sec(200, 2, S_GRAVEL, { amp: 0.4, wl: 40, rough: 0.03 });
      c.sec(250, -8, S_GRAVEL, { shape: 'ramp', amp: 0.3, wl: 30, rough: 0.03 });
      c.sec(280, 0, S_RUTS, { amp: 0.3, wl: 26, rough: 0.05, surfFn: (t, x) => fbm1(x / 22, 59, 2) > 0.2 ? S_SNOW : S_RUTS });
      c.sec(250, -3.2, S_GRAVEL, { amp: 0.4, wl: 40, rough: 0.03 });
      P.poles(20, 962, 44);
    } },
  e23: { a: 'rail', b: 'pulp', name: 'Railway road', short: 'PULP MILL', kind: 'main', len: 1000, forest: 'taiga', way: [[2840, 450], [2800, 200], [2720, -60], [2650, -250], [2620, -360]],
    traits: 'Slab road along the railway line',
    build(c, P) {
      c.sec(250, 1, S_SLABS, { amp: 0.3, wl: 40, rough: 0 });
      c.sec(300, -3, S_GRAVEL, { amp: 0.5, wl: 50, rough: 0.025 });
      c.sec(450, -3, S_SLABS, { amp: 0.4, wl: 50, rough: 0, surfFn: (t, x) => fbm1(x / 36, 61, 2) > 0.2 ? S_GRAVEL : S_SLABS });
      P.poles(10, 992, 40);
    } },
  e24: { a: 'pulp', b: 'zar', name: 'Zarechye crossing', short: 'ZARECHYE', kind: 'ice', len: 560, forest: 'birch', way: [[2620, -360], [2700, -450], [2770, -540], [2860, -610], [2990, -650]],
    traits: 'Down the bank and across the river to Zarechye',
    build(c, P) {
      c.sec(150, -2, S_GRAVEL, { amp: 0.3, rough: 0.03 });
      c.sec(60, -8, S_RUTS, { shape: 'ramp', amp: 0.1, rough: 0.04 });
      iceSec(c, 200, { patches: [[90, 115]], bumps: [[60, 0.25, 2.2], [150, 0.2, 2.0]] });
      c.sec(40, 2, S_RUTS, { shape: 'ramp', amp: 0.1, rough: 0.04 });
      c.sec(110, 2, S_SNOW, { amp: 0.3, rough: 0.03 });
      P.firs(214, 406, 24); P.zone(150, 455, 'none');
    } },
  e25: { a: 'sjct', b: 'icej', name: 'Forest track', short: 'FOREST', kind: 'track', len: 960, secret: 'forest', forest: 'dense', bottomless: true, way: [[1700, 235], [1640, 60], [1560, -120], [1450, -300], [1380, -420], [1330, -510]],
    traits: 'Overgrown track through the dense forest · bottomless drifts · fallen trees · steep drop to the river',
    build(c, P) {
      c.sec(200, -1, S_DEEP, { amp: 0.7, wl: 26, rough: 0.06, softFn: deepSoft });
      c.sec(160, 2, S_SNOW, { amp: 0.6, wl: 26, rough: 0.05, surfFn: (t, x) => fbm1(x / 18, 67, 2) > 0.2 ? S_DEEP : S_SNOW, softFn: deepSoft });
      const cx = c.x; c.sec(30, 0, S_WOOD, { shape: 'l', amp: 0 }); c.add('corduroy', cx, { x1: cx + 30 }); P.block(cx - 6, cx + 36);
      c.sec(250, -3, S_DEEP, { amp: 0.7, wl: 26, rough: 0.06, softFn: deepSoft });
      c.sec(120, -10, S_RUTS, { shape: 'steps', n: 2, r: 0.8, amp: 0.12, rough: 0.05 });
      c.sec(200, -2, S_SNOW, { amp: 0.3, rough: 0.035 });
      P.fallen(30, 900, 0.35); P.zone(900, 960, 'none');
    } },
  e26: { a: 'sosn', b: 'zar', name: 'South bank track', short: 'SOUTH BANK', kind: 'track', len: 2000, secret: 'south', forest: 'birch', bottomless: true, way: [[1180, -880], [1450, -930], [1750, -900], [2050, -860], [2350, -850], [2650, -760], [2990, -650]],
    traits: 'Long winding track on the far bank · bottomless drifts · bog ice',
    build(c, P) {
      c.sec(300, 3, S_SNOW, { amp: 0.6, wl: 30, rough: 0.045 });
      c.sec(300, -2, S_DEEP, { amp: 0.8, wl: 28, rough: 0.06, softFn: deepSoft });
      c.sec(200, 4, S_SNOW, { amp: 0.5, wl: 26, rough: 0.05, surfFn: rockMix });
      c.sec(250, -6, S_SNOW, { shape: 'ramp', amp: 0.3, wl: 30, rough: 0.04 });
      c.sec(100, 0, S_ICE, { amp: 0.15, wl: 20, rough: 0.03, under: 3 });
      c.sec(350, 2, S_DEEP, { amp: 0.8, wl: 30, rough: 0.06, softFn: deepSoft });
      c.sec(500, -2, S_SNOW, { amp: 0.5, wl: 40, rough: 0.035 });
      for (let x = 10; x < 1990; x += 30) if (x < 1040 || x > 1160) c.add('marker', x);
      c.add('ruin', 1300); P.block(1290, 1312); P.zone(1040, 1160, 'swamp');
    } },
  // v0.6: two long ways round with steel bridges, so heavy rigs reach the far bank in the thaw without touching ice
  e27: { a: 'bridgej', b: 'sosn', name: 'Bridge road', short: 'BRIDGE', kind: 'main', len: 1600, forest: 'taiga', way: [[1880, -60], [1940, -230], [1985, -440], [2005, -655], [1985, -770], [1800, -730], [1600, -700], [1400, -720], [1260, -790], [1180, -880]],
    traits: 'Down to the steel bridge and back west along the far bank · no ice, the long way round',
    build(c, P) {
      c.sec(170, -3, S_GRAVEL, { amp: 0.4, wl: 40, rough: 0.03 });
      c.sec(220, -6, S_SNOW, { amp: 0.5, wl: 36, rough: 0.035 });
      c.sec(160, -4, S_RUTS, { shape: 'ramp', amp: 0.12, rough: 0.04 });
      c.sec(20, 0, S_GRAVEL, { shape: 'l', amp: 0, rough: 0.01 }).mark('rb0');
      c.sec(110, 0, S_SLABS, { shape: 'l', amp: 0, rough: 0, under: 2, visFn: (t, x, y) => y - 2.2 - 8.6 * Math.pow(Math.sin(Math.PI * t), 0.6) }).mark('rb1');
      c.sec(20, 0, S_GRAVEL, { shape: 'l', amp: 0, rough: 0.01 });
      c.sec(120, 2, S_RUTS, { shape: 'ramp', amp: 0.12, rough: 0.04 });
      c.sec(380, -1.5, S_SNOW, { amp: 0.5, wl: 34, rough: 0.04, surfFn: (t, x) => fbm1(x / 26, 71, 2) > 0.3 ? S_DEEP : S_SNOW, softFn: deepSoft });
      c.sec(400, -1.7, S_SNOW, { amp: 0.4, wl: 40, rough: 0.035 });
      const M = c.marks;
      c.add('rbridge', M.rb0, { x1: M.rb1, wl: 6.7 }); P.block(M.rb0 - 10, M.rb1 + 10); P.zone(M.rb0 - 40, M.rb1 + 40, 'none');
      P.poles(20, 520, 42); P.poles(720, 1580, 42);
    } },
  e28: { a: 'pulp', b: 'zar', name: 'East bridge road', short: 'E BRIDGE', kind: 'main', len: 1000, forest: 'birch', way: [[2620, -360], [2780, -340], [2960, -360], [3120, -440], [3170, -555], [3140, -640], [2990, -650]],
    traits: 'East along the bank to the steel bridge and back to Zarechye · no ice, the long way round',
    build(c, P) {
      // the bridge sits where the map has the road over the river (740-840 m)
      c.sec(300, 1.5, S_GRAVEL, { amp: 0.4, wl: 40, rough: 0.03 });
      c.sec(300, -2.5, S_SNOW, { amp: 0.4, wl: 34, rough: 0.035 });
      c.sec(120, -4, S_RUTS, { shape: 'ramp', amp: 0.1, rough: 0.04 });
      c.sec(20, 0, S_GRAVEL, { shape: 'l', amp: 0, rough: 0.01 }).mark('rb0');
      c.sec(100, 0, S_SLABS, { shape: 'l', amp: 0, rough: 0, under: 2, visFn: (t, x, y) => y - 2.0 - 7.0 * Math.pow(Math.sin(Math.PI * t), 0.6) }).mark('rb1');
      c.sec(20, 0, S_GRAVEL, { shape: 'l', amp: 0, rough: 0.01 });
      c.sec(100, 1, S_RUTS, { shape: 'ramp', amp: 0.1, rough: 0.04 });
      c.sec(40, -2, S_SNOW, { amp: 0.3, wl: 30, rough: 0.035 });
      const M = c.marks;
      c.add('rbridge', M.rb0, { x1: M.rb1, wl: 5.0 }); P.block(M.rb0 - 10, M.rb1 + 10); P.zone(M.rb0 - 40, M.rb1 + 40, 'none');
      P.poles(20, 660, 42);
    } },
  // v0.9: three harsh roads for drivers who find the district too easy — hills, river ice, rock and glazed ice
  e29: { a: 'camp', b: 'cut12', name: 'Hill road', short: 'HILLS', kind: 'pass', len: 1080, forest: 'sparse', way: [[-40, -6], [60, 220], [170, 460], [300, 640], [430, 770], [560, 800]],
    traits: 'Over the hills straight to the cutting · steeper than the pass · bare rock, drifts on top',
    build(c, P) {
      c.sec(90, 2, S_SNOW, { amp: 0.4, wl: 30, rough: 0.04 });
      c.sec(150, 22, S_GRAVEL, { shape: 'steps', n: 2, r: 0.8, amp: 0.15, wl: 22, rough: 0.045, surfFn: screeMix });
      c.sec(50, 1, S_SNOW, { amp: 0.12, rough: 0.03 });
      c.sec(170, 30, S_SNOW, { shape: 'steps', n: 3, r: 0.8, amp: 0.18, wl: 24, rough: 0.045, surfFn: rockMix }).mark('hillsum');
      c.sec(180, -2, S_DEEP, { amp: 0.9, wl: 30, rough: 0.06, softFn: deepSoft });
      c.sec(160, -26, S_GRAVEL, { shape: 'steps', n: 2, r: 0.8, amp: 0.15, wl: 22, rough: 0.045, surfFn: screeMix });
      c.sec(90, -6, S_RUTS, { shape: 'ramp', amp: 0.12, rough: 0.045 });
      c.sec(190, 9, S_SNOW, { amp: 0.5, wl: 34, rough: 0.04, surfFn: (t, x) => fbm1(x / 22, 83, 2) > 0.25 ? S_RUTS : S_SNOW });
      const M = c.marks;
      P.rocks(80, 620, 0.5); c.add('cairn', M.hillsum + 8); P.block(M.hillsum + 2, M.hillsum + 14);
      for (let x = M.hillsum + 16; x < M.hillsum + 190; x += 24) c.add('snowpole', x);
      P.rocks(640, 830, 0.5);
    } },
  e30: { a: 'lesnoy', b: 'port', name: 'Ice crossing', short: 'ICE XING', kind: 'ice', len: 950, forest: 'dense', way: [[-760, 170], [-730, -60], [-650, -300], [-560, -520], [-470, -650], [-360, -660], [-240, -700], [-80, -760], [80, -790], [200, -750], [230, -690]],
    traits: 'Down through the forest, a long stretch of river ice, a steep climb out · weight limit',
    build(c, P) {
      c.sec(170, -3, S_SNOW, { amp: 0.5, wl: 30, rough: 0.045 });
      c.sec(160, -2, S_DEEP, { amp: 0.7, wl: 28, rough: 0.06, softFn: deepSoft });
      c.sec(90, -7, S_RUTS, { shape: 'ramp', amp: 0.12, rough: 0.045 });
      iceSec(c, 340, { patches: [[70, 110], [210, 240]], bumps: [[50, 0.24, 2.2], [160, 0.3, 2.6], [280, 0.22, 2.0]] });
      c.sec(90, 6, S_RUTS, { shape: 'ramp', amp: 0.12, rough: 0.045 });
      c.sec(100, -1, S_SNOW, { amp: 0.3, wl: 30, rough: 0.035 });
      P.firs(426, 758, 24); P.zone(420, 860, 'none');
    } },
  e31: { a: 'pit', b: 'rail', name: 'Quarry ridge', short: 'QRIDGE', kind: 'track', len: 700, forest: 'sparse', way: [[2330, 700], [2450, 800], [2580, 810], [2690, 700], [2790, 560], [2840, 450]],
    traits: 'Rocky steps over the ridge · glazed ice on the shady side · no room for a mistake',
    build(c, P) {
      c.sec(120, 6, S_GRAVEL, { shape: 'steps', n: 2, r: 0.8, amp: 0.14, rough: 0.04 });
      c.sec(140, 14, S_ROCK, { shape: 'steps', n: 2, r: 0.8, amp: 0.15, wl: 22, rough: 0.05, surfFn: screeMix });
      c.sec(90, -4, S_RUTS, { amp: 0.2, wl: 22, rough: 0.05, softFn: () => 0.16 });
      c.sec(120, -8, S_SNOW, { shape: 'ramp', amp: 0.1, wl: 20, rough: 0.035, surfFn: (t, x) => fbm1(x / 14, 91, 2) > 0.05 ? S_ICE : S_SNOW });
      c.sec(130, -10, S_GRAVEL, { shape: 'steps', n: 2, r: 0.8, amp: 0.14, rough: 0.04, surfFn: screeMix });
      c.sec(100, -2, S_SNOW, { amp: 0.3, wl: 30, rough: 0.03 });
      P.rocks(100, 280, 0.55); P.rocks(460, 620, 0.5);
      for (let x = 260; x < 470; x += 26) c.add('snowpole', x);
    } },
};
// how the secret roads are found: stop by these roadside things
const SECRETS = {
  zimnik: { edge: 'e7', at: 'oldsign', msg: 'You found the old winter road! New option at the fork' },
  forest: { edge: 'e25', at: 'fishhut', msg: 'The fisherman tells you about a forest track from the ice junction up to the mill junction' },
  south: { edge: 'e26', at: 'vboard', msg: 'A note on the board: the old south bank track to Zarechye is open again' },
};
// yards: u runs from the road (0) to the closed end (len). wall: what stops you there. zone: where you load and park.
const YARDS = {
  camp: { len: 100, surf: S_RUTS, zone: [14, 60], zk: 'posts', spawn: 46, wall: 'logs', bg: [['village', 2, 14, 120]],
    items: [['sign', 6, { kind: 'board', text: ['LESPROMKHOZ No 7', 'LOGGING CAMP'] }], ['lamp', 12], ['loader', 22], ['logpile', 36, { n: 9, len: 7 }], ['barrels', 44], ['lamp', 54], ['logpile', 62, { n: 6, len: 6 }],
      ['bldg', 77, { w: 12, h: 5.4, wall: '#6f5a46', roof: 'gable', door: 'big', sign: 'GARAGE', lit: true }], ['cabin', 91, { w: 6.5, h: 3.4, lit: true }]] },
  mill: { len: 136, surf: S_SLABS, zone: [34, 82], zk: 'gantry', spawn: 62, wall: 'fence', bg: [['sawmill', 2, 16, 70]],
    items: [['sign', 6, { kind: 'board', text: ['SAWMILL No 3', 'DELIVERIES >'] }], ['lamp', 14], ['stack', 20], ['stack', 28], ['lamp', 88], ['shed', 112, { w: 26, h: 8 }], ['stack', 129]] },
  depot: { len: 112, surf: S_SLABS, zone: [50, 88], zk: 'posts', spawn: 70, wall: 'concrete', bg: [['tanks', 2, 18, 60]],
    items: [['sign', 6, { kind: 'board', text: ['NEFTEBAZA', 'FUEL DEPOT'] }], ['lamp', 12], ['tank', 22, { d: 8, h: 6.5 }], ['tank', 34, { d: 6, h: 5 }], ['pump', 45], ['lamp', 92], ['bldg', 101, { w: 8, h: 3.6, wall: '#9a9488', roof: 'flat', door: 'small', win: 2, sign: 'NEFTEBAZA' }]] },
  port: { len: 120, surf: S_SLABS, zone: [44, 88], zk: 'posts', spawn: 66, wall: 'blocks', tail: 'quay', bg: [['cranes', 2, 20, 40]],
    items: [['sign', 6, { kind: 'board', text: ['RIVER LANDING', 'WINTER PORT'] }], ['lamp', 12], ['bldg', 27, { w: 16, h: 6, wall: '#7d8794', roof: 'shed', door: 'big', sign: 'SKLAD No 2' }], ['crates', 40], ['lamp', 92], ['crane', 104], ['bollard', 114]] },
  cut12: { len: 100, surf: S_RUTS, zone: [40, 82], zk: 'posts', spawn: 60, wall: 'logs', forest: 'dense',
    items: [['sign', 6, { kind: 'board', text: ['CUTTING No 12', 'LOGGING SITE'] }], ['vagon', 18], ['logpile', 30, { n: 8, len: 6 }], ['barrels', 37], ['logpile', 88, { n: 9, len: 7 }], ['stump', 94], ['stump', 70, { z: 0.6 }]] },
  mine: { len: 120, surf: S_GRAVEL, zone: [46, 90], zk: 'gantry', spawn: 68, wall: 'rock', bg: [['headframe', 2, 10, 60]],
    items: [['sign', 6, { kind: 'board', text: ['RUDNIK SEVERNY', 'COAL MINE'] }], ['lamp', 12], ['bldg', 25, { w: 11, h: 5, wall: '#8a6a52', roof: 'gable', door: 'small', win: 3, sign: 'SHAKHTA', lit: true }], ['heap', 39, { col: '#2b2a2b', w: 8, h: 3 }], ['lamp', 94], ['heap', 104, { col: '#2b2a2b', w: 10, h: 3.6 }]] },
  lesnoy: { len: 92, surf: S_SNOW, zone: [40, 76], zk: 'posts', spawn: 58, wall: 'fence', forest: 'dense', bg: [['village', 2, 16, 40]],
    items: [['sign', 6, { kind: 'board', text: ['LESNOY', 'VILLAGE'] }], ['izba', 17], ['izba', 30, { w: 6 }], ['well', 38], ['izba', 83, { w: 7 }]] },
  sosn: { len: 100, surf: S_SNOW, zone: [44, 84], zk: 'posts', spawn: 64, wall: 'fence', forest: 'birch', bg: [['village', 2, 20, 60]],
    items: [['sign', 6, { kind: 'board', text: ['SOSNOVKA', 'VILLAGE'] }], ['izba', 16], ['bldg', 29, { w: 9, h: 3.6, wall: '#a9875e', roof: 'gable', door: 'small', win: 2, sign: 'MAGAZIN', lit: true }], ['vboard', 39, { secret: 'south' }], ['izba', 90, { w: 7 }]] },
  rail: { len: 130, surf: S_SLABS, zone: [42, 90], zk: 'gantry', spawn: 66, wall: 'buffer', bg: [['train', 2, 30, 66]],
    items: [['sign', 6, { kind: 'board', text: ['TAYOZHNY', 'RAILWAY SIDING'] }], ['lamp', 12], ['bldg', 27, { w: 14, h: 5.5, wall: '#b58a4e', roof: 'gable', door: 'small', win: 3, sign: 'TAYOZHNY', lit: true }], ['lamp', 94], ['stack', 104], ['wagon', 117]] },
  pit: { len: 100, surf: S_GRAVEL, zone: [40, 80], zk: 'posts', spawn: 60, wall: 'rock', forest: 'sparse',
    items: [['sign', 6, { kind: 'board', text: ['GRAVEL PIT', 'KARIER'] }], ['excavator', 21], ['heap', 33, { col: '#8a8177', w: 9, h: 3.4 }], ['heap', 88, { col: '#8a8177', w: 11, h: 4 }]] },
  pulp: { len: 140, surf: S_SLABS, zone: [42, 90], zk: 'gantry', spawn: 66, wall: 'concrete', bg: [['chimney', 2, 26, 110]],
    items: [['sign', 6, { kind: 'board', text: ['ZARECHNY', 'PULP MILL'] }], ['lamp', 12], ['logpile', 22, { n: 9, len: 7 }], ['logpile', 31, { n: 7, len: 6 }], ['lamp', 94], ['bldg', 116, { w: 30, h: 10, wall: '#8f8a80', roof: 'flat', door: 'big', win: 6, sign: 'ZARECHNY TsBK', lit: true }]] },
  zar: { len: 100, surf: S_SNOW, zone: [40, 80], zk: 'posts', spawn: 60, wall: 'fence', forest: 'birch', bg: [['village', 2, 22, 50]],
    items: [['sign', 6, { kind: 'board', text: ['ZARECHYE', 'VILLAGE'] }], ['izba', 16], ['church', 30], ['izba', 86, { w: 7 }], ['well', 93]] },
};
// salvage hidden along the roads (s: metres along the road from its a end)
const FINDS = [
  { id: 'f_ctis', edge: 'e1', s: 176, cat: 'ctis', part: 'ctis', cond: 0.8, name: 'Central tire inflation kit', where: 'by the culvert' },
  { id: 'f_chains', edge: 'e3', s: 471, cat: 'tires', part: 'chains', cond: 1, name: 'Snow chains', where: 'at the summit cairn' },
  { id: 'f_win', edge: 'e5', s: 127, cat: 'tires', part: 'win', cond: 0.9, name: 'Studded winter tires', where: 'at the fishing hut' },
  { id: 'f_rad', edge: 'e5', s: 657, cat: 'radiator', part: 'rh', cond: 0.85, name: 'Heavy-duty radiator', where: 'by the old bridge' },
  { id: 'f_diesel', edge: 'e7', s: 501, cat: 'engine', part: 'i683', cond: 0.55, name: '8.3 turbo diesel (worn)', where: 'in the old wreck' },
  { id: 'f_mt', edge: 'e11', s: 404, cat: 'tires', part: 'mt', cond: 0.85, name: 'Mud-terrain tires', where: 'by the log crossing' },
  { id: 'f_brakes', edge: 'e13', s: 530, cat: 'brakes', part: 'bh', cond: 0.9, name: 'Heavy-duty brakes', where: 'by the upturned boat' },
  { id: 'f_lift', edge: 'e16', s: 312, cat: 'lift', part: 'l2', cond: 0.9, name: 'Lift kit + 43" tires', where: 'at the hunters\' hut' },
  { id: 'f_axle', edge: 'e25', s: 420, cat: 'gearbox', part: 'g10cc', cond: 0.8, name: '5-speed with 2-speed axle', where: 'under the fallen trees' },
  { id: 'f_tank', edge: 'e26', s: 1310, cat: 'tank', part: 'k2', cond: 0.85, name: 'Extra fuel tank', where: 'in the abandoned hamlet' },
];
const FOREST = {
  taiga: { gap: [3.5, 13], pick: r => r() < 0.82 ? 'spruce' : 'birch' },
  dense: { gap: [1.8, 5.5], pick: r => r() < 0.88 ? 'spruce' : 'birch', hk: 1.12 },
  birch: { gap: [3.5, 12], pick: r => r() < 0.55 ? 'birch' : 'spruce' },
  swamp: { gap: [3.5, 13], pick: r => r() < 0.55 ? 'birch' : r() < 0.5 ? 'dwarf' : null },
  sparse: { gap: [3.5, 13], pick: r => r() < 0.25 ? 'spruce' : null },
};
const km = d => (d / 1000).toFixed(1);

// ---------- graph ----------
const ADJ = {};
for (const id in NODES) ADJ[id] = [];
for (const id in EDGES) { const E = EDGES[id]; E.id = id; ADJ[E.a].push({ edge: id, other: E.b, rev: false }); ADJ[E.b].push({ edge: id, other: E.a, rev: true }); }
function nodeLen(id) { const N = NODES[id]; return N.kind === 'yard' ? YARDS[id].len : (N.padLen || 60); }
// shortest driving distance between two nodes that does not enter `avoid`, plus the path
function route(from, to, avoid, found) {
  if (from === to) return { d: 0, path: [from], edges: [] };
  const dist = { [from]: 0 }, prev = {}, done = new Set(), Q = [from];
  while (Q.length) {
    let bi = 0; for (let i = 1; i < Q.length; i++) if (dist[Q[i]] < dist[Q[bi]]) bi = i;
    const u = Q.splice(bi, 1)[0]; if (done.has(u)) continue; done.add(u);
    if (u === to) break;
    if (u !== from && NODES[u].kind === 'yard' && ADJ[u].length < 2) continue; // dead-end yards can't be passed through
    for (const a of ADJ[u]) {
      const E = EDGES[a.edge]; if (E.secret && found && !found(E.secret)) continue;
      if (avoid && avoid.has(a.other) && a.other !== to) continue;
      const nd = dist[u] + E.len + (a.other === to ? 0 : nodeLen(a.other));
      if (dist[a.other] === undefined || nd < dist[a.other]) { dist[a.other] = nd; prev[a.other] = [u, a.edge]; Q.push(a.other); }
    }
  }
  if (dist[to] === undefined) return { d: Infinity, path: [], edges: [] };
  const path = [to], edges = []; let n = to; while (prev[n]) { edges.unshift(prev[n][1]); n = prev[n][0]; path.unshift(n); }
  return { d: dist[to], path, edges };
}

// ---------- pieces: side-on profiles of roads, pads and yards, built once and reused ----------
const PIECES = new Map();
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function buildPiece(forest, seed, fill) {
  const c = new Course(seed % 100000); c.start(0);
  const blocks = [], zones = [], rnd = mulberry32(seed);
  const P = {
    rnd, c,
    block: (a, b) => blocks.push([a, b]),
    zone: (a, b, st) => zones.push([a, b, st]),
    poles: (a, b, gap, skip) => { for (let x = a; x < b; x += gap) { if (skip && skip.some(s => Math.abs(x - s) < 8)) continue; c.add('pole', x, { h: 6.3 }); } },
    rocks: (a, b, p) => { for (let x = a; x < b; x += 9 + rnd() * 16) if (rnd() < p) c.add('rock', x, { r: 0.5 + rnd() * 1.2, z: 0.2 + rnd() * 0.6 }); },
    firs: (a, b, gap) => { for (let x = a; x < b; x += gap) c.add('fir', x); },
    stumps: (a, b, p) => { for (let x = a; x < b; x += 4 + rnd() * 9) if (rnd() < p) c.add('stump', x, { z: rnd() * 0.8 }); },
    fallen: (a, b, p) => { for (let x = a; x < b; x += 14 + rnd() * 30) if (rnd() < p) c.add('fallen', x, { z: 0.3 + rnd() * 0.6, len: 5 + rnd() * 4 }); },
    pipe: (a, b) => { for (let x = a; x < b - 20; x += 24) c.add('pipe', x, { x1: x + 24, z: 0.35 }); },
  };
  fill(c, P);
  // trees, kept off ice, water and the things the road is built around
  for (let i = 0; i < c.n; i++) if (c.under[i] === 1 || c.under[i] === 3) { let j = i; while (j + 1 < c.n && (c.under[j + 1] === 1 || c.under[j + 1] === 3)) j++; blocks.push([c.X0 + i * DX - 3, c.X0 + j * DX + 3]); i = j; }
  for (const d of c.decor) if (d.t !== 'pole' && d.t !== 'rock' && d.t !== 'marker' && d.t !== 'snowpole' && d.t !== 'fir' && d.t !== 'stump' && d.t !== 'fallen') blocks.push([d.x - 4, (d.x1 === undefined ? d.x : d.x1) + 4]);
  const st0 = forest && FOREST[forest];
  let x = 1;
  while (x < c.x - 2) {
    const zn = zones.find(z => x >= z[0] && x < z[1]), st = zn ? (zn[2] === 'none' ? null : FOREST[zn[2]]) : st0;
    x += st ? st.gap[0] + rnd() * st.gap[1] : 6;
    if (!st || blocks.some(b => x > b[0] && x < b[1])) continue;
    const t = st.pick(rnd); if (!t) continue;
    const z = rnd();
    c.add(t, x, { h: (t === 'dwarf' ? 2.5 : t === 'birch' ? 7 : 9) * (0.65 + rnd() * 0.6) * (st.hk || 1), z, lean: (rnd() - 0.5) * 0.06 });
  }
  return { y: c.y, s: c.s, soft: c.soft, under: c.under, vis: c.vis, bot: c.bot, decor: c.decor, marks: c.marks, solids: c.solids, bgZones: c.bgZones, len: c.x, n: c.n };
}
function pieceStats(P) {
  const mix = new Array(8).fill(0); let up = 0, down = 0, maxG = 0, lo = 1e9, hi = -1e9, ice = 0, deep = 0, last = P.y[0];
  for (let i = 0; i < P.n; i += 4) { const h = P.y[i]; mix[P.s[i]] += 2; if (P.s[i] === S_ICE && P.under[i]) ice += 2; if (P.s[i] === S_DEEP) deep += 2; if (h > last) up += h - last; else down += last - h; last = h; lo = Math.min(lo, h); hi = Math.max(hi, h); }
  for (let i = 0; i + 40 < P.n; i += 10) maxG = Math.max(maxG, Math.abs(P.y[i + 40] - P.y[i]) / 20);
  return { mix, up, down, maxG, lo, hi, ice, deep };
}
function edgePiece(id) {
  let P = PIECES.get('e:' + id); if (P) return P;
  const E = EDGES[id];
  P = buildPiece(E.forest, hashStr(id) % 99991 + 11, (c, H) => E.build(c, H));
  const dy = NODES[E.b].alt - NODES[E.a].alt - P.y[P.n - 1];
  if (Math.abs(dy) > 1e-6) for (let i = 0; i < P.n; i++) { const f = smooth(i / (P.n - 1)); P.y[i] += dy * f; if (!isNaN(P.vis[i])) P.vis[i] += dy * f; }
  // the most hidden roads: their deep snow has no bottom a tyre can reach
  if (E.bottomless) for (let i = 0; i < P.n; i++) P.bot[i] = P.s[i] === S_DEEP ? 1 : 0;
  P.stats = pieceStats(P);
  PIECES.set('e:' + id, P); return P;
}
// junction pad: a flat stretch with the signpost and the side roads branching off
function padPiece(id) {
  let P = PIECES.get('p:' + id); if (P) return P;
  const N = NODES[id], len = nodeLen(id), ice = N.pad === 'ice';
  P = buildPiece('taiga', hashStr(id) % 99991 + 7, (c, H) => {
    if (ice) { iceSec(c, len, {}); H.zone(0, len, 'none'); H.firs(16, len - 4, 22); }
    else c.sec(len, 0, N.pad === 'gravel' ? S_GRAVEL : S_SNOW, { amp: 0.1, wl: 20, rough: 0.02 });
    c.add('fsign', 4, { node: id });
    c.add('sideroads', 30, { n: Math.max(0, ADJ[id].length - 2), ice });
  });
  PIECES.set('p:' + id, P); return P;
}
// what lies past an undecided junction: road for the camera to look at, replaced once you pick
function tailPiece(style) {
  let P = PIECES.get('t:' + style); if (P) return P;
  P = buildPiece(style === 'ice' ? null : 'taiga', 31, c => { if (style === 'ice') iceSec(c, 110, {}); else c.sec(110, 0, style === 'gravel' ? S_GRAVEL : style === 'slabs' ? S_SLABS : S_SNOW, { amp: 0.2, wl: 30, rough: 0.02 }); });
  PIECES.set('t:' + style, P); return P;
}
// yard, laid out from the road (u = 0). mode 'end': closed at the far end; 'start' is the same yard run backwards;
// 'pass': the road carries on through it
function yardPiece(id, mode) {
  const key = 'y:' + id + ':' + (mode === 'pass' ? 'pass' : 'end');
  let P = PIECES.get(key); if (P) return P;
  const Y = YARDS[id], len = Y.len, closed = mode !== 'pass';
  P = buildPiece(Y.forest || 'taiga', hashStr(key) % 99991 + 3, (c, H) => {
    c.sec(len, 0, Y.surf, { amp: 0.06, wl: 30, rough: 0, edge: 6 });
    for (const [t, u, o] of Y.items) { if (!closed && u > len - 10) continue; c.add(t, u, Object.assign({}, o || {})); }
    c.add('zone', Y.zone[0], { x1: Y.zone[1], kind: Y.zk });
    if (closed) {
      const wx = len - 2.8;
      c.add('barrier', wx, { kind: Y.wall });
      c.solids.push({ x0: wx - 0.6, x1: wx + 0.6, y0: -0.4, y1: Y.wall === 'fence' ? 2.2 : Y.wall === 'buffer' ? 1.3 : 2.4, k: Y.wall });
      if (Y.tail === 'quay') { c.sec(6, 0, Y.surf, { amp: 0, shape: 'l' }); c.sec(1, -3.2, S_ROCK, { amp: 0, shape: 'l' }); iceSec(c, 36, { under: 1 }); c.add('barge', len + 26); H.zone(len, len + 50, 'none'); }
      else c.sec(36, 0.4, Y.surf === S_SLABS ? S_SNOW : Y.surf, { amp: 0.15, wl: 20, rough: 0.02 });
      H.block(0, len - 1);
    } else { c.add('fsign', len - 6, { node: id }); H.block(0, len); }
    for (const [kind, layer, w, u] of Y.bg || []) c.bgZones.push({ wx: u, layer, w, kind });
  });
  P.zone = Y.zone; P.spawn = Y.spawn; P.closed = closed;
  PIECES.set(key, P); return P;
}

// ---------- a drive, built as you go ----------
class Trip {
  // o: { dest, mode: 'job'|'travel'|'free', rescue: { edge, s } (the stranded truck), found(secret) }
  constructor(start, o) {
    o = o || {};
    this.start = start; this.dest = o.dest || null; this.mode = o.mode || (this.dest ? 'travel' : 'free');
    this.rescue = o.rescue || null; this.rescueTaken = false; this.found = o.found || (() => true);
    this.onEdge = o.onEdge || null;
    const c = this.c = new Course(1979); c.start(0); c.trip = this;
    this.visited = new Set([start]); this.pending = null; this.done = false; this.endNode = null; this.decisions = [];
    // a truck left out on a road carries on from where it stands: the drive starts on that road, headed the way it
    // was going (o.onRoad = { edge, s from the road's a end, dir +1 a to b, -1 b to a })
    const tail = o.tail || 0;   // a trailer behind the truck needs that much road behind the spawn point
    if (o.onRoad) {
      const { edge, s, dir } = o.onRoad, E = EDGES[edge], rev = dir < 0, from = rev ? E.b : E.a, to = rev ? E.a : E.b;
      this.start = from; this.visited = new Set([from]);
      this.closedStart(c);
      const r = c.appendPiece(edgePiece(edge), rev, { kind: 'edge', edge, from, to });
      this.spawnX = clamp(r.X(s), r.x0 + 12 + tail, r.x1 - 12); this.autoSigns(r.x0, r.x1);
      if (this.rescue && edge === this.rescue.edge) this.rescueTaken = true;
      this.startEdge = { o: { edge, other: to, rev }, r };
      if (this.onEdge) this.onEdge(this.startEdge.o, r, this);
      this.arrive(to, edge);
      return;
    }
    // unloading in the yard the truck was towed to: a short stretch of its approach, then the yard itself
    if (o.inYard) {
      this.closedStart(c);
      c.sec(36 + tail, 0, (YARDS[start] || {}).surf === S_SLABS ? S_GRAVEL : S_SNOW, { amp: 0.1, rough: 0.02 });
      this.spawnX = 12 + tail;
      const yp = yardPiece(start, 'end'), r = c.appendPiece(yp, false, { kind: 'yard', node: start, role: 'end' });
      this.addZone(start, yp, r, 'end'); this.done = true; this.endNode = start;
      return;
    }
    const yp = yardPiece(start, 'start'), r = c.appendPiece(yp, true, { kind: 'yard', node: start, role: 'start' });
    this.spawnX = r.X(yp.spawn); this.addZone(start, yp, r, 'start');
    this.leave(start, null, r);
  }
  // the way back is closed for this drive: a log barrier at the very start
  closedStart(c) {
    c.sec(6, 0, S_SNOW, { amp: 0 }); c.add('barrier', 2.5, { kind: 'logs' });
    c.solids.push({ x0: 1.9, x1: 3.1, y0: c.cur - 0.4, y1: c.cur + 2.4, k: 'logs' });
  }
  addZone(node, yp, r, role) { const a = r.X(yp.zone[0]), b = r.X(yp.zone[1]); this.c.zones.push({ node, x0: Math.min(a, b), x1: Math.max(a, b), role }); }
  // where you can go from a node: no U-turns, secret roads only once found, and only roads that still lead to
  // where the drive is headed without coming back through a place you have already been
  options(node, inEdge) {
    const out = [];
    for (const a of ADJ[node]) {
      if (a.edge === inEdge) continue;
      const E = EDGES[a.edge]; if (E.secret && !this.found(E.secret)) continue;
      let d = 0;
      if (this.rescue && !this.rescueTaken) {
        const R = EDGES[this.rescue.edge];
        if (a.edge === this.rescue.edge) d = E.len + (a.other === this.dest ? 0 : nodeLen(a.other) + route(a.other, this.dest, new Set([node]), this.found).d);
        else if (this.visited.has(a.other)) d = Infinity;
        else {
          d = Infinity;
          for (const [p, q] of [[R.a, R.b], [R.b, R.a]]) {
            const r1 = a.other === p ? { d: 0 } : route(a.other, p, this.visited, this.found); if (r1.d === Infinity) continue;
            const r2 = q === this.dest ? { d: 0 } : route(q, this.dest, new Set([p]), this.found);
            d = Math.min(d, E.len + nodeLen(a.other) + r1.d + R.len + r2.d);
          }
        }
      } else if (this.dest) {
        if (a.other === this.dest) d = E.len;
        else if (this.visited.has(a.other)) d = Infinity;
        else d = E.len + nodeLen(a.other) + route(a.other, this.dest, this.visited, this.found).d;
      }
      if (!(d < Infinity)) continue;
      out.push({ edge: a.edge, other: a.other, rev: a.rev, d, rescue: !!(this.rescue && !this.rescueTaken) && (a.edge === this.rescue.edge || false) });
    }
    if (this.dest) out.sort((p, q) => p.d - q.d);
    // which way the stranded truck lies: the option on its best route
    if (this.rescue && !this.rescueTaken && out.length) out[0].towards = true;
    return out;
  }
  leave(node, inEdge, r) {
    const opts = this.options(node, inEdge);
    this.setSign(r, opts);
    if (!opts.length) { this.deadEnd(); return; }
    if (opts.length === 1) { this.take(opts[0]); return; }
    const st = NODES[node].kind === 'yard' ? (YARDS[node].surf === S_SLABS ? 'slabs' : YARDS[node].surf === S_GRAVEL ? 'gravel' : 'snow') : (NODES[node].pad || 'snow');
    // decide by the end of the pad; leaving the start yard, by the gate
    const x = this.c.x, start = node === this.start && this.c.legs.length <= 1;
    this.pending = { node, inEdge, x, opts, shown: false, r, auto: start ? x - 12 : x - 70, show: start ? -1e9 : x - 330 };
    this.c.appendPiece(tailPiece(st), false, null);
  }
  // the signpost at a junction or yard exit lists the roads you can take from there
  setSign(r, opts) {
    const d = this.c.decorIn(r.x0, r.x1).filter(q => q.t === 'fsign').pop(); if (!d) return;
    d.opts = opts.map(o => ({ id: o.edge, label: EDGES[o.edge].short + (this.dest ? ' ' + km(o.d) : ''), secret: !!EDGES[o.edge].secret }));
    d.optKey = d.opts.map(o => o.label + (o.secret ? '*' : '')).join('|') + (d.pick ? '>' + d.pick : '');
  }
  refresh() {
    const p = this.pending; if (!p) return false;
    p.opts = this.options(p.node, p.inEdge); this.setSign(p.r, p.opts); p.shown = false; return true;
  }
  choose(edge) {
    const p = this.pending; if (!p) return false;
    const o = p.opts.find(q => q.edge === edge); if (!o) return false;
    this.pending = null; this.c.truncate(p.x);
    const d = this.c.decorIn(p.r.x0, p.r.x1).filter(q => q.t === 'fsign').pop(); if (d) { d.pick = edge; d.optKey += '>' + edge; }
    this.decisions.push({ node: p.node, edge });
    this.take(o); return true;
  }
  take(o) {
    const E = EDGES[o.edge], from = o.rev ? E.b : E.a;
    const r = this.c.appendPiece(edgePiece(o.edge), o.rev, { kind: 'edge', edge: o.edge, from, to: o.other });
    this.autoSigns(r.x0, r.x1);
    if (this.rescue && o.edge === this.rescue.edge) { this.rescueTaken = true; this.visited = new Set([from]); }
    if (this.onEdge) this.onEdge(o, r, this);
    this.arrive(o.other, o.edge);
  }
  arrive(node, inEdge) {
    this.visited.add(node);
    const N = NODES[node], isDest = this.dest === node && (!this.rescue || this.rescueTaken);
    const opts = isDest ? [] : this.options(node, inEdge);
    if (N.kind === 'yard' && !opts.length) {
      const yp = yardPiece(node, 'end'), r = this.c.appendPiece(yp, false, { kind: 'yard', node, role: 'end' });
      this.addZone(node, yp, r, 'end'); this.done = true; this.endNode = node; return;
    }
    let r;
    if (N.kind === 'yard') { const yp = yardPiece(node, 'pass'); r = this.c.appendPiece(yp, false, { kind: 'yard', node, role: 'pass' }); this.addZone(node, yp, r, 'pass'); }
    else r = this.c.appendPiece(padPiece(node), false, { kind: 'pad', node });
    this.leave(node, inEdge, r);
  }
  // no way on (should not happen on this network): a closed road
  deadEnd() {
    const c = this.c, x = c.x;
    c.sec(8, 0, S_SNOW, { amp: 0.1 }); c.add('barrier', x + 4, { kind: 'logs' }); c.solids.push({ x0: x + 3.4, x1: x + 4.6, y0: c.cur - 0.4, y1: c.cur + 2.4, k: 'logs' });
    c.sec(30, 0, S_SNOW, { amp: 0.2 }); c.edit(x); this.done = true;
  }
  // signs that depend on the direction of travel: grade warnings, ice crossings, km posts from the start
  autoSigns(x0, x1) {
    const c = this.c, busy = at => c.decorIn(at - 6, at + 6).some(d => Math.abs(d.x - at) < 5 && d.t !== 'pole' && d.t !== 'spruce' && d.t !== 'birch' && d.t !== 'dwarf' && d.t !== 'rock' && d.t !== 'fir' && d.t !== 'marker' && d.t !== 'stump' && d.t !== 'snowpole');
    let x = x0 + 30, last = -1e9;
    while (x < x1 - 20) {
      const g = (c.hAt(x + 20) - c.hAt(x)) / 20;
      if (Math.abs(g) > 0.1) {
        let gm = 0; for (let s = x; s < Math.min(x1, x + 180); s += 3) gm = Math.max(gm, (c.hAt(s + 15) - c.hAt(s)) / 15 * sgn(g));
        let at = x - 26; for (let k = 0; k < 6 && busy(at); k++) at -= 4;
        if (at > x0 + 2 && at - last > 60) { c.add('warn', at, g > 0 ? { text: Math.round(gm * 100) + '%', icon: 'grade' } : { text: 'LOW GEAR', icon: 'down' }); last = at; }
        x += 190;
      } else x += 4;
    }
    for (let i = c.ii(x0) + 1; i < c.ii(x1); i++) {
      if (c.under[i] === 1 && c.s[i] === S_ICE && c.under[i - 1] !== 1) {
        let j = i; while (j < c.n - 1 && c.under[j + 1] === 1) j++;
        const at = c.X0 + i * DX - 14;
        if ((j - i) * DX > 50 && at > x0 && c.under[c.ii(at)] !== 1 && !busy(at)) c.add('icesign', at);
        i = j;
      }
    }
    for (let d = Math.ceil((x0 - this.spawnX + 1) / 500) * 500; this.spawnX + d < x1 - 5; d += 500) {
      const at = this.spawnX + d; if (d > 0 && at > x0 + 5 && !busy(at) && c.under[c.ii(at)] !== 1) c.add('kmpost', at, { label: km(d) });
    }
  }
  // where a course position is: on a road (edge, metres from its a end) or at a node
  locate(x) {
    const L = this.c.legs; let leg = L[0];
    for (const l of L) if (x >= l.x0) leg = l;
    if (!leg) return { node: this.start };
    if (leg.kind !== 'edge') return { node: leg.node, leg };
    const u = clamp(x - leg.x0, 0, leg.L), s = leg.rev ? leg.L - u : u;
    return { edge: leg.edge, s, leg };
  }
  // the junction coming up next and how far the destination is from there
  remaining(x) {
    if (this.done) { const z = this.c.zones[this.c.zones.length - 1]; return Math.max(0, z.x0 + 20 - x); }
    const p = this.pending; if (!p) return 0;
    return Math.max(0, p.x - x) + (p.opts.length ? p.opts[0].d : 0);
  }
}
