# Move đặc trưng của loài hiếm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ~172 loài hiếm có mỗi loài một move riêng, mở khóa ở Rank 5★, nằm ở ô thứ 5, đủ mạnh để đáng chọn thay nhóm 4 move ghép; ghép được với tối đa 2 buff.

**Architecture:** Dữ liệu `G.SIG` sinh bởi `tools/gen_signature.js` (87 legendary thiết kế tay trong `tools/signature_design.json`, 85 loài còn lại sinh từ mẫu), sức mạnh được hiệu chuẩn bằng `Moves.dps` để đạt `SIG_POWER`. Move đăng ký vào `BY_ID` (không vào `ALL`/`POOL`). Cơ chế riêng là 14 `G.SigFX` móc vào `afterHit`/sau `pl.cast`. `Player.sig` + `syncSignature()` cấp move theo loài và Rank.

**Tech Stack:** JS thuần treo trên `G`; Node cho bộ sinh và test (`node:test`, `.cjs`).

**Spec:** `docs/superpowers/specs/2026-10-28-signature-moves-design.md`

## Global Constraints

- Sửa `dev.html` (không sửa `index.html`, `js/app.min.js`, `version.json`). Thẻ script mới sau `js/data/moves.js` và trước `js/entities/player.js`: `js/data/signature-moves.js`, `js/data/sigfx.js` (không vào `NEED`; `Player` kiểm tra `G.SIG_OF`/`G.SigFX` tồn tại).
- Không đổi `codec.js`, giao thức, các `kind`, `LADDERS`, cân bằng 113 move hiện có, `BOND_MAX = 4` của nhóm thường.
- `G.Moves.ALL.length` giữ 113; move đặc trưng **không** vào `ALL`/`POOL`.
- Tên/mô tả move đặc trưng chỉ tiếng Anh (không dấu Tây Ban Nha), không vào `lang-en.js`.
- `SIG_POWER = 3.0`; dải test `[2.5, 3.5]` (spec mục 4). Mở khóa ở `Rank.starsOf(dex) >= 5`.
- Nhiều file là CRLF: dùng script Node đọc/ghi giữ newline (xem mẫu `edit()` trong các phiên trước) hoặc Edit với chuỗi duy nhất; `git diff --stat` để kiểm.
- **Không commit/push** (CLAUDE.md). Cuối mỗi task: test và `git status --short`.
- Lệnh test: `node --test tests/*.cjs`; hiện 393 pass.
- Một phiên khác đã sửa `dev.html`, `changelog.js`, `js/core/sprites.js`, `CREDITS.md`: không đụng ngoài các hunk của mình.

## Review Focus

- Người chơi đổi loài khi đang ở ô thứ 5 (tiến hóa hoặc Mega): move cũ biến mất, `slots`/`active` không trỏ vào ô không tồn tại. Test ở Task 4.
- Rank tụt (save gộp, bản trùng) hoặc `syncSignature` gọi hai lần: không nhân đôi move, không mất cấp. Test ở Task 4.
- Nhóm ghép chứa `sig` khi `sig` bị gỡ (đổi loài): nhóm tan, buff quay về ô thường, không mất buff. Test ở Task 5.
- Đồng đội ở co-op dùng `sig-<dex>` mà máy này chưa có dữ liệu (phiên bản cũ): bị bỏ qua, không lỗi. Test ở Task 6.
- `hit()`/đạn gọi `SigFX.onHit` trên kẻ địch đã chết hoặc `fxv` lạ: không ném lỗi. Test ở Task 2.

---

### Task 1: `Moves.dps`, `Moves.register`, danh sách loài, `G.SIG_OF`

**Files:**
- Modify: `js/data/moves.js` (thêm `dps`, `register`, `median` vào `G.Moves`; không đổi `RAW`)
- Create: `tools/sig_species.js` (module Node dùng chung của bộ sinh và test: `speciesList()`)
- Create: `tests/signature-moves.test.cjs`

