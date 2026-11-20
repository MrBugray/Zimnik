"""Builds a signed, installable APK around dist/index.html without the Android SDK.

  python3 build_apk.py <index.html> <icon.png> <out.apk> [versionCode] [versionName]

Pieces: hand-assembled classes.dex (dexgen.py), binary AndroidManifest.xml, a one-entry
resources.arsc for the launcher icon, 4-byte aligned zip, and APK Signature Scheme v2.
The signing key is derived deterministically from SEED so later builds can update the app.
"""
import struct, sys, zlib, hashlib, io, datetime, os
from dexgen import build as build_dex

PACKAGE = 'app.zimnik'
LABEL = 'Zimnik'
SEED = b'zimnik-signing-key-v1'
ICON_PATH = 'res/drawable-xxxhdpi-v4/icon.png'

# ---------------------------------------------------------------- string pools (UTF-16)
def string_pool(strings):
    offs, data = [], bytearray()
    for s in strings:
        offs.append(len(data))
        u = s.encode('utf-16-le'); n = len(s)
        assert n < 0x8000
        data += struct.pack('<H', n) + u + b'\x00\x00'
    while len(data) % 4: data.append(0)
    hdr_size = 28
    strings_start = hdr_size + 4 * len(strings)
    size = strings_start + len(data)
    return struct.pack('<HHIIIIII', 0x0001, hdr_size, size, len(strings), 0, 0, strings_start, 0) + b''.join(struct.pack('<I', o) for o in offs) + bytes(data)

# ---------------------------------------------------------------- binary XML
ANDROID_NS = 'http://schemas.android.com/apk/res/android'
ATTR_IDS = {
    'theme': 0x01010000, 'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003, 'exported': 0x01010010,
    'launchMode': 0x0101001d, 'screenOrientation': 0x0101001e, 'configChanges': 0x0101001f,
    'minSdkVersion': 0x0101020c, 'versionCode': 0x0101021b, 'versionName': 0x0101021c,
    'targetSdkVersion': 0x01010270, 'allowBackup': 0x01010280, 'hardwareAccelerated': 0x010102d3,
}
T_REF, T_STR, T_DEC, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12

def axml(tree):
    """tree: (tag, [(ns_android:bool, name, type, value)], [children])"""
    # collect strings: attribute names with resource ids first (in id-map order)
    attr_names = []
    def walk_attrs(n):
        for a in n[1]:
            if a[0] and a[1] not in attr_names: attr_names.append(a[1])
        for c in n[2]: walk_attrs(c)
    walk_attrs(tree)
    attr_names.sort(key=lambda x: ATTR_IDS[x])
    strings = list(attr_names)
    def S(s):
        if s not in strings: strings.append(s)
        return strings.index(s)
    S('android'); S(ANDROID_NS)
    def walk(n):
        S(n[0])
        for a in n[1]:
            S(a[1])
            if a[2] == T_STR: S(a[3])
        for c in n[2]: walk(c)
    walk(tree)
    body = bytearray()
    NS = S(ANDROID_NS)
    body += struct.pack('<HHIII', 0x0100, 16, 24, 1, 0xffffffff) + struct.pack('<II', S('android'), NS)
    def emit(n, line):
        tag, attrs, kids = n
        al = sorted(attrs, key=lambda a: (0, ATTR_IDS[a[1]]) if a[0] else (1, S(a[1])))
        ab = bytearray()
        for isns, name, typ, val in al:
            raw = S(val) if typ == T_STR else 0xffffffff
            data = S(val) if typ == T_STR else (0xffffffff if (typ == T_BOOL and val) else (0 if typ == T_BOOL else val))
            ab += struct.pack('<IIIHBBI', NS if isns else 0xffffffff, S(name), raw, 8, 0, typ, data & 0xffffffff)
        ext = struct.pack('<IIHHHHHH', 0xffffffff, S(tag), 20, 20, len(al), 0, 0, 0)
        size = 16 + len(ext) + len(ab)
        out = bytearray(struct.pack('<HHIII', 0x0102, 16, size, line, 0xffffffff) + ext + ab)
        for c in kids: out += emit(c, line + 1)
        out += struct.pack('<HHIII', 0x0103, 16, 24, line, 0xffffffff) + struct.pack('<II', 0xffffffff, S(tag))
        return out
    body += emit(tree, 2)
    body += struct.pack('<HHIII', 0x0101, 16, 24, 1, 0xffffffff) + struct.pack('<II', S('android'), NS)
    pool = string_pool(strings)
    resmap = struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(attr_names)) + b''.join(struct.pack('<I', ATTR_IDS[a]) for a in attr_names)
    total = 8 + len(pool) + len(resmap) + len(body)
    return struct.pack('<HHI', 0x0003, 8, total) + pool + resmap + bytes(body)

