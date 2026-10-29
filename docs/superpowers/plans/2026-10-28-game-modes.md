# Chế độ chơi mới (Wave, Boss Rush, Hardcore) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm ba chế độ ngoài ván Thường (Wave vô hạn, Boss Rush 10 chặng, lớp phủ Hardcore) chạy được solo và co-op.

**Architecture:** Registry `G.Modes` (`js/systems/modes.js`) với các hook; `normal` có hook rỗng nên ván Thường không đổi. `wave` và `bossrush` đăng ký từ file riêng. Hardcore là modifier tách riêng, hệ số quái nhân tại một chỗ (`Modes.scaleEnemy`). Co-op: cấu hình `mode` đi trong gói `start`, trạng thái đi qua một sự kiện `['md', ...]`, Boss Rush dùng cờ `rush` trong cấu hình `arena` sẵn có.

**Tech Stack:** JavaScript thuần, một đối tượng toàn cục `G`, không bundler; test bằng `node --test tests/*.test.cjs` (nạp file bằng `new Function('G', src)(G)` với `G` giả).

**Spec:** `docs/superpowers/specs/2026-10-28-game-modes-design.md`

## Global Constraints

- Sửa `dev.html`, không bao giờ sửa `index.html`, `js/app.min.js`, `version.json`, `js/lang/` (file sinh ra).
- Không commit/push nếu chủ dự án chưa yêu cầu; nếu commit thì **không** ghi "Co-Authored-By" hay chữ ký AI (CLAUDE.md của dự án; quy định này thắng mọi mặc định khác). Các bước "Commit" dưới đây chỉ chạy khi chủ dự án đã cho phép.
- Chuỗi giao diện mới **chỉ tiếng Anh**, viết thẳng trong code (không khóa Tây Ban Nha, không thêm vào `lang-en.js`). Mục changelog đánh dấu `'en-only'`.
- File JS mới phải nằm trong khối `<!-- scripts:begin/end -->` của `dev.html` đúng thứ tự tải; module imprescindible thêm vào `NEED` ở `js/main.js`. `build.js` cần `util.js` chứa đúng `window.G = window.G || {};` (không đụng).
- Không thêm tiền tệ, server, luật Firestore, hay thay đổi cấu trúc phòng Firebase. Chế độ mới không gọi `Ranking.runStarted/submitSolo/submitGroup`.
- Không đổi gói tin hiện có; sự kiện mới duy nhất là `['md', ...]`. `codec.js` không cần sửa (mã hóa mọi giá trị kiểu JSON).
- Khóa mới trong `save.stats` là **số phẳng**, gộp save bằng max: `bestWave`, `bestWaveHc`, `bestStage`, `bestStageHc`, `rushClears`, `rushClearsHc`.
- Mọi hằng số (hệ số Hardcore, `quota`, hệ số sau đợt 27, bảng thưởng) là ước tính, gom thành bảng hằng số có tên để chỉnh.
- Nhiều file là CRLF, một số LF. Sửa bằng `Edit` với chuỗi duy nhất rồi grep lại; không dùng regex nhiều dòng. Chạy Node bằng đường dẫn có sẵn; Python (nếu cần) ở `C:/Users/huyhu/AppData/Local/Programs/Python/Python312/python.exe`.
- Baseline: `node --test tests/*.test.cjs` đang **348/348 pass**; sau mỗi task phải còn xanh.

## Review Focus

- Boss hạ trong arena của Boss Rush không được đánh dấu là legendary đã vượt (`s.legends`, thành tựu `leg_*`) qua `Progress.kill`. (Task 3)
- Ván Wave/Boss Rush không được nâng `stats.bestTime`/`bestGroupTime` và không tăng nhiệm vụ "aguanta N minutos". (Task 3)
- Người chơi chết trong arena Boss Rush phải kết thúc ván (solo: sau animation; co-op: khi cả đội ngã), khác với arena rift thường nơi chỉ bị đẩy ra. (Task 5)
- Cấu hình `mode` từ mạng hoặc save có thể sai kiểu (loại lạ, `hc` không phải boolean, `md` với số vượt giới hạn): phải rơi về `normal`, không ném lỗi. (Task 1, Task 7)
- Thoát ván giữa chừng (`quitRun`, mất kết nối host) phải dọn `Modes.cfg`, đồ vật nhiệm vụ và arena; ván Thường kế tiếp không còn dấu vết chế độ. (Task 1)

---

### Task 1: Lõi `G.Modes` và điểm móc (chưa đổi hành vi)

**Files:**
- Create: `js/systems/modes.js`
- Modify: `dev.html` (thêm `<script defer src="js/systems/modes.js"></script>` ngay sau dòng `events.js`, khoảng dòng 706), `js/main.js` (thêm `'Modes'` vào `NEED`), `js/game.js` (startRun ~105-166, endRun ~320-377, vòng lặp ~742-756, `quitRun`), `js/systems/spawner.js` (đầu `update`; export `spawnOne`, `spawnBoss`, `anchor`), `js/entities/enemy.js` (~1039, sau `G.Progress.kill(e)`), `js/systems/events.js` (đầu `update`), `js/systems/judgment.js` (không đổi code; chặn ở `game.js`)
- Test: `tests/modes.test.cjs`

