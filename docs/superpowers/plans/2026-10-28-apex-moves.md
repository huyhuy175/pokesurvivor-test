# Chiêu mới cho Apex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi boss Apex có một chiêu đặc trưng theo hệ (18 chiêu) và "Overdrive" dưới 50% máu, chỉ dùng hazard/đạn có sẵn, nặng về né tránh.

**Architecture:** `G.ApexMoves` (`js/data/apex-moves.js`) định nghĩa 7 phép dựng hazard dùng chung và 18 chiêu ghép từ chúng; `enemy.js` chỉ thêm đòn `'sig'` cho Apex (chọn, bắt đầu, echo khi fury). Mọi hazard đi qua `G.Hazards.add` (tự broadcast `hz`), mọi đạn qua `boss.shoot` (tự `enemyShot`): không thêm gói tin.

**Tech Stack:** JS thuần treo trên `G`; test `node:test` (`.cjs`) nạp file bằng `new Function('G', src)`.

**Spec:** `docs/superpowers/specs/2026-10-28-apex-moves-design.md`

## Global Constraints

- Sửa `dev.html` (không sửa `index.html`, `js/app.min.js`, `version.json`). `js/data/apex-moves.js` đặt ngay trước `js/entities/enemy.js` trong khối `<!-- scripts:begin/end -->`; **không** thêm vào `NEED` của `js/main.js` (thiếu file thì Apex về hành vi cũ).
- Không đổi `Rift.APEX`, phần thưởng, `ARENA_TIME` (120 s), `codec.js`, gói tin co-op, hành vi của legendary thường (`!boss.apex`).
- Tên và mô tả chiêu chỉ tiếng Anh, không dấu Tây Ban Nha, không đưa vào `lang-en.js`.
- Hằng số ràng buộc (spec mục 5, đặt trong `G.ApexMoves.LIMITS`): `DMG_CAP = 1.5` (hazard ≤ `shotDmg × 1,5`), `MAX_OVERLAP = 2`, `MIN_SAFE = 0.35`, `MIN_DELAY = 0.7`, `MIN_TARGET_DELAY = 0.45`, `MAX_HAZARDS = 40`, `ECHO = { delay: 1.2, dmgK: 0.7, rot: Math.PI / 6 }`.
- Nhiều file là CRLF (`enemy.js`, `dev.html`, `changelog.js`) hoặc LF: dùng Edit với chuỗi duy nhất, kiểm `git diff --stat` để chắc không đổi hàng loạt dòng.
- Changelog 2026-10-28 (es + en).
- **Không commit/push** (CLAUDE.md: chỉ khi chủ dự án yêu cầu). Cuối mỗi task chỉ chạy test và `git status --short`.
- Lệnh test: `node --test tests/*.cjs`. Trước khi bắt đầu phải pass toàn bộ (hiện 348).

## Review Focus

- Người chơi ngoài đấu trường hoặc không còn ai sống (`players` rỗng): các phép `target`/`chain` không ném lỗi và không tạo hazard. Test ở Task 1.
- Apex có hệ không có trong bảng (`types` rỗng hoặc hệ lạ): `of` trả `null`, `bossInit` không thêm `'sig'`, boss vẫn chạy như legendary thường. Test ở Task 2 và 3.
- `ai.fury` bật giữa lúc đang ra `sig`: echo vẫn đúng một lần, không lồng. Test ở Task 3.
- Apex chết hoặc `arena.phase` kết thúc khi echo còn chờ: không tạo hazard sau khi boss `dead`. Test ở Task 3.
- Hazard nổ sau khi người chơi đã thắng/thua rift: `Rift.finish` gọi `Hazards.clear()` (đã có) nên không còn hazard treo; xác nhận bằng test ở Task 3 (gọi `clear` và kiểm `count`).

---

### Task 1: Lõi `G.ApexMoves` — ngữ cảnh và 7 phép dựng

**Files:**
- Create: `js/data/apex-moves.js`
- Create: `tests/helpers/apex-world.cjs`
- Create: `tests/apex-moves.test.cjs`

