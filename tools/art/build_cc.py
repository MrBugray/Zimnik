# Build the Polaris's two bodies from Lucas's 2K side views (prep_wb.py output): the single-cab pickup (cc) and the
# crew-cab flatbed (ccf), on the same chassis (3.5 m wheelbase). The kit off his parts sheet (prep_pk.py output: cage,
# loaded rack, rock sliders) and the side-view bull bar off his orange sheet are fitted to each body; the flatbed's
# lugged wheel is the off-road wheel the pickup gets with a lift kit or mud tyres.
#   python3 -I build_cc.py <pk prep dir> <fb prep dir> <parts prep dir> <orange sheet.png> <out dir> [ppm] [webp q]
# Writes <out>/cc and <out>/ccf (meta.json, urls.json, sprites) and previews.
import sys, os, io, json, base64, numpy as np
from PIL import Image
from scipy import ndimage as ndi

PKD, FBD, PARTS, ORANGE, OUT = sys.argv[1:6]
PPM = float(sys.argv[6]) if len(sys.argv) > 6 else 200.0
Q = int(sys.argv[7]) if len(sys.argv) > 7 else 92
WB = 3.5
def rgba(path): return np.array(Image.open(path).convert('RGBA')).astype(np.float32)
def toimg(a): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
def resized(a, k):
    img = toimg(a)
    if abs(k - 1) < 1e-4: return img
    return img.convert('RGBa').resize((max(1, round(a.shape[1] * k)), max(1, round(a.shape[0] * k))), Image.LANCZOS).convert('RGBA')

# ---------- the bodies as drawn: wheel centres (tyre circle fits, front first), tyre radius, paint tones
BODIES = {
    'cc': dict(src=PKD, wheels=[(2635.3, 1084.8), (786.1, 1090.3)], rt=233.45, rim=0.56,
               paint_ref=(197, 37), cab=(-0.36, 1.05, 0.56, 1.32),   # x0, x1 (cab), window sill, roof top + 0.05
               zones=dict(roof=0.56, lower=0.07, band=(-0.06, 0.07), stripe=(0.07, 0.205)),
               kit=dict(post=-0.40, roof=1.27, sliders=(-0.34, -0.55, 0.0040), front=2.50, bumper=-0.47, nose=0.49)),
    'ccf': dict(src=FBD, wheels=[(2527.7, 1046.4), (868.0, 1046.4)], rt=225.65, rim=0.45,
                paint_ref=(245, 2), cab=(-0.33, 1.30, 0.60, 1.23),
                zones=dict(roof=0.60, lower=-0.12, band=(0.225, 0.355), stripe=(0.355, 0.405)),
                kit=dict(post=-0.37, roof=1.18, sliders=(-0.30, -0.47, 0.0048), front=2.40, bumper=-0.37, nose=0.42)),
}
total = 0
def webp(img, d, name, lossless=False):
    global total
    b = io.BytesIO()
    if lossless: img.save(b, 'WEBP', lossless=True, quality=100, method=6)
    else: img.save(b, 'WEBP', quality=Q, alpha_quality=100, method=6)
    data = b.getvalue(); total += len(data)
    open(os.path.join(d, name + '.webp'), 'wb').write(data)
    return 'data:image/webp;base64,' + base64.b64encode(data).decode()

# ---------- the kit pieces (parts sheet at its own scale; the bull bar off the orange sheet)
parts = {n: rgba(os.path.join(PARTS, n + '.png')) for n in ('cage', 'rack', 'sliders')}
PBOX = json.load(open(os.path.join(PARTS, 'boxes.json')))
osh = np.array(Image.open(ORANGE).convert('RGB')).astype(np.float32)
oL = osh.mean(2); och = osh.max(2) - osh.min(2)
lab, n = ndi.label((oL > 232) & (och < 14)); ids = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]]).tolist()) - {0}
obg = np.isin(lab, list(ids))
for i, sl in enumerate(ndi.find_objects(lab), 1):
    if sl is None or i in ids: continue
    mm = lab[sl] == i
    if mm.sum() >= 12 and sl[1].start >= 1060: obg[sl] |= mm
