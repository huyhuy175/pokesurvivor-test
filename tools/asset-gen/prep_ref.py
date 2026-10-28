# Recorta el fotograma 0 de una fila (dirección) de una hoja y lo deja en un lienzo 1024x1024 de fondo liso.
# Uso: python prep_ref.py hoja.png ancho alto fila salida.png
import sys
from PIL import Image
src, w, h, row, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
fr = Image.open(src).convert('RGBA').crop((0, row * h, w, (row + 1) * h))
k = min(1024 // w, 1024 // h) - 1
big = fr.resize((w * k, h * k), Image.NEAREST)
bg = Image.new('RGBA', (1024, 1024), (163, 168, 163, 255))
bg.alpha_composite(big, ((1024 - big.width) // 2, (1024 - big.height) // 2))
bg.convert('RGB').save(out)
print('ok', k)
