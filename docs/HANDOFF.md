# HANDOFF — trạng thái công việc PokéSurvivor (cập nhật 2026-10-28)

> File này để lần sau bạn bảo Claude: "đọc `docs/HANDOFF.md` và làm tiếp". Nó tóm tắt mọi thứ đã làm, các quyết định, việc còn dở và cách làm việc trong repo. Đọc thêm `CLAUDE.md` (luật cố định của dự án).

## 1. Luật làm việc (từ CLAUDE.md và thực tế phiên này)

- Sửa **`dev.html`**, không bao giờ sửa file sinh ra: `index.html`, `js/app.min.js`, `js/lang/`, `version.json`. Hiện các file này **là bản cũ** (chưa chứa tính năng mới).
- Không commit/push trừ khi chủ dự án yêu cầu. Thư mục là git repo (nhánh `main`). Commit (nếu có) không ghi "Co-Authored-By" hay chữ ký AI (theo CLAUDE.md).
- Không bật Firebase Identity Platform, không thêm gì tính phí (Cloudflare Worker/TURN đã bỏ).
- Chuỗi giao diện mới: tiếng Tây Ban Nha trong code; tiếng Anh vào `js/data/lang-en.js`; fr/it/pt-BR/zh-Hans/zh-Hant thêm thành **hàng** trong `js/data/lang-updates.js` (mảng `rows`, thứ tự `[es, fr, it, pt-BR, zh-Hans, zh-Hant]`). Chuỗi có số dùng `{x}` và `G.I18n.f(es, ...vals)`. `node tools/build_langs.js --faltan --todo` chỉ so các khóa đã có, **không** phát hiện chuỗi mới trong code: tự kiểm tra bằng grep.
- Changelog: `js/data/changelog.js`, es + en, mục `new`/`chg`/`fix` của ngày hiện tại. Hiện có mục `2026-10-27` (passive, tiến hóa, pause) và `2026-10-28` (Lò Tiến Hóa, thẻ mới/độ hiếm, độ khó…). Không ghi thay đổi server/DB/chi phí.
- Thêm file JS mới: đưa vào khối `<!-- scripts:begin/end -->` của `dev.html` đúng thứ tự tải; nếu bắt buộc thì thêm vào `NEED` ở `js/main.js` (đã có `'PassiveFX','Evo','Forge'`).
- `build.js` cần `util.js` chứa đúng `window.G = window.G || {};`.
- Phát hành (chỉ khi chủ yêu cầu): `node tools/build.js && node tools/export_data.js && python tools/make_seo_pages.py` (máy này **không có Python**; bước SEO bỏ qua hoặc làm ở máy khác).

## 2. Cách chạy và kiểm tra

- Chơi/gỡ lỗi: mở `dev.html` (thêm `?dev` để vào khi bảo trì). Thử nhanh: `G.DB.grant(4,'gacha')` (có Charmander), `G.DB.save.shards=200`, `G.Game.debugLevelUp()`.
- Test: `node --test tests/*.cjs` (Node 24 cần glob, không dùng `tests/`). Hiện **179/179 pass**. Một file: `node --test tests/forge.test.cjs`.
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
- **Trong ván** (`js/systems/mega.js`, `G.Mega`): cấp **36** + Đá Mega (rơi như Đá Tiến Hóa) → thẻ `mevo` (`game.js: offerEvolution` xử lý Evo hoặc Mega). `Player.megaUp/clearMega`: stats Mega + thưởng cố định `BONUS` (+15% sát thương, +20% máu và hồi 25%, +8% tốc độ, +10% chí mạng), không cộng dồn, hoàn tác được.
- **Sprite**: Mega chưa có sprite riêng dùng `sheetDex` (hoàn toàn theo dạng gốc) + aura hồng (`isFallback`). Thêm sprite thật: `docs/MEGA_ASSETS.md`. Chưa có bộ tải SpriteCollab tự động.
- Co-op dùng lại sự kiện `evo` (dex ≥ 10000). Mọi chuỗi Mega **chỉ tiếng Anh** (dòng changelog đánh dấu `'en-only'`, test i18n bỏ qua).
- Ước tính cần chỉnh sau khi chơi thử: `Mega.LEVEL` 36, `BONUS`, tỉ lệ rơi đá `ENEMY_DROP`, giá `Forge.MEGA_SHARDS/MEGA_CRYSTALS`, `WEEKLY_CRYSTALS`. Sau mỗi chỉnh chạy `tests/balance.test.cjs`.

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
7. Phát hành khi chủ yêu cầu: `node tools/build.js && node tools/export_data.js` + `python tools/make_seo_pages.py` (máy này không có Python → làm bước SEO ở máy khác). Hiện ~35 file Mega chưa commit (chưa ai yêu cầu commit). Commit không ký AI theo CLAUDE.md.
8. **Thứ tự đề xuất cho phiên sau**: (1) chủ dự án chơi thử, báo số cần chỉnh → (2) chỉnh số + chạy `tests/balance.test.cjs`, `tests/difficulty.test.cjs` → (3) commit/phát hành nếu chủ yêu cầu → (4) sprite Mega hoặc đa dạng hóa chiêu.

