# Contacto: base | recolor automático | sprite real (si existe). Uso: python compare.py salida.png mega:base [mega:base ...]
import sys, re, json, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
meta = open(os.path.join(ROOT, 'js/data/sprites-meta.js'), encoding='utf-8').read()
real = open(os.path.join(ROOT, 'js/data/mega-sprites.js'), encoding='utf-8').read()
def geo(txt, d):
    m = re.search(r'^  %d: (\{.*\}),?$' % d, txt, re.M)
    a = json.loads(m.group(1))['a']['Idle'] if m else None
    return (a['w'], a['h']) if a else None
pairs = [tuple(map(int, a.split(':'))) for a in sys.argv[2:]]
CELL = 120
S = Image.new('RGBA', (len(pairs) * 3 * CELL, CELL), (70, 76, 86, 255))
for i, (m, b) in enumerate(pairs):
    w, h = geo(meta, b)
    for j, p in enumerate([f'assets/pokemon/{b}/Idle.png', f'tools/asset-gen/out/megas/{m}/Idle.png', f'assets/pokemon/{m}/Idle.png']):
        p = os.path.join(ROOT, p)
        if not os.path.exists(p): continue
        g = (geo(real, m) or (w, h)) if j == 2 else (w, h)
        fr = Image.open(p).convert('RGBA').crop((0, 0, g[0], g[1]))
        k = max(1, min((CELL - 8) // g[0], (CELL - 8) // g[1]))
        S.alpha_composite(fr.resize((g[0] * k, g[1] * k), Image.NEAREST), ((i * 3 + j) * CELL + 4, 4))
S.convert('RGB').save(sys.argv[1]); print('ok', S.size)