**Interfaces:**
- Produces:
  - `G.Moves.dps(def, lvl = 1) -> number`: `def.dmg × hitsOf(def) × AREA[def.kind] / cdOf(def)` ở cấp `lvl` (áp `ups` bằng `instance` khi `def.ups` có), `0` với `kind: 'buff'`. `hitsOf` = `count` nếu có, ngược lại 1; `cdOf` = `0.34` cho `orbit` (tần số đánh lại), ngược lại `cd`. Bảng `AREA` (hiệu chuẩn, đặt trong `moves.js`, xuất `G.Moves.AREA`): projectile 1 · homing 1.1 · bounce 1.4 · boomerang 1.5 · cone 1.3 · nova 1.2 · orbit 1.2 · melee 1.3 · dash 1.3 · spin 1.5 · beam 1.6 · chain 1.6 · charge 1.8 · aura 1.5 · quake 1.5 · vortex 1.5 · shove 1.3 · stun 1.4 · mine 1.3 · meteor 1.4 · turret 1.2 · trail 1.3.
  - `G.Moves.median(lvl = 1) -> number`: trung vị `dps` của mọi move trong `G.Moves.ALL` có `kind !== 'buff'`.
  - `G.Moves.SIG_POWER = 3.0`.
  - `G.Moves.register(def) -> def`: gắn `ups = LADDERS[def.kind]`, `maxLvl = ups.length + 1`, đặt `BY_ID[def.id]`; **không** thêm vào `ALL`/`POOL`; từ chối `kind === 'buff'` và id đã có (ném lỗi).
  - `speciesList() -> { dex, type, bst, why: 'legend'|'mega'|'pseudo' }[]` (trong `tools/sig_species.js`): hợp của (1) `leg` trong `js/data/pokedex.js` (87), (2) loài có `G.MEGA[dex]` và không `leg` (75), (3) `bst >= 580` không Mega, không `leg` (10); sắp theo dex.
  - `G.SIG_OF(dex) -> def | null` (đặt ở Task 3 khi có dữ liệu; ở Task 1 chỉ test `speciesList`).

- [ ] **Step 1: Test thất bại** (`tests/signature-moves.test.cjs`, nạp `moves.js` bằng `G` giả như `tests/buffs.test.cjs`): `dps` của `'ember'` bằng `18 × 1 × 1 / 0.52`; `dps` buff = 0; `median()` nằm giữa `min` và `max` của các `dps`; `register` thêm vào `BY_ID` nhưng không đổi `ALL.length` (113) hay `POOL`; `register` ném khi `kind === 'buff'` hoặc id trùng; `speciesList()` có đúng 87/75/10 phần tử, không trùng dex, đủ `type`.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Cài đặt** `dps/median/SIG_POWER/AREA/register` trong `moves.js` và `speciesList()` (đọc `pokedex.js` và `mega.js` bằng `new Function('G', …)`).
- [ ] **Step 4: Chạy** `node --test tests/*.cjs` → PASS.

---

### Task 2: Danh mục `G.SigFX` (14 cơ chế) và móc vào combat

**Files:**
- Create: `js/data/sigfx.js`
- Modify: `js/systems/combat.js` (`afterHit`, `hit`, vòng đạn trong `resolve`, sau `pl.cast(m)` trong `tickMove`)
- Modify: `dev.html` (thẻ script)
- Modify: `tests/signature-moves.test.cjs`