## 6. Quyết định (rulings) và điểm chấp nhận

- Mảnh/đá cấp thẳng cho người chơi cục bộ (không vật phẩm rơi) vì co-op chỉ host tạo vật phẩm.
- Đá chỉ rơi khi có dạng đích đã sở hữu; mảnh thì luôn rơi.
- Mảnh lưu ngay khi rơi (như vé), không chờ cuối ván.
- Event mạng tên `evo` (không phải `ev`).
- Dùng Node thay Python cho `fetch_evolutions.js`.
- Mítica có hai kiểu; thẻ Común yếu hơn trước (bù bằng thẻ thứ 4 và độ hiếm), tổng hệ mới ≈ +17% ở cấp 30, bù bằng độ khó cuối ván.
- Chấp nhận (reviewer nêu, không sửa): tab chạy phiên bản cũ ghi đè save có thể nhân đôi mảnh (chỉ khi hai phiên bản chạy song song sau khi phát hành); người ngã trong co-op không nhận mảnh từ boss nhưng vẫn nhận từ rương; mua Lò làm đủ Pokédex một thế hệ không có thông báo Amuleto Iris riêng; sprite đồng đội đã ngã có thể hiện Idle trong vài giây sau khi tiến hóa; baby (Pikachu, Clefairy, Jigglypuff, Marill, Roselia, Chansey…) cần cấp 24 cho lần tiến hóa đầu; dạng khu vực (Meowth→Perrserker, Scyther→Kleavor) tính như tiến hóa thường; cân bằng passive Reshiram là điểm lệch.
- Mốc `LEVELS`, giá, mảnh, độ hiếm, `LATE` đều là **ước tính**.

## 7. Bản đồ file đã tạo/sửa chính

Mới: `js/data/passive-fx.js`, `passives.js` (sinh), `evolutions.js` (sinh), `js/systems/evolution.js`, `js/systems/forge.js`, `js/ui/forge-ui.js`, `tools/gen_passives.js`, `tools/passive_design.json`, `tools/fetch_evolutions.js`, `tests/{passives,evolution,forge,stats,balance,difficulty}.test.cjs`, `tests/helpers/balance-sim.cjs`, specs/plans trong `docs/superpowers/`.
Sửa: `js/core/db.js` (sổ cái `sh`, `fixPartner`, `sanitize`), `js/entities/player.js`, `js/game.js`, `js/systems/{levelup,combat,gacha,mons,progress}.js`, `js/data/{enemies,missions,achievements,shop,ability-fx,changelog,lang-en,lang-updates}.js`, `js/ui/{menu,run-ui,gacha-ui,ui,icons,shop-ui}.js`, `js/net/coop.js`, `js/main.js`, `dev.html`, `css/style.css`, `docs/MULTIPLAYER_PROTOCOL.md`.

## 8. Quy trình đã dùng

Brainstorm → spec (`docs/superpowers/specs`) → plan (`docs/superpowers/plans`) → thực thi "native" (tự làm từng task, test viết trước) → reviewer độc lập một lần ở cuối → một đợt sửa lỗi. Việc nhỏ trong luồng có sẵn: trình bày thiết kế ngắn, chờ đồng ý rồi làm. Giao tiếp với chủ dự án bằng tiếng Việt.
