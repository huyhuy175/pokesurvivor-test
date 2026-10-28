#!/usr/bin/env python3
"""strong_palette.py — paleta MUY distinta de la base para las Mega recoloreadas.

    python strong_palette.py            reescribe palettes/{dex}.json de todas las que ya tengan paleta
    python strong_palette.py 10016 ...  sólo esas

El color dominante del sprite gira 150-210 grados en la rueda de color (el giro varía con el dex para que no salgan todas
iguales), con más croma; los grises/blancos medios se tiñen del color nuevo. Negro (contornos) y blanco puro se respetan.
"""
import json
import os
import sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import auto_palette as ap  # noqa: E402

CHROMA_UP = 1.3      # multiplicador de croma de los colores con color
NEUTRAL_C = 26.0     # croma con el que se tiñen los grises (en su punto medio de luminosidad)


def variant(dex):
    """0 para la primera Mega de una base, 1, 2... para sus variantes (Raichu X/Y, Tatsugiri...)."""
    rows = ap.mega_rows()
    return sum(1 for d, r in rows.items() if r[2] == rows[dex][2] and d < dex)


def offset(dex):
    return 150 + (dex * 37) % 61 + 50 * variant(dex)    # 150..210 (+50 por variante)


def dominant_hue(keys, lab, counts):
    c = np.hypot(lab[:, 1], lab[:, 2])
    w = counts * np.where(lab[:, 0] > 14, c, 0)
    ang = np.arctan2(lab[:, 2], lab[:, 1])
    return float(np.arctan2((w * np.sin(ang)).sum(), (w * np.cos(ang)).sum())) if w.sum() > 0 else 0.0


def build(dex, base):
    cols = ap.sprite_colors(base)
    keys = np.array(list(cols))
    counts = np.array([cols[tuple(k)] for k in keys], float)
    lab = ap.rgb2lab(keys)
    rot = np.radians(offset(dex)) * (1 if dex % 2 == 0 else -1)
    target = dominant_hue(keys, lab, counts) + rot       # matiz al que irán los grises
    pal = {}
    for c, l in zip(map(tuple, keys), lab):
        if l[0] < 14:
            continue                                      # contornos
        chroma = float(np.hypot(l[1], l[2]))
        if chroma >= 8:
            ang, ch = np.arctan2(l[2], l[1]) + rot, chroma * CHROMA_UP
        elif l[0] < 96:
            ang, ch = target, NEUTRAL_C * (1 - abs(l[0] - 55) / 55 * 0.7)    # menos teñido hacia negro/blanco
        else:
            continue
        nl = np.array([l[0], ch * np.cos(ang), ch * np.sin(ang)])
        new = tuple(int(v) for v in ap.lab2rgb(nl))
        if new != c:
            pal['#%02x%02x%02x' % c] = '#%02x%02x%02x' % new
    return pal


def main():
    rows = ap.mega_rows()
    args = [a for a in sys.argv[1:] if a.isdigit()]
    if not args:
        args = [f[:-5] for f in sorted(os.listdir(ap.PAL)) if f[:-5].isdigit()]
    for a in args:
        dex = int(a)
        name, slug, base = rows[dex]
        pal = build(dex, base)
        json.dump({'_': f'strong_palette.py: {name} — giro {offset(dex) * (1 if dex % 2 == 0 else -1)} grados', **pal},
                  open(os.path.join(ap.PAL, f'{dex}.json'), 'w'), indent=1)
        print(f'{dex} {name}: {len(pal)} colores, giro {offset(dex) * (1 if dex % 2 == 0 else -1)}')


if __name__ == '__main__':
    main()
