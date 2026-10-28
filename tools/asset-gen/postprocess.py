# Devuelve un render de 1024x1024 a pixel art real: recorta, reduce a la rejilla del sprite,
# limita la paleta y deja el fondo transparente.
# Uso: python postprocess.py entrada.png ancho alto colores salida.png [k]   (k = píxeles de la referencia por píxel de arte, 20)
import sys
from PIL import Image
from collections import deque
src, w, h, ncol, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
k = int(sys.argv[6]) if len(sys.argv) > 6 else 20
im = Image.open(src).convert('RGB')
x0, y0 = (im.width - w * k) // 2, (im.height - h * k) // 2
im = im.crop((x0, y0, x0 + w * k, y0 + h * k))
small = im.resize((w, h), Image.BOX)                       # promedia cada celda: mata el dither/ruido
bgc = small.getpixel((0, 0))
q = small.quantize(colors=ncol, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
# Fondo: relleno desde los bordes con los colores cercanos al de la esquina.
near = lambda a, b: sum((p - r) ** 2 for p, r in zip(a, b)) < 40 ** 2
px, bg = q.load(), set()
dq = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
while dq:
    x, y = dq.popleft()
    if (x, y) in bg or not (0 <= x < w and 0 <= y < h) or not near(px[x, y], bgc): continue
    bg.add((x, y)); dq.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
res = q.convert('RGBA')
rp = res.load()
for x, y in bg: rp[x, y] = (0, 0, 0, 0)
res.save(out)
big = res.resize((w * 16, h * 16), Image.NEAREST)
prev = Image.new('RGBA', big.size, (60, 64, 72, 255)); prev.alpha_composite(big)
prev.convert('RGB').save(out.replace('.png', '_x16.png'))
print('ok', out)