**Interfaces:**
- Produces (`G.ApexMoves`):
  - `LIMITS` (hằng số trong Global Constraints).
  - `makeCtx(boss, pl, cast, opts?: { echo?: boolean }) -> ctx`, với `ctx = { boss, pl, players, arena: { x, y, r }, type, color, base, fury, echo, out: Hazard[], zone, beam, shot }` và:
    - `players` = `G.Game.everyone().filter(p => !p.dead)` (có thể rỗng).
    - `arena` lấy từ `G.Rift.arenaInfo()` nếu có, nếu không thì `{ x: boss.x, y: boss.y, r: 307 }` (xem Task 4 cho `arenaInfo`).
    - `base = boss.shotDmg()`; `ctx.zone(x, y, r, delay, k = 1)` và `ctx.beam(x, y, angle, len, w, delay, k = 1)` gọi `G.Hazards.add` với `{ kind, ..., dmg: base * Math.min(k, LIMITS.DMG_CAP) * (echo ? ECHO.dmgK : 1), type, color, cat: boss.cat }`, đẩy hazard vào `out` và trả về nó; từ chối (không tạo, trả `null`) khi `out.length >= MAX_HAZARDS` hoặc `delay < (target ? MIN_TARGET_DELAY : MIN_DELAY)`.
    - `ctx.shot = null` ban đầu; một chiêu gán `ctx.shot = { spread, n, k }` để `bossCast` bắn ở cuối `wind`.
  - `PRIMS` — mỗi phép nhận `(ctx, opts)` và trả danh sách hazard vừa tạo:
    - `ring(ctx, { n, r, hr, delay, gap? })`: `n` vùng (bán kính `hr`) trên vòng bán kính `r` quanh boss; `gap` (rad) bỏ các vùng nằm trong khe đó.
    - `spiral(ctx, { n, r0, r1, turns, hr, delay, stagger })`
    - `sweep(ctx, { nBeams, spread, steps, stepAngle, len, w, delay, step })`: `steps` lượt tia, mỗi lượt xoay `stepAngle`, lượt sau chậm `step` s.
    - `rain(ctx, { n, hr, spread, delay, stagger, around })`: `around` = `'players'` hoặc `'arena'`.
    - `target(ctx, { r, delay, extra? })`: một vùng lên mỗi người chơi còn sống (delay ≥ `MIN_TARGET_DELAY`).
    - `lanes(ctx, { n, width, axis, gapIndex, delay, step })`: `n` tia song song theo trục `'x'|'y'` của đấu trường, bỏ tia số `gapIndex` (làn an toàn).
    - `converge(ctx, { rings, r0, r1, n, hr, delay, stagger })`: các vòng vùng thu hẹp dần từ `r0` đến `r1`.
  - Mọi vị trí hazard bị kẹp trong `arena` (khoảng cách tới tâm ≤ `arena.r`).

- [ ] **Step 1: Viết helper** `tests/helpers/apex-world.cjs` exporting `world({ players?, arena?, host? }) -> { G, calls, boss(opts?), pl }`: `G` giả gồm `Game.everyone`, `Hazards` thật (nạp `js/systems/hazards.js` với `Coop.isHost` theo `host`, `Coop.broadcast` ghi vào `calls.broadcast`, `Camera`, `FX`, `Audio`, `Game.player`), `Rift.arenaInfo`, `Spawner.say` (ghi `calls.say`), `U` (`rand`, `pick`, `hash`, `norm`, `dist2`, `clamp`, `TYPE_COLOR`), `Coop`; `boss(o)` trả đối tượng `{ x, y, r, types, atkType, cat: 'special', apex: true, dead: false, shotDmg: () => 60, shoot(...) { calls.shots.push([...]) }, anim: { play() {} }, ai: null }`; nạp `js/data/apex-moves.js` sau cùng. Đồng thời export `coverage(hazards, arena, step = 12) -> { frac, depth }` (lưới điểm trong đấu trường; `frac` = tỉ lệ điểm bị phủ bởi ít nhất một hazard, `depth` = số hazard lớn nhất phủ một điểm; dùng `G.Hazards.inside(h, x, y, 12)` thật).
- [ ] **Step 2: Viết test thất bại** trong `tests/apex-moves.test.cjs` (nạp qua helper):
  - `test('zone/beam wrappers apply cat, type, color and capped damage')`: `ctx.zone(0,0,50,1,9)` có `dmg === 60 * 1.5`, `cat === boss.cat`, `type === boss.atkType`; ở `echo: true` thì `60 * 1.5 * 0.7`.
  - `test('wrappers refuse too-short delays and more than 40 hazards')`: `ctx.zone(0,0,50,0.3)` → `null`; 45 llamadas válidas → `out.length === 40`.
  - `test('every primitive creates the expected hazards and keeps them inside the arena')`: cho mỗi phép, đếm (ví dụ `ring({n:8})` → 8 `zone`; `ring` với `gap` bỏ ≥ 1; `sweep({nBeams:3, steps:3})` → 9 `beam`; `lanes({n:5, gapIndex:2})` → 4 `beam`; `converge({rings:3,n:6})` → 18), và mọi hazard có khoảng cách tới tâm arena ≤ `arena.r`.
  - `test('target creates one zone per living player and nothing without players')`: 2 người → 2 vùng; `players` rỗng → 0, không ném lỗi; người chơi chết bị bỏ.
  - `test('primitives are deterministic with a fixed Math.random')`: hai lần gọi cùng `opts` cho cùng danh sách `{x,y,delay}`.
