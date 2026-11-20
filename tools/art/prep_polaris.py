# Prepare the Polaris picture sheet for build_art: Lucas's sheet has the full truck with its expedition cage on top,
# the base truck's silhouette in magenta and the cage on its own, on a checkerboard that is part of the pixels.
#   python3 -I prep_polaris.py <sheet.png> <out dir>
# Writes, all on one canvas (the full drawing's pixels, 1200 x 452):
#   truck.png   the base truck: cage taken off and the holes filled, windows as glass, body paint as magenta
#   cage.png    roll cage, bed bars, ladder, roof rack and its load (no beacon, no bull bar)
#   bullbar.png the bull bar on its own
#   beacon.png  the amber beacon on its own (a small picture, its box in meta)
#   zones.png   livery zones over the paint: red = roof, green = below the side crease, blue = band (255) / stripe (128)
#   meta.json   wheel centres and radius in pixels, the scale, the beacon box
import sys, os, json, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
sheet = np.array(Image.open(src).convert('RGB')).astype(np.float32)
H0, W0 = sheet.shape[:2]

# ---------- 1) the checkerboard: 9.375 px squares; the phase is measured, the colour order is found square by square
S, OX, OY, SS = 9.375, 9.39, 7.41, 16
def odd_frac(n, o):
    u = np.arange(n)[:, None] + (np.arange(SS)[None, :] + 0.5) / SS
    return (np.floor((u - o) / S).astype(int) % 2 == 1).mean(1)
px, py = odd_frac(W0, OX), odd_frac(H0, OY)
white = px[None, :] * (1 - py[:, None]) + (1 - px[None, :]) * py[:, None]
E1, E2 = 197 + 58 * white, 197 + 58 * (1 - white)
Lum = sheet.mean(2); chroma = sheet.max(2) - sheet.min(2)
cx = np.floor((np.arange(W0) + 0.5 - OX) / S).astype(int) + 2; cy = np.floor((np.arange(H0) + 0.5 - OY) / S).astype(int) + 2
CX, CY = np.meshgrid(cx, cy); NX, NY = CX.max() + 1, CY.max() + 1
pure = (white < 0.02) | (white > 0.98)
m1 = (np.abs(Lum - E1) <= 6) & (chroma <= 8) & pure; m2 = (np.abs(Lum - E2) <= 6) & (chroma <= 8) & pure
n1 = np.zeros((NY, NX)); n2 = np.zeros((NY, NX)); np.add.at(n1, (CY[m1], CX[m1]), 1); np.add.at(n2, (CY[m2], CX[m2]), 1)
par = np.where((n1 > 4) & (n1 >= n2), 1, np.where((n2 > 4) & (n2 > n1), 2, 0))
_, (iy2, ix2) = ndi.distance_transform_edt(par == 0, return_indices=True); par = par[iy2, ix2]
E = np.where(par[CY, CX] == 1, E1, E2)
cand = ((np.abs(Lum - E) <= 9) | ((Lum > E + 6) & (Lum >= 205))) & (chroma <= 12)
lab, _ = ndi.label(cand)
edge_ids = np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]]); bg = np.isin(lab, edge_ids[edge_ids > 0])
# near-white neutral pixels that touch the background are background (thin streaks between dark parts)
vlight = (Lum >= 226) & (chroma <= 12)
for _ in range(6): bg |= ndi.binary_dilation(bg) & vlight
# enclosed checker (gaps in the cage, under the truck): both square tones inside
mlab, _ = ndi.label((np.abs(Lum - E) <= 9) & (chroma <= 10) & ~bg)
for i, sl in enumerate(ndi.find_objects(mlab), 1):
    m = mlab[sl] == i
    if m.sum() < 40: continue
    e = E[sl][m]
    if (e < 215).mean() > 0.15 and (e > 240).mean() > 0.15: bg[sl] |= m
# small light specks left in the open (stray anti-aliasing): drop them
fl, nf = ndi.label(~bg)
for i, sl in enumerate(ndi.find_objects(fl), 1):
    m = fl[sl] == i
    if m.sum() < 60 and (Lum[sl][m] > 150).mean() > 0.6: bg[sl] |= m
