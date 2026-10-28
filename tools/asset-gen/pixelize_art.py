# Convierte un artwork oficial (PNG con alfa) en pixel art con el estilo de los sprites del juego:
# recorta al contenido, encaja en ancho x alto, reduce promediando, limita la paleta y añade contorno negro.
# Uso: python pixelize_art.py artwork.png ancho alto colores salida.png
import sys
from PIL import Image, ImageFilter
src, W, H, ncol, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
im = Image.open(src).convert('RGBA')
im = im.crop(im.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox())
iw, ih = W - 2, H - 2                                   # deja 1 px para el contorno
k = min(iw / im.width, ih / im.height)
nw, nh = max(1, round(im.width * k)), max(1, round(im.height * k))
a = im.getchannel('A').resize((nw, nh), Image.BOX).point(lambda v: 255 if v > 110 else 0)
rgb = Image.new('RGB', im.size, (0, 0, 0))
rgb.paste(im, mask=im.getchannel('A'))                  # los bordes semitransparentes no sangran blanco
rgb = rgb.resize((nw, nh), Image.BOX)
rgb = rgb.quantize(colors=ncol, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
sp = Image.new('RGBA', (nw, nh)); sp.paste(rgb); sp.putalpha(a)
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ox, oy = (W - nw) // 2, H - 1 - nh                       # pegado abajo, centrado
canvas.alpha_composite(sp, (ox, oy))
# contorno negro de 1 px (4 vecinos)
al = canvas.getchannel('A'); px = canvas.load(); ap = al.load()
for y in range(H):
    for x in range(W):
        if ap[x, y] == 0 and any(0 <= x + dx < W and 0 <= y + dy < H and ap[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            px[x, y] = (0, 0, 0, 255)
canvas.save(out)
print('ok', out)
