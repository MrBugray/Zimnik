"""Minimal hand-assembled DEX (version 035) for a full-screen WebView activity.

Equivalent Java:
  public class MainActivity extends android.app.Activity {
    private android.webkit.WebView web;
    protected void onCreate(Bundle b) {
      super.onCreate(b);
      getWindow().addFlags(FLAG_FULLSCREEN | FLAG_KEEP_SCREEN_ON);
      WebView v = new WebView(this); web = v;
      WebSettings s = v.getSettings();
      s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setMediaPlaybackRequiresUserGesture(false);
      s.setTextZoom(100);   // system font size must not inflate the game's fixed-unit layout
      v.setBackgroundColor(0xff000000); setContentView(v);
      v.setSystemUiVisibility(IMMERSIVE_STICKY|FULLSCREEN|HIDE_NAV|LAYOUT_*);
      v.loadUrl("file:///android_asset/index.html");
    }
    public void onBackPressed() { if (web != null) web.evaluateJavascript("window.onAndroidBack&&window.onAndroidBack()", null); }
    public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f && web != null) web.setSystemUiVisibility(0x1706); }
    protected void onPause() { super.onPause(); if (web != null) web.onPause(); }
    protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
  }
"""
import struct, zlib, hashlib

def uleb(n):
    out = bytearray()
    while True:
        b = n & 0x7f; n >>= 7
        if n: out.append(b | 0x80)
        else: out.append(b); return bytes(out)

def mutf8(s):
    return s.encode('utf-8')  # ASCII only here

CLS = 'Lapp/zimnik/MainActivity;'
ACT = 'Landroid/app/Activity;'
WV = 'Landroid/webkit/WebView;'
WS = 'Landroid/webkit/WebSettings;'
VIEW = 'Landroid/view/View;'
WIN = 'Landroid/view/Window;'
BUNDLE = 'Landroid/os/Bundle;'
CTX = 'Landroid/content/Context;'
STR = 'Ljava/lang/String;'
VCB = 'Landroid/webkit/ValueCallback;'

# (class, name, return, params)
METHODS = [
    (ACT, '<init>', 'V', ()),
    (ACT, 'getWindow', WIN, ()),
    (ACT, 'onCreate', 'V', (BUNDLE,)),
    (ACT, 'onPause', 'V', ()),
    (ACT, 'onResume', 'V', ()),
    (ACT, 'onWindowFocusChanged', 'V', ('Z',)),
    (ACT, 'setContentView', 'V', (VIEW,)),
    (VIEW, 'setSystemUiVisibility', 'V', ('I',)),
    (WIN, 'addFlags', 'V', ('I',)),
    (WS, 'setDomStorageEnabled', 'V', ('Z',)),
    (WS, 'setJavaScriptEnabled', 'V', ('Z',)),
    (WS, 'setMediaPlaybackRequiresUserGesture', 'V', ('Z',)),
    (WS, 'setTextZoom', 'V', ('I',)),
    (WV, '<init>', 'V', (CTX,)),
    (WV, 'evaluateJavascript', 'V', (STR, VCB)),
    (WV, 'getSettings', WS, ()),
    (WV, 'loadUrl', 'V', (STR,)),
    (WV, 'onPause', 'V', ()),
    (WV, 'onResume', 'V', ()),
    (WV, 'setBackgroundColor', 'V', ('I',)),
    (CLS, '<init>', 'V', ()),
    (CLS, 'onBackPressed', 'V', ()),
    (CLS, 'onCreate', 'V', (BUNDLE,)),
    (CLS, 'onPause', 'V', ()),
    (CLS, 'onResume', 'V', ()),
    (CLS, 'onWindowFocusChanged', 'V', ('Z',)),
]
FIELDS = [(CLS, 'web', WV)]
CONST_STRINGS = ['file:///android_asset/index.html', 'window.onAndroidBack&&window.onAndroidBack()']

