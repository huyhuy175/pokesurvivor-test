#!/usr/bin/env python3
"""Genera los atlas de mapa a partir de tilesets RPG Maker del itch-bundle.

    python tools/make_tilesets.py                 # todos los packs de la config
    python tools/make_tilesets.py --only meadow   # sólo uno
    python tools/make_tilesets.py --contact meadow   # hojas con rejilla para elegir bloques
    python tools/make_tilesets.py --ground meadow    # tiles planos opacos de las hojas B

Entrada: tools/tilesets.config.json. Salida: assets/tilesets/<id>.png y
js/data/tilesets.js (G.Tilesets). Necesita Pillow (sólo herramienta de desarrollo).

Formato RPG Maker (tile de 48 px):
  A2  suelo: 8×4 bloques de 96×144 (2×3 tiles). Bloque (bx 0..7, by 0..3).
  A4  paredes: 8 columnas; por fila ty (0..5) un bloque "cara superior" (ty par,
      96×144) o "cara frontal" (ty impar, 96×96) en las alturas A4_Y.
  B   objetos: rejilla de 16×16 tiles de 48 px; los props se piden en tiles.
Suelo, suelo alternativo y líquido son listas de tiles PLANOS (los packs comparten
las hojas A2/A4; el tema real está en los tiles llenos de las hojas B). Cada
referencia es {sheet, tx, ty} (tile de 48 px de cualquier hoja) o
{sheet, bx, by, interior: true} (el centro de un bloque A2).
Atlas (ancho 384; el runtime, js/world/skins.js, usa esta misma convención):
  y=0  floor ×N (celdas de 32 px desde x=0) · wallTop x192 (64×96) · wallFace x256 (64×64)
       · altBlock x320 (64×96, autotile de las manchas; opcional)
  y=32 alt ×N · y=64 liquid ×N. Debajo (y>=96), los props reducidos a 2/3.
"""
import argparse, json, os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUNDLE = os.path.join(ROOT, 'itch-bundle')
OUT_DIR = os.path.join(ROOT, 'assets', 'tilesets')
OUT_JS = os.path.join(ROOT, 'js', 'data', 'tilesets.js')
CONFIG = os.path.join(ROOT, 'tools', 'tilesets.config.json')
CONTACT_DIR = os.path.join(ROOT, 'tools', 'cache', 'contact')
SRC, DST = 48, 32                      # px por tile: origen y atlas
A4_Y = [0, 144, 240, 384, 480, 624]    # y de cada fila de bloques A4
ATLAS_W = 384
ROWS = {'floor': 0, 'alt': 32, 'liquid': 64}
WALL_X, FACE_X, ALT_X = 192, 256, 320
MAX_CELLS = 6
PROP_Y = 96


FOLDERS = {}   # id de pack -> carpeta (para tomar tiles prestados con "from")


def find_sheet(folder, name):
    base = os.path.join(BUNDLE, folder)
    if not os.path.isdir(base):
        sys.exit(f'No existe la carpeta del pack: {folder}')
    for dp, _, files in os.walk(base):
        if name in files:
            return os.path.join(dp, name)
    sys.exit(f'No encuentro la hoja "{name}" en {folder}')


def shrink(img):
    w, h = img.size
    return img.resize((round(w * DST / SRC), round(h * DST / SRC)), Image.LANCZOS)


FLOOR_INTERIOR = [[2, 4], [1, 4], [2, 3], [1, 3]]   # cuartos del interior (FLOOR_TABLE[0] de autotile.js)