fg = ~bg
dist = ndi.distance_transform_edt(fg)
rim = fg & (dist <= 2.0); inner = fg & (dist > 2.0)
_, (iy, ix) = ndi.distance_transform_edt(~inner, return_indices=True)
F = sheet[iy, ix]
alpha = np.where(bg, 0.0, 1.0).astype(np.float32)
alpha[rim] = np.clip((E - Lum) / np.maximum(E - F.mean(2), 25), 0, 1)[rim]
rgb = sheet.copy(); rgb[rim] = F[rim]

# ---------- 2) the full drawing (top of the sheet)
HT = 452
img = rgb[:HT].copy(); al = alpha[:HT].copy(); L = Lum[:HT]; C = chroma[:HT]
H, W = al.shape
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
hsv = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
hue, sat, val = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
brown = (hue >= 12) & (hue <= 42) & (sat > 0.28) & (val > 0.16)

# ---------- 3) the cage, traced: corridors along its tubes; inside them the tube pixels (not the brown paint)
def corridor(pts, hw):
    m = np.zeros((H, W), np.uint8)
    cv2.polylines(m, [np.round(np.array(pts) * 4).astype(np.int32)], False, 1, thickness=max(1, int(round(hw * 2))), lineType=cv2.LINE_8, shift=2)
    return m > 0
tubes = [
    ([(326, 101), (250, 132), (170, 166), (110, 189), (92, 198), (87, 210), (87, 296), (96, 312), (140, 327)], 6),  # rear hoop
    ([(84, 208), (468, 208)], 5.5), ([(84, 257), (468, 257)], 5.5),                                               # bed rails
    ([(138.5, 203), (138.5, 328)], 5.5), ([(273, 203), (273, 261)], 5.5),                                         # bed posts
    ([(414.5, 96), (414.5, 318)], 5.5), ([(463, 96), (463, 318)], 5.5),                                           # ladder rails
    ([(569, 100), (569, 340), (574, 352), (590, 356.5), (834, 356.5), (837, 340), (837, 310), (842, 280), (850, 258), (864, 246)], 6),  # cab hoop, sliders, front hoop
    ([(570, 106), (802, 106)], 6),                                                                                # roof tube
    ([(800, 104), (816, 120), (852, 176), (882, 218), (905, 245)], 6.5),                                          # A-pillar tube
    ([(862, 246), (960, 246), (1052, 250)], 5.5),                                                                 # fender tube
]
cage = np.zeros((H, W), bool)
for pts, hw in tubes: cage |= corridor(pts, hw)
for y in (150, 197, 245, 293):   # ladder rungs
    cage |= corridor([(413, y), (463, y)], 6)
tube_px = (~brown) & (al > 0.02)
cage &= tube_px
cage |= corridor([(812, 116), (860, 137), (944, 171.5), (1000, 194.5), (1036, 207), (1046, 213)], 3.0) & (al > 0.02) & (L < 130)   # the cable
cage |= (yy < 109) & (xx >= 312) & (xx <= 818) & (al > 0.02)                                         # the rack and its load
# the bull bar: in front of the grille
bull = (xx >= 1047) & (yy >= 195) & (yy <= 345) & (al > 0.02)
bull |= (xx >= 1036) & (yy >= 293) & (yy <= 345) & (al > 0.02) & ~brown
cage_all = (cage | bull)
# grow by the anti-aliased rim so no dark fringe of a tube stays on the truck
cage_all = cage_all | (ndi.binary_dilation(cage_all, iterations=2) & ~brown & (al > 0.02) & (L < 120))
bull |= cage_all & (xx >= 1030) & (yy >= 290)   # the fringe of the bull bar's foot belongs to the bull bar

