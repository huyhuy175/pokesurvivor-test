# HANDOFF — trạng thái công việc PokéSurvivor (cập nhật 2026-10-28)

> File này để lần sau bạn bảo Claude: "đọc `docs/HANDOFF.md` và làm tiếp". Nó tóm tắt mọi thứ đã làm, các quyết định, việc còn dở và cách làm việc trong repo. Đọc thêm `CLAUDE.md` (luật cố định của dự án).

## 1. Luật làm việc (từ CLAUDE.md và thực tế phiên này)

- Sửa **`dev.html`**, không bao giờ sửa file sinh ra: `index.html`, `js/app.min.js`, `js/lang/`, `version.json`. Bản build hiện tại (commit `d761fef`, đã lên GitHub Pages bản thử) **đã chứa** Mega materials, Gemas/Prestigio và thẻ tiến hóa; sau mỗi thay đổi phải build lại.
- Không commit/push trừ khi chủ dự án yêu cầu. Thư mục là git repo; nhánh làm việc hiện tại là `test-deploy` (không có upstream; xem mục 9 cho cách deploy và revert). Commit (nếu có) không ghi "Co-Authored-By" hay chữ ký AI (theo CLAUDE.md).
- Không bật Firebase Identity Platform, không thêm gì tính phí (Cloudflare Worker/TURN đã bỏ).
- Chuỗi giao diện mới: tiếng Tây Ban Nha trong code; tiếng Anh vào `js/data/lang-en.js`; game chỉ còn tiếng Anh (đã bỏ es/fr/it/pt/zh, `lang-updates.js`, `js/lang/`, `build_langs.js`). Chuỗi mới: khóa tiếng Tây Ban Nha → tiếng Anh trong `lang-en.js`. Chuỗi có số dùng `{x}` và `G.I18n.f(es, ...vals)`.
- Changelog: `js/data/changelog.js`, es + en, mục `new`/`chg`/`fix` của ngày hiện tại. Hiện có mục `2026-10-27` (passive, tiến hóa, pause) và `2026-10-28` (Lò Tiến Hóa, thẻ mới/độ hiếm, độ khó…). Không ghi thay đổi server/DB/chi phí.
- Thêm file JS mới: đưa vào khối `<!-- scripts:begin/end -->` của `dev.html` đúng thứ tự tải; nếu bắt buộc thì thêm vào `NEED` ở `js/main.js` (đã có `'PassiveFX','Evo','Mega','MegaMats','Forge','Prestige','PrestigeUI'`).
- `build.js` cần `util.js` chứa đúng `window.G = window.G || {};`.
- Phát hành (chỉ khi chủ yêu cầu): `node tools/build.js && node tools/export_data.js && python tools/make_seo_pages.py` (Python 3.12 đã cài nhưng **chưa nằm trong PATH** của shell Claude: gọi `C:/Users/huyhu/AppData/Local/Programs/Python/Python312/python.exe tools/make_seo_pages.py`).

## 2. Cách chạy và kiểm tra

- Chơi/gỡ lỗi: mở `dev.html` (thêm `?dev` để vào khi bảo trì). Thử nhanh: `G.DB.grant(4,'gacha')` (có Charmander), `G.DB.save.shards=200`, `G.Game.debugLevelUp()`.
- Test: `node --test tests/*.cjs` (Node 24 cần glob, không dùng `tests/`). Hiện **224/224 pass**. Một file: `node --test tests/forge.test.cjs`.
- Build thử: sao lưu `index.html`, `js/app.min.js`, `version.json`, `js/lang/` → `node tools/build.js --expose --sin-seo` → **khôi phục bản cũ** (bản `--expose` không được ofuscar). Đã làm nhiều lần, luôn khôi phục.
- Mô phỏng cân bằng: `node tests/helpers/balance-sim.cjs`.
- Bẫy khi sửa file: nhiều file là **CRLF**, một số là LF (ví dụ `progress.js`, `menu.js`, `evolution.js` là LF). Regex có `\n` hay thay chuỗi nhiều dòng dễ **thất bại âm thầm**. Cách an toàn: script Node đọc file, nhận biết CRLF/LF, thay chuỗi **duy nhất** rồi grep/test lại. Script tạm `edit.cjs` nằm trong thư mục scratchpad của phiên (có thể mất) — viết lại: `edit(file, [[cũ, mới]])` chuẩn hóa xuống dòng theo file và báo lỗi nếu chuỗi cũ không duy nhất.
- Test nạp file bằng `new Function('G', src)(G)` với `G` giả (xem `tests/evolution.test.cjs`, `tests/forge.test.cjs`, `tests/stats.test.cjs`).

