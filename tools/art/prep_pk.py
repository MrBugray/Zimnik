# Cut Lucas's pickup parts sheet off its drawn checkerboard: the magenta base truck (single cab, drawn facing left),
# the expedition cage, the roof rack with its load, two off-road wheels, the bull bar (drawn from the front) and the
# rock sliders with their tank, each as its own RGBA picture with its box on the sheet.
#   python3 -I prep_pk.py <parts.png> <out dir>
# The checkerboard is exact: 15 px squares on the pixel grid, edges at x = 15 i and y = 13 + 15 j, two flat greys.
import sys, os, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
sheet = np.array(Image.open(src).convert('RGB')).astype(np.float32)
H0, W0 = sheet.shape[:2]
Lum = sheet.mean(2); chroma = sheet.max(2) - sheet.min(2)

# ---------- 1) the checkerboard: each square's tone measured where it shows, the rest from the pattern
S, OX, OY = 15, 0, 13
ix = (np.arange(W0) - OX) // S; iy = (np.arange(H0) - OY) // S
ix -= ix.min(); iy -= iy.min()
IX, IY = np.meshgrid(ix, iy); NX, NY = IX.max() + 1, IY.max() + 1
T_D, T_L = 57.0, 103.0
pD = (np.abs(Lum - T_D) <= 9) & (chroma <= 10); pL = (np.abs(Lum - T_L) <= 9) & (chroma <= 10)
nD = np.zeros((NY, NX)); nL = np.zeros((NY, NX)); sD = np.zeros((NY, NX)); sL = np.zeros((NY, NX))
np.add.at(nD, (IY[pD], IX[pD]), 1); np.add.at(nL, (IY[pL], IX[pL]), 1)
np.add.at(sD, (IY[pD], IX[pD]), Lum[pD]); np.add.at(sL, (IY[pL], IX[pL]), Lum[pL])
known = (np.maximum(nD, nL) > 20)
light_sq = nL >= nD
gi, gj = np.meshgrid(np.arange(NX), np.arange(NY))
rule = ((gi + gj) % 2 == 0)
agree = (light_sq == rule)[known].mean()
if agree < 0.5: rule = ~rule
light_sq = np.where(known, light_sq, rule)
tone = np.where(light_sq, np.where(nL > 20, sL / np.maximum(nL, 1), T_L), np.where(nD > 20, sD / np.maximum(nD, 1), T_D))
E = tone[IY, IX]; LS = light_sq[IY, IX]
print('checker: %d x %d squares, %.1f%% known, pattern agreement %.3f' % (NX, NY, 100 * known.mean(), max(agree, 1 - agree)))

cand = (np.abs(Lum - E) <= 9) & (chroma <= 10)
# the picture's smoothing leaves a soft pixel or two where two squares meet; such a pixel bridges two background squares
# when the pixels on either side of it match their own (different) squares. Inside a part it never does.
mid = (~cand) & (chroma <= 12) & (Lum >= T_D - 9) & (Lum <= T_L + 9)
def sh(a, dy, dx, fill=False):
    o = np.full_like(a, fill)
    ys, yd = (slice(dy, None), slice(0, -dy)) if dy > 0 else ((slice(0, dy), slice(-dy, None)) if dy < 0 else (slice(None), slice(None)))
    xs, xd = (slice(dx, None), slice(0, -dx)) if dx > 0 else ((slice(0, dx), slice(-dx, None)) if dx < 0 else (slice(None), slice(None)))
    o[yd, xd] = a[ys, xs]
    return o
bridge = np.zeros_like(cand)
for (dy, dx) in ((0, 1), (1, 0)):
    for k1, k2 in ((1, 1), (2, 1), (1, 2)):
        a_c, b_c = sh(cand, -dy * k1, -dx * k1), sh(cand, dy * k2, dx * k2)
        a_l, b_l = sh(LS, -dy * k1, -dx * k1), sh(LS, dy * k2, dx * k2)
        bridge |= mid & a_c & b_c & (a_l != b_l)
