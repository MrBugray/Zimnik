# Zimnik — v0.9

Offline 2D trucking game for Android (HTML5 canvas + planck.js physics, wrapped in a tiny WebView app).

## Starting out
The start screen is a full-screen menu: **Continue**, **Start new game** (double-tap: it wipes the save) and
**Settings**. The gear knob choices live in Settings: start in AUTO or in neutral and manual, the knob's look
(pattern on its face or a lever in an open gate) and the Skinnerd 12-speed's layout (LO/INT/DIR or range +
splitter), next to sound, graphics, frame rate and auto-hold.

You start with the old Polaris and 3,000 ₽. Every other truck has its price (Bars 24,000 ₽, Skinnerd 38,000 ₽,
Skinnerd tractor 52,000 ₽) and every upgrade and add-on costs money; fuel, repairs and tows too. Trucks you buy
stay yours across saves.

## The world
Twelve places (yards) and five junctions joined by 31 roads, three of them hidden until you find them. A drive is
built as you go: the start yard, a road, the next junction pad, the road you pick there, and so on until the yard you
are heading for, which ends in a wall, a fence or the riverbank. Every road can be driven both ways, and no road is
flat for long: they all roll with hills, crests and dips (gentler on the paved stretches, wilder on the back tracks),
so momentum and gear choice matter everywhere, not just on the passes. And every road is broken up: **potholes**
everywhere (wider and deeper on the back tracks), **boulders** lying on the rougher roads, drifted stretches of
bottomless-feeling snow, washboard climbs of frozen ruts and, on the worst tracks, whole **rock gardens**. Speed is
the choice: hit a boulder at 45 km/h and the suspension slams its stops — body damage, maybe a cut tire; crawl it at
walking pace and nothing happens. A pothole taken fast won't always reach the stops, but the tires and springs pay
every time. Deep drifts want aired-down tires and AWD, washboard climbs want the diff locked, rock gardens want a
crawl. Trucks stay
where they finish; each place has its own job board, driven by what the places make and need.

Two steel bridges cross the Zimnyaya for rigs the ice will not carry in the thaw: the Bridge road from the bridge
junction to Sosnovka (1.6 km, against 0.5 km over the Sosnovka crossing) and the East bridge road from the pulp mill
to Zarechye (1.0 km, against 0.56 km over the Zarechye crossing). Longer, but they never crack.

Three roads are harder than the rest. The **Hill road** from the camp to the cutting (1.08 km) climbs in stepped
ramps of up to 28% through rock and drifts. The **Ice crossing** from Lesnoy to the port (0.95 km) drops off the
forest bank onto 340 m of river ice with a weight limit — crack through and you swim. The **Quarry ridge** from the
gravel pit to the railhead (0.7 km) is a rocky track with glazed-ice patches.

## Gears: the knob
There is no low range any more: the gearboxes do the crawling (the Bars has a deep first gear for it). The right of
the dashboard is the shift knob, and what is drawn on it matches the gearbox fitted: a 5-speed H, the 5-speed with
the 2-speed axle lever (LO/HI), the Bars' 10-speed with its split lever, and the Skinnerd 12-speed in one of two
layouts (setting): a LO/INT/DIR lever with four slots, or a range lever and a splitter button. The automatic has R
and D. Two looks (setting): the shift pattern on the knob face, or a lever in an open gate.

With AUTO on the truck shifts and the knob follows. Grab the knob and it is yours (manual): drag it through the gate
and the gear goes in at the end of the slot. The clutch is never yours: it opens whenever the knob leaves a slot or
the truck stops, and closes when a gear goes in. A split or axle lever shifts at once; a range lever waits for the
next slot. Moving to a new slot takes the split half that follows on from the gear you had, so up a slot is the next
gear. Reverse is split too where the box allows: R and R+ (axle), R1–R2 (Bars 10), R1–R3 (Skinnerd LO/INT/DIR) or
R1–R4 (Skinnerd range + splitter). A gear that would over-rev the engine is refused the first time (the knob
bounces back with the rpm it would hit); push it in again within 2.5 s and it goes in, and the engine is hurt.
Start a drive in AUTO, or in neutral and manual (setting). Keys: E/W up, Q/S down, R reverse, N neutral, D AUTO.