## 3. Kiến trúc nhanh

Không module/bundler; mọi thứ treo trên đối tượng toàn cục `G`. Thứ tự `<script defer>` trong `dev.html` = thứ tự tải. Thư mục: `core/` (db, i18n, audio…), `data/` (bảng dữ liệu), `systems/` (combat, spawner, gacha, levelup, evolution, forge…), `entities/`, `world/`, `net/` (co-op P2P WebRTC), `ui/`. `js/game.js` chứa vòng lặp ván và `G.Flow`. Sổ cái "libreta" trong `core/db.js` (xu, vé, **mảnh `sh`**, Mochila `b:`, MT `m:`): mỗi thiết bị ghi [kiếm, tiêu], số dư = tổng, gộp save lấy max từng mục.

## 4. Việc đã hoàn thành

### 4.1 Passive riêng cho từng Pokémon (xong)
- Mỗi Pokémon có 1 passive riêng, mạnh theo độ hiếm; độ hiếm 4–5 có cơ chế độc nhất; tên/mô tả chỉ tiếng Anh. Dữ liệu sinh bởi `tools/gen_passives.js` + `tools/passive_design.json` → `js/data/passives.js`; mẫu hiệu ứng `js/data/passive-fx.js` (`G.PassiveFX`); áp dụng qua `js/data/ability-fx.js`, `js/systems/mons.js` (`abilityOf`).
- **Đã gỡ Ability Capsule** (không hoàn tiền); `js/data/shop.js` chỉ còn Mint + MT.
- Passive của người chơi hoàn tác được (`passiveDelta`, `clearAbility`, `setAbility`) nên tiến hóa nhiều lần không cộng dồn.
- Pause hiện passive của dạng hiện tại ("Tu pasiva", dưới Tus estadísticas).

### 4.2 Giai đoạn 1 — tiến hóa trong ván (xong)
- Dữ liệu chuỗi tiến hóa: `js/data/evolutions.js` (`G.EVO`, `G.EVO_FROM`), sinh bởi `tools/fetch_evolutions.js` (Node, PokeAPI; cache `tools/cache/evolutions.json`).
- `js/systems/evolution.js` (`G.Evo`): cấp 12 (24 nếu đã là dạng tiến hóa) + **Đá Tiến Hóa**, chỉ tiến hóa lên dạng **đã sở hữu**; đá rơi từ boss/rương lớn (chỉ khi đủ điều kiện) và 0,05% từ quái thường; cấp trực tiếp cho người chơi cục bộ (co-op không cần vật phẩm rơi).
- `Player.evolve/setLook` giữ cấp, máu theo tỉ lệ, chiêu; **nâng cấp (perks) của dạng gốc được giữ**; passive/chỉ số đổi theo dạng mới. Co-op: sự kiện mạng `evo` (đặt tên `evo` vì `ev` đã dùng) — xem `docs/MULTIPLAYER_PROTOCOL.md`.
- Xếp hạng/thống kê dùng `startDex` (Pokémon bắt đầu ván).

### 4.3 Giai đoạn 2 — Lò Tiến Hóa và Mảnh Tiến Hóa (xong)
- Spec: `docs/superpowers/specs/2026-10-27-evolution-forge-design.md`; plan: `docs/superpowers/plans/2026-10-27-evolution-forge.md`.
- **Mảnh Tiến Hóa** (`save.shards`, khóa sổ cái `sh`, clamp ≤ 1e9 trong `sanitize`). Nguồn: boss +3, rương lớn +1 (lưu ngay, không chờ hết ván; màn kết thúc có dòng tổng), nhiệm vụ ngày +2 / tuần +8, thành tựu theo bậc 5/15/40 (thành tựu `leg_*` chỉ +3). Hiện trên thanh trên cùng.
- **Lò Tiến Hóa** (`js/systems/forge.js`, `js/ui/forge-ui.js`, màn `scr-forge`, mục menu `data-go="forge"`): mua dạng tiến hóa của Pokémon đã có; giá theo độ hiếm đích `{1:20,2:40,3:80,4:160,5:300}`; dạng gốc không mất; không shiny; phân trang 30 mục; lọc độ hiếm.
- **Gacha không ra dạng tiến hóa** (`inBanner` dùng `G.Mons.isBase`). Hệ quả: banner Hoenn/Sinnoh không có Épica dạng gốc → Épica ra Rara, giao diện banner có ghi chú. Amuleto Iris cần mua dạng tiến hóa ở Lò.
- **Chỉ dạng gốc làm compañero** (`G.Mons.isBase = !G.EVO_FROM[dex]`). Ficha dạng tiến hóa: không có nút chọn, chỉ xem trước + dòng **"Evoluciona de"** (`G.Mons.lineage`) bấm để nhảy tới tiền thân.
- Migration trong `db.js` (`fixPartner`, chạy ở `sanitize` và `merge`): compañero/starter là dạng tiến hóa → về dạng gốc (tặng dạng gốc nếu chưa có; shiny giữ nếu dạng gốc có shiny).
- **Nâng cấp (Mejoras) chia sẻ cả dòng tiến hóa**: màn Mejoras chỉ liệt kê dạng gốc; `fixPartner` gộp `pupg` của dạng tiến hóa vào dạng gốc (max từng nâng cấp).

