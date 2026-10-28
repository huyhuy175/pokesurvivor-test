# Gacha Rank, passive common/unique và rift phút 25 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pokémon trùng nâng Rank (10 sao), passive tách common/unique, ba loại vé "wish" rơi từ boss Apex của rift đặc biệt ở phút 25.

**Architecture:** Một module mới `G.Rank` (`js/systems/rank.js`) tính sao từ `save.dupes[dexGốc]` và cấp chỉ số, hệ số passive. Passive đổi từ `G.PASSIVES[dex]` sang `G.PASSIVES_COMMON[type]` + `G.PASSIVES_UNIQUE[dexGốc]`, `G.AbilityFX.of(mon)` gộp hai cái. Rift đặc biệt tái dùng arena hiện có với cờ `special`.

**Tech Stack:** JS thuần, một đối tượng toàn cục `G`, không bundler; test bằng `node --test tests/` (nạp file bằng `new Function('G', source)`).

**Spec:** `docs/superpowers/specs/2026-10-28-gacha-stars-passives-design.md`

## Global Constraints

- Sửa `dev.html` (không sửa `index.html`/`js/app.min.js`/`version.json`, là file sinh ra). File JS mới phải nằm trong khối `<!-- scripts:begin -->…<!-- scripts:end -->` đúng thứ tự tải; nếu bắt buộc thì thêm vào `NEED` ở `js/main.js`.
- Commit chỉ khi chủ dự án yêu cầu, **không** ghi "Co-Authored-By" hay chữ ký AI (CLAUDE.md). Mỗi task kết thúc bằng bước "Commit"; chỉ chạy khi được yêu cầu.
- Chữ mới viết thẳng bằng tiếng Anh trong code (game chỉ có tiếng Anh). Không thêm vào `lang-en.js` trừ khi `tests/i18n.test.cjs` đòi.
- Bản trùng: `dupes` 0–15; sao vàng 1–5 ở 1,2,3,4,5 bản trùng; sao đỏ 6–10 ở 7,9,11,13,15; từ bản trùng thứ 16 hoàn tiền theo `REFUND` (shiny ×3).
- Chỉ số Rank: sao 1,2 = +2% HP/sát thương mỗi sao; sao 4,5 = +2,5%; sao 7,9 = +3%; tối đa ≈ +15%. Sao 3 mở unique; sao 6 common +20%; sao 8 unique +25%; sao 10 cả hai +50%.
- Hệ số common theo dạng tiến hóa: dạng 1 ×1,0; dạng 2 ×1,3; dạng 3 ×1,6.
- Item: `wishsure`, `wishtype`, `wishany` (khớp `^b:[a-z0-9]{1,12}$`), giới hạn 999, chỉ dạng cơ bản, không bán ở tiệm. Rơi 80/15/5.
- Rift đặc biệt: 25:00 (`SPECIAL_AT = 25 * 60`), một lần mỗi run, `ARENA_TIME = 120` giữ nguyên, nằm trước `G.Judgment.AT` (30:00).
- Ngân sách unique gần phẳng (lệch ≤ ±15% theo độ hiếm); kho cơ chế ba bậc: cơ bản (1–3★), nâng cao (4★), tối thượng (5★/legendary/mythical).
- Giao thức cooperativo không đổi, trừ cờ `special` trong cấu hình `arena`.
- Không đụng `tickets`, `RATES`, `PITY_5`, banner, Forja, Sentencia.

## Review Focus

- Save cũ không có `dupes`/`pendingType` → mở bình thường, 0 sao, không lỗi (Task 1).
- Dex tiến hóa hoặc Mega phải quy về dạng gốc khi tính sao và unique (Task 1, Task 7).
- Hai thiết bị gộp save: `dupes` lấy giá trị lớn hơn từng dex, không cộng đôi (Task 1).
- Dùng vé wish khi không còn Pokémon chưa có: không trừ vé, báo lỗi rõ (Task 4).
- Đóng game giữa chừng sau khi Vé Chọn Hệ bốc hệ: hệ đã lưu, không reroll (Task 4).
- Rift đặc biệt tới đúng lúc đang có rift thường/arena: đợi, không mở chồng, không mở hai lần (Task 8).
- Cooperativo: mỗi máy tung phần thưởng đúng một lần dù `won()` bị gọi lại (Task 8).