## Out on the road
At a junction the road card comes up well before the pad. If you have not picked by the end of it, the truck brakes
to a stop and the drive waits — clock and all — until you choose a road.

About one drive in ten has something waiting out there: a driver **stuck in a drift** on the road ahead (stop and
pull them out for a thank-you in cash and a few minutes on the clock, or drive on by), or a road **snowed in and
closed** — the job stands, but the short way is not on offer and you go round.

Menu during a drive: **Leave it here** (the truck waits at the roadside with its load; in a yard it parks),
**Tow to the closest yard** (the district tow truck: a call-out plus a rate per km, and minutes on the clock; to the
job's destination it drops you at the gate and you drive in and unload yourself), **Call a fuel truck** when the tank
is low (40 L at fuel-truck prices, four minutes), and **Abandon the job** (a 10% fee, the load goes back, you drive on
empty). Tow, fuel and abandon need a second tap. The Map button opens the district map with the drive on it.

A haul stays with its truck until it is delivered or given up: park in a yard on the way, leave it on a road, get
towed somewhere, and the job carries on from there (the job panel: carry on, unload here, call a tow, abandon). A
truck left on a road shows up there on the map, at the roadside when you drive past, and on the job board of your
other trucks: **Fetch your truck**, hook up the tow bar, and bring it (load and trailer too) to its delivery or a
workshop. A truck left on its side needs a tow or another truck before it drives again.

## The clock
The district clock runs while any of your trucks is driving, and the tow truck and the fuel truck add their time.
There are no deadlines: a job waits as long as it has to. What the clock moves is the world — the time of day, the
weather, what services are open and what a load pays (night and bad weather pay more).

## Weather
The weather runs on its own, one spell to the next (clear tends to cloud over, snow can turn to a blizzard, a thaw
is followed by cloud), each change blending in over a minute and a half. A coming thaw is announced: the ice goes
soft. The time of day moves the same way — morning, noon, dusk and night follow the clock while you drive, and the
lights and the pay follow them.

## Snow and grip
Snow has a bottom: a tyre sinks until it reaches packed ground (about 0.1 m plus up to 0.4 m with softness) and from
there grips like packed snow, so a truck slows in drifts but keeps pulling. Only the most hidden tracks (the forest
track and the south bank track) have bottomless drifts. Trucks, trailers and loads are about 10% heavier than in 0.5,
which presses the tyres harder. Each tyre's grip and sinking are read where it actually touches the ground (the
contact point), not straight under the axle, so on a slope or a crest the right patch of surface counts.

## Fuel
Fuel stays in the tank between drives and is bought when you choose, as much as you choose (Fuel tab in the hub:
presets and a slider). Nothing is charged at the end of a job. Pumps differ by place: the depot and the railhead are
cheapest, villages sell at a premium, the mine, pulp mill and cutting sell only diesel, and the gravel pit has none.
Where fuel is trucked in, the pump price follows that place's supply (deliveries of fuel or drums bring it down).
With no pump for your fuel, a fuel truck comes out (up to 100 L, 1.6× price plus a call-out fee); a nearly empty tank
can always get 25 L on credit. Running dry on the road, call the fuel truck from the menu: it brings 40 L. Fuel weighs 0.84 kg/L (diesel)
or 0.74 kg/L (petrol) and rides in the truck's mass. Job cards show the litres a drive should take, learned from what
each truck has been burning.

## Drawn trucks (tools/art)
A truck can be a picture instead of code: a true side view on a transparent background, front to the right, with the
painted areas in flat magenta. `measure.py` fits the tyre circles (1.08 m tyres set the scale) and prints the outline
in metres; `build_art.py` cuts the wheels out as their own sprites, fills the wheel wells dark and scales to 200 px/m
(WebP); `make_js.py` writes `src/44_art_img.js`. In the game the magenta becomes the body colour (each pixel's grey
part plus its magenta amount), the picture is lit by the same palette as the vector art, the wheels turn and follow
the suspension, and each axle hangs at its own height (`anchorYs`) so the wheels rest where the drawing has them.
The shading drawn on the tyres is split off into a layer that stays with the truck while the tyre turns under it.
Lamps (`lamps`), the stack (`exhaust`: position, lean, first puff size, jet) and a second, low outlet (`exhaust2`,
which coughs when the throttle comes on) are placed where the drawing has them.