**Interfaces:**
- Produces `G.SigFX`:
  - `FX: Record<id, { id, min, max, text(v) -> string, onHit?(pl, e, m, dmg, v), onCast?(pl, m, v) }>` với 14 id và khoảng giá trị:
    `splash` (30–60 %: gây v % `dmg` lên kẻ địch trong 70 px quanh `e`), `chain` (25–50 %: nhảy tới tối đa 2 kẻ gần nhất trong 160 px), `drain` (2–6 %: `pl.heal(dmg × v/100)`, tối đa `0.02 × maxHp` mỗi lần), `bossbane` (30–70 %: thêm `dmg × v/100` nếu `e.boss`), `execute` (40–100 %: thêm `dmg × v/100` nếu `e.hp < 0.3 × e.maxHp`), `slow` (20–50 %: `e.applySlow(v/100)`), `knock` (80–200 px: `e.kx/ky` đẩy ra xa), `pull` (80–200 px: kéo vào), `stun` (10–25 %: xác suất `e.stunT = max(e.stunT, 0.6)`), `burn` (1–3: `e.applyBurn(v)`), `poison` (1–3: `e.applyPoison(v)`), `surgeHaste`/`surgeCrit`/`surgeAtk` (onCast, cứ 3 lần cast: `pl.addBuff('haste'|'crit'|'atk', amount, 6, 3)` với amount tương ứng 0.05/0.03/0.08 × v/100 `v` 100–200 là hệ số).
  - `onHit(pl, e, m, dmg)` và `onCast(pl, m)`: đọc `m.sig` (`{ fx, v }`); không làm gì nếu `m.sig` không có, `fx` lạ, `e.dead`, hoặc `ghost` (combat đang chạy move đồng đội: truyền cờ để bỏ qua sát thương phụ).
  - Hệ số thưởng sức mạnh của từng cơ chế `POWER[fx](v)` (số nhân ≥ 1 vào `dps`, ví dụ `splash` 1 + v/100 × 0.5) để bộ sinh bù `dmg` (Task 3).
- Hooks: `afterHit(pl, e, m, dmg)` ở `combat.js` (hiện `afterHit(pl, e, m)`): thêm tham số `dmg`; gọi `G.SigFX.onHit` khi `m && m.sig`. `hit()` truyền `dmg` đã nhân; vòng đạn truyền `p.dmg × k`. Sau `pl.cast(m)` trong `tickMove`: `if (m.sig) G.SigFX.onCast(pl, m)`.

- [ ] **Step 1: Test thất bại** (nạp `moves.js` + `sigfx.js`, enemy giả `{ x, y, hp, maxHp, boss, dead, hurt(), applySlow(), applyBurn(), applyPoison(), stunT, kx, ky }`, `EnemyMgr.queryCircle` giả): mỗi id có `text(v)` tiếng Anh không dấu Tây Ban Nha và `min < max`; `splash` gây v % lên kẻ địch khác trong 70 px nhưng không lên `e` và không lên kẻ ngoài tầm; `chain` nhảy tối đa 2 kẻ; `drain` hồi đúng và bị chặn ở 2 % `maxHp`; `bossbane`/`execute` chỉ cộng khi điều kiện đúng; `slow/burn/poison/stun/knock/pull` gọi đúng hàm hoặc đổi `kx/ky`/`stunT` theo hướng đúng; `surge*` chỉ thêm buff mỗi 3 lần cast (đếm trên `pl`); không ném lỗi với `m.sig` thiếu, `fx` lạ, `e.dead`, `v` NaN (Review Focus).
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Cài đặt `sigfx.js`** và sửa `combat.js`; thêm thẻ script vào `dev.html` sau `moves.js`.
- [ ] **Step 4: Chạy** `node --test tests/*.cjs` → PASS.

---

### Task 3: Bộ sinh, thiết kế 172 move và `G.SIG` / `G.SIG_OF`

**Files:**
- Create: `tools/gen_signature.js`, `tools/signature_design.json`
- Create (sinh): `js/data/signature-moves.js`
- Modify: `dev.html` (thẻ script sau `sigfx.js`)
- Modify: `tests/signature-moves.test.cjs`