- [ ] **Step 3: Chạy** `node --test tests/apex-moves.test.cjs` → FAIL (thiếu file).
- [ ] **Step 4: Cài đặt `js/data/apex-moves.js`** (IIFE `G.ApexMoves = (() => { ... })()`), `makeCtx` và 7 `PRIMS` theo Interfaces. Hình học dùng hệ toạ độ thế giới của game (y xuống), `arena.r` tính bằng px.
- [ ] **Step 5: Chạy** `node --test tests/*.cjs` → PASS.

---

### Task 2: 18 chiêu, `of`, `start`, `echo` và ràng buộc độ khó

**Files:**
- Modify: `js/data/apex-moves.js`
- Modify: `tests/apex-moves.test.cjs`

**Interfaces:**
- Consumes: `makeCtx`, `PRIMS` (Task 1).
- Produces:
  - `MOVES: Record<type, { id, name, desc, wind, after, build(ctx) -> void }>` cho 18 hệ (xem spec mục 2); `wind` là số giây boss đứng yên trước khi `bossCast` chuyển sang `after`; `build` gọi các `PRIMS` (có thể nhiều lần, mỗi lần một nhịp) và có thể đặt `ctx.shot`.
  - `of(types: string[]) -> move | null` — chiêu của `types[0]`; `null` nếu `types` rỗng/không phải mảng hoặc hệ lạ.
  - `start(boss, pl, cast) -> Hazard[]` — `makeCtx(boss, pl, cast)`, `move.build(ctx)`, đặt `cast.wind = move.wind`, `cast.after = ctx.fury ? ECHO.delay + 0.3 : move.after`, `cast.shot = ctx.shot`, `cast.sig = move`, nói tên chiêu bằng `G.Spawner.say('APEX ' + boss.name + ': ' + move.name + '!', 1.6)` chỉ khi host/solo (`!G.Coop.active || G.Coop.isHost`); trả `ctx.out`. Nếu `of` trả `null`, không làm gì và trả `[]`.
  - `echo(boss, pl, cast) -> Hazard[]` — chỉ chạy một lần mỗi `cast` (`cast.echoed`); không chạy khi `boss.dead`; `makeCtx(..., { echo: true })` với toàn bộ góc xoay thêm `ECHO.rot` (các phép đọc `ctx.rot` cộng vào mọi góc/ vị trí tương đối).
- Chỉ định ban đầu (số chính xác tự chọn để thoả `LIMITS`; điều chỉnh sau khi chơi thử), `wind` 0.6–1.0 s:
  - normal `Hyper Burst`: `ring` 2 lần (r 110 rồi 190, `gap` ≈ 0.9 rad ở hai hướng khác nhau, lệch delay 0.6 s).
  - fire `Inferno Spiral`: `spiral` n 8, turns 1.5, r0 40 → r1 260.
  - water `Tidal Wave`: `lanes` trục x, 6 tia + `gapIndex` ngẫu nhiên theo `Math.random`, bước 0.25 s.
  - grass `Thorn Field`: `rain` 10 (around `arena`) + `sweep` 4 tia cố định (`steps` 1).
  - electric `Chain Storm`: 3 nhịp; mỗi nhịp một `beam` từ boss tới từng người chơi (dùng `ctx.beam` trực tiếp) + `target` ở cuối.
  - ice `Frost Cross`: `sweep` nBeams 4 (spread = π/2 mỗi tia), steps 3, stepAngle 0.38.
  - fighting `Seismic Combo`: 3 `ctx.zone` đồng tâm tại boss, r 70/110/150, delay 0.8/1.4/2.0 (vòng lớn không chồng vòng nhỏ quá `MAX_OVERLAP`).
  - poison `Toxic Bloom`: `target` r 70 + `ring` n 6 quanh người chơi đầu.
  - ground `Fissure Lines`: `sweep` 3 tia dài 450 cách 2π/3.
  - flying `Cyclone`: `sweep` 2 tia (spread π), steps 4, stepAngle 0.35 + `ctx.shot = { spread: 1.4, n: 8, k: 0.8 }`.
  - psychic `Mind Crush`: `target` delay 0.8 + `ring` n 8 r 150.
  - bug `Swarm Rain`: `rain` n 12 hr 28 + `ctx.shot`.
  - rock `Meteor Storm`: `rain` n 8 hr 55 stagger 0.15 around `players`.
  - ghost `Phantom Trap`: tam giác 3 vùng quanh người chơi đầu (r 90) rồi `target` thu hẹp sau 0.7 s.
  - dragon `Draconic Breath`: `sweep` nBeams 7 spread 1.5, steps 2 + `ring` n 8 r 170.
  - dark `Black Hole`: `converge` rings 4, r0 220 → r1 60.
  - steel `Iron Barrage`: `lanes` trục y, 5 tia, `gapIndex` 2, bước 0.3 s, 2 lượt dịch.
  - fairy `Moonlit Petals`: `ring` n 12 r 140 + `ctx.shot = { spread: 6.28, n: 12, k: 0.7 }`.

