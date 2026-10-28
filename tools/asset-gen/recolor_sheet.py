# Recolorea una hoja entera (todas sus filas/fotogramas) con una paleta de colores exactos.
# Uso: python recolor_sheet.py hoja.png alto_fotograma paleta.json salida.png
# "zones" opcional: {"from","color","maxY"} -> sólo cambia ese color en las primeras maxY filas de CADA fotograma.
import sys, json
from PIL import Image
src, fh, pal, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
P = json.load(open(pal))
hx = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
rules = {hx(k): hx(v) for k, v in P.items() if isinstance(v, str) and k.startswith('#')}
zones = [(hx(z['from']), hx(z['color']), z.get('maxY', fh)) for z in P.get('zones', [])]
im = Image.open(src).convert('RGBA')
px = im.load()
for y in range(im.height):
    fy = y % fh
    for x in range(im.width):
        r, g, b, a = px[x, y]
        if not a: continue
        c = (r, g, b)
        for f, t, mx in zones:
            if c == f and fy <= mx: c = t; break
        else:
            c = rules.get(c, c)
        px[x, y] = (*c, a)
im.save(out)