**Interfaces:**
- Consumes: `speciesList`, `Moves.dps/median/SIG_POWER/AREA`, `SigFX.POWER`.
- Produces: `G.SIG: Record<dex, def>` với `def = { id: 'sig-<dex>', name, type, kind, desc, cd, dmg, <thông số của kind>, cat, sig: { fx, v } }` (đã `Moves.register`), `G.SIG_OF(dex) -> def | null` (Mega → `G.MEGA_FROM[dex]`).
- `signature_design.json`: `{ "<dex>": { "name": "…", "kind": "<kind ≠ buff>", "fx": "<id SigFX>", "v": <số trong [min,max]>, "desc?": "…" } }` cho **87 legendary** (viết tay). Nguyên tắc: tên là move đặc trưng chính thức nếu có (Psystrike, Dragon Ascent, Roar of Time…), nếu không thì tên mới theo chủ đề của loài; `kind` hợp chủ đề (tia cho Mewtwo, vùng cho Groudon…); `fx` đa dạng, không quá 12 legendary dùng cùng một `fx`; mỗi cặp (`type`, `kind`, `fx`) duy nhất trong 87.
- Mẫu cho **85 loài còn lại** (trong `gen_signature.js`): bảng `TEMPLATE[type] = { kind, fx, v, namePool[] }` + bậc (`mega` hoặc `pseudo`) chỉnh `v`; tên lấy từ `namePool[type]` theo thứ tự dex (≥ 6 tên cho mỗi hệ có loài), không trùng với 87 tên tay và nhau.
- Hiệu chuẩn (cho cả 172): với `kind` đã chọn, lấy thông số mẫu của một move thường cùng `kind` (đầu tiên trong `ALL`), rồi **chỉ co giãn `dmg`** để `dps(def) × POWER[fx](v) = SIG_POWER × median()` (làm tròn; không đổi `cd`, `count`, `radius`…); `desc` = mô tả `kind` ngắn + `SigFX.text(v)`; `cat` theo `G.Stats.sideOf` của hệ (đặc biệt cho các hệ đặc biệt, vật lý cho các hệ vật lý — dùng bảng hệ→side trong `stats.js`; nếu không tiện, theo `TYPE_CAT` đặt trong bộ sinh).
- Quy trình: `node tools/gen_signature.js` đọc cache + design, in tóm tắt (số loài, vi phạm), ghi `js/data/signature-moves.js` (header "GENERADO por tools/gen_signature.js, no editar a mano"; `G.SIG = {...}`, đăng ký bằng `G.Moves.register` khi `G.Moves` đã có, `G.SIG_OF`). Chạy lại phải cho cùng file (xác định).

- [ ] **Step 1: Test thất bại**: số mục `G.SIG` = `speciesList().length` (172) và khóa trùng khít danh sách; id `sig-<dex>` duy nhất; tên duy nhất, tiếng Anh không dấu Tây Ban Nha, độ dài 4–32; `kind` ∈ 22 `kind` không buff; `sig.fx ∈ SigFX.FX` và `v ∈ [min,max]`; **sức mạnh**: `dps(def) × POWER[fx](v) / median()` ∈ [2.5, 3.5] cho cả 172; `BY_ID` có đủ, `ALL.length === 113`, `POOL` không chứa `sig-*`; `SIG_OF(10001)` (Mega Charizard X) trả move của Charizard; không `legend` nào dùng một `fx` quá 12 lần; (`type`, `kind`, `fx`) duy nhất trong 87 legendary; chạy `gen_signature.js` hai lần cho cùng nội dung (đọc file, so sánh).
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Viết** `signature_design.json` (87 mục; lấy danh sách dex từ `speciesList().filter(s => s.why === 'legend')`, in ra bảng "dex, tên, hệ, bst" bằng `node tools/gen_signature.js --worksheet` để điền), `gen_signature.js` và sinh `js/data/signature-moves.js`; thêm thẻ script vào `dev.html`.
- [ ] **Step 4: Chạy** `node tools/gen_signature.js && node --test tests/*.cjs` → PASS.

---

### Task 4: `Player.sig`, `syncSignature`, ô thứ 5 và phím 5

**Files:**
- Modify: `js/entities/player.js` (`sig`, `syncSignature`, `addMove`, `setActive`/chu kỳ, `evolve`/`setLook`/`megaUp`)
- Modify: `js/game.js` (khởi tạo ván: gọi `pl.syncSignature()` sau `addMove(start)`; phím 1–5 ở dòng 607; sau tiến hóa)
- Modify: `js/ui/hud.js` (vẽ 5 ô; ô 5 viền vàng; `nAll`)
- Create: `tests/signature-player.test.cjs`