X0b, Y0b, X1b, Y1b = 1058, 548, 1134, 714
reg = np.zeros(oL.shape, bool); reg[Y0b:Y1b, X0b:X1b] = True
truckbits = (och > 45) | ((oL > 135) & (och < 35))
barm = reg & ~obg & ~truckbits
barm = ndi.binary_opening(barm, iterations=1) | (reg & ~obg & (oL < 60))
lab2, n2 = ndi.label(barm, structure=np.ones((3, 3)))
sizes = ndi.sum(barm, lab2, range(1, n2 + 1)); barm = np.isin(lab2, 1 + np.argsort(sizes)[::-1][:1])
thick = ndi.binary_opening(barm, structure=np.ones((5, 5))); barm = barm & ndi.binary_dilation(thick, iterations=3)
barm[695:, :1063] = False
ab = barm.astype(np.float32); edge = barm & ~ndi.binary_erosion(barm)
ab = np.where(edge, np.minimum(1, np.clip((255 - oL) / (255 - 18), 0, 1) * 1.15), ab)
BAR = np.dstack([osh, ab * 255])[Y0b:Y1b, X0b:X1b]
BAR_BACK, BAR_BOTTOM = 1066 - X0b, (Y1b - 4) - Y0b       # where the bar meets the grille, the bottom of its box

def rim_paint(crop, face):
    Lw = crop[..., :3].mean(2)
    ref = float(np.median(Lw[face])) if face.any() else 200.0
    kk = np.clip(Lw / ref, 0, 1.3)
    m_amt = np.clip(kk, 0, 1) * 255; grey = np.clip((kk - 1) / 0.3, 0, 1) * 60
    enc = np.dstack([grey + m_amt, grey, grey + m_amt]).clip(0, 255)
    crop[face, 0:3] = enc[face]
    return crop
def wheel_crop(src, cx, cy, rt, rim_k, darken=1.0):
    hw = int(np.ceil(rt + 3)); X0, Y0 = int(round(cx)) - hw, int(round(cy)) - hw
    Hs, Ws = src.shape[:2]
    crop = np.zeros((2 * hw, 2 * hw, 4), np.float32)
    ys0, xs0 = max(0, Y0), max(0, X0); ys1, xs1 = min(Hs, Y0 + 2 * hw), min(Ws, X0 + 2 * hw)
    crop[ys0 - Y0:ys1 - Y0, xs0 - X0:xs1 - X0] = src[ys0:ys1, xs0:xs1]
    gy, gx = np.mgrid[0:2 * hw, 0:2 * hw].astype(np.float32)
    d = np.hypot(gx + X0 - cx, gy + Y0 - cy)
    crop[..., 3] = 255 * np.clip(rt + 0.8 - d, 0, 1)
    Lw = crop[..., :3].mean(2); chw = crop[..., :3].max(2) - crop[..., :3].min(2)
    face = (d <= rim_k * rt) & (Lw > 105) & (chw < 40)      # the steel rim face, not its black outlines and holes
    crop = rim_paint(crop, face)
    return crop, hw, X0, Y0

