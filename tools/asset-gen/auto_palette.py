#!/usr/bin/env python3
"""auto_palette.py — deduce la paleta de una Mega comparando el artwork oficial de la base con el de la Mega.

    python auto_palette.py 10001 [10002 ...]     escribe palettes/{dex}.json (y out/auto/{dex}.txt con el informe)
    python auto_palette.py --missing             todas las Mega sin carpeta en assets/pokemon/ y sin paleta propia
    python auto_palette.py --force-missing       lo mismo pero forzando el cambio (giro de matiz + croma) si apenas cambia
Método: k-means de los colores dominantes de cada artwork (sin el contorno oscuro), emparejados por posición y
tamaño; cada color del sprite base se mueve en Lab lo que se movió su color dominante más cercano. Si ningún color
cambia de forma apreciable no se escribe paleta (la Mega seguiría igual que la base) y se avisa.
"""
import io
import json
import os
import re
import sys
import urllib.request
from itertools import permutations
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
ART = os.path.join(HERE, 'out', 'ref')
PAL = os.path.join(HERE, 'palettes')
K = 6
MIN_DE = 14.0       # cambio mínimo (ΔE) de un color dominante para considerarlo "cambió"
TINT_DEG = 28.0      # giro de matiz del modo --force (el signo depende de la paridad del dex, para que no salgan todas iguales)
MIN_SCORE = 10.0     # cambio medio por pixel (Lab) para escribir paleta; por debajo la Mega sería casi igual que la base
NEAR_DE = 30.0      # un color del sprite sólo sigue a un dominante si está a menos de esto


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'pokesurvivor/1.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def artwork(pid):
    p = os.path.join(ART, f'{pid}.png')
    if not os.path.exists(p):
        os.makedirs(ART, exist_ok=True)
        open(p, 'wb').write(get(f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{pid}.png'))
    return Image.open(p).convert('RGBA')


def pokeapi_id(slug):
    return json.loads(get(f'https://pokeapi.co/api/v2/pokemon/{slug}'))['id']


def rgb2lab(rgb):
    c = np.asarray(rgb, float) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab2rgb(lab):
    lab = np.asarray(lab, float)
    fy = (lab[..., 0] + 16) / 116
    fx, fz = fy + lab[..., 1] / 500, fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * np.array([0.95047, 1.0, 1.08883])
    m = np.linalg.inv(np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]))
    c = np.clip(xyz @ m.T, 0, 1)
    c = np.where(c > 0.0031308, 1.055 * c ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(np.rint(c * 255), 0, 255).astype(int)


def clusters(im):
    """K colores dominantes: (Lab centro, peso, centroide normalizado x,y)."""
    a = np.asarray(im)
    ys, xs = np.nonzero(a[..., 3] > 200)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    rgb = a[ys, xs, :3]
    lab = rgb2lab(rgb)
    keep = lab[:, 0] > 14                                   # fuera el contorno casi negro
    lab, xs, ys = lab[keep], xs[keep], ys[keep]
    rng = np.random.default_rng(1)
    cen = lab[rng.choice(len(lab), K, replace=False)]
    for _ in range(25):
        lbl = np.argmin(((lab[:, None] - cen[None]) ** 2).sum(-1), 1)
        for k in range(K):
            if (lbl == k).any():
                cen[k] = lab[lbl == k].mean(0)
    out = []
    for k in range(K):
        sel = lbl == k
        if sel.sum() < 30:
            continue
        out.append((cen[k], sel.mean(), np.array([(xs[sel].mean() - x0) / (x1 - x0 + 1), (ys[sel].mean() - y0) / (y1 - y0 + 1)])))
    return out


def match(cb, cm):
    """Empareja dominantes de la base con los de la Mega (posición + tamaño)."""
    n = min(len(cb), len(cm))
    best, bs = None, 1e9
    for perm in permutations(range(len(cm)), n):
        s = sum(np.linalg.norm(cb[i][2] - cm[j][2]) + 2.0 * abs(cb[i][1] - cm[j][1]) for i, j in enumerate(perm))
        if s < bs:
            best, bs = perm, s
    return [(i, j) for i, j in enumerate(best)]


def sprite_colors(base):
    cnt = {}
    for n in ('Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint'):
        p = os.path.join(ROOT, 'assets', 'pokemon', str(base), n + '.png')
        if os.path.exists(p):
            a =np.asarray(Image.open(p).convert('RGBA')).reshape(-1, 4)
            a = a[a[:, 3] > 0][:, :3]
            u, k = np.unique(a, axis=0, return_counts=True)
            for c, n_ in zip(map(tuple, u), k):
                cnt[c] = cnt.get(c, 0) + int(n_)
    return cnt


def tint(l, sign):
    """Giro de matiz + más croma + algo más oscuro (Mega cuyo color casi no cambia respecto a la base)."""
    chroma = float(np.hypot(l[1], l[2]))
    if chroma < 8 or l[0] < 14 or l[0] > 92:
        return l
    ang = np.arctan2(l[2], l[1]) + np.radians(TINT_DEG) * sign
    chroma *= 1.2
    return np.array([max(3.0, l[0] - 4), chroma * np.cos(ang), chroma * np.sin(ang)])


def build(dex, slug, base, force=False):
    cb, cm = clusters(artwork(base)), clusters(artwork(pokeapi_id(slug)))
    pairs = match(cb, cm)
    moves = [(cb[i][0], cm[j][0] - cb[i][0], float(np.linalg.norm(cm[j][0] - cb[i][0]))) for i, j in pairs]
    if not force and max(m[2] for m in moves) < MIN_DE:
        return None, 'sin cambio de color apreciable (dE max %.0f)' % max(m[2] for m in moves), 0.0
    cols = sprite_colors(base)
    keys = np.array(list(cols))
    lab = rgb2lab(keys)
    pal, changed, shift = {}, 0, 0.0
    total = sum(cols.values())
    for c, l in zip(map(tuple, keys), lab):
        d = [np.linalg.norm(l - m[0]) for m in moves]
        i = int(np.argmin(d))
        if d[i] > NEAR_DE or l[0] < 14 or moves[i][2] < MIN_DE:
            if not force:
                continue
            nl = l.copy()
        else:
            nl = l + moves[i][1]
            nl[0] = np.clip(nl[0], 3, 100)
        if force:
            nl = tint(nl, 1 if dex % 2 == 0 else -1)
        new = tuple(int(v) for v in lab2rgb(nl))
        if new != c:
            pal['#%02x%02x%02x' % c] = '#%02x%02x%02x' % new
            changed += 1
            shift += cols[c] * float(np.linalg.norm(nl - l))
    return pal, f'{changed}/{len(keys)} colores cambiados; cambio medio {shift / total:.1f}', shift / total


def mega_rows():
    txt = open(os.path.join(ROOT, 'js', 'data', 'mega.js'), encoding='utf-8').read()
    rx = r'"dex":(\d+),"name":"([^"]+)","slug":"([^"]+)","mega":(\d+)'
    return {int(m[0]): (m[1], m[2], int(m[3])) for m in re.findall(rx, txt)}


def main():
    rows = mega_rows()
    args = [a for a in sys.argv[1:] if a.isdigit()]
    force = '--force' in sys.argv or '--force-missing' in sys.argv
    if '--missing' in sys.argv or '--force-missing' in sys.argv:
        args = [str(d) for d in rows if not os.path.isdir(os.path.join(ROOT, 'assets', 'pokemon', str(d)))
                and not os.path.exists(os.path.join(PAL, f'{d}.json'))]
    os.makedirs(PAL, exist_ok=True)
    for a in args:
        dex = int(a)
        name, slug, base = rows[dex]
        try:
            pal, info, score = build(dex, slug, base, force)
        except Exception as e:
            print(f'{dex} {name}: ERROR {e}')
            continue
        if pal and (force or score >= MIN_SCORE):
            json.dump({'_': f'auto_palette.py: {name} — {info}' + (' (forzada: matiz/croma)' if force else ''), **pal}, open(os.path.join(PAL, f'{dex}.json'), 'w'), indent=1)
        print(f'{dex} {name}: {info}' + ('' if pal and (force or score >= MIN_SCORE) else '  -> sin paleta (cambio insuficiente)'))


if __name__ == '__main__':
    main()