**Interfaces:**
- Produces (`G.Modes`):
  - `register(id: string, def: ModeDef): void` ; `TYPES: { [id]: ModeDef }` với `ModeDef = { id, name, desc, classic: boolean, arena?: boolean, begin?(players), end?(), spawn?(dt, players, t), onKill?(e), onTick?(dt, players, t), result?(): { won:boolean, label:string }, rewardMul?(): number, hud?(): string, onNet?(ev: any[]) }`
  - `cfg: { type: string, hc: boolean }` (mặc định `{ type: 'normal', hc: false }`)
  - `normalize(raw: any): { type, hc }` — loại lạ hoặc rác → `{ type:'normal', hc:false }`; `hc` chỉ `true` khi `raw.hc === true`
  - `begin(raw: any, players: object[]): void` ; `end(): void` (đặt lại `cfg` về mặc định, gọi `end` của loại hiện tại)
  - `current: ModeDef` (getter) ; `classic(): boolean` ; `arenaRun(): boolean` (= `current.arena === true`) ; `hc(): boolean`
  - `tick(dt, players, t): void` (gọi `current.onTick`) ; `onKill(e): void` ; `hudLine(): string` ; `result(): {won,label}|null`
  - `rewardMul(): number` (= `current.rewardMul() × (hc ? HARDCORE.rewardK : 1)`, mặc định 1)
  - Stub trả mặc định cho Task 2: `scaleEnemy(sc)`, `rateK()`, `healK()`, `noReroll()`, `noRevive()`, `rand()`
- Consumes: `G.Spawner`, `G.Game` (không tại thời điểm nạp, chỉ lúc chạy).

- [ ] **Step 1: Viết test thất bại `tests/modes.test.cjs`** nạp `js/systems/modes.js` với `G = {}` giả. Các test (tên và khẳng định):
  - `normalize rejects garbage`: `normalize(null)`, `normalize('wave')`, `normalize({type:'nope'})` → `{type:'normal',hc:false}`; `normalize({type:'wave',hc:'yes'})` → `{type:'wave',hc:false}`; `normalize({type:'wave',hc:true})` → `{type:'wave',hc:true}` (chỉ sau khi `register('wave', …)`).
  - `normal has empty hooks`: `TYPES.normal.classic === true`, và `spawn`, `onKill`, `onTick`, `result`, `hud` đều `undefined`; `rewardMul()` của Modes = 1.
  - `begin/end resets`: `begin({type:'wave',hc:true}, [])` rồi `end()` → `cfg` là `{type:'normal',hc:false}`; `begin` gọi `begin` của loại đúng một lần, `end` gọi `end` một lần.
  - `classic false for registered non-classic mode`; `arenaRun` đúng theo cờ `arena`.
- [ ] **Step 2: Chạy** `node --test tests/modes.test.cjs` → FAIL (file chưa có).
- [ ] **Step 3: Tạo `js/systems/modes.js`** (IIFE gán `G.Modes`, đăng ký sẵn `normal`). Hằng số `HARDCORE` để trống ở task này (Task 2 điền). Stub `scaleEnemy(sc) => sc`, `rateK()/healK() => 1`, `noReroll()/noRevive() => false`, `rand() => Math.random`.
- [ ] **Step 4: Chạy lại test** → PASS.
- [ ] **Step 5: Nối vào game** (mỗi điểm một `Edit`, hành vi ván Thường giữ nguyên):
  - `dev.html` và `main.js`: đăng ký script và `NEED`.
  - `game.js`: `startRun(coop = null, mode = null)`; ngay trước dòng `G.Camera.x = pl.x` (sau khối `if (coop) { G.Coop.begin… }`) gọi `G.Modes.begin(coop ? coop.mode : mode, everyone())`. `endRun` gọi `G.Modes.end()` sau khi đã đọc kết quả (thêm `modeResult` ở Task 3). `quitRun` đi qua `endRun` nên đã dọn; Step 1 có test `begin` sau `end` không giữ trạng thái cũ.
  - Vòng lặp: giữ nguyên các lời gọi `G.Rift.update`, `G.Judgment.update`, `G.Events.update` trong `game.js`; chặn **bên trong** từng hàm: `Judgment.update` và `Events.update` mở đầu bằng `if (!G.Modes.classic()) return;`; `Rift.update` chỉ chặn việc **mở** grieta (hai nhánh gọi `open(...)` thêm điều kiện `G.Modes.classic()`), để `arenaTick` vẫn chạy cho Boss Rush. Thêm `G.Modes.tick(dt, all, time)` ngay sau `G.Events.update`; `tick` chạy ở mọi máy, nên `onTick` của từng chế độ phải tự kiểm `!G.Coop.active || G.Coop.isHost` trước khi đổi trạng thái.
  - `spawner.js`: đầu `update`, sau khi gán `players`: `if (G.Modes.current.spawn) { G.Modes.current.spawn(dt, players, t); return; }`. Thêm `spawnOne`, `spawnBoss`, `anchor` vào đối tượng trả về. Không đổi chữ ký hiện có; `spawnOne(pl, t, angle, opts = {})` nhận `opts.elite: boolean` ép quái elite (cùng công thức elite sẵn có: ×1,6 máu, ×1,25 sát thương, ×1,6 xp).
  - `enemy.js`: sau `G.Progress.kill(e)` (khoảng dòng 1039) thêm `G.Modes.onKill(e);`. Vòng này chỉ chạy cho quái không `remote`, nên chỉ máy có quyền gọi hook.