# ---------- 4) the base truck: the cage taken off, the holes filled from around them
hole = cage_all.copy()
base = img.copy(); bal = al.copy()
bal[hole] = 0
# the fill takes its colours from a little further out, past the tubes' light anti-aliased edges
grow = ndi.binary_dilation(hole, iterations=2) & ~hole & (al > 0.5)
# fill: colour and opacity both spread in from the edges (Telea); inside the body the opacity ends up full, at an
# outline it ends up half way, which puts the body's edge in the middle of where the tube was
src8 = np.dstack([np.clip(base, 0, 255), (bal * 255)]).astype(np.uint8)
mask8 = (hole | grow).astype(np.uint8) * 255
filled_rgb = cv2.inpaint(np.ascontiguousarray(src8[..., :3]), mask8, 5, cv2.INPAINT_TELEA).astype(np.float32)
filled_a = cv2.inpaint(np.ascontiguousarray(src8[..., 3]), mask8, 5, cv2.INPAINT_TELEA).astype(np.float32) / 255
base[hole] = filled_rgb[hole]; bal[hole] = np.where(filled_a[hole] > 0.5, 1.0, 0.0)
base[grow] = filled_rgb[grow]
# what is left of the hole outside the body in front (the bull bar's place) and above the roof is open air
bal[(xx >= 1050)] = 0; bal[hole & (yy < 112)] = 0
# nothing of the truck is above its roof but the stack's top; and only the truck itself, no stray bits
bal[(yy < 113) & ~((xx > 536) & (xx < 566))] = 0
tl, tn = ndi.label(bal > 0.02); tsz = ndi.sum(np.ones_like(L), tl, index=np.arange(tn + 1))
bal[(tl > 0) & (tsz[tl] < 400)] = 0
# where a tube covered the body's edge, the edge gets its dark outline back
edge = (bal > 0.5) & ndi.binary_dilation(bal <= 0.5, iterations=1) & ndi.binary_dilation(hole, iterations=2)
base[edge] = base[edge] * 0.25 + np.array([42, 37, 32], np.float32) * 0.75

# ---------- 4b) the nose without the bull bar: a clean chrome headlamp bezel and a stock chrome bumper
from PIL import ImageDraw
bal[(xx > 1047)] = 0; bal[(xx > 1030) & (yy > 318)] = 0
SSN = 4
lay = Image.new('RGBA', (W * SSN, H * SSN), (0, 0, 0, 0)); dr = ImageDraw.Draw(lay)
def rrect(x0, y0, x1, y1, r, fill, outline, wd):
    dr.rounded_rectangle([x0 * SSN, y0 * SSN, x1 * SSN, y1 * SSN], radius=r * SSN, fill=fill, outline=outline, width=int(wd * SSN))
rrect(1030.5, 209, 1047.5, 299, 6, (150, 154, 156, 255), (40, 36, 32, 255), 1.6)      # headlamp bezel, side on
rrect(1035, 217, 1042, 291, 3.5, (196, 200, 202, 255), None, 0)                     # its highlight
rrect(1019, 297, 1061, 316, 5, (146, 150, 152, 255), (40, 36, 32, 255), 1.8)          # bumper
rrect(1022, 299.5, 1058, 305, 2.5, (205, 208, 210, 255), None, 0)                     # its top light
rrect(1032, 315, 1046, 323, 2, (52, 48, 44, 255), (30, 27, 24, 255), 1.2)             # bracket
lay = np.array(lay.resize((W, H), Image.LANCZOS)).astype(np.float32)
la = lay[..., 3] / 255
base = base * (1 - la[..., None]) + lay[..., :3] * la[..., None]; bal = np.maximum(bal, la)

# ---------- 5) windows: tinted glass over the checker -> smooth glass
glassish = (C <= 28) & (L > 95) & (L < 185) & (img[..., 2] >= img[..., 0] - 2) & (bal > 0.5)
wl, _ = ndi.label(glassish)
win = np.zeros((H, W), bool)
for seed in [(160, 630), (160, 740), (175, 820)]:
    k = wl[seed]
    if k: win |= wl == k
win = ndi.binary_closing(win, iterations=2) & (bal > 0.5)
if win.any():
    g = cv2.GaussianBlur(np.where(win[..., None], base, 0), (0, 0), 9) / np.maximum(cv2.GaussianBlur(win.astype(np.float32), (0, 0), 9)[..., None], 1e-3)
    tone = np.array([128, 146, 158], np.float32)
    shade = 0.55 * g + 0.45 * tone
    # a faint diagonal sheen
    sheen = np.clip(1 - np.abs(((xx - 0.6 * yy) % 70) - 35) / 9, 0, 1)[..., None] * 18
    base[win] = np.clip(shade + sheen, 0, 255)[win]