### 4.4 Thẻ lên cấp (xong)
- **Chọn 1 trong 4** (phím 1–4; `offer(pl, n = 4)`).
- 7 thẻ chỉ số mới: Ojo certero (+5% chí mạng), Golpe certero (+20% sát thương chí mạng, cộng vào hệ số), Cazajefes, Rematador (<30% máu), Esquiva, Curación mejorada, Fortuna. Trường Player mới: `critDmgBonus, bossDmg, executeDmg, dodgeChance, healMul`; `Player.critFactor()`, `statDmgK(e)`; hook trong `combat.js` (`critMul`, `statK`).
- **Độ hiếm thẻ chỉ số** (`js/systems/levelup.js`): Común→Mítica. Tỉ lệ 45/30/17/6,5/1/0,5. Hệ số: đơn `{1:0.6, 2:0.9, 3:1.35}`; Épica "Armonía" 2×0,75 hoặc 3×0,55; Legendaria "Maestría" 2×1,35 hoặc 3×1,05; Mítica "Pacto" (một chỉ số ×3, một chỉ số `spd|cd|mag|xp` ×−0,5) hoặc "Ascensión" (3×1,2 và +1 cấp một chiêu). Bundle tính 1 lượt chọn cho mỗi chỉ số (để điều kiện tiến hóa chiêu vẫn chạy). Thẻ chờ tiến hóa chiêu luôn rơi với hệ số "Poco común".
- **Cân bằng tự động**: `tests/balance.test.cjs` + `tests/helpers/balance-sim.cjs` (mô phỏng người chơi luôn chọn thẻ tốt nhất, so hệ cũ 3 thẻ vs mới 4 thẻ có độ hiếm): cấp 10 ≈ 1,06×, cấp 30 ≈ 1,17×, cấp 40 ≈ 1,22×. Test giữ khoảng cho phép.
- **Độ khó tăng theo thời gian** (`js/data/enemies.js`: `LATE = { hp: 0.20, dmg: 0.15 }`, hàm `late`): quái và boss +20% máu, +15% sát thương ở phút 30 (mũ 1,5, dừng sau phút 40). Test: `tests/difficulty.test.cjs`.
- **Pause "Tus estadísticas"** hiện đủ: thêm Esquiva, Daño a jefes, Daño a débiles, Curación, Imán, Experiencia, Pokémonedas (cùng Daño crítico).

