# Measure the drawn truck: tyre circles (fit to the clean lower arcs), scale from the 1.08 m tyres, silhouette profile.
import sys, json, numpy as np
from PIL import Image
src = sys.argv[1]
a = np.array(Image.open(src).convert('RGBA')).astype(np.int32)
al = a[..., 3]; op = al > 128; H, W = op.shape
ground = int(np.nonzero(op.any(1))[0].max())
def fit(cx0, r0):
    xs, ys = [], []
    for x in range(int(cx0 - r0 * 0.85), int(cx0 + r0 * 0.85) + 1):
        col = np.nonzero(op[int(1406):, x])[0]
        if col.size: xs.append(x); ys.append(1406 + col.max())
    xs = np.array(xs, float); ys = np.array(ys, float)
    A = np.c_[2 * xs, 2 * ys, np.ones_like(xs)]; b = xs ** 2 + ys ** 2
    c, *_ = np.linalg.lstsq(A, b, rcond=None); cx, cy = c[0], c[1]; r = np.sqrt(c[2] + cx ** 2 + cy ** 2)
    res = np.abs(np.hypot(xs - cx, ys - cy) - r)
    return cx, cy, r, res.max()
wheels = [fit(610, 276), fit(1250, 277), fit(3250, 268)]
for w in wheels: print('tyre centre %.1f,%.1f r %.1f maxres %.1f' % w)
R = np.mean([w[2] for w in wheels]); s = R / 0.54
print('ground row', ground, 'mean r px', round(R, 1), 'scale px/m', round(s, 2), 'image', W, H)
ox = wheels[2][0] - 3.0 * s; oy = ground - 1.08 * s
m = lambda px, py: (round((px - ox) / s, 3), round((oy - py) / s, 3))
ys, xs = np.nonzero(op); print('extent m: x', m(xs.min(), 0)[0], '..', m(xs.max(), 0)[0], ' y', m(0, ys.max())[1], '..', m(0, ys.min())[1])
print('axles m:', [m(w[0], w[1]) for w in wheels])
# top and bottom of the silhouette every 0.1 m
out = []
for xm in np.arange(-3.2, 4.6, 0.1):
    px = int(round(ox + xm * s));
    if px < 0 or px >= W: continue
    col = np.nonzero(op[:, px])[0]
    if col.size: out.append((round(xm, 1), m(0, col.min())[1], m(0, col.max())[1]))
print('profile (x, top, bottom):'); print(' '.join('%s:%s/%s' % o for o in out))
json.dump({'s': s, 'ox': ox, 'oy': oy, 'ground': ground, 'wheels': wheels, 'W': W, 'H': H}, open(sys.argv[2], 'w'))