def shorty(ret, params):
    f = lambda t: 'L' if t[0] in 'L[' else t
    return f(ret) + ''.join(f(p) for p in params)

def build(path=None):
    # ---- collect ids
    types = set([CLS, ACT])
    strings = set(CONST_STRINGS)
    protos = set()
    for c, n, r, ps in METHODS:
        types.add(c); types.add(r); types.update(ps); strings.add(n)
        protos.add((r, ps)); strings.add(shorty(r, ps))
    for c, n, t in FIELDS:
        types.add(c); types.add(t); strings.add(n)
    strings.update(types)
    strings = sorted(strings)                       # UTF-16 order == code point order for ASCII
    sidx = {s: i for i, s in enumerate(strings)}
    types = sorted(types, key=lambda t: sidx[t])
    tidx = {t: i for i, t in enumerate(types)}
    protos = sorted(protos, key=lambda p: (tidx[p[0]], [tidx[x] for x in p[1]]))
    pidx = {p: i for i, p in enumerate(protos)}
    fields = sorted(FIELDS, key=lambda f: (tidx[f[0]], sidx[f[1]], tidx[f[2]]))
    fidx = {f: i for i, f in enumerate(fields)}
    methods = sorted(METHODS, key=lambda m: (tidx[m[0]], sidx[m[1]], pidx[(m[2], m[3])]))
    midx = {(m[0], m[1]): i for i, m in enumerate(methods)}
    M = lambda c, n: midx[(c, n)]
    F = fidx[FIELDS[0]]

    # ---- assembler helpers (each returns list of 16-bit code units)
    def i35c(op, mref, regs):
        regs = list(regs) + [0] * (5 - len(regs))
        c, d, e, f, g = regs[:5]
        return [(len([r for r in regs if r is not None]) if False else 0)]  # placeholder (unused)
    def inv(op, mref, regs):
        n = len(regs); r = list(regs) + [0] * (5 - n)
        return [(n << 12) | (r[4] << 8) | op, mref, (r[3] << 12) | (r[2] << 8) | (r[1] << 4) | r[0]]
    def move_result_object(a): return [(a << 8) | 0x0c]
    def const4(a, v): return [((v & 0xf) << 12) | (a << 8) | 0x12]
    def const16(a, v): return [(a << 8) | 0x13, v & 0xffff]
    def const32(a, v): return [(a << 8) | 0x14, v & 0xffff, (v >> 16) & 0xffff]
    def const_string(a, s): return [(a << 8) | 0x1a, sidx[s]]
    def new_instance(a, t): return [(a << 8) | 0x22, tidx[t]]
    def iget_obj(a, b, f): return [(b << 12) | (a << 8) | 0x54, f]
    def iput_obj(a, b, f): return [(b << 12) | (a << 8) | 0x5b, f]
    def if_eqz(a, off): return [(a << 8) | 0x38, off & 0xffff]
    RET = [0x000e]
    UI = 0x1706

    codes = {}
    # <init>: regs 1 (p0=v0)
    codes['<init>'] = (1, 1, 1, inv(0x70, M(ACT, '<init>'), [0]) + RET)
    # onCreate: v0..v3 locals, p0=v4, p1=v5
    oc = []
    oc += inv(0x6f, M(ACT, 'onCreate'), [4, 5])
    oc += inv(0x6e, M(ACT, 'getWindow'), [4]); oc += move_result_object(0)
    oc += const16(1, 0x0480); oc += inv(0x6e, M(WIN, 'addFlags'), [0, 1])
    oc += new_instance(0, WV); oc += inv(0x70, M(WV, '<init>'), [0, 4])
    oc += iput_obj(0, 4, F)
    oc += inv(0x6e, M(WV, 'getSettings'), [0]); oc += move_result_object(1)
    oc += const4(2, 1)
    oc += inv(0x6e, M(WS, 'setJavaScriptEnabled'), [1, 2])
    oc += inv(0x6e, M(WS, 'setDomStorageEnabled'), [1, 2])
    oc += const4(2, 0)
    oc += inv(0x6e, M(WS, 'setMediaPlaybackRequiresUserGesture'), [1, 2])
    oc += const16(2, 100); oc += inv(0x6e, M(WS, 'setTextZoom'), [1, 2])
    oc += const32(1, 0xff000000); oc += inv(0x6e, M(WV, 'setBackgroundColor'), [0, 1])
    oc += inv(0x6e, M(ACT, 'setContentView'), [4, 0])
    oc += const16(1, UI); oc += inv(0x6e, M(VIEW, 'setSystemUiVisibility'), [0, 1])
    oc += const_string(1, CONST_STRINGS[0]); oc += inv(0x6e, M(WV, 'loadUrl'), [0, 1])
    oc += RET
    codes['onCreate'] = (6, 2, 2, oc)
    # onBackPressed: v0..v2, p0=v3
    ob = []
    ob += iget_obj(0, 3, F)             # 0..1
    ob += if_eqz(0, 8)                   # 2..3 -> 10
    ob += const_string(1, CONST_STRINGS[1])  # 4..5
    ob += const4(2, 0)                   # 6
    ob += inv(0x6e, M(WV, 'evaluateJavascript'), [0, 1, 2])  # 7..9
    ob += RET                            # 10
    codes['onBackPressed'] = (4, 1, 3, ob)
    # onWindowFocusChanged(Z): v0,v1 ; p0=v2, p1=v3
    ow = []
    ow += inv(0x6f, M(ACT, 'onWindowFocusChanged'), [2, 3])  # 0..2
    ow += if_eqz(3, 11)                  # 3..4 -> 14
    ow += iget_obj(0, 2, F)              # 5..6
    ow += if_eqz(0, 7)                   # 7..8 -> 14
    ow += const16(1, UI)                 # 9..10
    ow += inv(0x6e, M(VIEW, 'setSystemUiVisibility'), [0, 1])  # 11..13
    ow += RET                            # 14
    codes['onWindowFocusChanged'] = (4, 2, 2, ow)
    for nm in ('onPause', 'onResume'):
        c = []
        c += inv(0x6f, M(ACT, nm), [1])   # 0..2
        c += iget_obj(0, 1, F)            # 3..4
        c += if_eqz(0, 5)                 # 5..6 -> 10
        c += inv(0x6e, M(WV, nm), [0])    # 7..9
        c += RET                          # 10
        codes[nm] = (2, 1, 1, c)
    assert len(codes['onBackPressed'][3]) == 11 and len(codes['onWindowFocusChanged'][3]) == 15 and len(codes['onPause'][3]) == 11

    # ---- layout
    HDR = 0x70
    off = HDR
    string_ids_off = off; off += 4 * len(strings)
    type_ids_off = off; off += 4 * len(types)
    proto_ids_off = off; off += 12 * len(protos)
    field_ids_off = off; off += 8 * len(fields)
    method_ids_off = off; off += 8 * len(methods)
    class_defs_off = off; off += 32
    data_off = off
    data = bytearray()
    def align(n):
        while (data_off + len(data)) % n: data.append(0)
    # code items
    code_off = {}
    order = ['<init>', 'onBackPressed', 'onCreate', 'onPause', 'onResume', 'onWindowFocusChanged']
    align(4); code_items_off = data_off + len(data)
    for nm in order:
        align(4)
        regs, ins, outs, insns = codes[nm]
        code_off[nm] = data_off + len(data)
        data += struct.pack('<HHHHII', regs, ins, outs, 0, 0, len(insns))
        data += b''.join(struct.pack('<H', w) for w in insns)
    # type lists (proto params)
    align(4); type_lists_off = data_off + len(data)
    tl_off = {}
    plists = sorted(set(p[1] for p in protos if p[1]), key=lambda ps: [tidx[x] for x in ps])
    for ps in plists:
        align(4)
        tl_off[ps] = data_off + len(data)
        data += struct.pack('<I', len(ps)) + b''.join(struct.pack('<H', tidx[x]) for x in ps)
    # string data
    str_data_off = data_off + len(data)
    sdo = []
    for s in strings:
        sdo.append(data_off + len(data))
        data += uleb(len(s)) + mutf8(s) + b'\x00'
    # class data
    class_data_off = data_off + len(data)
    cd = bytearray()
    cd += uleb(0) + uleb(1) + uleb(1) + uleb(5)
    cd += uleb(F) + uleb(0x2)                          # private WebView web
    cd += uleb(M(CLS, '<init>')) + uleb(0x10001) + uleb(code_off['<init>'])
    virt = sorted(['onBackPressed', 'onCreate', 'onPause', 'onResume', 'onWindowFocusChanged'], key=lambda n: M(CLS, n))
    acc = {'onBackPressed': 0x1, 'onCreate': 0x4, 'onPause': 0x4, 'onResume': 0x4, 'onWindowFocusChanged': 0x1}
    prev = 0
    for i, nm in enumerate(virt):
        mi = M(CLS, nm)
        cd += uleb(mi - prev if i else mi) + uleb(acc[nm]) + uleb(code_off[nm]); prev = mi
    data += cd
    # map list
    align(4); map_off = data_off + len(data)
    items = [
        (0x0000, 1, 0), (0x0001, len(strings), string_ids_off), (0x0002, len(types), type_ids_off),
        (0x0003, len(protos), proto_ids_off), (0x0004, len(fields), field_ids_off), (0x0005, len(methods), method_ids_off),
        (0x0006, 1, class_defs_off), (0x2001, len(order), code_items_off), (0x1001, len(plists), type_lists_off),
        (0x2002, len(strings), str_data_off), (0x2000, 1, class_data_off), (0x1000, 1, map_off),
    ]
    data += struct.pack('<I', len(items)) + b''.join(struct.pack('<HHII', t, 0, n, o) for t, n, o in items)
    align(4)
    # ---- id sections
    body = bytearray()
    for o in sdo: body += struct.pack('<I', o)
    for t in types: body += struct.pack('<I', sidx[t])
    for r, ps in protos: body += struct.pack('<III', sidx[shorty(r, ps)], tidx[r], tl_off[ps] if ps else 0)
    for c, n, t in fields: body += struct.pack('<HHI', tidx[c], tidx[t], sidx[n])
    for c, n, r, ps in methods: body += struct.pack('<HHI', tidx[c], pidx[(r, ps)], sidx[n])
    body += struct.pack('<IIIIIIII', tidx[CLS], 0x1, tidx[ACT], 0, 0xffffffff, 0, class_data_off, 0)
    assert HDR + len(body) == data_off
    file_size = data_off + len(data)
    hdr = bytearray(b'dex\n035\x00') + b'\x00' * 4 + b'\x00' * 20
    hdr += struct.pack('<IIIII', file_size, HDR, 0x12345678, 0, 0)
    hdr += struct.pack('<I', map_off)
    hdr += struct.pack('<II', len(strings), string_ids_off) + struct.pack('<II', len(types), type_ids_off)
    hdr += struct.pack('<II', len(protos), proto_ids_off) + struct.pack('<II', len(fields), field_ids_off)
    hdr += struct.pack('<II', len(methods), method_ids_off) + struct.pack('<II', 1, class_defs_off)
    hdr += struct.pack('<II', len(data), data_off)
    assert len(hdr) == HDR
    dex = bytearray(hdr + body + data)
    dex[12:32] = hashlib.sha1(bytes(dex[32:])).digest()
    dex[8:12] = struct.pack('<I', zlib.adler32(bytes(dex[12:])) & 0xffffffff)
    if path:
        open(path, 'wb').write(dex)
    return bytes(dex)

if __name__ == '__main__':
    import sys
    d = build(sys.argv[1] if len(sys.argv) > 1 else 'classes.dex')
    print('dex bytes', len(d))