- [ ] **Step 6: Chạy toàn bộ** `node --test tests/*.test.cjs` → 348 test cũ + các test mới đều PASS.
- [ ] **Step 7: Commit** (chỉ khi được phép) `feat: Modes registry and hooks (Normal unchanged)`.

---

### Task 2: Hardcore (hệ số và luật)

**Files:**
- Modify: `js/systems/modes.js`, `js/systems/spawner.js` (`spawnOne`, `spawnBoss`, tính `acc`), `js/ui/run-ui.js` (~40-44 `rerollsLeft`), `js/entities/player.js` (`heal` ~542, regen ~618, `ab.revive` ~510), `js/systems/interact.js` (~59 `spring`), `js/game.js` (`reviveTick` ~767), `js/systems/evolution.js` (`onKill` ~69)
- Test: `tests/hardcore.test.cjs`

**Interfaces:**
- Produces: `Modes.HARDCORE = { hpK: 1.5, dmgK: 1.4, rateK: 1.25, spdK: 1.1, healK: 0.5, rewardK: 1.75, dropK: 1.5 }`; `scaleEnemy(sc: {hp,dmg,spd}): {hp,dmg,spd}` (khi `hc` nhân `hp×hpK`, `dmg×dmgK`, `spd×spdK`; không hc trả `sc` nguyên); `rateK(): number`; `healK(): number`; `noReroll(): boolean`; `noRevive(): boolean`; `rand(): () => number` (khi hc trả `() => Math.random() / dropK`, ngược lại `Math.random`).
- Consumes: `Modes.hc()` của Task 1.

- [ ] **Step 1: Viết test thất bại `tests/hardcore.test.cjs`:**
  - `scaleEnemy multiplies only under hardcore`: `{hp:100,dmg:10,spd:1}` → không hc giữ nguyên; hc → `{hp:150,dmg:14,spd:1.1}` (so `Math.abs(x-y)<1e-9`).
  - `rateK/healK/noReroll/noRevive` theo cờ: hc → `1.25`, `0.5`, `true`, `true`; không hc → `1`, `1`, `false`, `false`.
  - `rand biases drops up`: với `Math.random` giả trả 0,6, hc cho `rand()() < 0.5`… tức `0.6/1.5 = 0.4`; không hc trả 0,6.
  - Test nguồn (đọc file bằng `fs`): `run-ui.js` chứa `noReroll()` trong `rerollsLeft`; `player.js` `heal(` chứa `healK()`; `interact.js` spring chứa `healK()`; `game.js` `reviveTick` chứa `noRevive()`; `player.js` quanh `ab.revive` chứa `noRevive()`; `spawner.js` gọi `scaleEnemy` hai lần (spawnOne và spawnBoss).
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Điền `HARDCORE` và các hàm trong `modes.js`.**
- [ ] **Step 4: Nối luật:**
  - `spawner.js`: bọc `scaled(G.Enemies.scale(t), …)` và `scaled(G.Enemies.bossScale(t), …)` bằng `G.Modes.scaleEnemy(...)` (gọi trên kết quả `{hp,dmg,spd}` trước khi nhân hệ số co-op); `acc += rate(t) × … × G.Modes.rateK() × dt`.
  - `run-ui.js rerollsLeft`: dòng đầu `if (G.Modes.noReroll()) return 0;`.
  - `player.js`: trong `heal(amount, quiet)` thêm `amount *= G.Modes.healK();` ngay cạnh `healMul`; dòng regen (`this.hp + this.regen * dt`) nhân `G.Modes.healK()`; điều kiện `ab.revive` thêm `&& !G.Modes.noRevive()`.
  - `interact.js spring`: nhân `G.Modes.healK()` vào lượng hồi `pl.maxHp * 0.14 * dt`.
  - `game.js reviveTick`: dòng đầu `if (G.Modes.noRevive()) return;`.
  - `evolution.js onKill(pl, e, rand)`: khi `rand` không được truyền, dùng `G.Modes.rand()` (các lời gọi `Mega.onKill` và `Prestige.onKill` nhận chung `rand` nên Hardcore tăng xác suất cho cả ba).
- [ ] **Step 5: Chạy** `node --test tests/hardcore.test.cjs` rồi toàn bộ → PASS.
- [ ] **Step 6: Commit** `feat: Hardcore overlay rules and multipliers`.

---

### Task 3: Kỷ lục, thưởng, chống nhiễm dữ liệu

**Files:**
- Modify: `js/core/db.js` (khóa `stats` mặc định ~108, kiểm `sanitize` ~202), `js/game.js` (`endRun`), `js/systems/progress.js` (`kill` ~185), `js/ui/run-ui.js` (`showOver` ~125)
- Test: `tests/modes-records.test.cjs`

**Interfaces:**
- Produces: `Modes.recordKeys(): { best: string, clears?: string }` (với `wave`: `bestWave`/`bestWaveHc`; `bossrush`: `bestStage`/`bestStageHc` + `rushClears`/`rushClearsHc`; theo `hc`), `Modes.record(n: number): void` (nâng khóa tương ứng bằng max, chỉ khi `hc` đúng khóa `*Hc`), `Modes.recordClear(): void` (cộng `rushClears*`).
- `endRun` dùng: `modeResult = G.Modes.result()` (có thể `null`), truyền `mode: { label, won, hc }` vào `showOver`.
- Consumes: `Modes.rewardMul()` (Task 1), `Modes.hc()`.