def manifest(version_code, version_name):
    A = lambda n, t, v: (True, n, t, v)
    return axml(('manifest', [A('versionCode', T_DEC, version_code), A('versionName', T_STR, version_name), (False, 'package', T_STR, PACKAGE)], [
        ('uses-sdk', [A('minSdkVersion', T_DEC, 24), A('targetSdkVersion', T_DEC, 34)], []),
        ('application', [A('label', T_STR, LABEL), A('icon', T_REF, 0x7f010000), A('allowBackup', T_BOOL, True),
                         A('hardwareAccelerated', T_BOOL, True), A('theme', T_REF, 0x0103000a)], [
            ('activity', [A('name', T_STR, PACKAGE + '.MainActivity'), A('exported', T_BOOL, True), A('launchMode', T_DEC, 1),
                          A('screenOrientation', T_DEC, 6), A('configChanges', T_HEX, 0x0ff0)], [
                ('intent-filter', [], [
                    ('action', [A('name', T_STR, 'android.intent.action.MAIN')], []),
                    ('category', [A('name', T_STR, 'android.intent.category.LAUNCHER')], []),
                ]),
            ]),
        ]),
    ]))

# ---------------------------------------------------------------- resources.arsc (one drawable)
def arsc():
    gpool = string_pool([ICON_PATH])
    tpool = string_pool(['drawable'])
    kpool = string_pool(['icon'])
    spec = struct.pack('<HHIBBHI', 0x0202, 16, 16 + 4, 1, 0, 0, 1) + struct.pack('<I', 0x0100)
    cfg = bytearray(64); struct.pack_into('<I', cfg, 0, 64); struct.pack_into('<H', cfg, 14, 640); struct.pack_into('<H', cfg, 24, 4)
    entries = struct.pack('<HHI', 8, 0, 0) + struct.pack('<HBBI', 8, 0, T_STR, 0)
    hdr_size = 8 + 4 + 4 + 4 + 64
    entries_start = hdr_size + 4
    typ = struct.pack('<HHIBBHII', 0x0201, hdr_size, entries_start + len(entries), 1, 0, 0, 1, entries_start) + bytes(cfg) + struct.pack('<I', 0) + entries
    name = PACKAGE.encode('utf-16-le').ljust(256, b'\x00')
    pkg_hdr = 288
    type_strings = pkg_hdr; key_strings = pkg_hdr + len(tpool)
    pkg_size = pkg_hdr + len(tpool) + len(kpool) + len(spec) + len(typ)
    pkg = struct.pack('<HHII', 0x0200, pkg_hdr, pkg_size, 0x7f) + name + struct.pack('<IIIII', type_strings, 1, key_strings, 1, 0)
    assert len(pkg) == pkg_hdr
    pkg += tpool + kpool + spec + typ
    total = 12 + len(gpool) + len(pkg)
    return struct.pack('<HHII', 0x0002, 12, total, 1) + gpool + pkg

# ---------------------------------------------------------------- zip writer with alignment
def make_zip(files):
    """files: list of (name, data, compress). Returns zip bytes (no comment)."""
    out = bytearray(); cd = bytearray(); n = 0
    dt = (0x0021, 0x5a61)  # fixed DOS time/date for reproducible builds (1 Nov 2025)
    for name, data, comp in files:
        nb = name.encode()
        crc = zlib.crc32(data) & 0xffffffff
        if comp:
            co = zlib.compressobj(9, zlib.DEFLATED, -15); payload = co.compress(data) + co.flush(); method = 8
        else:
            payload = data; method = 0
        off = len(out)
        extra = b''
        if method == 0:
            pad = (4 - (off + 30 + len(nb)) % 4) % 4
            extra = b'\x00' * pad
        out += struct.pack('<IHHHHHIIIHH', 0x04034b50, 20, 0x0800 if False else 0, method, dt[0], dt[1], crc, len(payload), len(data), len(nb), len(extra)) + nb + extra + payload
        cd += struct.pack('<IHHHHHHIIIHHHHHII', 0x02014b50, 20, 20, 0, method, dt[0], dt[1], crc, len(payload), len(data), len(nb), 0, 0, 0, 0, 0, off) + nb
        n += 1
    cd_off = len(out)
    eocd = struct.pack('<IHHHHIIH', 0x06054b50, 0, 0, n, n, len(cd), cd_off, 0)
    return bytes(out), bytes(cd), eocd