def tint_img(im, rgb):
    """Multiplica el color de la imagen por rgb/255 (nocturno, nieve, pantano...)."""
    if not rgb:
        return im
    r, g, b, a = im.split()
    mul = lambda ch, k: ch.point(lambda v: min(255, v * k // 255))
    return Image.merge('RGBA', (mul(r, rgb[0]), mul(g, rgb[1]), mul(b, rgb[2]), a))


def tile_ref(pack, ref, tint=None):
    """Un tile plano de 48 px -> 32 px (con "from": hoja de otro pack)."""
    folder = FOLDERS[ref['from']] if 'from' in ref else pack['folder']
    sheet = Image.open(find_sheet(folder, ref['sheet'])).convert('RGBA')
    if ref.get('interior'):
        bx, by, q = ref['bx'] * 96, ref['by'] * 144, SRC // 2
        t = Image.new('RGBA', (SRC, SRC))
        for i, (qx, qy) in enumerate(FLOOR_INTERIOR):
            t.paste(sheet.crop((bx + qx * q, by + qy * q, bx + (qx + 1) * q, by + (qy + 1) * q)), ((i % 2) * q, (i // 2) * q))
    else:
        t = sheet.crop((ref['tx'] * SRC, ref['ty'] * SRC, (ref['tx'] + 1) * SRC, (ref['ty'] + 1) * SRC))
    return tint_img(shrink(t), tint)


def a2_block(pack, ref):
    """Bloque de autotile A2 completo (96×144 -> 64×96)."""
    sheet = Image.open(find_sheet(pack['folder'], ref['sheet'])).convert('RGBA')
    x, y = ref['bx'] * 96, ref['by'] * 144
    return shrink(sheet.crop((x, y, x + 96, y + 144)))


def a4_block(pack, ref, h):
    sheet = Image.open(find_sheet(pack['folder'], ref['sheet'])).convert('RGBA')
    x, y = ref['bx'] * 96, A4_Y[ref['ty']]
    return shrink(sheet.crop((x, y, x + 96, y + h)))


def build(pack):
    props = {}
    prop_imgs = []
    for kind, r in pack.get('props', {}).items():
        sheet = Image.open(find_sheet(pack['folder'], r['sheet'])).convert('RGBA')
        box = (r['tx'] * SRC, r['ty'] * SRC, (r['tx'] + r['tw']) * SRC, (r['ty'] + r['th']) * SRC)
        prop_imgs.append((kind, shrink(sheet.crop(box))))
    # Props en filas, de izquierda a derecha, saltando de fila al llenarse.
    x = y = row_h = 0
    for kind, im in prop_imgs:
        if x + im.width > ATLAS_W:
            x, y, row_h = 0, y + row_h, 0
        props[kind] = {'x': x, 'y': PROP_Y + y, 'w': im.width, 'h': im.height}
        x += im.width
        row_h = max(row_h, im.height)
    atlas = Image.new('RGBA', (ATLAS_W, PROP_Y + y + row_h), (0, 0, 0, 0))
    counts = {}
    for row, key in (('floor', 'floor'), ('alt', 'alt'), ('liquid', 'liquidCells')):
        refs = pack.get(key, [])[:MAX_CELLS]
        counts[row] = len(refs)
        for i, r in enumerate(refs):
            tint = pack.get('liquidTint') if row == 'liquid' else pack.get('tint')
            atlas.paste(tile_ref(pack, r, tint), (i * DST, ROWS[row]))
    if pack.get('altBlock'):
        counts['altBlock'] = 1
        atlas.paste(tint_img(a2_block(pack, pack['altBlock']), pack.get('tint')), (ALT_X, 0))
    atlas.paste(a4_block(pack, pack['wallTop'], 144), (WALL_X, 0))
    atlas.paste(a4_block(pack, pack['wallFace'], 96), (FACE_X, 0))
    for kind, im in prop_imgs:
        p = props[kind]
        atlas.paste(im, (p['x'], p['y']))
    os.makedirs(OUT_DIR, exist_ok=True)
    atlas.save(os.path.join(OUT_DIR, pack['id'] + '.png'), optimize=True)
    return {'props': props, 'counts': counts}


def ground(pack):
    """Tiles de 48 px totalmente opacos de las hojas B (candidatos a suelo/líquido), sin repetir."""
    import hashlib
    os.makedirs(CONTACT_DIR, exist_ok=True)
    base = os.path.join(BUNDLE, pack['folder'])
    seen, cells = set(), []
    for dp, _, files in os.walk(base):
        for f in sorted(files):
            if not f.lower().endswith('.png') or 'a2' in f.lower() or 'a4' in f.lower():
                continue
            im = Image.open(os.path.join(dp, f)).convert('RGBA')
            for ty in range(im.height // SRC):
                for tx in range(im.width // SRC):
                    t = im.crop((tx * SRC, ty * SRC, tx * SRC + SRC, ty * SRC + SRC))
                    if t.getchannel('A').getextrema()[0] < 255:
                        continue
                    h = hashlib.md5(t.tobytes()).hexdigest()
                    if h in seen:
                        continue
                    seen.add(h)
                    cells.append((t, f.replace('tile-', '').replace('.png', ''), tx, ty))
    cols = 12
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 64, max(1, rows) * 64), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for i, (t, f, tx, ty) in enumerate(cells):
        x, y = (i % cols) * 64, (i // cols) * 64
        sheet.paste(t.convert('RGB').resize((48, 48)), (x + 8, y + 2))
        d.text((x + 2, y + 51), f'{f[-2:]}:{tx},{ty}', fill=(255, 255, 255))
    out = os.path.join(CONTACT_DIR, pack['id'] + '__ground.png')
    sheet.save(out)
    print(out, len(cells), 'tiles')


def contact(pack):
    """Hojas con rejilla y rótulos para elegir bloques: A2/A4 por bloque, B por tile."""
    os.makedirs(CONTACT_DIR, exist_ok=True)
    base = os.path.join(BUNDLE, pack['folder'])
    for dp, _, files in os.walk(base):
        for f in sorted(files):
            if not f.lower().endswith('.png'):
                continue
            im = Image.open(os.path.join(dp, f)).convert('RGBA')
            bg = Image.new('RGBA', im.size, (255, 0, 255, 255))
            bg.alpha_composite(im)
            d = ImageDraw.Draw(bg)
            low = f.lower()
            if 'a2' in low:
                cells = [(bx * 96, by * 144, f'{bx},{by}') for bx in range(8) for by in range(4)]
                size = (96, 144)
            elif 'a4' in low:
                cells = [(bx * 96, A4_Y[ty], f'{bx},t{ty}') for bx in range(8) for ty in range(6)]
                size = (96, 48)
            else:
                cells = [(tx * 48, ty * 48, f'{tx},{ty}') for tx in range(16) for ty in range(16)]
                size = (48, 48)
            for x, y, label in cells:
                d.rectangle((x, y, x + size[0] - 1, y + size[1] - 1), outline=(255, 255, 0, 255))
                d.text((x + 2, y + 1), label, fill=(255, 255, 255, 255), stroke_width=1, stroke_fill=(0, 0, 0, 255))
            out = os.path.join(CONTACT_DIR, f"{pack['id']}__{f}")
            bg.convert('RGB').save(out)
            print(out)


def write_js(packs, all_props):
    rows = []
    for p in packs:
        rows.append({'id': p['id'], 'name': p['name'], 'liquid': p['liquid'],
                     'palette': p['palette'], 'prop': 'tree', **all_props[p['id']]})
    body = json.dumps(rows, ensure_ascii=False, indent=1)
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('/* GENERADO por tools/make_tilesets.py: no se edita a mano.\n'
                ' * Tilesets de mapa (atlas en assets/tilesets/<id>.png); ver js/world/skins.js. */\n')
        f.write('G.Tilesets = ' + body + ';\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only')
    ap.add_argument('--contact')
    ap.add_argument('--ground')
    a = ap.parse_args()
    packs = json.load(open(CONFIG, encoding='utf-8'))
    for p in packs:
        FOLDERS[p['id']] = p['folder']
    if a.contact:
        for p in packs:
            if p['id'] == a.contact:
                contact(p)
        return
    if a.ground:
        for p in packs:
            if p['id'] == a.ground:
                ground(p)
        return
    all_props = {}
    old = {}
    if os.path.exists(OUT_JS) and a.only:
        # Con --only se conservan los props de los demás packs ya generados.
        txt = open(OUT_JS, encoding='utf-8').read()
        old = {r['id']: {'props': r['props'], 'counts': r['counts']} for r in json.loads(txt[txt.index('G.Tilesets = ') + 13:].rstrip().rstrip(';'))}
    for p in packs:
        if a.only and p['id'] != a.only:
            all_props[p['id']] = old.get(p['id'], {'props': {}, 'counts': {}})
            continue
        all_props[p['id']] = build(p)
        print('ok', p['id'])
    write_js(packs, all_props)


if __name__ == '__main__':
    main()