- [ ] **Step 1: Viết test thất bại `tests/modes-records.test.cjs`:**
  - `stats defaults include the six record keys at 0` (nạp `db.js` theo cách `tests` hiện có dùng, hoặc đọc nguồn và kiểm cả sáu khóa trong khối `stats` mặc định).
  - `record keeps the max and routes hc to the Hc key`: `begin({type:'wave',hc:false})`, `record(7)`, `record(3)` → `bestWave === 7`; `hc:true` ghi vào `bestWaveHc` và không đụng `bestWave`.
  - `endRun source skips bestTime and bestGroupTime unless normal`: nguồn `game.js` có `G.Modes.classic()` quanh hai dòng cập nhật đó; `runEnd` gửi `time` bằng `0` khi không classic.
  - `Progress.kill passes legend 0 outside normal`: nạp `progress.js` với `G` giả (`Rift.inArena=true`, `Modes.classic=()=>false`, `Judgment.active=false`) và bắt lời gọi `event('kill')`; boss arena → `legend: 0`, `boss: true`; với `classic()` true giữ hành vi cũ (`legend = e.dex`).
  - `reward multiplier applies`: `rewardMul()` với `hc` trả `1.75` khi mode `rewardMul` mặc định 1.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Implement** `recordKeys/record/recordClear` trong `modes.js`; thêm sáu khóa vào `stats` mặc định trong `db.js` (kiểm `sanitize`: khóa số lạ không bị xóa, trần số hợp lý ≤ 1e9).
- [ ] **Step 4: Sửa `endRun`:** hệ số `coins = Math.round(sum × mul × G.Modes.rewardMul())`; `Prestige.grantXp` nhận kết quả nhân `Modes.rewardMul()` (nhân vào `xp` trước khi gọi nếu hàm không nhận hệ số; đọc `prestige.js grantXp` để chọn); `bestTime`/`bestGroupTime` chỉ cập nhật khi `G.Modes.classic()`; `Progress.event('runEnd', { time: classic ? time : 0, … })`; bọc cả khối `Ranking` (`sent`) bằng `classic`; gọi `G.Modes.result()` trước `G.Modes.end()` và truyền `mode` vào `showOver`.
- [ ] **Step 5: `progress.js kill`:** `legend = (e.legend || (G.Rift.inArena && e.boss)) && G.Modes.classic() ? e.dex : 0`.
- [ ] **Step 6: `showOver` (run-ui.js):** nếu `r.mode`, thêm một dòng "`<label>`" và huy hiệu "HARDCORE" khi `r.mode.hc` (cùng cách các dòng "Mega Crystals", "Mega Materials" đã được thêm).
- [ ] **Step 7: Chạy** toàn bộ test → PASS.
- [ ] **Step 8: Commit** `feat: mode records, reward multiplier, data isolation from Normal`.

---

### Task 4: Mục menu "Modes" và HUD

**Files:**
- Create: `js/ui/modes-ui.js`
- Modify: `dev.html` (nút menu sau dòng 188; màn `scr-modes`; script `modes-ui.js` sau `menu.js`), `js/ui/menu.js` (`ICON` và `onclick`), `js/game.js` (`Flow.play(mode)`), `css/style.css`, `js/ui/hud.js` (dòng chế độ và huy hiệu), `js/main.js` (`NEED` `'ModesUI'`)
- Test: `tests/modes-ui.test.cjs`

**Interfaces:**
- Produces: `G.ModesUI = { open(): void, close(): void }`; `G.Flow.play(mode?: {type, hc})` truyền xuống `G.Game.startRun(null, mode)`.
- Consumes: `Modes.TYPES`, `DB.save.stats` (khóa kỷ lục), `Modes.normalize`.

- [ ] **Step 1: Viết test thất bại `tests/modes-ui.test.cjs`** (kiểm nguồn, không cần DOM): `dev.html` có `data-go="modes"` và `id="scr-modes"`; `menu.js` xử lý `go === 'modes'`; `Flow.play` nhận tham số `mode`; nút `data-go="play"` vẫn gọi `G.Flow.play()` không tham số; `modes-ui.js` dựng 3 thẻ (Normal, Wave, Boss Rush) và một công tắc Hardcore.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Dựng `modes-ui.js`** theo mẫu một màn có sẵn (đọc `forge-ui.js` về cách dùng `G.UI.show/hide`, `$` và nút quay lại `data-back`). Mỗi thẻ: tên, mô tả một câu, kỷ lục của đúng biến thể đang chọn (`bestWave`, `bestStage`/`rushClears` hoặc bản `Hc`). Bấm thẻ gọi `G.Flow.play({ type, hc })`. Nếu `G.Social.room` tồn tại thì bấm thẻ chỉ báo "Start the run from the lobby" (chọn chế độ co-op ở Task 7). Chuỗi chỉ tiếng Anh.
- [ ] **Step 4: Nút menu** "Modes" với dòng phụ "Wave, Boss Rush and Hardcore"; `ICON.modes = 'trophy'` (icon có sẵn của mục `rank`).
- [ ] **Step 5: HUD:** vẽ `G.Modes.hudLine()` ở giữa phía trên cạnh đồng hồ, và nếu `Modes.hc()` thì huy hiệu đỏ "HARDCORE" (tìm chỗ vẽ đồng hồ trong `hud.js`, tránh đè dòng cảnh báo của `Spawner.banner`).
- [ ] **Step 6: Chạy** toàn bộ test → PASS. Kiểm tay: mở `dev.html?dev`, vào "Modes", bắt đầu Normal với Hardcore, thấy huy hiệu; "Jugar" vẫn vào thẳng ván Thường.
- [ ] **Step 7: Commit** `feat: Modes menu and HUD line`.

