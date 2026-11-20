# Build the Polaris game art from Lucas's pickup sheets: the magenta base truck and its parts (prep_pk.py output) and
# the side-view bull bar off his orange sheet.
#   python3 -I build_pk.py <prep dir> <orange sheet.png> <out dir> [webp quality]
# Scale: his 4200 mm wheelbase. The frame origin is at mid-wheelbase, 1.0 m above the ground.
# Writes the body (paint as magenta, the wheel wells dark above the axle, open below), the livery zones, two stock
# wheels and an off-road wheel (their rims as paint so the rim colour can be picked), the add-on layers (cage, roof
# rack with its load, rock sliders with their tank, bull bar), meta.json / urls.json, and preview pictures.
import sys, os, io, json, base64, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi, optimize

P, orange_src, out = sys.argv[1], sys.argv[2], sys.argv[3]
q = int(sys.argv[4]) if len(sys.argv) > 4 else 92
os.makedirs(out, exist_ok=True)
def ld(n): return np.array(Image.open(os.path.join(P, n)).convert('RGBA')).astype(np.float32)
BOX = json.load(open(os.path.join(P, 'boxes.json')))

# ---------- the base truck, turned to face right like every truck in the game
truck = ld('truck.png')[:, ::-1].copy()
H, W = truck.shape[:2]
WHEELS = [(613.89, 221.67), (182.84, 220.01)]   # front, rear (rim circle fits), in the game's axle order
RT, RIM = 58.5, 32.0                             # tyre and rim radius in pixels
WB = 4.2
s = (WHEELS[0][0] - WHEELS[1][0]) / WB          # pixels per metre
ox = (WHEELS[0][0] + WHEELS[1][0]) / 2
ground = (WHEELS[0][1] + WHEELS[1][1]) / 2 + RT
oy = ground - 1.0 * s
def place(x0, y0, w, h, k=1.0):   # a picture's corner (pixels on the truck canvas) -> its box in metres
    return {'x0': (x0 - ox) / s, 'y1': (oy - y0) / s, 'w': w * k / s, 'h': h * k / s}
def M(px, py): return [round((px - ox) / s, 3), round((oy - py) / s, 3)]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

total = 0
def webp(img, name, lossless=False):
    global total
    b = io.BytesIO()
    if lossless: img.save(b, 'WEBP', lossless=True, quality=100, method=6)
    else: img.save(b, 'WEBP', quality=q, alpha_quality=100, method=6)
    data = b.getvalue(); total += len(data)
    open(os.path.join(out, name + '.webp'), 'wb').write(data)
    return 'data:image/webp;base64,' + base64.b64encode(data).decode()
def toimg(a): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')

# ---------- paint: the magenta becomes the body colour. Each pixel: a grey part (green) plus an amount of magenta;
# the main panel tone (226 here) is taken as the full colour
R, G, B, A = truck[..., 0], truck[..., 1], truck[..., 2], truck[..., 3]
mag = np.minimum(R, B) - G
paint = (mag > 30) & (A > 10)
m2 = np.clip(mag * (255 / 226), 0, 255)
truck[..., 0] = np.where(paint, np.clip(G + m2, 0, 255), R)
truck[..., 2] = np.where(paint, np.clip(G + m2, 0, 255), B)
# windows: the drawing's white glass becomes a light blue-grey tint, like the orange sheet's
Lum = truck[..., :3].mean(2); chroma = truck[..., :3].max(2) - truck[..., :3].min(2)
cab = (xx > ox - 0.45 * s) & (xx < ox + 1.5 * s) & (yy < oy - 0.72 * s) & (yy > oy - 1.56 * s)
glass = cab & (Lum > 160) & (chroma < 30) & (A > 200)
gl = ndi.binary_opening(glass, iterations=1)
lab, n = ndi.label(gl)
for i, sl in enumerate(ndi.find_objects(lab), 1):
    mm = lab[sl] == i
    if mm.sum() < 150: gl[sl] &= ~mm   # the mirror and small trim keep their colour
tint = np.array([196, 210, 220], np.float32) / 235
truck[gl, :3] = np.clip(truck[gl, :3] * tint, 0, 255)

# ---------- body: wheels out. Above the axle the well behind the tyre is dark; below it there is only air
body = truck.copy()
for cx, cy in WHEELS:
    d = np.hypot(xx - cx, yy - cy)
    disc = d <= RT + 2.5
    up = disc & (yy <= cy + 0.12 * RT)
    body[up, 0:3] = [34, 33, 32]; body[up, 3] = 255
    # below the axle: the tyre and the specks of checker left around it go
    body[(d <= RT + 12) & (yy > cy + 0.12 * RT), 3] = 0
