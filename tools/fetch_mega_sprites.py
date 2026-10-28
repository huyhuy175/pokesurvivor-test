#!/usr/bin/env python3
"""fetch_mega_sprites.py — baja de SpriteCollab los sprites de las Megaevoluciones que ya los tengan
(estilo Mundo Misterioso, igual que fetch_sprites.py) y escribe js/data/mega-sprites.js.

    python tools/fetch_mega_sprites.py            baja las que falten y regenera mega-sprites.js
    python tools/fetch_mega_sprites.py --regen    sólo regenera mega-sprites.js (tras copiar hojas recoloreadas)

Se guardan en assets/pokemon/{dex de la Mega}/ (+ s/ si hay shiny). Las Mega sin sprite real siguen usando la
forma base con un aura (core/sprites.js) o, si tienen hojas recoloreadas (tools/asset-gen/make_mega.js), éstas.
Se omiten las Mega cuya forma de SpriteCollab sea ambigua (varias Mega del juego comparten una).
Fuente: https://github.com/PMDCollab/SpriteCollab  (CC BY-NC 4.0)
"""
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_sprites as fs  # noqa: E402

ROOT = fs.ROOT
OUT_JS = os.path.join(ROOT, 'js', 'data', 'mega-sprites.js')
CACHE_FILE = os.path.join(fs.CACHE, 'mega-sprites.json')
WANT_NAME = {'x': 'Mega_X', 'y': 'Mega_Y', 'z': 'Mega_Z', 'mega': 'Mega'}


def mega_rows():
    txt = open(os.path.join(ROOT, 'js', 'data', 'mega.js'), encoding='utf-8').read()
    rx = r'"dex":(\d+),"name":"([^"]+)","slug":"([^"]+)","mega":(\d+),"form":"([^"]+)"'
    return [{'dex': int(m[0]), 'name': m[1], 'base': int(m[3]), 'form': m[4]} for m in re.findall(rx, txt)]


def pick_forms(rows, tracker):
    """dex de Mega -> subcarpeta de SpriteCollab ('0001'...), sólo si es inequívoca."""
    found = {}
    for r in rows:
        e = tracker.get(f'{r["base"]:04d}')
        subs = (e or {}).get('subgroups', {})
        hit = [k for k, v in subs.items() if v.get('name') == WANT_NAME.get(r['form'])]
        if len(hit) == 1:
            found[r['dex']] = (r['base'], hit[0])
    count = {}
    for b, f in found.values():
        count[(b, f)] = count.get((b, f), 0) + 1
    return {d: v for d, v in found.items() if count[v] == 1}


def do_mega(job):
    dex, base, form = job
    tag, out = f'{base:04d}', os.path.join(fs.OUT_ASSETS, str(dex))
    url = f'{fs.BASE}/{tag}/{form}'
    xml = fs.fetch(url + '/AnimData.xml')
    if not xml:
        return dex, None
    anims, shadow = fs.parse_animdata(xml.decode('utf-8', 'replace'))
    normal = fs.download_set(url, out, anims)
    if not fs.REQUIRED <= set(normal):
        return dex, None
    meta = {'s': shadow, 'a': normal}
    sxml = fs.fetch(url + '/0001/AnimData.xml')
    if sxml:
        sanims = fs.parse_animdata(sxml.decode('utf-8', 'replace'))[0]
        shiny = fs.download_set(url + '/0001', os.path.join(out, 's'), sanims, normal)
        if 'Idle' in shiny and 'Walk' in shiny:
            meta['sh'] = 1
            diff = {k: v for k, v in shiny.items() if normal.get(k) != v}
            if diff:
                meta['sa'] = diff
            miss = [k for k in normal if k not in shiny]
            if miss:
                meta['sm'] = miss
    return dex, meta


def write_js(real):
    have = sorted(int(d) for d in os.listdir(fs.OUT_ASSETS) if d.isdigit() and int(d) >= 10000)
    pal = os.path.join(ROOT, 'tools', 'asset-gen', 'palettes')
    recolor = [d for d in have if str(d) not in real and os.path.exists(os.path.join(pal, f'{d}.json'))]
    body = ',\n'.join(f'  {d}: {json.dumps(real[str(d)], separators=(",", ":"))}' for d in have if str(d) in real)
    js = f'''/* ============ mega-sprites.js — GENERADO por tools/fetch_mega_sprites.py, no editar a mano ============
 * Megas con hojas propias en assets/pokemon/{{dex}}/. Las de G.MEGA_SPRITE_META son sprites reales de SpriteCollab
 * (misma geometría que sprites-meta.js); las de G.MEGA_RECOLOR son la forma base recoloreada (tools/asset-gen/make_mega.js)
 * y usan la geometría de su base, sin shiny propio. Las demás Mega siguen usando la base con un aura (core/sprites.js).
 * Debe cargarse DESPUÉS de sprites-meta.js y de mega.js.
 */
G.MEGA_SPRITE_META = {{
{body}
}};
G.MEGA_RECOLOR = {json.dumps(recolor)};
Object.keys(G.MEGA_SPRITE_META).forEach(d => {{
  const m = G.MEGA_SPRITE_META[d], b = G.SPRITE_META[G.MEGA_FROM[d]];
  if (b && b.hv) m.hv = 1;
  G.SPRITE_META[d] = m;
}});
G.MEGA_RECOLOR.forEach(d => {{
  const b = G.SPRITE_META[G.MEGA_FROM[d]];
  if (!b) return;
  const c = JSON.parse(JSON.stringify(b));
  delete c.sh; delete c.sa; delete c.sm;
  G.SPRITE_META[d] = c;
}});
'''
    with open(OUT_JS, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print(f'{OUT_JS}: {len(real)} reales + {len(recolor)} recoloreadas')


def main():
    os.makedirs(fs.CACHE, exist_ok=True)
    real = json.load(open(CACHE_FILE, encoding='utf-8')) if os.path.exists(CACHE_FILE) else {}
    if '--regen' not in sys.argv:
        print('Leyendo tracker.json de SpriteCollab...')
        tracker = json.loads(fs.fetch(fs.RAW + '/tracker.json').decode('utf-8'))
        jobs = [(d, b, f) for d, (b, f) in pick_forms(mega_rows(), tracker).items() if str(d) not in real]
        print(f'{len(jobs)} Mega por bajar')
        with ThreadPoolExecutor(max_workers=8) as ex:
            for dex, meta in ex.map(do_mega, jobs):
                if meta:
                    real[str(dex)] = meta
                    print(f'  {dex} ok')
        json.dump(real, open(CACHE_FILE, 'w', encoding='utf-8'), separators=(',', ':'))
    write_js(real)


if __name__ == '__main__':
    main()