### 4.6 Giai đoạn 3 — Mega (xong, chưa chơi thử)
- Spec `docs/superpowers/specs/2026-10-28-mega-design.md` (có phần điều chỉnh khi triển khai ở đầu), plan `docs/superpowers/plans/2026-10-28-mega.md`.
- **94 dạng Mega** (gồm Mega mới Legends Z-A) sinh bởi `tools/fetch_mega.js` (PokeAPI, cache `tools/cache/mega.json`) → `js/data/mega.js`: `G.MEGA_DEX` (dex ≥ 10000, **không** nằm trong `G.DEX`), `G.MEGA[base]`, `G.MEGA_FROM[mega]`, `G.isMega(dex)`, gộp vào `G.DEX_BY`. Chỉ số = max(dạng gốc, Mega); passive = passive dạng gốc. Mega không vào gacha, không làm compañero (`isBase` sai); không tính vào Pokédex/thành tựu/yêu thích hồ sơ.
- **Cristales Mega** theo hệ: `save.cry[type]`, khóa sổ cái `x:<tipo>` (trần 1e9). Nguồn: boss 1 (hệ đầu của boss), rương lớn 1 (một hệ của Pokémon), nhiệm vụ tuần 2 (`reward.megaCry` trong `missions.js`; boss không có Pokémon trong Pokédex rơi hệ ngẫu nhiên). Lưu ngay; màn kết thúc có dòng "Mega Crystals".
- **Lò**: tab Mega (`G.Forge.offersMega/buyMega/megaCost`): 8 tinh thể nếu một hệ, 6+6 nếu hai hệ; Mảnh 400 (X/Y: 450). Cần có dạng gốc.
- **Trong ván** (`js/systems/mega.js`, `G.Mega`): cấp **36** + Đá Mega (rơi như Đá Tiến Hóa) → thẻ `mevo` trong màn lên cấp (từ 2026-10-28 tối; xem 4.9, không còn tự kích hoạt). `Player.megaUp/clearMega`: stats Mega + thưởng cố định `BONUS` (+15% sát thương, +20% máu và hồi 25%, +8% tốc độ, +10% chí mạng), không cộng dồn, hoàn tác được.
- **Sprite**: Mega chưa có sprite riêng dùng `sheetDex` (hoàn toàn theo dạng gốc) + aura hồng (`isFallback`). Thêm sprite thật: `docs/MEGA_ASSETS.md`. Chưa có bộ tải SpriteCollab tự động.
- Co-op dùng lại sự kiện `evo` (dex ≥ 10000). Mọi chuỗi Mega **chỉ tiếng Anh** (dòng changelog đánh dấu `'en-only'`, test i18n bỏ qua).
- Ước tính cần chỉnh sau khi chơi thử: `Mega.LEVEL` 36, `BONUS`, tỉ lệ rơi đá `ENEMY_DROP`, giá `Forge.MEGA_SHARDS/MEGA_CRYSTALS`, `WEEKLY_CRYSTALS`. Sau mỗi chỉnh chạy `tests/balance.test.cjs`.

### 4.7 Materiales Mega (xong, chưa chơi thử trên giao diện)
- Spec `docs/superpowers/specs/2026-10-28-mega-materials-design.md`; plan `docs/superpowers/plans/2026-10-28-mega-materials.md`.
- 18 vật liệu, một cho mỗi hệ, trong Mochila (`save.bag`) với id `mat<hệ>` (`matfire`, `matfighting`…). **Không dùng gạch dưới**: sổ cái chỉ nhận `^b:[a-z0-9]{1,12}$`. Định nghĩa ở `js/data/mega-mats.js` (`G.MegaMats`: `TYPES, id, typeOf, name, color, dot`), nạp **trước** `data/shop.js` (shop gộp chúng vào `ITEMS` để `sanitize` không xóa; `ORDER` vẫn chỉ có Mint). Icon: chấm màu theo hệ (`MegaMats.dot`), không có sprite mới.
- **Lò → tab Mega**: ngoài Mảnh và Cristales còn cần vật liệu cùng hệ (`Forge.MEGA_MATS = { one: 5, two: 3 }`). `megaCost` trả thêm `mats`; `buyMega` kiểm tra hết rồi mới trừ (thiếu vật liệu thì không trừ gì, `reason: 'mats'`).
- **Rơi** (`systems/mega.js`, `MAT_DROP`): quái thường 0,4% (1 cái, hệ đầu của nó), boss 2–3 (hệ đầu; boss không có Pokémon thì hệ ngẫu nhiên, cùng hệ với Cristal), rương lớn 1–2 (một hệ của Pokémon). Lưu ngay (`Shop.give` trả số thực sự thêm; túi đầy 999 thì không đếm/không báo). Màn kết thúc có dòng "Mega Materials".
- **Shop Kecleon**: mục "Mega Materials" xoay theo ngày (`Shop.dailyMats()`, 5 hệ, seed `kecleon:mats:<ngày>`, luôn có hệ chính của compañero), giá `MAT_PRICE = 600`. `Shop.buy('mat:<hệ>')`; id trần (`matfire`) bị từ chối. Túi đầy 999 thì không trừ xu (cả Mint/MT).

