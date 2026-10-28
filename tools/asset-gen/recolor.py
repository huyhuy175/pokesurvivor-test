# Cambia la paleta de un fotograma de sprite (colores exactos -> colores nuevos).
# Uso: python recolor.py hoja.png ancho alto fila paleta.json salida.png
# paleta.json: {"#d73f00": "#2b2f3a", ..., "eyes": {"color": "#ff3030", "from": "#ffffff", "maxY": 15}}
import sys, json
from PIL import Image
src, w, h, row, pal, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], sys.argv[6]
P = json.load(open(pal))
hx = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
im = Image.open(src).convert('RGBA').crop((0, row * h, w, (row + 1) * h))
px = im.load()
rules = {hx(k): hx(v) for k, v in P.items() if isinstance(v, str)}
zones = [(hx(z['from']), hx(z['color']), z.get('maxY', h), z.get('minY', 0)) for z in P.get('zones', [])]
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if not a: continue
        c = (r, g, b)
        for f, t, mx, mn in zones:
            if c == f and mn <= y <= mx: c = t; break
        else:
            c = rules.get(c, c)
        px[x, y] = (*c, a)
im.save(out)
print('ok', out)