- [ ] **Step 1: Viết test thất bại**:
  - `test('every one of the 18 types has a move with English name and description')`: 18 hệ; `name`/`desc` không chứa `[áéíóúñ¿¡]`, độ dài > 3; `id` duy nhất.
  - `test('of picks the first type and handles bad input')`: `of(['fire','flying']).id === MOVES.fire.id`; `of([])`, `of(undefined)`, `of(['nope'])` → `null`.
  - `test('every move respects the difficulty limits for 1, 2 and 4 players, with and without fury')`: với `Math.random` cố định (0.37) và cho mỗi hệ, `players` ∈ {1,2,4}, `fury` ∈ {false,true}: `start` trả `hs` (và `echo` nếu fury: `hs2`); kiểm: mọi `dmg ≤ 60 × 1.5`; `hs.length ≤ 40`; mọi `delay ≥ 0.7` (hazard từ `target` ≥ 0.45; phân biệt qua cờ `h.target` mà `PRIMS.target` đặt); `coverage(hs).depth ≤ 2`; chia `hs` thành nhóm theo `delay` (cách nhau < 0.25 s) và với mỗi nhóm `coverage(nhóm).frac ≤ 0.65` (tức vùng an toàn ≥ 35%).
  - `test('start sets the cast fields and says the move name once on the host')`: `cast.wind > 0`, `cast.sig`, `calls.say` có đúng một dòng chứa tên chiêu; ở khách (`Coop.active && !isHost`) `say` không được gọi.
  - `test('echo runs once, is weaker and rotated, and never after the boss died')`: `echo` lần 1 trả hazard với `dmg === first.dmg × 0.7` (so cùng chỉ số hazard), lần 2 trả `[]`; `boss.dead = true` → `[]`.
  - `test('a move that uses a shot sets cast.shot')`: `flying`, `bug`, `fairy` có `cast.shot.n ≥ 8`; các hệ khác có thể `null`.
  - `test('only hz is broadcast when a move runs on the host')`: `Coop.isHost = true`; chạy `start` cho 18 hệ; mọi `calls.broadcast[i][0] === 'hz'`.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Cài đặt** `MOVES`, `of`, `start`, `echo` trong `apex-moves.js` theo Interfaces. Nếu một chiêu vi phạm ràng buộc, chỉnh thông số của chiêu (không nới `LIMITS`).
- [ ] **Step 4: Chạy** `node --test tests/*.cjs` → PASS.

---

### Task 3: Nối vào `enemy.js` (đòn `sig`, Overdrive) và `dev.html`

**Files:**
- Modify: `js/entities/enemy.js` (`bossInit`, `bossMove`, `bossStart`, `bossCast`; quanh các dòng 468–605)
- Modify: `dev.html` (thẻ script trước `js/entities/enemy.js`)
- Create: `tests/helpers/enemy-world.cjs`
- Modify: `tests/apex-moves.test.cjs`

