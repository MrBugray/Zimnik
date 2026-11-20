# Build the Polaris game art from prep_polaris.py output: the body (wheels cut out, wells dark above the axle), two
# wheels with their rims as paint (so the rim colour can be picked) and the tyre shading split off, the cage and the
# bull bar as add-on layers, the livery zones, and the amber beacon as a fixture any truck can carry.
#   python3 -I build_polaris.py <prep dir> <out dir> <ppm> [webp quality]
# Scale: 3.80 m wheelbase (Ford F-250 crew cab, 149-150 in); frame origin 0.95 m above the ground at mid-wheelbase.
import sys, os, io, json, base64, numpy as np, cv2
from PIL import Image

P, out, ppm = sys.argv[1], sys.argv[2], float(sys.argv[3])
q = int(sys.argv[4]) if len(sys.argv) > 4 else 92
os.makedirs(out, exist_ok=True)
WHEELS = [(929.64, 370.27), (312.74, 370.59)]   # front, rear (pixels on the sheet), in the game's axle order
RT, RIM = 72.5, 39.5                             # tyre and rim radius (pixels)
WB = 3.80
s = abs(WHEELS[0][0] - WHEELS[1][0]) / WB
ox = (WHEELS[0][0] + WHEELS[1][0]) / 2; s = abs(s)
ground = (WHEELS[0][1] + WHEELS[1][1]) / 2 + RT
oy = ground - 0.95 * s
k = ppm / s
def ld(n): return np.array(Image.open(os.path.join(P, n)).convert('RGBA')).astype(np.float32)
truck, cage, bull, zones = ld('truck.png'), ld('cage.png'), ld('bullbar.png'), np.array(Image.open(os.path.join(P, 'zones.png')).convert('RGBA')).astype(np.float32)
beacon = ld('beacon.png'); meta0 = json.load(open(os.path.join(P, 'meta.json')))
H, W = truck.shape[:2]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

def shrink(arr, box):
    x0, y0, x1, y1 = box
    img = Image.fromarray(np.clip(arr[y0:y1, x0:x1], 0, 255).astype(np.uint8), 'RGBA').convert('RGBa')
    w, h = max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))
    return img.resize((w, h), Image.LANCZOS).convert('RGBA')
total = 0
def webp(img, name, lossless=False):
    global total
    b = io.BytesIO()
    if lossless: img.save(b, 'WEBP', lossless=True, quality=100, method=6)
    else: img.save(b, 'WEBP', quality=q, alpha_quality=100, method=6)
    data = b.getvalue(); total += len(data)
    open(os.path.join(out, name + '.webp'), 'wb').write(data)
    return 'data:image/webp;base64,' + base64.b64encode(data).decode()
def bbox(a, pad=3):
    ys, xs = np.nonzero(a[..., 3] > 6)
    return [max(0, xs.min() - pad), max(0, ys.min() - pad), min(W, xs.max() + pad + 1), min(H, ys.max() + pad + 1)]
def place(box):   # a picture's top-left corner and size in the truck's frame (metres, y up)
    x0, y0, x1, y1 = box
    return {'x0': (x0 - ox) / s, 'y1': (oy - y0) / s, 'w': (x1 - x0) / s, 'h': (y1 - y0) / s}

# ---------- body: the wells behind the wheels dark above the axle (below it there is only air behind a tyre)
body = truck.copy()
for cx, cy in WHEELS:
    d = np.hypot(xx - cx, yy - cy); disc = d <= RT + 3
    up = disc & (yy <= cy + 0.15 * RT)
    body[up, 0:3] = [27, 26, 25]; body[up, 3] = 255
    body[disc & ~up, 3] = 0
bb = bbox(body)
urls = {'body': webp(shrink(body, bb), 'body')}
meta = dict(ppm=ppm, **place(bb), wheels=[], layers={})
# zones over the same box: red roof, green lower body, blue band, alpha the thin crease stripe
zb = Image.fromarray(zones[bb[1]:bb[3], bb[0]:bb[2], :3].astype(np.uint8), 'RGB')
zimg = zb.resize((max(1, round((bb[2] - bb[0]) * k)), max(1, round((bb[3] - bb[1]) * k))), Image.NEAREST)
urls['zones'] = webp(zimg, 'zones', lossless=True)