---

### Task 1: Module `G.Rank` và `save.dupes`

**Files:**
- Create: `js/systems/rank.js`
- Modify: `js/core/db.js` (mặc định save ~dòng 76–100, `sanitize` ~201, `merge` ~392), `dev.html` (thêm sau `js/systems/prestige.js`)
- Test: `tests/rank.test.cjs`

**Interfaces:**
- Produces (`G.Rank`):
  - `MAX_DUPES = 15`, `THRESHOLDS = [1,2,3,4,5,7,9,11,13,15]`
  - `root(dex: number): number | null` — dạng gốc qua `G.Mons.lineage` (Mega/tiến hóa → gốc), `null` nếu dex không tồn tại
  - `starsFor(dupes: number): number` (0–10)
  - `dupesOf(dex): number`, `starsOf(dex): number`
  - `add(dex): { star: number, over: boolean }` — cộng 1 bản trùng vào `save.dupes[root]`; `star` = sao mới nếu vừa lên sao, ngược lại 0; `over = true` (và không cộng) nếu đã 15
  - `bonus(dex): { dmgMul, hpMul, commonMul, uniqueMul, uniqueOn }` — `uniqueOn = stars >= 3`; `commonMul` = 1 → 1,2 (≥6) → 1,5 (10); `uniqueMul` = 1 → 1,25 (≥8) → 1,5 (10)
  - `apply(perks, mon): perks` — cùng dạng với `G.Prestige.apply` (nhân `perks.atkMul`, cộng `perks.hp`)
- Consumes: `G.Mons.lineage(dex): number[]`, `G.DEX_BY`, `G.DB.save`.

- [ ] **Step 1: Write the failing tests** trong `tests/rank.test.cjs` (dùng cùng kiểu `world()` như `tests/mega-materials.test.cjs`): `starsFor` ở 0,1,5,6,7,15,16 → 0,1,5,5,6,10,10; `root(MEGA_DEX)` và `root(evolvedDex)` trả dạng gốc, `root(99999)` là `null`; `add` tăng dần, lên sao đúng các mốc và trả `over:true` ở lần 16 mà `dupes` vẫn 15; `bonus` ở 0,3,6,8,10 sao khớp bảng Global Constraints (`hpMul` ở 10 sao ≈ 1,15 ± 0,001); `apply` giữ nguyên `perks` khi 0 sao; save cũ không có `dupes` → `starsOf` = 0 không lỗi; `db.sanitize` xoá `dupes` của dex không tồn tại và kẹp giá trị vào 0–15; `db.merge(a, b)` lấy max `dupes` theo dex.
- [ ] **Step 2: Run** `node --test tests/rank.test.cjs` → FAIL (`G.Rank` chưa có).
- [ ] **Step 3: Implement** `G.Rank` theo Interfaces (IIFE như `prestige.js`, hằng số ở đầu file). Thêm `dupes: {}` vào save mặc định; `sanitize` giữ `dupes[d] = clamp(0..15)` cho dex có trong `G.DEX_BY`; `merge` lấy `Math.max` từng dex (cạnh khối `pused`). Thêm `<script defer src="js/systems/rank.js">` vào `dev.html` sau `prestige.js`.
- [ ] **Step 4: Run** `node --test tests/rank.test.cjs` → PASS; `node --test tests/` không có lỗi mới.
- [ ] **Step 5: Commit** (xem Global Constraints) — `feat: Rank — sao theo bản trùng`.

---

### Task 2: Gacha — bản trùng nâng Rank

**Files:**
- Modify: `js/systems/gacha.js` (`pull`, đầu file ghi chú "Repetidos")
- Test: `tests/rank.test.cjs` (thêm nhóm `gacha`)

**Interfaces:**
- Consumes: `G.Rank.add(dex)`.
- Produces: mỗi kết quả của `G.Gacha.pull` có thêm `star: number` (sao mới nếu bản trùng vừa lên sao, ngược lại 0); `refund` chỉ > 0 khi `add(...).over` (hoặc shiny: `REFUND × 3`).