**Interfaces:**
- Consumes: `G.SIG_OF`, `G.Rank.starsOf`, `Moves.instance`.
- Produces:
  - `Player.sig: Move | null` — là phần tử của `moves` **và** nằm trong `slots` như nhóm thường `[sig]` ở **vị trí cuối**; `Player.isSigSlot(i) -> boolean`.
  - `Player.syncSignature() -> void`: đích = `G.SIG_OF && G.SIG_OF(this.dex)` nếu `G.Rank.starsOf(this.dex) >= 5`, ngược lại `null`. Nếu đích khác `this.sig`: gỡ `sig` cũ (xoá khỏi `moves` và khỏi nhóm ghép của nó — buff trong nhóm trở lại ô thường, xem Task 5), thêm đích (`instance(id, lvlCũ ?? 1)`, đặt `m.since`), cập nhật `slots` và `active` hợp lệ (nếu ô đang dùng biến mất thì `active = 0`). Gọi hai lần cho cùng kết quả (bất biến).
  - `maxMoves` vẫn 4; `addMove` chỉ đếm các ô **không phải** ô sig (`this.slots.filter(g => g !== sigGroup).length >= this.maxMoves` thì từ chối).
  - `arrange()` giữ ô sig ở cuối (không dính `bind`).
  - Phím: `digit5`/`numpad5` gọi `setActive(4)` khi `slots.length ≥ 5`; chu kỳ Q/E đi qua mọi ô.
  - HUD: `n = slots.length` (tối đa 5); `nAll = Math.max(n, pl.maxMoves)` thành `Math.max(n, pl.maxMoves + (pl.sig ? 1 : 0))`.

- [ ] **Step 1: Test thất bại** (`tests/signature-player.test.cjs`, mundo như `tests/buffs.test.cjs` + `moves.js` + dữ liệu `G.SIG` thật + `G.Rank` giả với `starsOf`): Rank 4 → không `sig`; 5 → có, nằm cuối `slots`, trong `moves`; `maxMoves` 4 và vẫn thêm được 4 move thường sau khi có `sig`, move thứ 5 thường bị từ chối; `syncSignature()` hai lần không nhân đôi; tiến hóa sang loài khác có `sig` đổi `sig` và **giữ cấp** (`levelUp` trước đó); sang loài không có `sig` thì gỡ, `active` hợp lệ; Mega dùng move loài gốc; Rank tụt về 4 thì gỡ; `setActive(4)` chọn ô sig, `arrange()` không đổi chỗ ô sig; `addMove` không tính ô sig.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Cài đặt** như Interfaces; gọi `syncSignature()` ở `game.js` khi bắt đầu ván và sau mỗi tiến hóa/Mega (tại chỗ gọi `Player.evolve/megaUp`, hoặc ngay trong các phương thức đó).
- [ ] **Step 4: Chạy** `node --test tests/*.cjs` → PASS.

---

### Task 5: Luật ghép với buff và thẻ ghép

**Files:**
- Modify: `js/entities/player.js` (`bondOptions`, `fuse`, `syncSignature` khi gỡ nhóm)
- Modify: `js/ui/run-ui.js` (`showBond`/`renderBond` cho `mode: 'sig'`)
- Modify: `js/game.js` (`offerBond`: nhận `mode 'sig'`)
- Modify: `tests/signature-player.test.cjs`