### 4.8 Gemas y Prestigio (xong, chưa chơi thử trên giao diện)
- Spec `docs/superpowers/specs/2026-10-28-gems-prestige-design.md`; plan `docs/superpowers/plans/2026-10-28-gems-prestige.md`.
- **Gemas**: `save.gems` (≤ 1e9), khóa sổ cái `g`, icon `gem`, hiện trên thanh trên cùng và màn kết thúc. Nguồn: nhiệm vụ ngày `boss/survive/level` +1, nhiệm vụ tuần +3, thành tựu bậc 2 +1 và bậc 3 +3 (`leg_*` không), boss 1–2 (lưu ngay), quái thường 0,03%.
- **Nivel permanente** (`js/systems/prestige.js`, `G.Prestige`): `save.plv[dex gốc] = { xp, star }`, khóa theo **dạng gốc** (`rootOf` = `lineage[0]` hoặc chính dex nếu đã là dạng gốc; Mega/tiến hóa về dạng gốc, `fixPartner` gộp `plv` như `pupg`). EXP tích lũy cho cấp L = `6·(L−1)·L`; giới hạn cấp = `30 + 10·star`; tối đa 5 sao. EXP mỗi ván = `time/10 + kills/20 + bosses·15 + level` (cộng ở `endRun`, màn kết thúc hiện EXP).
- **Bonus** = `1 + 0,005·(cấp−1) + 0,10·star` cho cả sát thương và máu (Pokémon mới đúng ×1). `Prestige.apply(perks, mon)` chỉnh `atkMul` và `perks.hp` ở `startRun` (không sửa `Player`).
- **Prestigio**: đủ giới hạn cấp + `50·(star+1)` gemas → cấp 1, `xp = 0`, +1 sao, giới hạn +10. UI: `js/ui/prestige-ui.js` (`G.PrestigeUI.panel`), đặt trên cùng màn Mejoras (nút bị khóa khi thiếu gemas).

### 4.9 Evolución y Mega como carta al subir de nivel (xong)
- Trước đây `game.js: offerEvolution` chạy mỗi khung hình và tự tiến hóa. **Đã xóa** (cùng `evoOpen`, `Evo.evolveNow`, `Mega.megaNow`). Giờ `LevelUp.offer` (`levelup.js: formCards`) luôn thêm một thẻ `mevo` cho mỗi dạng đích (tối đa 5, luôn chừa ít nhất 1 thẻ thường); tiến hóa thường ưu tiên, Mega chỉ khi không còn tiến hóa thường. Chọn thẻ thì `apply` tiến hóa, tiêu đá và gọi `celebrate`; không chọn thì đá giữ và thẻ hiện lại ở lần lên cấp sau. Sprite được nạp trước khi hiện thẻ. Reroll dùng được (đã bỏ chặn `mevo` trong `run-ui.js`). Co-op: mỗi máy tự tạo thẻ của mình, nên bỏ logic giữ riêng.
- Hệ quả: đá rơi khi người chơi đang ở cấp cao thì phải chờ lần lên cấp kế.
- Test: `tests/evo-choice.test.cjs`, `tests/mega-materials.test.cjs`, `tests/prestige.test.cjs`.

### 4.10 Ping co-op (xong, commit 7305ebe, chưa chơi thử với người thật)
- `js/net/net.js`: mỗi 2 s mỗi bên gửi JSON `{k:'ping',t}` qua kênh WebRTC, bên kia trả `{k:'pong',t}`; xử lý trong `wireChannel` (không qua `deliver`, `coop.js` không thấy). API: `G.Net.ping(uid)` (ms đã làm mượt 0,7/0,3; `null` nếu chưa đo, không phải `direct` hoặc quá 8 s không có pong), `G.Net.onPing(fn)`, `G.Net.pingColor(ms)` (xanh <80, vàng <160, đỏ). Vòng ping dùng chuỗi `setTimeout` (không `setInterval`) vì `tests/net.test.cjs` chỉ giả lập `setTimeout`; dùng `setInterval` làm test treo.
- Chỉ đo host ↔ khách (topology hình sao): host thấy ping từng khách, khách chỉ thấy ping của mình tới host. Client cũ không trả lời → không có số, không lỗi.
- UI: phòng chờ (`social-ui.js`: `updateConn/pingOf`, chỉ cập nhật chữ, không dựng lại thẻ) và HUD (`hud.js: drawCoop`: host thấy ms cạnh thanh máu đồng đội, khách thấy dòng "Ping N ms"). Không có chuỗi cần dịch. Test: `tests/ping.test.cjs` (6 test); giao thức ở `docs/MULTIPLAYER_PROTOCOL.md`.

### 4.5 Khác
- Menu Kecleon: bỏ chữ "Cápsulas" ở `dev.html`. (Vẫn còn vài **comment** nhắc Cápsulas trong code — vô hại.)