- [ ] **Step 1: Write the failing tests** (nạp `gacha.js` với `G` giả có `DEX`, `SPRITE_META`, `Mons.isBase`, `Sprites.hasShiny`, `U.pick`, `Rank` thật): quay một Pokémon đã có → `dupes` tăng, `refund === 0`, `star` đúng mốc; tới bản 16 → `refund === REFUND[rarity]`, `dupes` vẫn 15; Pokémon mới → `isNew`, `star === 0`, `dupes` không đổi; shiny trùng cũng cộng `dupes` và hoàn ×3 khi `over`.
- [ ] **Step 2: Run** `node --test tests/rank.test.cjs` → FAIL.
- [ ] **Step 3: Modify `pull`**: nhánh không-mới gọi `G.Rank.add(mon.dex)`; `refund` chỉ đặt khi `over`; thêm `star` vào phần tử kết quả. Cập nhật ghi chú đầu file ("Repetidos").
- [ ] **Step 4: Run** test → PASS; `node --test tests/` xanh.
- [ ] **Step 5: Commit** — `feat: bản trùng nâng Rank en el gacha`.

---

### Task 3: Rank trong partida y hiển thị

**Files:**
- Modify: `js/game.js:110` (nối `G.Rank.apply` sau `G.Prestige.apply`), `js/ui/prestige-ui.js:13` (sao Prestigio đổi `★` → `♦`, và chữ "star" → "diamond" trong câu xác nhận dòng 29), `js/ui/gacha-ui.js` (thẻ kết quả hiện `star`, nhãn "Repetido" bỏ tiền khi chưa `over`), thẻ Pokémon ở màn bộ sưu tập/chọn compañero (tìm bằng `Grep "prestige\|Prestige" js/ui`)
- Create: hàm `G.UI.rankStars(n: number, size?: number): string` trong `js/ui/ui.js` — HTML 5 sao vàng, sao đỏ đè lên khi `n > 5` (sao thứ `n-5` đầu tiên là đỏ)
- Test: `tests/rank.test.cjs`

**Interfaces:**
- Consumes: `G.Rank.bonus/starsOf`, `G.Prestige.apply`.
- Produces: `G.UI.rankStars(n, size?): string`.

- [ ] **Step 1: Write the failing tests**: (a) `game.js` gọi `G.Rank.apply` đúng sau `G.Prestige.apply` (kiểm bằng regex trên source, như `passives.test.cjs`); (b) với `G` giả, `perks` sau `Prestige.apply` rồi `Rank.apply` ở 10 sao có `atkMul` nhân thêm ≈ 1,15; (c) `prestige-ui.js` không còn ký tự `★`; (d) `rankStars(0)` không có sao nào bật, `rankStars(10)` có 5 sao đỏ.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** theo Files. `rankStars` trả chuỗi HTML dùng màu `#ffd23f` (vàng) và `#ff4d4d` (đỏ), sao tắt `#555`.
- [ ] **Step 4: Run** `node --test tests/` → xanh. Thủ công trên `dev.html`: quay trùng và thấy sao tăng; Prestigio hiện ♦.
- [ ] **Step 5: Commit** — `feat: Rank en la partida y en las cartas`.

---

### Task 4: Vé wish — lógica

**Files:**
- Modify: `js/data/shop.js` (thêm 3 id vào `ITEMS`, **không** vào `ORDER`), `js/systems/gacha.js`, `js/core/db.js` (`sanitize` giữ `pendingType`)
- Test: `tests/wish.test.cjs`