---

### Task 5: Boss Rush solo

**Files:**
- Create: `js/systems/modes-bossrush.js`
- Modify: `dev.html` (script sau `modes.js`), `js/systems/rift.js` (thêm `openRush`, nhánh `'rush'` trong `arenaTick`, `begin` đọc `cfg.rush`), `js/game.js` (`addPendingLevels`, điều kiện chết ~711 và ~775), `js/systems/spawner.js` (nếu cần export thêm)
- Test: `tests/bossrush.test.cjs`

**Interfaces:**
- Produces: `Rift.openRush(cfg: {tx,ty,r,type}): void` (gọi `begin({...cfg, rush:true})`, đặt `arena.phase = 'rush'`, phát `['arena', cfg+rush]` khi là host); `Rift.rushSpawn(def, apex: boolean, power: number): Enemy` (tạo boss ở phía bắc arena như `spawnLegend`, đặt `e.legend = true`, `e.apex = apex`); `Game.addPendingLevels(n: number): void`; `Game.winRun(): void` (solo: `endRun(false)`; co-op host: `G.Coop.over(summary())`, đường mà `checkAllDown` đã dùng; export cả hai trong đối tượng `G.Game`); `BossRush.stages(bosses: object[], legends: object[]): { kind:'regular'|'apex', def, index }[]` (đúng 10 phần tử: 5 `regular` từ `Enemies.BOSSES[0..4]`, 4 `apex`, 1 `apex` cuối với `final: true`); `BossRush.STAGE_REST = 10`; `BossRush.DRAFT = 3`; `BossRush.FINAL_REWARD = { gems: 20, shards: 30 }` (ước tính, chỉnh sau).
- Consumes: `Modes.register`, `Spawner.say`, `Rift.apexDef`, `Rift.apexPower`, `Pickups.pullAll`, `Progress.grant`, `Modes.record`, `Modes.recordClear`, `DB.commit`.

- [ ] **Step 1: Đọc** `Rift.onEvent` (cuối `rift.js`, sau dòng 340) để biết cách máy khách xử lý `'arena'` và những gì `Rift.arenaInfo` trả. Xác nhận bằng một dòng comment trong `modes-bossrush.js` rằng `begin(cfg)` chạy được ngay lúc bắt đầu ván (vị trí `back` chỉ dùng khi `finish()`, mà `rush` không gọi `finish`).
- [ ] **Step 2: Viết test thất bại `tests/bossrush.test.cjs`:**
  - `stages returns exactly 10 in the specified order`: 5 `regular` rồi 5 `apex`, chỉ phần tử cuối có `final: true`.
  - `apex power rises across stages` (nếu `stages` mang `power`, kiểm tăng dần).
  - `a won run records clear and best stage 10`: mô phỏng `onKill` cho đủ 10 boss với `G` giả → `result().won === true`, `bestStage === 10`, `rushClears === 1`.
  - `dying records best stage reached`: hạ 4 boss rồi `end()` → `bestStage === 4`.
  - `no regular spawn`: `TYPES.bossrush.spawn` không bao giờ gọi `Spawner.spawnOne` (đếm lời gọi giả).
  - Nguồn `rift.js`: nhánh `phase === 'rush'` trong `arenaTick` không gọi `won()`/`lost()`/`finish()`; nguồn `game.js`: hai điều kiện chết dùng `G.Modes.arenaRun()`.
- [ ] **Step 3: Chạy** → FAIL.
- [ ] **Step 4: Rift:** `openRush`, `rushSpawn`, nhánh `rush` trong `arenaTick` (chỉ `if (authority()) keepInside();` rồi `return`; `keepInside` đang dùng chung và không phụ thuộc `bossId`), `begin` đặt `phase: cfg.rush ? 'rush' : 'fight'`; chặn `Rift.update` rẽ vào `rift` hoặc `special` khi `!Modes.classic()` (đã làm ở Task 1).
- [ ] **Step 5: Game:** `addPendingLevels(n)` cộng vào `pendingLevels`; điều kiện chết solo `if (pl.dead && !coop && (!G.Rift.inArena || G.Modes.arenaRun()))`; `checkAllDown`: `if ((G.Rift.inArena && !G.Modes.arenaRun()) || !… every(dead))`.
- [ ] **Step 6: `modes-bossrush.js`:** đăng ký `bossrush` (`classic:false`, `arena:true`, `name:'Boss Rush'`). `begin(players)`: dựng arena bằng `Rift.openRush` (tọa độ giống `Rift.start`: `tx/ty` trong `5000..8000`, `r: 11`, `type` ngẫu nhiên), `Spawner.say` banner, nếu có quyền (solo hoặc host) `Game.addPendingLevels(DRAFT)`, chặng 1 xuất hiện sau 4 s. Máy trạng thái: `fight` (đợi boss chết) → `rest` (10 s, `Pickups.pullAll()`) → chặng kế; `onKill(e)` nhận ra boss của chặng hiện tại, `Modes.record(chặng đã hạ)`. Chặng cuối hạ xong: `Modes.recordClear()`, `Progress.grant(FINAL_REWARD)`, `DB.commit(true)`, `result() = { won:true, … }` và gọi `Game.winRun()`. `result()` trả `{ won, label: 'Stage N/10' }`. `hud()` trả `Boss Rush · Stage N/10`.
- [ ] **Step 7: Chạy** toàn bộ test → PASS. Kiểm tay (`dev.html?dev`, `G.Modes` chọn Boss Rush từ menu): vào arena, 3 lượt chọn thẻ, boss 1 xuất hiện, hạ rồi nghỉ 10 s, chặng Apex có chiêu đặc trưng, chết thì ra màn kết thúc.
- [ ] **Step 8: Commit** `feat: Boss Rush (solo)`.