# the bits of the drawn ground line under the wheels
body[yy > ground - 2, 3] = 0
def bbox(a, pad=2):
    ys, xs = np.nonzero(a[..., 3] > 6)
    return [max(0, xs.min() - pad), max(0, ys.min() - pad), min(W, xs.max() + pad + 1), min(H, ys.max() + pad + 1)]
bb = bbox(body)
urls = {'body': webp(toimg(body[bb[1]:bb[3], bb[0]:bb[2]]), 'body')}
meta = dict(ppm=round(s, 3), **place(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]), ground=-1.0, wheels=[], layers={})

# ---------- livery zones over the body: red = roof (above the window sills), green = below the double crease line,
# blue 255 = a band under the crease, 128 = the stripe between the two crease lines (opaque RGB: no alpha games)
Y = lambda m: oy - m * s
zones = np.zeros((H, W, 3), np.uint8)
pz = (np.minimum(body[..., 0], body[..., 2]) - body[..., 1] > 20) & (body[..., 3] > 10)
roof = pz & (yy < Y(0.80)) & (xx > ox - 0.45 * s) & (xx < ox + 1.6 * s)
zones[roof, 0] = 255
zones[pz & (yy > Y(0.385)), 1] = 255
zones[pz & (yy > Y(0.385)) & (yy <= Y(0.17)), 2] = 255
zones[pz & (yy >= Y(0.478)) & (yy <= Y(0.382)), 2] = 128
zimg = Image.fromarray(zones[bb[1]:bb[3], bb[0]:bb[2]], 'RGB')
urls['zones'] = webp(zimg, 'zones', lossless=True)

# ---------- wheels: rims become paint (magenta by brightness; slots, nuts and outlines stay grey)
def rim_paint(crop, d, r_face, face_sel):
    Lw = crop[..., :3].mean(2)
    ref = float(np.median(Lw[face_sel])) if face_sel.any() else 200.0
    kk = np.clip(Lw / ref, 0, 1.3)
    m_amt = np.clip(kk, 0, 1) * 255; grey = np.clip((kk - 1) / 0.3, 0, 1) * 60
    enc = np.dstack([grey + m_amt, grey, grey + m_amt]).clip(0, 255)
    crop[face_sel, 0:3] = enc[face_sel]
    return crop
def wheel_sprite(src, cx, cy, rt, r_face, face_fn, darken_tyre=1.0):
    hw = int(np.ceil(rt + 3)); X0, Y0 = int(round(cx)) - hw, int(round(cy)) - hw
    Hs, Ws = src.shape[:2]
    crop = np.zeros((2 * hw, 2 * hw, 4), np.float32)
    ys0, xs0 = max(0, Y0), max(0, X0); ys1, xs1 = min(Hs, Y0 + 2 * hw), min(Ws, X0 + 2 * hw)
    crop[ys0 - Y0:ys1 - Y0, xs0 - X0:xs1 - X0] = src[ys0:ys1, xs0:xs1]
    gy, gx = np.mgrid[0:2 * hw, 0:2 * hw].astype(np.float32)
    d = np.hypot(gx + X0 - cx, gy + Y0 - cy)
    crop[..., 3] = 255 * np.clip(rt + 0.8 - d, 0, 1)
    if darken_tyre != 1.0:
        ring = (d > r_face + 1.5) & (d <= rt + 1)
        crop[ring, :3] *= darken_tyre
    crop = rim_paint(crop, d, r_face, face_fn(crop, d))
    return crop, hw, X0, Y0
def stock_face(crop, d):
    Lw = crop[..., :3].mean(2); ch = crop[..., :3].max(2) - crop[..., :3].min(2)
    return (d <= RIM - 1) & (Lw > 150) & (ch < 30)
for i, (cx, cy) in enumerate(WHEELS):
    crop, hw, X0, Y0 = wheel_sprite(truck, cx, cy, RT, RIM, stock_face, darken_tyre=0.66)
    urls['wheel%d' % i] = webp(toimg(crop), 'wheel%d' % i)
    meta['wheels'].append({'half': hw / s, 'dx': (X0 + hw - cx) / s, 'dy': (cy - (Y0 + hw)) / s, 'r': RT / s})