## 5. Việc còn dở / ý định sau này

1. **Chơi thử thủ công** (chưa ai chơi bản này): `dev.html?dev` — Mejoras (chỉ dạng gốc), ficha dạng tiến hóa ("Evoluciona de"), Lò Tiến Hóa (mua, phân trang, lọc), banner Hoenn/Sinnoh (ghi chú Épica), màn lên cấp với 4 thẻ và các độ hiếm (viền màu, Mítica có sáng), pause (các dòng mới), tiến hóa trong ván (đá/boss/rương, co-op), màn kết thúc có dòng mảnh, thanh trên cùng 3 bộ đếm (có thể chật trên điện thoại).
2. **Tinh chỉnh số sau khi chơi thử**: mốc cấp tiến hóa `LEVELS=[12,24]` (`evolution.js`), tỉ lệ rơi đá, giá Lò `PRICE` (`forge.js`), mảnh nhận được, hệ số độ hiếm (sau mỗi lần chỉnh chạy `tests/balance.test.cjs`), `LATE` (độ khó cuối ván), tần suất thẻ chỉ số (hiện lấy ngẫu nhiên 5 thẻ chỉ số mỗi lượt trong 16 thẻ).
3. **Giai đoạn 3 — Mega: đã làm (2026-10-28), chưa chơi thử.** Xem mục 4.6. Danh sách chơi thử Mega (mở `dev.html?dev`; mẹo console: `G.DB.grant(6,'gacha')` lấy Charizard, `G.DB.save.cry={fire:20,dragon:20}`, `G.DB.save.shards=2000`):
   - Lò → tab Mega: hiện đúng giá, mua được, phân trang/lọc, báo lỗi thiếu tinh thể/mảnh.
   - Boss và rương lớn rơi tinh thể (có thông báo, lưu ngay); màn kết thúc có dòng "Mega Crystals".
   - Trong ván: cấp 36 + Đá Mega → thẻ Mega; sau khi lên: aura hồng, chỉ số tăng rõ, máu hồi 25%, không cộng dồn.
   - Nhiệm vụ tuần thưởng 2 tinh thể (hiện trong rewardText).
   - Co-op: đồng đội thấy dạng Mega (sự kiện `evo`, dex ≥ 10000).
   - Mega không xuất hiện trong gacha/Pokédex/yêu thích/đếm sở hữu.
4. **Sprite Mega thật** (có thể làm tiếp): chưa có bộ tải; phải kiểm tra cấu trúc thư mục SpriteCollab trước rồi viết `tools/fetch_mega_sprites.js`. Đường thủ công: `docs/MEGA_ASSETS.md`.
5. **Đa dạng hóa chiêu** (sau, cần brainstorm → spec → plan riêng): bậc nâng cấp riêng cho từng chiêu + hiệu ứng phụ theo hệ; **không** thêm `kind` mới, **không** cân lại các `kind`.
6. **Minor còn lại (chủ dự án quyết định không sửa)**: `Player.clearMega` chưa có nơi gọi (vô hại); client cũ xóa Mega đã mở khóa khỏi `owned` trong lúc phát hành (cửa sổ rollout ngắn).
7. Phát hành khi chủ yêu cầu: `node tools/build.js && node tools/export_data.js` + `python tools/make_seo_pages.py` (xem mục 1 về đường dẫn Python). Commit không ký AI theo CLAUDE.md. **Bản thử đã deploy 2026-10-28** (commit `d761fef`); cách deploy và revert ở mục 9.
8. **Chơi thử bản live (chưa ai làm)** ngoài danh sách Mega ở trên: Lò tab Mega có dòng vật liệu (đủ thì sáng, thiếu thì đỏ); shop mục "Mega Materials" + Mochila; mua khi túi đầy 999; màn kết thúc có dòng Materials/Gems/EXP; thanh trên cùng có icon gem; Mejoras có panel Prestige (nhấn Prestige khi đủ gemas); lên cấp có thẻ tiến hóa/Mega, bỏ qua thẻ rồi lên cấp tiếp, reroll, co-op.
9. **Tinh chỉnh số (đều là ước tính)**: `Forge.MEGA_MATS`, `Mega.MAT_DROP`, `Shop.MAT_PRICE`/`DAILY_MATS`, `Prestige` (`XP_K`, `LV_BASE/LV_STEP/MAX_STAR`, `LV_BONUS/STAR_BONUS`, `GEMS_BASE`, `GEM_DROP`), gemas trong `missions.js`/`achievements.js`.
10. **Minor còn lại (đã biết, chưa sửa)**: HP bonus của Prestige lệch nhẹ khi tiến hóa giữa ván (`Player.evolve` giữ `hpDiff` tuyệt đối); `commit('run')` gọi tới 4 lần khi diệt boss; chữ nổi khi nhặt đá chưa nói "chọn ở lần lên cấp tới"; hai thiết bị offline có thể cùng tiêu một vật liệu/gemas cho hai thứ khác nhau (bản chất của sổ cái, giống Cristales).
11. **Thứ tự đề xuất cho phiên sau**: (1) chủ dự án chơi thử, báo số cần chỉnh → (2) chỉnh số + chạy `tests/balance.test.cjs`, `tests/difficulty.test.cjs` → (3) commit/phát hành nếu chủ yêu cầu → (4) sprite Mega hoặc đa dạng hóa chiêu.