# ---------------------------------------------------------------- deterministic RSA key + cert
def det_key():
    from cryptography.hazmat.primitives.asymmetric import rsa
    import random
    rng = random.Random(hashlib.sha256(SEED).digest())
    def is_prime(n):
        if n < 2: return False
        for p in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
            if n % p == 0: return n == p
        d, r = n - 1, 0
        while d % 2 == 0: d //= 2; r += 1
        for _ in range(40):
            a = rng.randrange(2, n - 2); x = pow(a, d, n)
            if x in (1, n - 1): continue
            for _ in range(r - 1):
                x = pow(x, 2, n)
                if x == n - 1: break
            else: return False
        return True
    def prime(bits):
        while True:
            c = rng.getrandbits(bits) | (1 << (bits - 1)) | (1 << (bits - 2)) | 1
            if is_prime(c) and (c - 1) % 65537: return c
    e = 65537
    p = prime(1024); q = prime(1024)
    while q == p: q = prime(1024)
    if p < q: p, q = q, p
    n = p * q; phi = (p - 1) * (q - 1); d = pow(e, -1, phi)
    pub = rsa.RSAPublicNumbers(e, n)
    priv = rsa.RSAPrivateNumbers(p, q, d, d % (p - 1), d % (q - 1), pow(q, -1, p), pub)
    return priv.private_key()

def det_cert(key):
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Zimnik'), x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'Zimnik test builds')])
    nb = datetime.datetime(2025, 1, 1, tzinfo=datetime.timezone.utc); na = datetime.datetime(2075, 1, 1, tzinfo=datetime.timezone.utc)
    c = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
         .serial_number(0x5a1d2025).not_valid_before(nb).not_valid_after(na).sign(key, hashes.SHA256()))
    return c

# ---------------------------------------------------------------- APK Signature Scheme v2
def lp(b): return struct.pack('<I', len(b)) + b
def chunked_digest(sections):
    chunks = []
    for s in sections:
        for i in range(0, len(s), 1 << 20):
            c = s[i:i + (1 << 20)]
            chunks.append(hashlib.sha256(b'\xa5' + struct.pack('<I', len(c)) + c).digest())
    return hashlib.sha256(b'\x5a' + struct.pack('<I', len(chunks)) + b''.join(chunks)).digest()

def sign_v2(entries, cd, eocd, key, cert):
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    ALG = 0x0103  # RSASSA-PKCS1-v1_5 with SHA2-256
    digest = chunked_digest([entries, cd, eocd])  # EOCD's CD offset already equals the block offset
    der = cert.public_bytes(serialization.Encoding.DER)
    spki = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    signed_data = lp(lp(struct.pack('<I', ALG) + lp(digest))) + lp(lp(der)) + lp(b'')
    sig = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    signer = lp(signed_data) + lp(lp(struct.pack('<I', ALG) + lp(sig))) + lp(spki)
    value = lp(lp(signer))
    pair = struct.pack('<Q', 4 + len(value)) + struct.pack('<I', 0x7109871a) + value
    block_size = len(pair) + 8 + 16
    block = struct.pack('<Q', block_size) + pair + struct.pack('<Q', block_size) + b'APK Sig Block 42'
    new_eocd = bytearray(eocd); struct.pack_into('<I', new_eocd, 16, len(entries) + len(block))
    return entries + block + cd + bytes(new_eocd)

def build(index_html, icon_png, out, version_code=1, version_name='0.1'):
    html = open(index_html, 'rb').read(); icon = open(icon_png, 'rb').read()
    files = [
        ('AndroidManifest.xml', manifest(version_code, version_name), True),
        ('classes.dex', build_dex(), True),
        ('resources.arsc', arsc(), False),
        (ICON_PATH, icon, False),
        ('assets/index.html', html, True),
    ]
    entries, cd, eocd = make_zip(files)
    key = det_key(); cert = det_cert(key)
    apk = sign_v2(entries, cd, eocd, key, cert)
    open(out, 'wb').write(apk)
    from cryptography.hazmat.primitives import serialization
    print('APK', out, len(apk), 'bytes; cert sha256', hashlib.sha256(cert.public_bytes(serialization.Encoding.DER)).hexdigest()[:16])

if __name__ == '__main__':
    a = sys.argv
    build(a[1], a[2], a[3], int(a[4]) if len(a) > 4 else 1, a[5] if len(a) > 5 else '0.1')