The Skinnerd 143H tractor is drawn (by Lucas): it has the tractor's parts, upgrades, trailers and jobs. Add-ons work
on it; only the beacon is drawn on it so far. Saves from 0.5.2 move its test copy (`skx`) over to the tractor.

The Polaris is Lucas's flat 2D F-600-type truck (0.9; it replaces the 0.8 art), with two bodies on one chassis
(3.5 m wheelbase), picked in the workshop's Body tab as the "Cab & bed" part: the single-cab pickup (stock: 35"
road tyres, cab roof 2.27 m, a 2.5 m bed with high sides, floor 1.0 m up) and the crew-cab flatbed (lifted on 37"
lugged tyres, four doors, a 2.2 m deck 1.17 m up behind a headache rack). Each body has its own geometry (`GEOM.cc`,
`GEOM.ccf`; `geomKey()` picks it from the parts) and picture (`ART_IMG.cc`, `ART_IMG.ccf`); what the truck carries
follows the body (`capOf(id, cargo, parts)`), and a haul aboard is cut down to fit when the body changes.

The pictures are his 2K side views on white. `prep_wb.py` cuts one off its background (the white flooded from the
edges, white pockets under the deck opened, the outline's soft edge put back). `build_cc.py` makes both bodies'
sprites at 200 px per metre: paint as magenta (the lit panel tone is the full colour, darker tones shade it, brighter
ones become highlights), the wells dark above the axle, the wheels with their rims as paint, livery zones on each
body's crease lines, and the kit fitted to each body: the cage (its tall post at the back of the cab, the top frame
over the roof, the rear frame to the end of the bed or deck), the loaded rack on the cage, the rock sliders under the
doors, the bull bar off the orange sheet. The flatbed's lugged wheel is also the pickup's off-road wheel (lift kit or
mud tyres). The kit pieces come off his parts sheet through `prep_pk.py` (an exact model of the checkerboard drawn
into it: 15 px squares, each square's tone measured, the soft pixels where squares meet bridged, gaps between tubes
found by holding both flat tones, outline edges mixed with the square behind). `make_js.py` merges trucks into
`src/44_art_img.js` without touching the others; the workshop frames a drawn truck by its body, its layers and the
ground.

    python3 -I tools/art/prep_pk.py parts.png kit                       # the kit pieces off the parts sheet
    python3 -I tools/art/prep_wb.py pickup.png pk && python3 -I tools/art/prep_wb.py flatbed.png fb
    python3 -I tools/art/build_cc.py pk fb kit orange.png art 200 92
    python3 -I tools/art/make_js.py src/44_art_img.js cc=art/cc ccf=art/ccf

The pickup's bed holds two pulp bundles, four drums or two crates a tier behind a tailgate; the flatbed's deck two
bundles, three drums or two crates a tier, with only a low lip at the back. Add-ons: the expedition cage (roll cage
over the cab and bed, ladder, rack frame; guards the cab in a roll-over), the loaded roof rack on the cage (crates and
60 L in jerry cans; fitting it fits the cage, taking the cage off takes it too), rock sliders with an 80 L side tank,
the bull bar, the light bar and snorkel (vector parts, placed per body), the beacon. A lift kit (+2" or +4" tyres)
puts the pickup on the lugged wheels too. Paint: body and trim colour, seven liveries (two-tone roof, lower two-tone,
door band, side stripe, company lettering, rescue), five rim finishes, the door number. The older tools for his
earlier sheets (`build_pk.py`, `prep_polaris.py`, `build_polaris.py`) are kept for reference.

    python3 -I tools/art/measure.py truck.png measure.json
    python3 -I tools/art/build_art.py truck.png measure.json art_out 200 94
    python3 -I tools/art/make_js.py src/44_art_img.js skt=art_out