## 6. Quyết định (rulings) và điểm chấp nhận

- Mảnh/đá cấp thẳng cho người chơi cục bộ (không vật phẩm rơi) vì co-op chỉ host tạo vật phẩm.
- Đá chỉ rơi khi có dạng đích đã sở hữu; mảnh thì luôn rơi.
- Mảnh lưu ngay khi rơi (như vé), không chờ cuối ván.
- Event mạng tên `evo` (không phải `ev`).
- Dùng Node thay Python cho `fetch_evolutions.js`.
- Mítica có hai kiểu; thẻ Común yếu hơn trước (bù bằng thẻ thứ 4 và độ hiếm), tổng hệ mới ≈ +17% ở cấp 30, bù bằng độ khó cuối ván.
- Chấp nhận (reviewer nêu, không sửa): tab chạy phiên bản cũ ghi đè save có thể nhân đôi mảnh (chỉ khi hai phiên bản chạy song song sau khi phát hành); người ngã trong co-op không nhận mảnh từ boss nhưng vẫn nhận từ rương; mua Lò làm đủ Pokédex một thế hệ không có thông báo Amuleto Iris riêng; sprite đồng đội đã ngã có thể hiện Idle trong vài giây sau khi tiến hóa; baby (Pikachu, Clefairy, Jigglypuff, Marill, Roselia, Chansey…) cần cấp 24 cho lần tiến hóa đầu; dạng khu vực (Meowth→Perrserker, Scyther→Kleavor) tính như tiến hóa thường; cân bằng passive Reshiram là điểm lệch.
- Mốc `LEVELS`, giá, mảnh, độ hiếm, `LATE` đều là **ước tính**.
- **Rủi ro phiên bản lẫn lộn (chủ dự án chấp nhận 2026-10-28, vì game ít người)**: client cũ còn chạy giữa ván có thể tải save lên và `sanitize` cũ xóa `matfire`… khỏi Mochila, ghi nhận là đã tiêu → vật liệu về 0 vĩnh viễn trên mọi thiết bị. Gemas/`plv` hồi phục phần lớn. Đã đề xuất bật `MAINTENANCE` hai lượt hoặc lưu vật liệu ngoài `save.bag`; chủ dự án chọn **không làm**. Nếu có người báo mất vật liệu ngay sau bản này, đây là nguyên nhân.
- Bonus Prestige dùng `cấp − 1` (spec ghi "mỗi cấp"): Pokémon mới đúng ×1 thay vì tặng +0,5% ở Lv1.
- `Shop.buy` từ chối id vật liệu trần (`matfire`) vì `ITEMS` đã chứa chúng và sẽ lách kiểm tra "bán hôm nay".
- Spec/plan của lượt này nằm ở `docs/superpowers/` như các lượt trước (theo quy ước repo).

## 7. Bản đồ file đã tạo/sửa chính