OFFROAD = None
previews = {}
for key, B in BODIES.items():
    d = os.path.join(OUT, key); os.makedirs(d, exist_ok=True)
    truck = rgba(os.path.join(B['src'], 'rgba.png'))
    H, W = truck.shape[:2]
    (fx, fy), (rx, ry) = B['wheels']; rt = B['rt']
    s = (fx - rx) / WB; ox = (fx + rx) / 2; ground = (fy + ry) / 2 + rt; oy = ground - s
    k = PPM / s
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    Xm = lambda m: ox + m * s; Ym = lambda m: oy - m * s
    def M(px, py): return [round((px - ox) / s, 4), round((oy - py) / s, 4)]
    # ---- paint: magenta becomes the body colour. The lit panel tone is the full colour; its grey is taken off, and
    # a tone brighter than it turns its extra into grey (a highlight), so every tone keeps its place
    R, G, Bc, A = truck[..., 0], truck[..., 1], truck[..., 2], truck[..., 3]
    mag = np.minimum(R, Bc) - G
    paint = (mag > 30) & (A > 10)
    mref, gref = B['paint_ref']
    m2 = mag * (255.0 / mref)
    over = np.clip(m2 - 255, 0, None)
    g2 = np.clip(G - gref, 0, None) + over * 0.45
    m2 = np.clip(m2, 0, 255)
    for c, v in ((0, g2 + m2), (1, g2), (2, g2 + m2)): truck[..., c] = np.where(paint, np.clip(v, 0, 255), truck[..., c])
    # ---- body: the wheels out; the well behind each tyre dark above the axle, open air below it
    body = truck.copy()
    for cx, cy in B['wheels']:
        dd = np.hypot(xx - cx, yy - cy)
        up = (dd <= rt + 4) & (yy <= cy + 0.10 * rt)
        body[up, 0:3] = [36, 35, 38]; body[up, 3] = 255
        body[(dd <= rt + 6) & (yy > cy + 0.10 * rt), 3] = 0
    ys, xs = np.nonzero(body[..., 3] > 6)
    bb = [max(0, xs.min() - 3), max(0, ys.min() - 3), min(W, xs.max() + 4), min(H, ys.max() + 4)]
    urls = {}
    bimg = resized(body[bb[1]:bb[3], bb[0]:bb[2]], k)
    urls['body'] = webp(bimg, d, 'body')
    meta = {'ppm': PPM, 'x0': (bb[0] - ox) / s, 'y1': (oy - bb[1]) / s, 'w': (bb[2] - bb[0]) / s, 'h': (bb[3] - bb[1]) / s,
            'ground': -1.0, 'wheels': [], 'layers': {}}
    # ---- livery zones: red roof (above the window sills over the cab), green below the lower crease, blue 255 the
    # door band, 128 the stripe along the crease
    Z = B['zones']; cx0, cx1 = B['cab'][0], B['cab'][1]
    pz = (np.minimum(body[..., 0], body[..., 2]) - body[..., 1] > 20) & (body[..., 3] > 10)
    zones = np.zeros((H, W, 3), np.uint8)
    zones[pz & (yy < Ym(Z['roof'])) & (xx > Xm(cx0 - 0.05)) & (xx < Xm(cx1 + 0.35)), 0] = 255
    zones[pz & (yy > Ym(Z['lower'])), 1] = 255
    zones[pz & (yy <= Ym(Z['band'][0])) & (yy > Ym(Z['band'][1])), 2] = 255
    zones[pz & (yy <= Ym(Z['stripe'][0])) & (yy > Ym(Z['stripe'][1])), 2] = 128
    zimg = Image.fromarray(zones[bb[1]:bb[3], bb[0]:bb[2]], 'RGB').resize(bimg.size, Image.NEAREST)
    urls['zones'] = webp(zimg, d, 'zones', lossless=True)
    # ---- wheels (rims as paint). The pickup's road tyres are drawn mid grey: darkened to the flatbed's black rubber
    for i, (cx, cy) in enumerate(B['wheels']):
        crop, hw, X0, Y0 = wheel_crop(truck, cx, cy, rt, B['rim'], darken=1.0)
        urls['wheel%d' % i] = webp(resized(crop, k), d, 'wheel%d' % i)
        meta['wheels'].append({'half': hw / s, 'dx': (X0 + hw - cx) / s, 'dy': (cy - (Y0 + hw)) / s, 'r': rt / s})
        if key == 'ccf' and i == 0: OFFROAD = (crop.copy(), hw, X0, Y0, cx, cy, s)
    # ---- the kit, fitted: the cage's tall post at the back of the cab, its top frame just over the roof, its rear
    # frame to the end of the bed (one scale fits all of it); the loaded rack centred on the top frame; the sliders
    # under the doors with their tank just below the sills; the bull bar from under the bumper to the top of the grille
    K = B['kit']; cb = PBOX['cage']
    rear_end = -3.0 + 0.02
    kc = (K['post'] - rear_end) / (880 - cb[0])                      # metres per sheet pixel
    def place(name, arr, x_left, y_top, mpp):
        h, w = arr.shape[:2]
        meta['layers'][name] = {'x0': x_left, 'y1': y_top, 'w': w * mpp, 'h': h * mpp}
        urls[name] = webp(resized(arr, mpp * PPM), d, name)
    cage_top = K['roof'] + 0.03 + 17 * kc
    place('cage', parts['cage'], K['post'] - (880 - cb[0]) * kc, cage_top, kc)
    rk = parts['rack']; Lc = meta['layers']['cage']
    tl, tr_ = Lc['x0'] + (727 - cb[0]) * kc, Lc['x0'] + (1040 - cb[0]) * kc
    place('rack', rk, (tl + tr_) / 2 - rk.shape[1] * kc / 2, cage_top - 0.05 + rk.shape[0] * kc, kc)
    sx, sy, sk = K['sliders']; sh_ = parts['sliders']
    place('sliders', sh_, sx, sy + 0.2 * sh_.shape[0] * sk, sk)
    kb = (K['nose'] - K['bumper']) / BAR_BOTTOM                     # metres per orange-sheet pixel
    place('bullbar', BAR, K['front'] - BAR_BACK * kb, K['bumper'] + BAR_BOTTOM * kb, kb)
    meta['ref'] = {'axles': [M(fx, fy), M(rx, ry)], 'r': round(rt / s, 4), 's': round(s, 3), 'cage_top': round(cage_top, 3),
                   'rack_top': round(meta['layers']['rack']['y1'], 3)}
    json.dump(meta, open(os.path.join(d, 'meta.json'), 'w'), indent=1)
    json.dump(urls, open(os.path.join(d, 'urls.json'), 'w'))
    previews[key] = (body, bb, s, ox, oy, truck, meta)
    print(key, 'scale %.1f px/m -> %g, body %s, r %.3f m, axles %s, layers %s' % (s, PPM, [round(v, 3) for v in (meta['x0'], meta['y1'], meta['w'], meta['h'])], rt / s, meta['ref']['axles'],
          {n: [round(v, 3) for v in L.values()] for n, L in meta['layers'].items()}))

