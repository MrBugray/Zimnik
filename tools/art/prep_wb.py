# Cut a truck drawn on plain white off its background (Lucas's 2K side views): the white is flooded in from the edges,
# white pockets between parts (under a deck, between brackets) are opened up too, and the outermost pixels get their
# soft edge back from how far their dark outline is mixed with the white.
#   python3 -I prep_wb.py <truck.png> <out dir>
# Writes rgba.png (the whole canvas) and box.json (the truck's box on it).
import sys, os, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
a = np.array(Image.open(src).convert('RGB')).astype(np.float32)
H, W = a.shape[:2]
L = a.mean(2); ch = a.max(2) - a.min(2)
white = (L > 236) & (ch < 16)
lab, n = ndi.label(white)
edge_ids = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]]).tolist()) - {0}
bg = np.isin(lab, list(edge_ids))
# white pockets: open air when they are big enough and really white (no part of these trucks is pure white)
for i, sl in enumerate(ndi.find_objects(lab), 1):
    if sl is None or i in edge_ids: continue
    m = lab[sl] == i
    if m.sum() >= 30 and L[sl][m].mean() > 246: bg[sl] |= m
# stray specks of colour out in the white
fl, nf = ndi.label(~bg)
for i, sl in enumerate(ndi.find_objects(fl), 1):
    m = fl[sl] == i
    if m.sum() < 30: bg[sl] |= m
fg = ~bg
# the outline colour: what the darkest edge pixels are
dist = ndi.distance_transform_edt(fg)
rim = fg & (dist <= 1.5)
inner = fg & (dist > 1.5)
dark = inner & (L < 60) & (ch < 25)
OUT = np.median(a[dark], 0) if dark.any() else np.array([26, 26, 30], np.float32)
Lo = float(OUT.mean())
alpha = np.where(bg, 0.0, 1.0).astype(np.float32)
_, (jy, jx) = ndi.distance_transform_edt(~inner, return_indices=True)
F = a[jy, jx]
# an edge pixel lighter than the outline and grey is the outline mixed with white; a coloured one is paint mixed
# with white (rare: everything is outlined)
dark_edge = rim & (ch < 40)
a_dark = np.clip((255 - L) / (255 - Lo), 0, 1)
alpha[dark_edge] = a_dark[dark_edge]
rgb = a.copy()
rgb[dark_edge] = OUT
col_edge = rim & ~dark_edge
Fm = F.mean(2)
alpha[col_edge] = np.clip((255 - L) / np.maximum(255 - Fm, 20), 0, 1)[col_edge]
rgb[col_edge] = F[col_edge]
ys, xs = np.nonzero(alpha > 0.02)
box = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
Image.fromarray(np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8), 'RGBA').save(os.path.join(out, 'rgba.png'))
json.dump({'box': box, 'size': [W, H], 'outline': [round(float(v), 1) for v in OUT]}, open(os.path.join(out, 'box.json'), 'w'))
print('box', box, 'outline', OUT.round(1), 'pockets/specks done')