**Interfaces:**
- `Player.SIG_BUFFS = 2`.
- `bondOptions()` trả thêm `{ mode: 'sig', group: sigGroup, loose: [buff rời] }` **ưu tiên thấp hơn** nhóm thường: thứ tự — nhóm thường đang lớn (`add`) → `sig` nếu còn chỗ (`sigGroup.length - 1 < SIG_BUFFS`) và có buff rời → `pair` thường. Nhóm thường không bao giờ nhận `sig`; `loose` của các chế độ khác **loại** ô sig; `sigGroup` chỉ nhận `kind === 'buff'`.
- `fuse(moves, group)`: nếu `group` là nhóm sig, từ chối (trả `null` và không tiêu `bonds`) mọi move không phải buff hoặc khi vượt `1 + SIG_BUFFS`; buff được rút khỏi ô thường (`slots.splice`) như hiện nay; `bonds` giảm 1.
- Gỡ `sig` (đổi loài): buff trong nhóm sig quay lại thành ô thường rời (mỗi buff một ô) nếu còn chỗ (< `maxMoves` ô thường); hết chỗ thì buff đó bị bỏ khỏi `moves` (ghi chú trong test: hiếm gặp).
- UI: thẻ ghép `mode 'sig'` ghi "Se lanzará a la vez que <tên sig>" (qua `G.T`/`G.I18n.f`; tên sig tiếng Anh) và liệt kê buff rời; chỉ chọn 1 buff mỗi lần (cho hai lần ghép, mỗi lần tiêu một vínculo).

- [ ] **Step 1: Test thất bại**: `sig` + 1 buff rồi + buff thứ 2 → nhóm `[sig, b1, b2]`, mỗi lần giảm `bonds` 1, ô buff biến mất khỏi ô thường (giải phóng chỗ); buff thứ 3 và move thường bị từ chối (không tiêu `bonds`); nhóm thường không nhận `sig` (kể cả `sig` đang rời); không có buff rời → `bondOptions()` không có `'sig'`; nhóm thường vẫn tối đa 4; hai ô sig không tồn tại; đổi loài làm gỡ `sig` → buff trở về ô thường (kiểm `slots`, `moves`), `active` hợp lệ; `activeGroup()` của ô sig trả cả `sig` và buff, `combat` chạy cả hai (kiểm bằng `activeGroup().map(m => m.kind)`).
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Cài đặt** như Interfaces (và nhánh UI).
- [ ] **Step 4: Chạy** `node --test tests/*.cjs` → PASS.

---

### Task 6: VFX, icon, hiển thị (tạm dừng, ficha) và co-op

**Files:**
- Modify: `tools/gen_signature.js` (sinh luôn bảng VFX) → `js/data/signature-moves.js` gọi `G.VFX.addMoves` nếu `G.VFX` có
- Modify: `js/systems/mons.js` (`abilityOf` thêm `sig: { name, desc, locked }`), `js/ui/menu.js` (`rankHtml`: dòng "Signature move"), `js/ui/run-ui.js` (pausa "Tus ataques" liệt kê ô 5)
- Modify: `js/net/coop.js` (chỉ nếu `ghostCast` cần cờ; ưu tiên không đổi)
- Modify: `tests/signature-moves.test.cjs`, `tests/signature-player.test.cjs`

**Interfaces:**
- VFX: mỗi `sig-<dex>` có mục `{ proj/beam/melee/aura, trail?, hit? }` chọn từ shape có sẵn theo `type` và `kind` (bảng `VFX_BY_TYPE[type] = { proj, beam, aura, melee, hit }` trong bộ sinh, dùng lại hình của VFX 1a); trong cùng một `type`, bộ (`kind`, `proj/beam/melee/aura`, `trail`, `hit`) khác nhau giữa các `sig` **khi có thể** (test chỉ yêu cầu cặp (`type`, `kind`, `fx`) đã duy nhất ở Task 3; VFX trùng được chấp nhận và ghi trong HANDOFF).
- `Mons.abilityOf(dex).sig = { name, desc, locked }` (`locked = Rank.starsOf(dex) < 5`); `rankHtml` hiện dòng "Signature" giống dòng unique: mờ + "Unlocks at 5★" khi khóa, sáng khi mở; tên màu vàng với `legend`.
- Co-op: id `sig-<dex>` chạy qua `ghostCast` như move thường; id lạ (máy thiếu dữ liệu) bị `BY_ID` bỏ qua như hiện nay.