**Interfaces:**
- Consumes: `G.ApexMoves.of/start/echo/LIMITS` (Task 1–2).
- Produces (trong `Enemy`):
  - `bossInit()`: nếu `this.apex && G.ApexMoves && G.ApexMoves.of(this.types)` thì `ai.ranged = [...ai.ranged, 'sig']` và `ai.sig = move`; ngược lại không đổi.
  - `pickRanged()`: trả `'sig'` với xác suất `0.5` khi `ai.fury` và `ai.sig`; ngược lại `G.U.pick(ai.ranged)`; `bossMove` dùng nó thay cho `G.U.pick(ai.ranged)` ở cả hai chỗ (mode `close` và `far`).
  - `bossStart`: `case 'sig': G.ApexMoves.start(this, pl, c); this.anim.play('Charge', { speed: 1.2 }); break;`
  - `bossCast`: sau khối `c.t >= c.wind && !c.fired`: nếu `c.id === 'sig'` thì (a) lần đầu `fired` và `c.shot` → `this.shoot(ax, ay, c.shot.spread, c.shot.n, c.shot.k)`; (b) khi `ai.fury` và `!c.echoAt` đặt `c.echoAt = c.t + G.ApexMoves.LIMITS.ECHO.delay`; (c) khi `c.echoAt && !c.echoed && c.t >= c.echoAt` đặt `c.echoed = true` và gọi `G.ApexMoves.echo(this, pl, c)`.
  - `dev.html`: `<script defer src="js/data/apex-moves.js"></script>` ngay trước `js/entities/enemy.js`.

- [ ] **Step 1: Viết helper** `tests/helpers/enemy-world.cjs` exporting `world({ host? }) -> { G, calls }` nạp `js/entities/enemy.js`, `js/systems/hazards.js`, `js/data/apex-moves.js` với `G` giả đủ cho `new G.Enemy(def, x, y, {hp:1,spd:1,dmg:1}, true)`: `DEX_BY[dex] = { dex, name, types, spd }`, `Sprites` (`animMeta: () => ({ ay: 30 })`, `Animator: class { constructor() {} play(){} loop(){} }`, `bodyRadius: () => 14`, `bodyHeight: () => 30`, `hovers: () => false`, `dirFromAngle: () => 0`, `PX: 2`), `Stats.sideOf: () => 'special'`, `U` (`hash`, `rand`, `pick`, `norm`, `dist2`, `clamp`, `TYPE_COLOR`), `FX` (`ring`, `burst`, `dmgText`, `px`, `sp`, `beam` ghi nhận), `Audio`, `Camera`, `Spawner.say`, `Coop` (`isHost`, `active`, `broadcast`, `enemyShot`), `Projectiles.spawn`, `VFX.forType`, `Game.everyone/player`, `Rift.arenaInfo`; `Enemy` tạo bằng `def = { dex: 150, name, hp: 1000, spd: 60, dmg: 40, shotDmg: 20, shotCd: 1, behavior: 'ranged' }` và `new G.Enemy(def, 0, 0, sc, true)`.
- [ ] **Step 2: Viết test thất bại**:
  - `test('an Apex gets the sig move in its ranged list and a normal legend does not')`: `e.apex = true; e.bossInit()` → `ai.ranged` chứa `'sig'` và `ai.sig.id`; `e.apex = false` → không chứa.
  - `test('an Apex whose type has no move behaves like a normal legend')`: `types = ['nope']` → không `'sig'`, không lỗi.
  - `test('bossStart sig creates hazards and bossCast ends normally')`: `bossStart('sig', pl)` → `G.Hazards.count > 0`, `ai.cast.id === 'sig'`; chạy `bossCast(dt, pl)` cho tới `bossEnd` → `ai.cast === null`, không ném lỗi.
  - `test('overdrive: with fury sig is picked about half the time and an echo follows 1.2 s later, once')`: `ai.fury = true`; 400 lần `pickRanged()` → tỉ lệ `'sig'` ∈ [0.4, 0.6] (`Math.random` seed đơn giản theo bộ đếm); không fury → `'sig'` chỉ ra như một trong ba đòn (≤ 0.45); chạy một cast `sig` ở fury: số hazard sau `echoAt` > trước, tăng đúng một lần (chạy tiếp 3 s không tăng thêm).
  - `test('fury switched on in the middle of a sig cast does not nest an echo')`.
  - `test('no hazards are created by an echo after the boss died')`: `e.dead = true` giữa chừng.
  - `test('a normal legend never calls ApexMoves')`: `G.ApexMoves.start` được bọc để đếm; legend thường chạy 10 cast → 0 lần.
  - `test('rift cleanup removes pending hazards')`: tạo `sig`, gọi `G.Hazards.clear()` → `count === 0`.
  - `test('dev.html loads apex-moves.js before enemy.js')`.