# the off-road wheel for the pickup: the flatbed's lugged tyre on its steel wheel
crop, hw, X0, Y0, cx, cy, s_fb = OFFROAD
for key in ('cc',):
    d = os.path.join(OUT, key); meta = json.load(open(os.path.join(d, 'meta.json'))); urls = json.load(open(os.path.join(d, 'urls.json')))
    urls['owheel'] = webp(resized(crop, PPM / s_fb), d, 'owheel')
    meta['owheel'] = {'half': hw / s_fb, 'dx': (X0 + hw - cx) / s_fb, 'dy': (cy - (Y0 + hw)) / s_fb, 'r': BODIES['ccf']['rt'] / s_fb}
    json.dump(meta, open(os.path.join(d, 'meta.json'), 'w'), indent=1); json.dump(urls, open(os.path.join(d, 'urls.json'), 'w'))
print('total %d KB (base64 ~%d KB)' % (total // 1024, total * 4 // 3 // 1024))

# ---------- previews: each body stock and with the whole kit, painted, on a light ground
def painted(img, col):
    a = np.array(img).astype(np.float32); g0 = a[..., 1].copy(); mg = np.minimum(a[..., 0], a[..., 2]) - g0; pm = mg > 3
    for c in range(3): a[..., c] = np.where(pm, g0 + mg / 255 * col[c], a[..., c])
    return toimg(a)
def preview(key, name, layers, offroad, col=(181, 110, 62), rim=(138, 106, 72), scale=1.0):
    d = os.path.join(OUT, key); meta = json.load(open(os.path.join(d, 'meta.json')))
    X0m, X1m, Y0m, Y1m = -3.4, 3.2, -1.15, 2.2
    P = PPM * scale
    can = Image.new('RGBA', (int((X1m - X0m) * P), int((Y1m - Y0m) * P)), (226, 232, 238, 255))
    def put(img, x0, y1, w, h):
        im = img.resize((max(1, round(w * P)), max(1, round(h * P))), Image.LANCZOS)
        can.alpha_composite(im, (int(round((x0 - X0m) * P)), int(round((Y1m - y1) * P))))
    put(painted(Image.open(os.path.join(d, 'body.webp')).convert('RGBA'), col), meta['x0'], meta['y1'], meta['w'], meta['h'])
    for i, (ax, ay) in enumerate(meta['ref']['axles']):
        if offroad and 'owheel' in meta:
            m = meta['owheel']; r = meta['ref']['r'] + 0.03; kk = r / m['r']; hm = m['half'] * kk
            wi = painted(Image.open(os.path.join(d, 'owheel.webp')).convert('RGBA'), rim); ay2 = -1.0 + r
            put(wi, ax - hm, ay2 + hm, 2 * hm, 2 * hm)
        else:
            m = meta['wheels'][i]; wi = painted(Image.open(os.path.join(d, 'wheel%d.webp' % i)).convert('RGBA'), rim)
            put(wi, ax + m['dx'] - m['half'], ay + m['dy'] + m['half'], 2 * m['half'], 2 * m['half'])
    for n in layers:
        Ly = meta['layers'][n]; put(Image.open(os.path.join(d, n + '.webp')).convert('RGBA'), Ly['x0'], Ly['y1'], Ly['w'], Ly['h'])
    can.save(os.path.join(OUT, 'preview_%s_%s.png' % (key, name)))
for key in BODIES:
    preview(key, 'stock', [], False)
    preview(key, 'kit', ['sliders', 'cage', 'rack', 'bullbar'], key == 'cc')