## Layout
- `src/` — game source, concatenated in file-name order by `build.js` into one IIFE
  - `05_data.js` engines, gearboxes and their knob gates (slots, levers, split reverse gears), tires and every other
    part, add-ons, paint, trucks (incl. the Skinnerd tractor), trailers, cargo capacity
  - `10_course.js` the side-on course: surfaces, sections, decor buckets, cutting and extending a drive, river water
  - `11_world.js` the network: places, junctions, all roads (each a hand-made profile), yards and their walls,
    salvage, secrets, routing, and `Trip`, which builds a drive junction by junction
  - `12_economy.js` cargo types, what each place makes and needs, demand, processed stock, job boards, pay
  - `15_geom.js` truck and trailer geometry (axles, fixtures, hitch, fifth wheel, cargo slots)
  - `20_physics.js` vehicles and drivetrain, segmented ground with solid walls, towing (re-attachable), semi-trailers,
    bulk loads, cargo, wear and damage
  - `30_palette.js` time of day × weather looks
  - `39_cache.js` sprite cache: static art is drawn once and blitted
  - `40_render_bg.js`, `41_render_world.js`, `42_decor.js`, `43_trucks_draw.js`, `45_render.js` drawing; `44_art_img.js` drawn truck pictures (generated)
  - `48_map.js` district map: the network to scale, river, lakes, hills, forest, routes, jobs, travel
  - `50_audio.js` synthesized engines (a voice per engine) and effects, `60_hud.js` dashboard, junction cards,
    job board, pause menu, garage UI, `62_knob.js` the shift knob, `70_game.js` rules, trips, saves and loop,
    `71_road.js` the district clock, trucks left on the roads, tows, the random weather
- `build.js` → `dist/index.html` (one self-contained offline page) and `dist/artifact.html`
- `tools/apk/` — APK builder without the Android SDK: `dexgen.py` (hand-assembled WebView activity),
  `build_apk.py` (binary manifest, icon resources, aligned zip, APK Signature Scheme v2).
  The signing key is derived from a fixed seed, so new builds install over old ones (saves are kept).
- `tools/icon.svg` launcher icon, `test/` headless checks

Saves live in the WebView's localStorage under `zimnik.v2` (older saves are migrated; trucks start at the camp).

## Build
    npm install planck@1.5.1 puppeteer-core @fontsource/barlow-condensed
    node build.js
    node tools/render_icon.js icon.png 192
    cd tools/apk && python3 build_apk.py ../../dist/index.html ../../icon.png zimnik.apk <versionCode> <versionName>

## Tests
    node test/sim_node.js route pass|river|zimnik cc|bars|sk pulp|logs|drums     # autopilot: camp to sawmill by that road
    node test/sim_node.js trip <from> <to> <truck> <cargo> "{parts}" "e15,e17"    # any trip, preferring those roads
    node test/sim_node.js launch cc "{gearbox:'g10cc'}"                           # hill start on the 26% pass
    node test/sim_node.js wall sk 40                                              # drive into a yard wall
    node test/sim_node.js hazards                                                 # potholes on all roads; rocks/holes: slow is safe, fast hurts
    node test/shots.js [names]                                                    # screenshots of yards, loads, rigs, map
    node test/drive.js && node test/flow.js && node test/rotated.js               # touch path and the whole game flow
    node test/fuel.js [16x9]                                                      # refuelling, fuel truck, credit, running dry
    node test/art.js                                                              # the drawn truck: garage, paint, driving, lighting
    node test/v06.js                                                              # old save, lamps, both exhausts, tyre shading, bridges, map
    node test/v07.js                                                              # knob, reverse gears, over-rev, leave/tow/fetch, deliveries, weather
    node test/v09.js                                                              # the Polaris, both bodies: liveries, rims, cage, rack, sliders, bull bar, off-road wheels, loads, beacon
    node test/modes.js                                                            # start screen, settings, buying trucks, routing around a closed road
    node test/events.js                                                           # the fork hold, the closed-road event, the stuck driver
    node test/uiaudit.js                                                          # screenshots of the main screens; every settings button reachable