- [ ] **Step 3: Chạy** → FAIL.
- [ ] **Step 4: Cài đặt** các thay đổi ở Interfaces trong `enemy.js` và thêm thẻ script vào `dev.html`.
- [ ] **Step 5: Chạy** `node --test tests/*.cjs` → PASS (gồm `tests/rift-special.test.cjs`).

---

### Task 4: `Rift.arenaInfo`, xem thử, tài liệu, changelog, chơi thử

**Files:**
- Modify: `js/systems/rift.js` (export `arenaInfo`)
- Create: `tools/apex-preview.html`
- Modify: `docs/MULTIPLAYER_PROTOCOL.md` (một dòng), `js/data/changelog.js`, `docs/HANDOFF.md`
- Modify: `tests/rift-special.test.cjs`

**Interfaces:**
- `G.Rift.arenaInfo() -> { x, y, r } | null`: `r` = `(arena.r - 1.4) * TS()` (px, cùng công thức `keepInside`), `null` khi không có arena.

- [ ] **Step 1: Test thất bại** trong `tests/rift-special.test.cjs`: `arenaInfo()` là `null` khi chưa vào arena; sau khi vào, `r === (11 - 1.4) * 3 * 16 * ...` (tính bằng `Tiles.T × Sprites.PX` của world giả: `16 × 3 = 48` ⇒ `(11 − 1.4) × 48`) và `x`, `y` bằng tâm arena.
- [ ] **Step 2: Cài đặt `arenaInfo`** trong `rift.js`, export; chạy test → PASS.
- [ ] **Step 3: `tools/apex-preview.html`** (không vào build): dùng cùng stub `G` như `tools/vfx-preview.html`, nạp `hazards.js` thật (nếu cần stub thêm), `apex-moves.js`; chọn hệ + `fury` + số người chơi (1/2/4, đặt ngẫu nhiên trong đấu trường); nút "Cast" chạy `start` (và `echo` sau 1,2 s nếu fury), vẽ đấu trường từ trên xuống: boss ở giữa, người chơi là chấm, hazard theo thời gian (vùng/tia dần đầy rồi nổ, có đồng hồ), hiển thị `coverage` (vùng an toàn %, độ chồng) của nhóm đang nổ. Kiểm bằng mắt: mỗi chiêu có đường né rõ.
- [ ] **Step 4: Tài liệu**: thêm vào `docs/MULTIPLAYER_PROTOCOL.md` (mục hazard `hz`) một dòng: "Los Apex usan los mismos hazards (`hz`) y disparos; sin mensajes nuevos." (hoặc tiếng Anh nếu tài liệu là tiếng Anh; theo ngôn ngữ của mục đó). Thêm mục `new` vào changelog 2026-10-28 (es + en): "Los Apex ahora tienen un ataque propio según su tipo y se vuelven más peligrosos por debajo de la mitad de vida" / "Apex bosses now have a signature attack for their type and become more dangerous below half health". Chạy `node --test tests/i18n.test.cjs`.
- [ ] **Step 5: Chơi thử trong `dev.html?dev`** (trình duyệt/IDE nếu có): `G.Rift.debugSpecial('fire')` và các hệ khác; ghi lại những gì đã/không kiểm được. Cập nhật `docs/HANDOFF.md` (mục Apex: đã làm, chưa chơi thử, hằng số cần chỉnh: `LIMITS`, thông số từng chiêu).
- [ ] **Step 6: Chạy** `node --test tests/*.cjs` → PASS; `git status --short` để liệt kê tập file đã đổi cho chủ dự án (không commit).

---

## Self-review (đã chạy)

- **Phủ spec:** cấu trúc và `of/start/echo` (Task 1–2), 18 chiêu (Task 2), 7 phép dựng (Task 1), Overdrive (Task 3), ràng buộc độ khó (Task 1–2 test), co-op `hz` (Task 2 test), xem thử/changelog/HANDOFF (Task 4), legendary thường không đổi (Task 3 test).
- **Nhất quán tên:** `G.ApexMoves.{LIMITS,makeCtx,PRIMS,MOVES,of,start,echo}`, `ctx.{zone,beam,shot,out,arena,players,echo}`, `cast.{wind,after,shot,sig,echoAt,echoed}`, `Rift.arenaInfo` dùng đồng nhất.
- **Tỉ lệ:** hình học từng chiêu chỉ nêu mẫu và phép dựng, số liệu do người cài đặt chọn để thoả `LIMITS`; test là thước đo.
- **Điểm mở:** cảm giác "né được" chỉ kiểm bằng mắt (Task 4 Step 3/5) và vòng chơi thử của chủ dự án.