# the off-road wheel (lugged tyre, beadlock rim): one picture for every wheel; the game scales it to the tyre size
ow = ld('wheelA.png')
oa = ow[..., 3] > 128; oe = oa & ~ndi.binary_erosion(oa); ey, ex = np.nonzero(oe)
res = lambda p: np.hypot(ex - p[0], ey - p[1]) - p[2]
fitc = optimize.least_squares(res, [ow.shape[1] / 2, ow.shape[0] / 2, ow.shape[0] / 2 - 2], loss='soft_l1').x
ocx, ocy, ort = fitc
# the lugs make the outline bumpy: the tyre's radius for scaling is the mean over the lugs and the gaps
def off_face(crop, d):
    # the whole rim face from the beadlock ring in to the hub cap, but not its black outlines
    return (d <= 0.60 * ort) & (d >= 0.13 * ort) & (crop[..., :3].mean(2) > 38)
ocrop, ohw, OX0, OY0 = wheel_sprite(ow, ocx, ocy, ort + 1.5, 0.6 * ort, off_face)
urls['owheel'] = webp(toimg(ocrop), 'owheel')
meta['owheel'] = {'half': ohw / s, 'dx': (OX0 + ohw - ocx) / s, 'dy': (ocy - (OY0 + ohw)) / s, 'r': ort / s}

# ---------- add-on layers, placed on the truck (metres in the truck's frame). Scales: the cage and the rack are on
# the parts sheet at the truck's scale; the sliders are drawn bigger there; the bull bar comes off the orange sheet
LAY = {}
def layer(name, arr, x_left, y_top, k):
    h, w = arr.shape[:2]
    LAY[name] = arr
    meta['layers'][name] = {'x0': x_left, 'y1': y_top, 'w': w * k / s, 'h': h * k / s}
    img = toimg(arr)
    if abs(k - 1) > 1e-3: img = img.convert('RGBa').resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS).convert('RGBA')
    urls[name] = webp(img, name)
cage = ld('cage.png')
# the cage's tall post (sheet x 880) stands at the back of the cab; its top frame sits just over the roof
cb = BOX['cage']; post_dx = (880 - cb[0]) / s
CAB_BACK, ROOF = -0.42, 1.555
layer('cage', cage, CAB_BACK - post_dx, ROOF + 0.20, 1.0)
rack = ld('rack.png')
cg = meta['layers']['cage']
top_l, top_r = cg['x0'] + (727 - cb[0]) / s, cg['x0'] + (1040 - cb[0]) / s
rw, rh = rack.shape[1] / s, rack.shape[0] / s
layer('rack', rack, (top_l + top_r) / 2 - rw / 2, cg['y1'] - 0.07 + rh, 1.0)
sl_ = ld('sliders.png'); K_SL = 0.58
layer('sliders', sl_, -0.30, -0.17, K_SL)

# the bull bar: off the orange sheet's single cab (146 px per metre there), the part in front of the grille
osh = np.array(Image.open(orange_src).convert('RGB')).astype(np.float32)
oL = osh.mean(2); och = osh.max(2) - osh.min(2)
bgw = (oL > 232) & (och < 14)
lab, n = ndi.label(bgw); ids = np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]]); obg = np.isin(lab, ids[ids > 0])
# white gaps inside the bar (in the hoop) are open air too
for i, sl in enumerate(ndi.find_objects(lab), 1):
    if sl is None or i in ids: continue
    mm = lab[sl] == i
    if mm.sum() >= 12 and sl[1].start >= 1060: obg[sl] |= mm