# ---------- 6) paint: the brown becomes magenta, keeping its light and shade
WHEELS = [(312.74, 370.59), (929.64, 370.27)]; RT = 72.5
wheeldisc = np.zeros((H, W), bool)
for wx, wy in WHEELS: wheeldisc |= np.hypot(xx - wx, yy - wy) <= RT + 3
hsv2 = cv2.cvtColor(np.clip(base, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
hue2, sat2, val2 = hsv2[..., 0] * 2, hsv2[..., 1] / 255, hsv2[..., 2] / 255
brown2 = (hue2 >= 12) & (hue2 <= 42) & (sat2 > 0.28) & (val2 > 0.16)
paint = brown2 & (bal > 0.5) & ~win & ~wheeldisc
# lamps and trim that only look brown: bright, very saturated orange (marker lamps, the badge) stays as drawn
paint &= ~((sat2 > 0.7) & (val2 > 0.75))
pl, pn = ndi.label(paint); psz = ndi.sum(np.ones_like(L), pl, index=np.arange(pn + 1)); paint &= psz[pl] >= 8   # no lone specks
ref = np.array([181, 110, 62], np.float32)   # the drawing's mid paint tone
Lp = base.mean(2); Lr = ref.mean()
k = np.clip(Lp / Lr, 0, 1.6)
m_amt = np.clip(k, 0, 1) * 255                       # magenta amount: the paint's brightness
grey = np.clip((k - 1) / 0.6, 0, 1) * 150            # highlights brighter than the paint: a grey part on top
enc = np.dstack([grey + m_amt, grey, grey + m_amt]).clip(0, 255)
base[paint] = enc[paint]

# ---------- 7) livery zones on the paint: roof (above the window sills), lower (below the side crease), crease band
zones = np.zeros((H, W, 3), np.float32)
cab = (xx > 578) & (xx < 860)
zones[..., 0] = (paint & cab & (yy < 197)) * 255
crease = np.interp(xx, [100, 470, 580, 860, 1040], [236, 236, 241, 241, 236])   # the side crease line
zones[..., 1] = (paint & (yy > crease + 3)) * 255
# blue: 255 a band under the crease (about 13 cm), 128 the thin stripe along it (no alpha: browsers drop the colour
# under transparent pixels)
zones[..., 2] = np.where(paint & (yy > crease + 3) & (yy <= crease + 24), 255, np.where(paint & (np.abs(yy - crease) <= 3), 128, 0))

# ---------- 8) the layers
def save(name, rgbv, av, box=None):
    o = np.dstack([np.clip(rgbv, 0, 255), np.clip(av, 0, 1) * 255]).astype(np.uint8)
    if box: x0, y0, x1, y1 = box; o = o[y0:y1, x0:x1]
    Image.fromarray(o, 'RGBA').save(os.path.join(out, name))
save('truck.png', base, bal)
# beacon: its box on the rack; the rack rails behind it are drawn on across the gap from both sides
bx0, by0, bx1, by1 = 598, 74, 623, 106
inbox = (xx >= 600) & (xx <= 621) & (yy >= 76) & (yy <= 104)
bea = inbox & (al > 0.02) & (((sat > 0.4) & (hue > 18) & (hue < 56) & (val > 0.4)) | (L < 85) | (yy >= 100))
bea = ndi.binary_fill_holes(ndi.binary_closing(bea, iterations=1)) & inbox
cage_img = img.copy(); cage_a = np.where(cage_all & ~bull, al, 0)
for y in range(by0, by1):
    lc, rc = img[y, bx0 - 2], img[y, bx1 + 1]; la, ra = cage_a[y, bx0 - 2], cage_a[y, bx1 + 1]
    for x in range(bx0, bx1):
        t = (x - bx0 + 1) / (bx1 - bx0 + 1)
        cage_img[y, x] = lc * (1 - t) + rc * t; cage_a[y, x] = min(la, ra)
cl, cn = ndi.label(cage_a > 0.02); csz = ndi.sum(np.ones_like(L), cl, index=np.arange(cn + 1))
cage_a[(cl > 0) & (csz[cl] < 60)] = 0
save('cage.png', cage_img, cage_a)
bl, bn = ndi.label(bull); bsz = ndi.sum(np.ones_like(L), bl, index=np.arange(bn + 1)); bull &= bsz[bl] >= 80
save('bullbar.png', img, np.where(bull & ~((L > 200) & (C < 14)), al, 0))
save('beacon.png', img, np.where(bea, al, 0), (bx0, by0, bx1, by1))
Image.fromarray(zones.astype(np.uint8), 'RGB').save(os.path.join(out, 'zones.png'))
json.dump({'W': W, 'H': H, 'beacon': [bx0, by0, bx1, by1]}, open(os.path.join(out, 'meta.json'), 'w'))
print('cage px', int(cage_all.sum()), 'bull px', int(bull.sum()), 'paint px', int(paint.sum()), 'window px', int(win.sum()), 'beacon px', int(bea.sum()))