**Interfaces:**
- Produces:
  - `G.Shop.ITEMS.wishsure|wishtype|wishany` — `{ name, icon, price: 0, desc }` (tên: "Guarantee Ticket", "Type Pick Ticket", "Free Pick Ticket").
  - `G.Gacha.missing(save, type?: string): number[]` — dex dạng gốc chưa sở hữu (lọc theo hệ nếu có `type`, mọi thế hệ).
  - `G.Gacha.pull(save, n, gen, use, opts?: { sure?: boolean })` — với `sure` và `n === 10`: lượt cuối bắt buộc Pokémon chưa có trong banner; trả `null` không trừ gì nếu banner đã đủ hoặc không có `wishsure`; khi dùng thật thì trừ 1 `wishsure` qua `G.Shop.take`.
  - `G.Gacha.startTypePick(save): { ok: true, type: string } | { ok: false, reason: 'item'|'none' }` — trừ 1 `wishtype`, bốc hệ ngẫu nhiên trong các hệ còn Pokémon chưa có, lưu `save.pendingType`; nếu đã có `pendingType` thì trả lại hệ đó và không trừ thêm.
  - `G.Gacha.claim(save, kind: 'type'|'any', dex): { ok: boolean, reason?: 'item'|'owned'|'type' }` — `type`: dex phải thuộc `pendingType`, xoá `pendingType`; `any`: trừ 1 `wishany`; cấp `save.owned[dex] = { at, from: 'wish' }`, không đổi pity.
  - `G.Gacha.rollWish(rand = Math.random): 'wishsure'|'wishtype'|'wishany'` — 0–0,80 / 0,80–0,95 / 0,95–1.

- [ ] **Step 1: Write the failing tests**: `rollWish` với `rand` 0, 0.79, 0.80, 0.949, 0.95, 0.999 → sure,sure,type,type,any,any; phân phối 100000 mẫu trong ±1% của 80/15/5; `wishsure` trên banner đủ Pokémon → `null` và túi không đổi; `wishsure` thật → lượt cuối là Pokémon chưa có và túi giảm 1; `startTypePick` lưu `pendingType` và gọi lần hai trả cùng hệ, trừ vé đúng 1 lần; không còn Pokémon nào → `{ ok:false, reason:'none' }` và không trừ; `claim` sai hệ → `reason:'type'`; `claim` Pokémon đã có → `reason:'owned'`; `claim any` cấp Pokémon, giảm `wishany`, không đổi `pity`; `db.sanitize` bỏ `pendingType` không phải hệ hợp lệ; id `wish*` sống sót qua `sanitize` của `bag` và quy tắc sổ `b:`.
- [ ] **Step 2: Run** `node --test tests/wish.test.cjs` → FAIL.
- [ ] **Step 3: Implement** theo Interfaces; `pull` giữ nguyên hành vi khi không có `opts`.
- [ ] **Step 4: Run** test mới và `node --test tests/` → PASS.
- [ ] **Step 5: Commit** — `feat: vé wish (lógica)`.

---

### Task 5: Vé wish — giao diện

**Files:**
- Modify: `dev.html` (ô tick "Use Guarantee Ticket" ở `#scr-gacha`, hộp chọn Pokémon `#wish-pick`), `js/ui/gacha-ui.js`, `js/ui/shop-ui.js` (Mochila liệt kê 3 vé, kèm nút "Use" cho `wishtype`/`wishany`)
- Test: `tests/wish.test.cjs`

**Interfaces:**
- Consumes: `G.Gacha.pull(..., { sure })`, `startTypePick`, `claim`, `missing`.
- Produces: `G.GachaUI.openPick(kind: 'type'|'any'): void`.

- [ ] **Step 1: Write the failing tests** (kiểm bằng source/DOM giả): `dev.html` chứa `#wish-pick` và ô tick; `gacha-ui.js` truyền `{ sure: true }` chỉ cho nút ×10 khi ô tick bật và `G.Shop` có `wishsure`; nút ×100 không bao giờ truyền `sure`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — ô tick bị vô hiệu khi không có vé hoặc banner đã đủ (dùng `missing`); `openPick` liệt kê Pokémon từ `missing(save, pendingType)` (hoặc toàn bộ cho `any`) bằng `G.UI.spriteCanvas`, xác nhận bằng `claim`; sau khi nhận hiện thẻ "NEW!" như gacha.
- [ ] **Step 4: Run** `node --test tests/` → xanh. Thủ công trên `dev.html` (dùng `G.Shop.give('wishsure', 3)` trong console của bản `--expose`/dev) cho cả ba loại vé.
- [ ] **Step 5: Commit** — `feat: vé wish (interfaz)`.

---

### Task 6: Passive common (18 hệ) và kho cơ chế unique