Mới: `js/data/passive-fx.js`, `passives.js` (sinh), `evolutions.js` (sinh), `js/systems/evolution.js`, `js/systems/forge.js`, `js/ui/forge-ui.js`, `tools/gen_passives.js`, `tools/passive_design.json`, `tools/fetch_evolutions.js`, `tests/{passives,evolution,forge,stats,balance,difficulty}.test.cjs`, `tests/helpers/balance-sim.cjs`, specs/plans trong `docs/superpowers/`.
Mới (28-10 tối): `js/data/mega-mats.js`, `js/systems/prestige.js`, `js/ui/prestige-ui.js`, `tests/{evo-choice,mega-materials,prestige}.test.cjs`. Cũng sửa: `js/systems/{levelup,mega,evolution,forge}.js`, `js/data/shop.js`, `js/ui/{forge-ui,shop-ui,run-ui,menu}.js`, `js/core/db.js` (khóa `g`, `plv`).
Sửa: `js/core/db.js` (sổ cái `sh`, `fixPartner`, `sanitize`), `js/entities/player.js`, `js/game.js`, `js/systems/{levelup,combat,gacha,mons,progress}.js`, `js/data/{enemies,missions,achievements,shop,ability-fx,changelog,lang-en,lang-updates}.js`, `js/ui/{menu,run-ui,gacha-ui,ui,icons,shop-ui}.js`, `js/net/coop.js`, `js/main.js`, `dev.html`, `css/style.css`, `docs/MULTIPLAYER_PROTOCOL.md`.

## 8. Quy trình đã dùng

Brainstorm → spec (`docs/superpowers/specs`) → plan (`docs/superpowers/plans`) → thực thi "native" (tự làm từng task, test viết trước) → reviewer độc lập một lần ở cuối → một đợt sửa lỗi. Việc nhỏ trong luồng có sẵn: trình bày thiết kế ngắn, chờ đồng ý rồi làm. Giao tiếp với chủ dự án bằng tiếng Việt.

## 9. Deploy bản thử lên GitHub Pages và revert

- Remote `origin` = `huyhuy175/pokesurvivor-main` (fork, `main` ở bản cũ `5d499d2`). Remote **`test`** = `huyhuy175/pokesurvivor-test` là nơi chạy GitHub Pages bản thử (`https://huyhuy175.github.io/pokesurvivor-test/`, Firebase riêng `pokemoon-survi`). Nhánh làm việc `test-deploy` được đẩy lên **`main` của remote `test`**.
- Quy trình đã dùng: test xanh → `node tools/build.js && node tools/export_data.js` + `make_seo_pages.py` → commit (không ký AI) → `git push test test-deploy:main` (fast-forward, không force) → kiểm tra `.../version.json` trả về mã mới (mất ~1 phút).
- **Khác biệt của `test-deploy` so với `main`** (đừng gộp bừa): xóa `CNAME` (không tranh `pokesurvivor.com`), xóa `.github/` (token `gh` thiếu scope `workflow`, push bị từ chối), `js/core/firebase-config.js` + `.firebaserc` trỏ `pokemoon-survi`, `HOSTS` trong `js/core/db.js` có thêm `huyhuy175.github.io` (không có thì game ở host lạ chỉ chạy local, không đăng nhập/co-op), build dùng `--sin-seo`. Rules Firestore/RTDB đã đẩy bằng `npx firebase-tools deploy --only firestore,database --project pokemoon-survi`. Cần `huyhuy175.github.io` trong Firebase Authentication → Authorized domains. `gh` CLI đã cài (`C:\Program Files\GitHub CLI`, có thể phải mở terminal mới để có trong PATH) và đã đăng nhập tài khoản `huyhuy175`.
- **Co-op có thể không nối được**: chỉ có STUN của Google; `net.js` vẫn gọi `ice.pokesurvivor.com` (TURN đã gỡ) nên bỏ qua. Mạng 4G/CGNAT có thể thất bại (lỗi kết nối, không phải lag). Hướng nếu xảy ra: thêm TURN miễn phí vào `iceServers` (chưa làm; cần chủ dự án đồng ý vì CLAUDE.md cấm thêm thứ trả phí).
- **Bản thử đã chạy** (2026-10-28) gồm Mega + ping + bản chỉ tiếng Anh + Materials/Gems/Prestige; chưa ai chơi thử ping và Mega với 2 người thật.
- **Sao lưu**: tag `backup-before-mega-gems` (annotated) trỏ vào `15d5628`, bản chạy trước đợt này; có trên máy và trên remote `test`.
- **Revert**: `git revert d761fef && git push test test-deploy:main` (giữ lịch sử). Nhanh hơn nhưng ghi đè: `git push --force test backup-before-mega-gems:main`.
- Revert code **không** hoàn tác dữ liệu trên Firebase `pokemoon-survi`: save đã có `gems`, `plv`, vật liệu trong `bag`; bản cũ sẽ xóa vật liệu khi `sanitize`. Muốn bản dữ liệu để khôi phục thì xuất Firestore ở Firebase console trước (Claude không làm được).