---

### Task 6: Wave solo (nhiệm vụ nhóm số liệu)

**Files:**
- Create: `js/systems/modes-wave.js`
- Modify: `dev.html` (script sau `modes-bossrush.js`), `js/systems/spawner.js` (nếu cần export thêm), `js/data/enemies.js` (không đổi; dùng `scale`, `bossScale`, `bagAt`, `BOSSES`)
- Test: `tests/wave.test.cjs`

**Interfaces:**
- Produces (đối tượng `G.Wave` để test, `register('wave', …)` gọi lại nó):
  - `quota(n: number): number` = `Math.min(160, Math.round(10 + 4 * n ** 1.1))`
  - `virtualT(n: number): number` = `n * 90`
  - `lateK(n): { hp, dmg }` = `n ≤ 27 ? {hp:1,dmg:1} : {hp: 1 + 0.06*(n-27), dmg: 1 + 0.04*(n-27)}`
  - `eliteShare(n): number` = `n ≤ 27 ? 0 : Math.min(0.5, 0.025 * (n - 27))`
  - `bossFor(n): null | { kind: 'regular'|'apex', index: number }`: `n % 5 !== 0` → `null`; `k = n/5`; `k % 5 === 0` → `{kind:'apex', index:k/5}`; ngược lại `{kind:'regular', index:(k % 5) - 1}` (0..3)
  - `objectiveFor(seed: number, n: number, hasBoss: boolean): { id: string, goal: number, arg?: string, secs?: number }` (xác định, thuần theo `seed`/`n`; id thuộc `killType | speed | elites | holdBelow | bossTime`, `bossTime` chỉ khi `hasBoss`)
  - Máy trạng thái trong `register`: pha `intro` (2 s), `fight`, `rest` (8 s); `WAVE_INTRO = 2`, `WAVE_REST = 8`
  - `REWARDS(n, diff): { coins, shards, gems?, mats? }` (bảng ước tính: coins `40 + 8n`, shards 1-3 theo độ khó, gems 0-1, vật liệu Mega hiếm)
- Consumes: `Spawner.spawnOne(pl,t,angle,{elite})`, `Spawner.spawnBoss`, `Spawner.anchor`, `Spawner.say`, `Enemies.scale/bossScale/BOSSES`, `Rift.apexDef`, `Progress.grant`, `Modes.record`, `Coop.scaleRate`.

- [ ] **Step 1: Viết test thất bại `tests/wave.test.cjs`** (nạp `modes.js` + `modes-wave.js` với `G` giả):
  - `quota(1) === 14`, `quota(20) === 118`, `quota(60) === 160` (trần), tăng đơn điệu.
  - `virtualT(20) === 1800`.
  - `lateK(27)` là `{1,1}`; `lateK(28)` là `{hp:1.06, dmg:1.04}` (so gần đúng); `eliteShare(27) === 0`, `eliteShare(60) === 0.5`.
  - `bossFor`: `n=4 → null`; `5 → {regular,0}`; `10 → {regular,1}`; `15 → {regular,2}`; `20 → {regular,3}`; `25 → {apex,1}`; `30 → {regular,0}`; `50 → {apex,2}`.
  - `objectiveFor` giống nhau với cùng `seed,n`; không bao giờ trả `bossTime` khi `hasBoss` sai; quét `n = 1..200` chỉ trả id hợp lệ.
  - Máy trạng thái: bắt đầu `intro` 2 s → `fight`; `fight` không kết thúc khi còn quái hoặc chưa spawn đủ hạn ngạch; chỉ khi spawn đủ và `EnemyMgr` rỗng mới sang `rest` 8 s rồi `n+1`; `Modes.record(n)` gọi khi đợt `n` hoàn thành.
  - Mất người chơi: `result()` trả `{ won:false, label:'Wave N' }` với `N` là đợt đạt được.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Implement `modes-wave.js`** theo giao diện trên. Máy trạng thái và `spawn` chỉ chạy khi `!G.Coop.active || G.Coop.isHost` (máy khách chỉ nhận `md` ở Task 7). Spawn: trong `fight`, bơm cụm nhỏ (4-6 quái) qua `Spawner.spawnOne` khi `EnemyMgr.count < Spawner.CAP`, mỗi quái elite với xác suất `eliteShare(n)`; chỉ số quái đi qua `Modes.scaleEnemy` (Task 2) và nhân `lateK(n)`; boss qua `Spawner.spawnBoss` (regular: `Enemies.BOSSES[index]`; apex: legendary ngẫu nhiên `G.DEX.filter(p => p.leg && G.SPRITE_META[p.dex])` dạng `Rift.apexDef(def, power)` với `power` tăng theo `k`), hạn ngạch co-op nhân `Coop.scaleRate`. `rest`: `Pickups.pullAll()`, phát thưởng nhiệm vụ nếu đạt (`Progress.grant`, `pl.shardsFound`/`gemsFound` cộng để màn kết thúc hiện, `DB.commit(true)`), hồi 25% máu nếu đạt (`pl.heal(pl.maxHp * 0.25)`). `hud()` trả `Wave N · M left` kèm mô tả nhiệm vụ và tiến độ.