**Files:**
- Create: `js/data/passives-common.js` (`G.PASSIVES_COMMON`), `js/data/passive-unique-fx.js` (`G.UniqueFX`)
- Modify: `js/data/passive-fx.js` (xuất thêm hàm gộp hệ số), `dev.html` (hai file mới nằm giữa `passive-fx.js` và `passives.js`), `js/main.js` (`NEED` thêm `'UniqueFX'`)
- Test: `tests/passives.test.cjs`

**Interfaces:**
- Produces:
  - `G.PASSIVES_COMMON[type] = { n: string, fx: [[template, value], ...] }` cho đủ 18 hệ (`G.U.TYPE_NAME`), 2–3 hiệu ứng có chủ đề, dùng `G.PassiveFX.TEMPLATES`.
  - `G.PassiveFX.scale(fx, k: number): fx` — nhân giá trị từng hiệu ứng với `k` rồi làm tròn, kẹp trong `[min, max × 1,6]` của mẫu; `k` 1,0–1,6 theo dạng, nhân thêm theo `commonMul`.
  - `G.UniqueFX.TEMPLATES[id] = { tier: 'basic'|'adv'|'supreme', cost, min, max, text(v, mon), hooks(v, mon) }` cùng dạng với `PassiveFX.TEMPLATES` (cùng bộ ganchos của `ability-fx.js`), và `G.UniqueFX.TIERS = { basic: [ids], adv: [ids], supreme: [ids] }`.
  - Danh sách tối thiểu 30 mẫu: **basic (12):** `deathBurst, lifeSteal, thornAura, speedOnKill, startShield, coinBonus, xpBurst, slowAura, critStreak, burnTouch, rangedBonus, comebackHeal`; **adv (10):** `reviveOnce, killNova, hurtNova, orbitGuard, chainSpark, dashOnHurt, executeLow, comboCharge, killHealPulse, barrier`; **supreme (8):** `moveStorm, slowDomain, timeWarp, mirrorHit, lastStand, apexAura, spectralClone, rageEngine`. Mỗi mẫu dùng các ganchos hiện có; riêng `reviveOnce` cần gọi mới `abil.revive(pl)` trong đường chết của `Player` (thêm ở `js/entities/player.js`, như `sturdyAt` của Robustez).
- Consumes: `G.PassiveFX.TEMPLATES/build/power`.

- [ ] **Step 1: Write the failing tests**: đủ 18 hệ trong `PASSIVES_COMMON`; mỗi cái có 2–3 hiệu ứng, mọi id tồn tại và giá trị trong `[min,max]`; `scale(fx, 1.6)` không vượt `max × 1.6` và đúng làm tròn; mỗi mẫu của `UniqueFX` build ra mô tả tiếng Anh không có `NaN|undefined` hoặc ký tự có dấu cho 1 hệ và 2 hệ; ≥ 30 mẫu, đủ ba bậc; `reviveOnce` hồi sinh đúng một lần (state nằm trên `pl`); `dev.html` nạp hai file mới trước `passives.js`.
- [ ] **Step 2: Run** `node --test tests/passives.test.cjs` → FAIL.
- [ ] **Step 3: Implement** theo Interfaces; `PASSIVES_COMMON` viết tay (ví dụ Fire = typeDmg + lowHpDmg; Water = healMul + dmgTaken). Mỗi mẫu unique chọn `cost/min/max` sao cho ngân sách một mẫu bậc supreme gấp khoảng 1,5 lần bậc cơ bản.
- [ ] **Step 4: Run** `node --test tests/passives.test.cjs` → PASS.
- [ ] **Step 5: Commit** — `feat: passive common y catálogo unique`.

---

### Task 7: Dữ liệu unique, gộp vào động cơ, SEO

**Files:**
- Modify: `tools/gen_passives.js` (sinh `G.PASSIVES_UNIQUE`), `tools/passive_design.json` (ghi đè viết tay: starter, legendary, mythical, tối thiểu mỗi legendary/mythical một mục), `js/data/passives.js` (**sinh ra**, không sửa tay), `js/data/ability-fx.js` (`of`), `js/systems/mons.js` (`abilityOf`), `js/data/mega.js` (bỏ dòng kế thừa `G.PASSIVES`), `tools/fetch_mega.js:108` (cùng việc), `tools/export_data.js`, `tools/make_seo_pages.py`, `tests/mega.test.cjs:36`, `tests/passives.test.cjs`
- Test: `tests/passives.test.cjs`