# ---------- wheels: de-lit (the drawing's light taken out into a separate overlay), rims as paint
def deshade(crop, d, r):
    m = (crop[..., 3] > 128).astype(np.float32)
    Lm = 0.299 * crop[..., 0] + 0.587 * crop[..., 1] + 0.114 * crop[..., 2]
    ri = np.clip(np.round(d).astype(int), 0, int(r + 8))
    sums = np.bincount(ri.ravel(), weights=(Lm * m).ravel(), minlength=int(r + 9)); cnt = np.bincount(ri.ravel(), weights=m.ravel(), minlength=int(r + 9))
    radial = (sums / np.maximum(cnt, 1))[ri]
    sig = 0.12 * r; D = cv2.GaussianBlur((Lm - radial) * m, (0, 0), sig) / np.maximum(cv2.GaussianBlur(m, (0, 0), sig), 1e-3) * m
    flat = crop.copy(); flat[..., 0:3] = np.clip(crop[..., 0:3] - D[..., None], 0, 255)
    sh = np.zeros_like(crop); dark = D < 0
    sh[..., 0:3] = np.where(dark[..., None], 0, 255)
    sh[..., 3] = np.clip(np.where(dark, -D / np.maximum(radial, 8), D / np.maximum(255 - radial, 8)), 0, 0.85) * crop[..., 3]
    return flat, sh
for i, (cx, cy) in enumerate(WHEELS):
    hw = int(np.ceil(RT + 5)); X0, Y0 = int(round(cx)) - hw, int(round(cy)) - hw
    crop = truck[Y0:Y0 + 2 * hw, X0:X0 + 2 * hw].copy()
    d = np.hypot(xx[Y0:Y0 + 2 * hw, X0:X0 + 2 * hw] - cx, yy[Y0:Y0 + 2 * hw, X0:X0 + 2 * hw] - cy)
    crop[..., 3] = 255 * np.clip(RT + 1.5 - d, 0, 1)
    flat, sh = deshade(crop, d, RT)
    # the rim face (bronze steel in the drawing) becomes paint: magenta by its brightness, holes and shadows stay grey
    hsv = cv2.cvtColor(np.clip(flat[..., :3], 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    Lw = flat[..., :3].mean(2)
    face = (d <= RIM) & (hsv[..., 1] > 22) & (Lw > 34)
    ref = float(np.median(Lw[face])) if face.any() else 90.0
    kk = np.clip(Lw / (ref * 1.25), 0, 1.4)
    m_amt = np.clip(kk, 0, 1) * 255; grey = np.clip((kk - 1) / 0.4, 0, 1) * 120
    enc = np.dstack([grey + m_amt, grey, grey + m_amt]).clip(0, 255)
    flat[face, 0:3] = enc[face]
    box = [X0, Y0, X0 + 2 * hw, Y0 + 2 * hw]
    def sq(a):
        img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').convert('RGBa'); n = max(1, round(2 * hw * k))
        return img.resize((n, n), Image.LANCZOS).convert('RGBA')
    urls['wheel%d' % i] = webp(sq(flat), 'wheel%d' % i); urls['shade%d' % i] = webp(sq(sh), 'shade%d' % i)
    meta['wheels'].append({'half': hw / s, 'dx': (X0 + hw - cx) / s, 'dy': (cy - (Y0 + hw)) / s, 'r': RT / s})
# ---------- add-on layers
for name, arr in (('cage', cage), ('bullbar', bull)):
    b = bbox(arr); urls[name] = webp(shrink(arr, b), name); meta['layers'][name] = place(b)
# ---------- the beacon: a fixture for every truck (its size in metres; it stands on its foot)
bx0, by0, bx1, by1 = meta0['beacon']
bimg = Image.fromarray(np.clip(beacon, 0, 255).astype(np.uint8), 'RGBA').convert('RGBa')
bimg = bimg.resize((max(1, round(bimg.width * k * 1.5)), max(1, round(bimg.height * k * 1.5))), Image.LANCZOS).convert('RGBA')
fix = {'beacon': {'w': (bx1 - bx0) / s, 'h': (by1 - by0) / s, 'src': webp(bimg, 'beacon')}}
# where things are on this truck (metres), for the game's geometry
def m(px, py): return [round((px - ox) / s, 3), round((oy - py) / s, 3)]
meta['ref'] = {'axles': [m(*WHEELS[0]), m(*WHEELS[1])], 'r': round(RT / s, 4), 'rackBeacon': m((bx0 + bx1) / 2, by1), 's': round(s, 3)}
json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
json.dump(urls, open(os.path.join(out, 'urls.json'), 'w'))
json.dump(fix, open(os.path.join(out, 'fix.json'), 'w'))
print('scale %.2f px/m, ppm %g, body %s, layers %s, total %d KB (base64 ~%d KB)' % (s, ppm, [round(v, 3) for v in place(bb).values()], {k2: [round(v, 2) for v in b.values()] for k2, b in meta['layers'].items()}, total // 1024, total * 4 // 3 // 1024))
print('ref', meta['ref'])