- [ ] **Step 4: Chạy** `node --test tests/wave.test.cjs` rồi toàn bộ → PASS. Kiểm tay: chơi đến đợt 5 (boss), đợt 28 (hệ số), xem FPS ở đợt cao.
- [ ] **Step 5: Commit** `feat: Wave mode (solo, stat objectives)`.

---

### Task 7: Co-op cho Wave và Boss Rush

**Files:**
- Modify: `js/net/coop.js` (thêm `case 'md'` gần dòng 458; tài liệu cấu hình đầu file dòng 22), `js/ui/social-ui.js` (`start()` ~273, `render` lobby ~262-271), `dev.html` (hàng chọn chế độ trong lobby sau dòng 386), `js/systems/modes.js` (`onNet`, `netState`), `js/systems/modes-wave.js`, `js/systems/modes-bossrush.js`, `docs/MULTIPLAYER_PROTOCOL.md`
- Test: `tests/net.test.cjs` (thêm), `tests/modes-coop.test.cjs`

**Interfaces:**
- Produces: sự kiện `['md', kind: number, n: number, phase: number, obj: number, prog: number, mask: number]`. `kind`: 1 = Wave, 2 = Boss Rush. `phase`: 0 intro, 1 fight, 2 rest, 3 over. `Modes.onNet(ev: any[]): void` (kiểm kiểu và kẹp số: `n ∈ [0, 1e6]`, `prog ∈ [0, 1e6]`, `mask ∈ [0, 2^31)`; sai kiểu thì bỏ qua); `Modes.netState(): any[] | null` (trạng thái hiện tại để host phát); `LobbyUI` thêm hàng chọn (`#lobby-mode`) chỉ host thấy; `start()` đặt `cfg.mode = G.Modes.normalize(selection)`.
- Consumes: `Coop.broadcast`, `Coop.isHost`, `Spawner.say`.

- [ ] **Step 1: Viết test thất bại:**
  - `tests/net.test.cjs`: `md` đi qua `NetCodec.encode/decode` nguyên vẹn (`['md',1,12,1,3,5,9]`); gói `start` có `mode:{type:'wave',hc:true}` cũng nguyên vẹn.
  - `tests/modes-coop.test.cjs`: `Modes.onNet` bỏ qua `['md']`, `['md','x']`, `['md',9,-5,99,NaN,1e12,-1]` mà không ném lỗi; `onNet` hợp lệ đặt trạng thái cho `hud()` của khách; nguồn `coop.js` có `case 'md':` gọi `G.Modes.onNet(ev)`; nguồn `social-ui.js` `start()` có `mode:`; `Game.startRun` đọc `coop.mode` (Task 1) và `normalize` loại lạ về `normal`.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Implement:** `case 'md': G.Modes.onNet(ev); break;` trong `coop.js`; host phát `Modes.netState()` mỗi khi `phase`/`n` đổi và tối đa 2 lần/giây cho `prog` (qua `Coop.broadcast`); khách chỉ lưu và vẽ HUD. Lobby: hàng chọn 4 lựa chọn (Normal, Wave, Boss Rush) cộng công tắc Hardcore, mặc định `Normal`, chỉ host thấy; khách thấy dòng "The host picks the mode". Wave: thưởng nhiệm vụ mỗi máy tự nhận khi `phase` chuyển sang `rest` và `obj` báo hoàn thành. Cấu hình chỉ số quái: host áp, luật người chơi mỗi máy tự áp (đã có ở Task 2 qua `Modes.hc()` đọc từ `cfg` của `begin`).
- [ ] **Step 4: Tài liệu:** thêm `md` và trường `mode` của `start`, cờ `rush` của `arena` vào `docs/MULTIPLAYER_PROTOCOL.md` và comment đầu `coop.js`.
- [ ] **Step 5: Chạy** toàn bộ test → PASS. Kiểm tay với hai tab: host bắt đầu Wave, cả hai thấy đợt, số quái, boss; Boss Rush: cả hai vào cùng arena; Hardcore: khách không reroll, hồi máu giảm.
- [ ] **Step 6: Commit** `feat: co-op for Wave and Boss Rush (md event)`.

---

### Task 8: Nhiệm vụ bản đồ của Wave (giải cứu, dẫn đường, thắp sáng)

**Files:**
- Create: `js/systems/modes-wave-obj.js`
- Modify: `dev.html` (script sau `modes-wave.js`), `js/systems/events.js` (tách phần tạo/điều khiển `lost` để Wave gọi), `js/systems/modes-wave.js` (chọn và theo dõi nhiệm vụ bản đồ), `js/game.js` (đăng ký vật vẽ giống `Rift.drawable`)
- Test: `tests/wave-obj.test.cjs`