cand |= bridge
lab, nl = ndi.label(cand)
edge_ids = np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])
bg = np.isin(lab, edge_ids[edge_ids > 0])
# enclosed checker: gaps between tubes. Showing both square tones means checker; one tone only counts when the region is
# ringed by dark outline and not by more of the same colour (a part's fill that happens to match one tone)
for i, sl in enumerate(ndi.find_objects(lab), 1):
    if sl is None: continue
    m = lab[sl] == i
    if m.sum() < 6 or bg[sl][m].any(): continue
    y0, y1 = max(0, sl[0].start - 3), min(H0, sl[0].stop + 3); x0, x1 = max(0, sl[1].start - 3), min(W0, sl[1].stop + 3)
    mm = lab[y0:y1, x0:x1] == i
    ring = ndi.binary_dilation(mm, iterations=2) & ~mm
    lr = Lum[y0:y1, x0:x1][ring]; cr = cand[y0:y1, x0:x1][ring]
    med = np.median(Lum[y0:y1, x0:x1][mm])
    f_out = (lr < 42).mean(); f_same = ((np.abs(lr - med) < 12) & ~cr).mean()
    ls = LS[y0:y1, x0:x1][mm]; lm = Lum[y0:y1, x0:x1][mm]
    # both tones, each flat like the squares are: checker for certain (no part's fill matches two greys at once)
    both = min(ls.mean(), 1 - ls.mean()) > 0.12 and mm.sum() >= 30
    if both:
        sd = sorted([lm[ls].std(), lm[~ls].std()])
        both = sd[1] < 5 or (sd[0] < 4 and sd[1] < 7 and f_same < 0.2)
    if both or (f_out > 0.6 and f_same < 0.08):
        bg[y0:y1, x0:x1] |= mm
# specks of foreground in the open
fl, nf = ndi.label(~bg)
for i, sl in enumerate(ndi.find_objects(fl), 1):
    m = fl[sl] == i
    if m.sum() < 25: bg[sl] |= m
fg = ~bg
# soft edge: the outermost ring of each part mixes its outline with the square behind it
dist = ndi.distance_transform_edt(fg)
rim = fg & (dist <= 1.5); inner = fg & (dist > 1.5)
_, (jy, jx) = ndi.distance_transform_edt(~inner, return_indices=True)
F = sheet[jy, jx]
alpha = np.where(bg, 0.0, 1.0).astype(np.float32)
# every part is drawn with a near-black outline, so an edge pixel darker than the square behind it is that outline
# mixed with the square; a lighter one is the part's fill mixed with it; a coloured one is fill
OUTL = 18.0
Fm = F.mean(2)
a_dark = np.clip((E - Lum) / np.maximum(E - OUTL, 10), 0, 1)
den = Fm - E
a_light = np.where(np.abs(den) > 18, np.clip((Lum - E) / np.where(np.abs(den) > 18, den, 1), 0, 1), 1.0)
dark_edge = (Lum <= E) & (chroma <= 40)
a_rim = np.where(dark_edge, a_dark, np.where(chroma > 40, 1.0, a_light))
alpha[rim] = a_rim[rim]
rgb = sheet.copy()
rgb[rim & dark_edge] = OUTL
rgb[rim & ~dark_edge & (chroma <= 40)] = F[rim & ~dark_edge & (chroma <= 40)]
np.save(os.path.join(out, 'alpha.npy'), alpha)
Image.fromarray(np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8), 'RGBA').save(os.path.join(out, 'sheet_rgba.png'))

# ---------- 2) the parts: boxes on the sheet (the lettering and the scale bar are left out)
BOX = {'truck': (25, 280, 790, 582), 'cage': (560, 50, 1150, 262), 'rack': (850, 330, 1160, 425),
       'wheelA': (840, 470, 1000, 660), 'wheelB': (995, 470, 1160, 660), 'bullfront': (100, 670, 430, 850),
       'sliders': (470, 690, 810, 820)}
meta = {}
for name, (x0, y0, x1, y1) in BOX.items():
    a = alpha[y0:y1, x0:x1].copy()
    # keep the biggest pieces only (the parts themselves), drop stray bits of the lettering
    fl2, n2 = ndi.label(a > 0.05, structure=np.ones((3, 3)))
    if n2:
        sizes = ndi.sum(np.ones_like(a), fl2, index=np.arange(1, n2 + 1))
        keep = np.isin(fl2, 1 + np.nonzero(sizes >= max(60, 0.02 * sizes.max()))[0])
        a = a * keep
    ys, xs = np.nonzero(a > 0.02)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    img = np.dstack([np.clip(rgb[y0:y1, x0:x1], 0, 255), a * 255]).astype(np.uint8)[by0:by1, bx0:bx1]
    Image.fromarray(img, 'RGBA').save(os.path.join(out, name + '.png'))
    meta[name] = [int(x0 + bx0), int(y0 + by0), int(x0 + bx1), int(y0 + by1)]
json.dump(meta, open(os.path.join(out, 'boxes.json'), 'w'), indent=1)
print(meta)