**Interfaces:**
- Produces:
  - `G.PASSIVES_UNIQUE[rootDex] = { n: string, tier: 'basic'|'adv'|'supreme', fx: [[template, value], ...] }` cho mọi dạng gốc; không còn `G.PASSIVES`.
  - `G.AbilityFX.of(mon: object, opts?: { stage?: number, commonMul?: number, uniqueMul?: number, uniqueOn?: boolean }): object` — mặc định đọc `opts` từ `G.Rank.bonus(mon.dex)` và dạng tiến hóa (`G.Mons.lineage(mon.dex).length` → hệ số 1,0/1,3/1,6). Trả hiệu ứng gộp common (+ unique nếu `uniqueOn`) với `d` ghép cả hai mô tả, `name` là tên unique khi đã mở, ngược lại tên common. Không có dữ liệu thì rơi về `generic(mon)`.
  - `G.Mons.abilityOf(dex)` trả thêm `unique: { name, desc, locked: boolean }` (`locked` khi dưới 3★).
- Quy tắc sinh: bậc theo `rarity` của dạng gốc (1–3 → basic, 4 → adv, 5/legendary/mythical → supreme); ngân sách = `BANDS` trung bình của bậc × (1 ± 0,15 theo vị trí `bst` ngược lại, tối đa ±15%); không trùng tên, không trùng chữ ký trong cùng bậc; `critDmg` chỉ đi kèm `critChance`.

- [ ] **Step 1: Write the failing tests** (sửa/bổ sung `tests/passives.test.cjs`, thay các test dùng `G.PASSIVES`): mọi dạng gốc có `PASSIVES_UNIQUE`; tên duy nhất; bậc đúng theo rarity; chữ ký duy nhất trong từng bậc; legendary/mythical đều bậc supreme; ngân sách trong dải ±15% quanh trung bình bậc; `of(mon)` ở 0★ chỉ có common (`d` không chứa mô tả unique), ở 3★ có cả hai, ở 6★ common ×1,2 so với 0★ (khác đúng giá trị); tiến hóa cùng dây giữ nguyên `name` unique nhưng common mạnh hơn theo dạng; Mega của một dây nhận unique của dây gốc; dex không có dữ liệu → `generic`; `abilityOf(dex).desc` là tiếng Anh sạch cho cả 966 dex; `mega.test.cjs` không còn so sánh `G.PASSIVES`.
- [ ] **Step 2: Run** `node --test tests/passives.test.cjs tests/mega.test.cjs` → FAIL.
- [ ] **Step 3: Implement**: viết lại `gen_passives.js` theo quy tắc sinh và chạy `node tools/gen_passives.js` để tạo `js/data/passives.js`; sửa `AbilityFX.of`/`Mons.abilityOf`; gỡ kế thừa `G.PASSIVES` của Mega; cập nhật `tools/export_data.js` và `tools/make_seo_pages.py` để xuất common theo hệ và unique theo dây (thay vì một passive mỗi dex).
- [ ] **Step 4: Run** `node --test tests/` → xanh; `node tools/export_data.js && python tools/make_seo_pages.py` chạy không lỗi. Thủ công: `dev.html` — vào một run với compañero 0★, 3★, 10★ và so mô tả; tiến hóa trong run giữ tên unique.
- [ ] **Step 5: Commit** — `feat: passive unique por línea evolutiva`.

---

### Task 8: Rift đặc biệt phút 25, boss Apex, phần thưởng

**Files:**
- Modify: `js/systems/rift.js` (`update`, `start`, `spawnLegend`, `won`, `lost`, `reset`), `js/ui/hud.js` (nhãn "Apex" cho boss, nếu thanh boss cần), `js/ui/run-ui.js` (phần thưởng ở màn kết quả)
- Test: `tests/rift-special.test.cjs`