**Interfaces:**
- Produces: `G.WaveObj = { spawn(kind: 'rescue'|'escort'|'light', center: {x,y}, seed: number, n: number): void, update(dt, players): void, done(): boolean, failed(): boolean, progress(): number, mask(): number, applyNet(prog: number, mask: number): void, drawable(): { y, draw(ctx) } | null, clear(): void }`; `Events.startEscort(players, { dist: number, ttl: number }): boolean` và `Events.escortState(): 'none'|'follow'|'done'|'failed'`; thông số: `RESCUE_HOLD = 3`, `RESCUE_DIST = [500, 700]`, `LIGHT_HOLD = 2.5`, `LIGHT_COUNT = [3, 5]`, `ESCORT_TTL = 90`.
- Consumes: `Wave.objectiveFor` (mở rộng danh sách id thêm `rescue | escort | light` cho `n ≥ 3`), `Coop` (host đo tiến độ bằng vị trí của mọi người chơi), mặt nạ `mask` của `md` (Task 7) cho đèn đã thắp.

- [ ] **Step 1: Đọc** phần `lost` trong `events.js` (`spawnLost`, `lostTick`, `onNet`, khoảng dòng 100-260) và mẫu `bigchest` trong `interact.js` (tiến độ giảm khi bước ra); ghi quyết định chia tách vào đầu `modes-wave-obj.js`.
- [ ] **Step 2: Viết test thất bại `tests/wave-obj.test.cjs`:**
  - `rescue progresses only while a player is within range and decays outside` (mô phỏng `update` với dt và vị trí).
  - `light needs every lamp lit before the wave ends`: 4 đèn, thắp 3 → `done() === false`; thắp đủ → `true`; `mask()` có đúng số bit bằng số đèn đã thắp.
  - `escort fails when the target dies or ttl expires` (dùng `Events.escortState` giả).
  - `objectiveFor never returns map objectives for n < 3` và có thể trả cả ba loại khi `n ≥ 3` (quét nhiều seed).
  - `clear() removes all objects` (kiểm `drawable() === null` sau `clear`); `Wave.end` gọi `WaveObj.clear()` và `Events` không còn escort.
- [ ] **Step 3: Chạy** → FAIL.
- [ ] **Step 4: Implement** theo giao diện. Giải cứu: nhân vật bị nhốt ở khoảng cách `RESCUE_DIST` quanh trung tâm người chơi, 2-4 quái canh sinh bằng `Spawner.spawnOne`, hoàn thành khi tiến độ đạt `RESCUE_HOLD`; phần thưởng thêm là hiệu ứng đi theo vài chục giây (không chiến đấu, không AI mới). Thắp sáng: số đèn trong `LIGHT_COUNT`, rải quanh bán kính 300-500 px, mỗi đèn cần `LIGHT_HOLD` giây có người chơi đứng gần; trạng thái đèn ghi vào `mask`. Dẫn đường: `Events.startEscort` dùng lại cơ chế `lost` với điểm đích đặt sẵn và `ESCORT_TTL`. Vẽ: đèn thắp có hào quang; nhân vật nhốt có vòng tròn; đăng ký vật vẽ cạnh chỗ `Rift.drawable` được gom trong `game.js`.
- [ ] **Step 5: Chạy** toàn bộ test → PASS. Kiểm tay: ép nhiệm vụ bằng `G.WaveObj.spawn('light', …)` trong console; co-op hai tab: đèn thắp bên host hiện ở khách (qua `mask` của `md`).
- [ ] **Step 6: Commit** `feat: Wave map objectives (rescue, escort, light)`.

---

### Task 9: Changelog, tài liệu và kiểm cuối

**Files:**
- Modify: `js/data/changelog.js`, `docs/HANDOFF.md`, `docs/MULTIPLAYER_PROTOCOL.md` (nếu chưa đủ)
- Test: `tests/*.test.cjs` (toàn bộ), `tests/i18n.test.cjs` (phải còn xanh)

**Interfaces:** không có hàm mới.

- [ ] **Step 1: Changelog:** thêm vào mục `2026-10-28` (hoặc ngày hiện tại khi phát hành) các dòng `new` đánh dấu `'en-only'`: Wave mode, Boss Rush, Hardcore overlay, Modes menu. Không ghi thay đổi server hay chi phí.
- [ ] **Step 2: HANDOFF:** thêm mục "Chế độ chơi mới" (kiến trúc `G.Modes`, các hằng số cần chỉnh sau khi chơi thử, danh sách chơi thử, lệnh gỡ lỗi `G.Modes.debug`, rủi ro đã biết) theo văn phong các mục 4.x.
- [ ] **Step 3: Lệnh gỡ lỗi:** thêm `G.Modes.debug(type, hc)` (bắt đầu ngay một ván của chế độ đó từ console, chỉ khi `?dev`) và `G.Modes.debugWave(n)` (nhảy tới đợt `n`) trong `modes.js` / `modes-wave.js`; kiểm một test nhỏ rằng chúng tồn tại.
- [ ] **Step 4: Chạy toàn bộ** `node --test tests/*.test.cjs` → tất cả PASS (348 cũ + mới), kể cả `i18n.test.cjs`.
- [ ] **Step 5: Kiểm tay cuối** theo danh sách trong HANDOFF mới: ván Thường không đổi (Jugar, rift, Sentencia vẫn xuất hiện); 6 biến thể; co-op hai tab; FPS Wave đợt cao.
- [ ] **Step 6: Commit** `docs: game modes changelog and handoff`.