X0b, Y0b, X1b, Y1b = 1058, 548, 1134, 714
reg = np.zeros(oL.shape, bool); reg[Y0b:Y1b, X0b:X1b] = True
hsv = cv2.cvtColor(osh.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
truckbits = (och > 45) | ((oL > 135) & (och < 35))          # the orange body and the light headlamp bezel behind
barm = reg & ~obg & ~truckbits
barm = ndi.binary_opening(barm, iterations=1) | (reg & ~obg & (oL < 60))
lab2, n2 = ndi.label(barm, structure=np.ones((3, 3)))
sizes = ndi.sum(barm, lab2, range(1, n2 + 1)); keep = np.isin(lab2, 1 + np.argsort(sizes)[::-1][:1])
barm = keep
# thin lines left over from the truck behind (fender and headlamp outlines) go: an opening keeps only what is at
# least a tube thick, then the bar's own outline grows back from it
thick = ndi.binary_opening(barm, structure=np.ones((5, 5)))
barm = barm & ndi.binary_dilation(thick, iterations=3)
barm[695:, :1063] = False                              # the truck's own tow point under the bumper
alpha_b = barm.astype(np.float32)
# soft edge against the white
edge = barm & ~ndi.binary_erosion(barm)
alpha_b[edge & obg] = 0
ab = np.clip((255 - oL) / (255 - 18), 0, 1)
alpha_b = np.where(edge, np.minimum(1, ab * 1.15), alpha_b)
bar = np.dstack([osh, alpha_b * 255])[Y0b:Y1b, X0b:X1b]
# orange px -> truck px. By the wheelbases it would be 0.70, but the magenta truck's nose is taller for its size than
# the orange one's, so the bar is drawn a bit bigger to reach from under the bumper to the top of the grille
K_BB = 0.85
FRONT = 3.02
layer('bullbar', bar, FRONT - (1066 - X0b) * K_BB / s, -0.41 + (Y1b - 4 - Y0b) * K_BB / s, K_BB)

# ---------- where things are on this truck (metres), for the game's geometry
meta['ref'] = {'axles': [M(*WHEELS[0]), M(*WHEELS[1])], 'r': round(RT / s, 4), 's': round(s, 3), 'ground': -1.0,
               'owheel_r_px': round(float(ort), 2)}
json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
json.dump(urls, open(os.path.join(out, 'urls.json'), 'w'))
print('scale %.2f px/m, body %s, total %d KB (base64 ~%d KB)' % (s, [round(v, 3) for v in place(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]).values()], total // 1024, total * 4 // 3 // 1024))
print('layers', {k: {kk: round(v, 3) for kk, v in b.items()} for k, b in meta['layers'].items()})
print('owheel r %.2f px = %.3f m' % (ort, ort / s))

# ---------- previews: stock, and with every add-on and the off-road wheels (lifted), on a light ground
def preview(name, layers, offroad, paint_rgb=(181, 110, 62), rim_rgb=(138, 106, 72), lift=0.0, scale=2):
    PAD = 0.6
    X0m, X1m, Y0m, Y1m = -4.3, 3.9, -1.25, 2.55
    Wp, Hp = int((X1m - X0m) * s * scale), int((Y1m - Y0m) * s * scale)
    can = Image.new('RGBA', (Wp, Hp), (226, 232, 238, 255))
    def put(img, x0m, y1m, wm, hm):
        im = img.resize((max(1, int(round(wm * s * scale))), max(1, int(round(hm * s * scale)))), Image.LANCZOS)
        can.alpha_composite(im, (int(round((x0m - X0m) * s * scale)), int(round((Y1m - y1m) * s * scale))))
    def painted(a, col):
        a = a.copy(); g0 = a[..., 1].copy(); mg = np.minimum(a[..., 0], a[..., 2]) - g0; pm = mg > 3
        for c in range(3): a[..., c] = np.where(pm, g0 + mg / 255 * col[c], a[..., c])
        return toimg(a)
    bimg = painted(body[bb[1]:bb[3], bb[0]:bb[2]], paint_rgb)
    put(bimg, meta['x0'], meta['y1'] + lift, meta['w'], meta['h'])
    for i, (cx, cy) in enumerate(WHEELS):
        if offroad:
            rr = RT / s + 0.07 + lift * 0.4
            oi = painted(ocrop, rim_rgb); k = rr / (ort / s); hm = meta['owheel']['half'] * k
            ax, ay = M(cx, cy); ay += (rr - RT / s) - 1e-9
            put(oi, ax - hm, ay - 1.0 + 1.0 + hm, 2 * hm, 2 * hm)
        else:
            cr, hw, X0, Y0 = wheel_sprite(truck, cx, cy, RT, RIM, stock_face, darken_tyre=0.66)
            wi = painted(cr, rim_rgb); ax, ay = M(cx, cy); hm = hw / s
            put(wi, ax - hm, ay + hm, 2 * hm, 2 * hm)
    for n in layers:
        Ly = meta['layers'][n]
        put(toimg(LAY[n]), Ly['x0'], Ly['y1'] + lift, Ly['w'], Ly['h'])
    can.save(os.path.join(out, 'preview_' + name + '.png'))
preview('stock', [], False)
preview('kit', ['sliders', 'cage', 'rack', 'bullbar'], True, lift=0.10)
preview('cage_only', ['cage'], False, paint_rgb=(47, 93, 58), rim_rgb=(205, 210, 212))