- [ ] **Step 1: Test thất bại**: mọi `sig-*` có `G.VFX.MOVE[id]` và shape/palette/hit tồn tại (nạp `vfx*.js` + `signature-moves.js`); `abilityOf(dex).sig` đúng khoá và `locked` theo Rank; `ghostCast(pl, 'sig-150', 1, 0, false)` chạy không lỗi với dữ liệu đủ, và `ghostCast(pl, 'sig-9999999', …)` trả về mà không ném; `tests/vfx.test.cjs` vẫn qua (113 move).
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Cài đặt** như Interfaces; chạy lại `node tools/gen_signature.js`.
- [ ] **Step 4: Chạy** `node --test tests/*.cjs` → PASS.

---

### Task 7: Cân bằng mô phỏng, xem thử, changelog, HANDOFF, chơi thử

**Files:**
- Modify: `tests/helpers/balance-sim.cjs`, `tests/balance.test.cjs`
- Create: `tools/signature-preview.html`
- Modify: `js/data/changelog.js`, `docs/HANDOFF.md`

- [ ] **Step 1: Mô phỏng** trong `balance-sim.cjs`: hàm `groupDps(moves)` (tổng `dps` của một nhóm 4 move thường cấp 3) và `sigDps(sig + 2 buff)`; test trong `balance.test.cjs`: `dps(sig, lvl 3) / groupDps` ∈ [0.6, 1.5] cho cả 172 move (move đặc trưng ≈ một nhóm 4 move, không lấn át quá 1,5×). Chỉnh `SIG_POWER` nếu cần (Global Constraints cho phép đổi hằng số, kèm test dải).
- [ ] **Step 2: `tools/signature-preview.html`** (dev, không vào build): nạp `moves.js`, `sigfx.js`, `signature-moves.js` bằng stub như `tools/vfx-preview.html`; bảng 172 dòng (dex, loài, hệ, tên, kind, fx, DPS/median); lọc theo bậc.
- [ ] **Step 3: Changelog** (`new`, es + en, ngày 2026-10-28): "Los Pokémon raros tienen un movimiento propio…" / "Rare Pokémon now have a signature move…"; chạy `node --test tests/i18n.test.cjs`.
- [ ] **Step 4: HANDOFF**: thêm mục mới nói cách sinh lại (`node tools/gen_signature.js`), các hằng số (`SIG_POWER`, dải test, `AREA`, 14 `SigFX` và khoảng giá trị, `SIG_BUFFS`), cách thử (`G.DB.save.dupes = {…}` với 15 bản; `G.Game.debugLevelUp()`) và những gì chưa xem được (cảm giác chơi, FPS).
- [ ] **Step 5: Chơi thử** trong `dev.html?dev` (trình duyệt hoặc IDE nếu có): Mewtwo với Rank 5★ (`G.DB.save.dupes = {150: 15}`) thấy ô 5; tiến hóa Charmander (`dupes {4: 15}`) lên Charizard; ghép với 2 buff; ghi lại những gì đã/không kiểm được.
- [ ] **Step 6: `node --test tests/*.cjs`** → PASS; `git status --short` (không commit).

---

## Self-review

- **Phủ spec:** danh sách loài (Task 1,3), dữ liệu và bộ sinh (3), cơ chế riêng (2), sức mạnh (1,3,7), cấp phát và ô 5 (4), ghép với 2 buff (5), UI/VFX/co-op (4,5,6), kiểm thử (mọi task), phát hành (7).
- **Điều chỉnh so với spec (ghi để duyệt):** danh mục `SigFX` là **14** cơ chế thay cho "~25" (mỗi cơ chế cần hook và test; thêm sau được); AREA/`dps` là hiệu chuẩn nội bộ chỉ để so sánh move với nhau.
- **Nhất quán tên:** `Moves.dps/median/register/SIG_POWER/AREA`, `speciesList`, `G.SIG/SIG_OF`, `SigFX.FX/POWER/onHit/onCast`, `Player.sig/syncSignature/isSigSlot/SIG_BUFFS`, `bondOptions().mode 'sig'`.
- **Tỉ lệ:** bảng 14 cơ chế và 87 tên là nội dung sáng tạo do người cài đặt viết theo nguyên tắc; mọi con số có test chặn.
