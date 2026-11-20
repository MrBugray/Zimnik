# Turn a drawn side view into game art: the body (wheels cut out, wells filled dark) and one sprite per wheel,
# scaled to `ppm` pixels per metre, plus the numbers that place them on the physics truck.
# python3 -I build_art.py <src.png> <measure.json> <out_dir> <ppm> [webp quality]
import sys, json, os, io, base64
import numpy as np
from PIL import Image

src, meas, out, ppm = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
q = int(sys.argv[5]) if len(sys.argv) > 5 else 90
M = json.load(open(meas)); s, ox, oy = M['s'], M['ox'], M['oy']
im = Image.open(src).convert('RGBA'); a = np.array(im).astype(np.float32); H, W = a.shape[:2]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
os.makedirs(out, exist_ok=True)
k = ppm / s  # downscale factor

def shrink(arr):
    # resize with premultiplied alpha so edges don't pick up the colour of transparent pixels
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA').convert('RGBa')
    w, h = max(1, round(img.width * k)), max(1, round(img.height * k))
    return img.resize((w, h), Image.LANCZOS).convert('RGBA')

def webp(img, name):
    b = io.BytesIO(); img.save(b, 'WEBP', quality=q, alpha_quality=100, method=6); data = b.getvalue()
    open(os.path.join(out, name + '.webp'), 'wb').write(data)
    return 'data:image/webp;base64,' + base64.b64encode(data).decode(), len(data)

# body: tyres and rims replaced by a dark wheel well (a little wider than the tyre, so no old outline peeks out)
body = a.copy()
for cx, cy, r, _ in M['wheels']:
    d = np.hypot(xx - cx, yy - cy); disc = d <= r + 3.0
    body[disc, 0:3] = [27, 26, 25]; body[disc, 3] = 255
op = body[..., 3] > 8; ys, xs = np.nonzero(op)
x0, x1, y0, y1 = max(0, xs.min() - 3), min(W, xs.max() + 4), max(0, ys.min() - 3), min(H, ys.max() + 4)
bimg = shrink(body[y0:y1, x0:x1]); burl, bsz = webp(bimg, 'body')
meta = {'ppm': ppm, 'x0': (x0 - ox) / s, 'y1': (oy - y0) / s, 'w': (x1 - x0) / s, 'h': (y1 - y0) / s, 'px': [bimg.width, bimg.height], 'wheels': []}
urls = {'body': burl}; total = bsz
# wheels: a square around each tyre, alpha cut to the tyre circle with a soft edge. The drawing's light and shade
# would turn with the wheel, so it is split off: each ring around the hub is averaged (that removes anything that
# depends on the angle), what is left is blurred into a smooth light-and-shadow map, taken out of the turning wheel
# and kept as a separate overlay that stays put while the wheel turns.
import cv2
def deshade(crop, d, r):
    al = crop[..., 3] / 255.0; m = (al > 0.5).astype(np.float32)
    Lm = 0.299 * crop[..., 0] + 0.587 * crop[..., 1] + 0.114 * crop[..., 2]
    ri = np.clip(np.round(d).astype(int), 0, int(r + 8))
    sums = np.bincount(ri.ravel(), weights=(Lm * m).ravel(), minlength=int(r + 9)); cnt = np.bincount(ri.ravel(), weights=m.ravel(), minlength=int(r + 9))
    radial = (sums / np.maximum(cnt, 1))[ri]
    sig = 0.12 * r; D = cv2.GaussianBlur((Lm - radial) * m, (0, 0), sig) / np.maximum(cv2.GaussianBlur(m, (0, 0), sig), 1e-3) * m
    flat = crop.copy(); flat[..., 0:3] = np.clip(crop[..., 0:3] - D[..., None], 0, 255)
    sh = np.zeros_like(crop); dark = D < 0
    sh[..., 0:3] = np.where(dark[..., None], 0, 255)
    sh[..., 3] = np.clip(np.where(dark, -D / np.maximum(radial, 8), D / np.maximum(255 - radial, 8)), 0, 0.85) * crop[..., 3]
    return flat, sh, float(np.abs(D[m > 0]).mean())
for i, (cx, cy, r, _) in enumerate(M['wheels']):
    hw = int(np.ceil(r + 5)); X0, Y0 = int(round(cx)) - hw, int(round(cy)) - hw
    crop = a[Y0:Y0 + 2 * hw, X0:X0 + 2 * hw].copy()
    d = np.hypot(xx[Y0:Y0 + 2 * hw, X0:X0 + 2 * hw] - cx, yy[Y0:Y0 + 2 * hw, X0:X0 + 2 * hw] - cy)
    crop[..., 3] = crop[..., 3] * np.clip(r + 2.0 - d, 0, 1)
    flat, sh, dm = deshade(crop, d, r)
    wimg = shrink(flat); wurl, wsz = webp(wimg, 'wheel%d' % i); total += wsz
    simg = shrink(sh); surl, ssz = webp(simg, 'shade%d' % i); total += ssz; urls['shade%d' % i] = surl
    print('wheel', i, 'shading taken out: mean', round(dm, 1), 'grey levels')
    # centre of the crop in metres from the tyre centre (the crop is centred on the rounded centre)
    meta['wheels'].append({'half': hw / s, 'dx': (X0 + hw - cx) / s, 'dy': (cy - (Y0 + hw)) / s, 'r': r / s, 'px': wimg.width})
    urls['wheel%d' % i] = wurl
json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
json.dump(urls, open(os.path.join(out, 'urls.json'), 'w'))
print('body', bimg.size, bsz, 'bytes · wheels', [w['px'] for w in meta['wheels']], '· total', total, 'bytes · base64 ~', round(total * 4 / 3 / 1024), 'KB')
print(json.dumps({k: (round(v, 4) if isinstance(v, float) else v) for k, v in meta.items() if k != 'wheels'}))