**Interfaces:**
- Produces trong `G.Rift`:
  - `SPECIAL_AT = 1500`
  - `APEX = { hp: 6, dmg: 1.8, spd: 1.2, shots: 1.5 }` (hằng số chỉnh được)
  - `apexDef(def, power: number): def` — nhân `hp, dmg, shotDmg, spd, shotCd⁻¹` theo `APEX`, và nhân `hp` thêm theo `power` (hệ số tổng Prestigio × Rank, `1` nếu không biết); thuần, không đụng `G` ngoài tham số.
  - `get special(): boolean` (arena đang chạy là đặc biệt).
  - Cấu hình arena thêm `special: true`; phần thưởng: `won()` gọi `G.Gacha.rollWish()` một lần (cờ `arena.rewarded`), `G.Shop.give(id, 1)`, `G.DB.commit('run')`, chữ nổi "+1 <tên vé>", và ghi `pl.wishFound = id` để màn kết quả hiện.
- Hành vi: ở `time >= SPECIAL_AT` (và chưa từng mở trong run, cờ `specialDone`), nếu không có `rift`/`arena`/boss sống thì host gọi `open()` có cờ `special`; nếu đang bận thì thử lại mỗi `CHECK` giây tới trước `Judgment.AT`. Rift đặc biệt không tính vào `misses` và không bị chặn bởi `time < AT - 120`. Boss luôn là legendary Apex ngẫu nhiên từ pool hiện có.

- [ ] **Step 1: Write the failing tests**: `apexDef` nhân đúng `hp/dmg/spd`; `power` 1,4 làm `hp` tăng 1,4 lần; `SPECIAL_AT < G.Judgment.AT`; mô phỏng `update` với `G` giả: ở 1499 s không mở, ở 1500 s mở đúng một lần, nếu `arena` đang chạy thì không mở rồi mở sau khi xong, không bao giờ mở lần hai trong cùng run; `reset()` xoá `specialDone`; `won()` gọi hai lần chỉ trao thưởng một lần; `lost()` không trao gì; rift đặc biệt không tăng `misses`.
- [ ] **Step 2: Run** `node --test tests/rift-special.test.cjs` → FAIL.
- [ ] **Step 3: Implement** theo Interfaces; `begin(cfg)` giữ `special` trong `arena`; `spawnLegend` dùng `apexDef` khi `arena.special`; `power` lấy từ `G.Prestige.bonus` × `G.Rank.bonus` của Pokémon người chơi (người đầu tiên khi nhiều người, dùng trung bình khi hợp tác).
- [ ] **Step 4: Run** `node --test tests/` → xanh. Thủ công trên `dev.html`: dùng `G.Rift.debugArena` mở nhanh arena đặc biệt (thêm `debugSpecial()`), kiểm thắng/thua và hợp tác hai máy.
- [ ] **Step 5: Commit** — `feat: rift especial del minuto 25 con jefe Apex`.

---

### Task 9: Changelog, văn bản, tài liệu và build

**Files:**
- Modify: `js/data/changelog.js` (cặp es/en, `new`/`chg`, ngày 2026-10-28), `docs/HANDOFF.md` (mô tả mới về Rank/passive), `GDD.md` nếu mô tả gacha
- Test: `tests/i18n.test.cjs` (chỉ chạy)

- [ ] **Step 1: Add changelog entries** — Rank (bản trùng, 10 sao, bonus), passive common/unique, vé wish và boss Apex phút 25, đổi sao Prestigio thành ♦.
- [ ] **Step 2: Run** `node --test tests/` → toàn bộ xanh.
- [ ] **Step 3: Run** `node tools/build.js && node tools/export_data.js && python tools/make_seo_pages.py` → không lỗi; mở `index.html` được (G không lộ ra `window`).
- [ ] **Step 4: Manual smoke** trên `dev.html` theo mục "Kiểm thử" của spec (quay trùng, mở unique ở 3★, tiến hóa, rift phút 25 thắng/thua, ba loại vé, hợp tác hai máy).
- [ ] **Step 5: Commit** — `docs: changelog y notas` (chỉ khi chủ dự án yêu cầu; không `git push`).
