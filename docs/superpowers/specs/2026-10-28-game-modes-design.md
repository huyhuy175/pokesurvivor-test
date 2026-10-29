# Chế độ chơi mới: Wave, Boss Rush, Hardcore — thiết kế

Ngày 2026-10-28. Trạng thái: chờ chủ dự án duyệt. Chưa có plan, chưa có code.

## 1. Mục tiêu và phạm vi

Thêm ba chế độ ngoài ván Thường để tăng lý do chơi lại:

- **Wave**: các đợt cố định, vô hạn, nghỉ giữa đợt, mỗi đợt có nhiệm vụ nhận thưởng.
- **Boss Rush**: chuỗi boss liên tiếp, không có quái thường.
- **Hardcore**: lớp phủ khó hơn, bật được cho cả Thường, Wave và Boss Rush (6 biến thể).

Đã chốt với chủ dự án:

- Solo **và** co-op ngay từ bản đầu.
- Thưởng dùng lại kinh tế sẵn có (xu, Mảnh Tiến Hóa, Gemas, vật liệu Mega, EXP Prestige), không thêm tiền tệ mới.
- Không xếp hạng online cho chế độ mới (không đụng server, luật Firestore, ranking). Chỉ kỷ lục trên máy.
- Chuỗi giao diện mới **chỉ tiếng Anh**, viết thẳng (như Mega và Apex). Changelog đánh dấu `'en-only'`.
- Không thêm thứ gì tính phí, không đổi `index.html`, `js/app.min.js`, `version.json` (do build sinh).

Ngoài phạm vi (làm sau nếu muốn): Pokémon giải cứu thành đồng đội chiến đấu thật; xếp hạng online; thời gian hoàn thành nhanh nhất của Boss Rush; tiền tệ hay huy hiệu riêng của từng chế độ.

## 2. Kiến trúc: registry `G.Modes`

File mới `js/systems/modes.js`, nạp **sau `spawner.js`**, thêm vào khối `<!-- scripts:begin/end -->` của `dev.html` và vào `NEED` ở `js/main.js`. Cấu hình chạy là `G.Modes.cfg = { type, hc }`, đặt ở `startRun`, xóa ở `endRun`.

Mỗi loại (`normal`, `wave`, `bossrush`) là một đối tượng có các hook tùy chọn:

| Hook | Việc |
|---|---|
| `begin(cfg, players)` / `end()` | khởi tạo và dọn trạng thái của chế độ |
| `spawn(dt, players, t)` | thay hoàn toàn nhánh goteo/marea/boss của `Spawner.update` |
| `onKill(e)`, `onTick(dt)` | theo dõi tiến độ đợt hoặc chặng |
| `result()` | `{ won, label }` cho màn kết thúc |
| `rewardMul()` | hệ số thưởng của chế độ |
| `hud()` | chuỗi một dòng cho HUD |

`normal` có **mọi hook rỗng**, nên ván Thường chạy như hiện nay. Đây là điều kiện chấp nhận của bước 1 (có test).

`G.Modes.HARDCORE` là modifier tách riêng (mục 5). Hệ số quái nhân tại **một** chỗ: `Modes.scaleEnemy(sc)`, mà `Spawner.spawnOne` và `Spawner.spawnBoss` (và các spawn của chế độ) gọi.

### Điểm móc vào code có sẵn

1. `game.js startRun(coop)`: nhận `cfg.mode` (solo lấy từ menu, co-op lấy từ gói `start`), gọi `Modes.begin`.
2. `Spawner.update`: đầu hàm, nếu `Modes.current.spawn` có thì dùng nó và thoát.
3. Vòng lặp `game.js` (khoảng dòng 718-753): `Rift.update`, `Judgment.update`, `Events.update` không chạy trong Wave và Boss Rush. `Judgment.AT = 1800 s` không áp dụng.
4. `endRun`: truyền `modeResult` vào `showOver`; thưởng nhân `Mode.rewardMul × hc.rewardK`; chặn `Ranking.runStarted/submitSolo/submitGroup` khi chế độ khác Thường.
5. `run-ui.js rerollsLeft()`, `Player` (hồi máu), `reviveTick` (co-op), `ab.revive` (player.js:511): cờ Hardcore.

## 3. Wave

File `js/systems/modes-wave.js`. Ván **vô hạn**; chỉ kết thúc khi chết; điểm là số đợt đạt được.

### 3.1 Nhịp đợt

Mỗi đợt `n` (từ 1) có 3 pha:

1. **intro** (2 s): banner "Wave N" và tên nhiệm vụ. Không spawn.
2. **fight**: spawn theo hạn ngạch. Đợt xong khi đã spawn đủ và không còn quái sống.
3. **rest** (8 s): hút mọi vật rơi (đá, tinh thể, XP) về người chơi; phát thưởng nhiệm vụ; hồi 25% máu nếu hoàn thành nhiệm vụ.

Thẻ lên cấp hiện **ngay lúc đủ XP** như ván Thường (cơ chế `pendingLevels` hiện có), không chờ cuối đợt.

### 3.2 Độ khó

- Hạn ngạch: `quota(n) = round(10 + 4·n^1.1)`, trần khoảng 160 quái mỗi đợt, nhân `Coop.scaleRate` theo số người. Sau trần, đợt khó hơn nhờ **tỉ lệ elite** tăng, không tăng số lượng.
- Quái: `Enemies.bagAt(t)` và `Enemies.scale(t)` với **thời gian ảo `t = n · 90 s`**. `LATE` dừng ở phút 40 (đợt 27), nên từ đợt 28 Wave thêm hệ số riêng `+6% máu`, `+4% sát thương` mỗi đợt.
- Spawn theo cụm nhỏ (như `Spawner.burst`) trong khi `EnemyMgr.count < CAP` (64).
- **Boss mỗi 5 đợt**: `k = n / 5`. Nếu `k` chia hết cho 5, boss là legendary Apex (`Rift.apexDef`, `power` tăng theo `k`, chiêu đặc trưng của `ApexMoves`); ngược lại là `Enemies.BOSSES[(k % 5) − 1]` (4 boss đầu), chỉ số qua `bossScale(n·90)` cộng hệ số sau đợt 27. Boss trong Wave đứng ngoài đồng trống như `spawnBoss`.

### 3.3 Nhiệm vụ mỗi đợt

Một nhiệm vụ mỗi đợt, tùy chọn, chọn bằng `hash(seed, n)` nên mọi máy trong co-op thấy giống nhau. Hoàn thành cho thưởng; thất bại chỉ mất thưởng. Qua đợt không phụ thuộc nhiệm vụ.

*Nhóm số liệu (chỉ cần dữ liệu của host):*
- Hạ N quái thuộc một hệ.
- Xong đợt trong T giây.
- Hạ N quái elite.
- Giữ số quái cùng lúc dưới ngưỡng X.
- Hạ boss trước giờ (đợt có boss).

*Nhóm bản đồ (bước 6, cần thực thể trong thế giới):*
- **Giải cứu**: một Pokémon bị nhốt cách người chơi 500-700 px, vài quái canh. Đứng cạnh khoảng 3 s (như `bigchest`, tiến độ giảm khi bước ra) để thả. Thưởng thêm: nó đi theo và hiện hiệu ứng vài chục giây, **không** chiến đấu.
- **Dẫn đường**: dùng lại sự kiện `lost` của `events.js` (chạm, đi theo, dẫn tới điểm đánh dấu, quái làm nó mất máu). `Events` cần cho phép Wave gọi với điểm đích đặt sẵn và hạn 90 s.
- **Thắp sáng**: 3-5 đèn rải quanh; đứng cạnh mỗi cái khoảng 2,5 s để thắp; phải thắp đủ trước khi hết đợt.
- Thêm loại mới về sau chỉ là thêm một mục trong bảng nhiệm vụ.

### 3.4 Thưởng nhiệm vụ

Ước tính, nằm trong một bảng để chỉnh: xu `40 + 8n`, Mảnh Tiến Hóa 1-3 (nhiệm vụ khó nhiều hơn), Gemas 0-1, thỉnh thoảng 1 vật liệu Mega, hồi 25% máu. Lưu ngay bằng đúng hàm đang dùng cho boss.

### 3.5 Kết thúc và kỷ lục

Chết là thua. `bestWave` (hoặc `bestWaveHc`) cập nhật khi `n` đạt được lớn hơn.

## 4. Boss Rush

File `js/systems/modes-bossrush.js`. Hữu hạn, 10 chặng, thắng khi hạ chặng 10.

### 4.1 Chuỗi

- Chặng 1-5: `Enemies.BOSSES[0..4]`, chỉ số `bossScale(b.at)` của chính khe.
- Chặng 6-9: legendary Apex (`Rift.apexDef`, chiêu đặc trưng), `power` tăng dần.
- Chặng 10: Apex cuối, **luôn ở trạng thái furia** (echo bật), máu cao hơn.

### 4.2 Nhịp

1. Bắt đầu bằng **3 lượt chọn thẻ liên tiếp** (draft), vì không có quái thường để tự lên cấp.
2. Mỗi chặng: banner tên boss, boss xuất hiện, đánh. Boss chết thì nghỉ 10 s, hút vật rơi, rồi chặng sau. XP từ boss cho lên cấp giữa chừng.
3. Không Judgment, Rift, Events, quái thường.

### 4.3 Arena cho cả ván

`ApexMoves` được viết và kiểm thử sao cho vùng nguy hiểm nằm trong arena (`Rift.arenaInfo()` ≈ 307 px). Vì vậy **toàn bộ Boss Rush diễn ra trong một arena cố định** dựng bằng hạ tầng arena của rift (`Rift.inArena`, `Spawner` đã tự dừng khi `inArena`).

Cần xác minh trong plan (bước 3): đọc `rift.js` để biết có dựng arena ngay lúc bắt đầu ván, không qua cổng, và co-op đồng bộ cấu hình `arena` ra sao. Nếu không dựng được, phương án lai (đồng trống cho chặng 1-5, arena cho chặng Apex) nặng hơn và được xét lại ở bước đó.

### 4.4 Thưởng và kỷ lục

Mỗi boss rơi thưởng như boss ván Thường (Mảnh, tinh thể Mega, Gemas, vật liệu). Hoàn thành 10 chặng thưởng thêm một lần: Gemas, Mảnh Tiến Hóa, một vật liệu Mega. `bestStage`, `rushClears` (và bản `Hc`).

## 5. Hardcore (lớp phủ)

`G.Modes.HARDCORE`, mọi hằng số là **ước tính** để chỉnh sau khi chơi thử:

| Hạng mục | Giá trị |
|---|---|
| Máu quái và boss | ×1,5 |
| Sát thương quái và boss | ×1,4 |
| Mật độ spawn (Thường) / hạn ngạch đợt (Wave) | ×1,25 |
| Tốc độ quái | ×1,1 |
| Thưởng xu và EXP Prestige (`rewardK`) | ×1,75 |
| Xác suất rơi Mảnh, Gemas, vật liệu | ×1,5 |

Luật khắt khe:

1. **Không reroll**: `rerollsLeft()` trả 0, nút ẩn.
2. **Hồi máu −50%** qua `healMul`, áp lên regen (player.js:618), vật nhặt hồi máu, manantial (interact.js) và hút máu. Cần xác minh trong plan mỗi nguồn có đi qua `Player.heal`/`healMul` không; chỗ nào không đi qua thì sửa riêng.
3. **Không hồi sinh**: đồng đội không cứu được người ngã (`reviveTick`), `ab.revive` bị vô hiệu. Solo không đổi gì (chết là hết ván).

Hiển thị: huy hiệu đỏ "HARDCORE" ở HUD, màn tạm dừng, màn kết thúc (kèm hệ số thưởng đã áp). `clean()` trong `endRun` không đổi.

## 6. Lưu trữ, thưởng, menu

### 6.1 Kỷ lục

Khóa số phẳng mới trong `save.stats` (khai báo ở db.js:108): `bestWave`, `bestWaveHc`, `bestStage`, `bestStageHc`, `rushClears`, `rushClearsHc`. Gộp save bằng max (db.js:490) là đúng cho cả sáu. Save cũ tự nhận giá trị mặc định (db.js:117). Plan phải kiểm `sanitize` có chặn khóa lạ hay trần số không.

### 6.2 Thưởng

Công thức xu giữ nguyên (`time/5 + kills·0,25 + bosses·80 + coins`) nhân `Mode.rewardMul × hc.rewardK`. Wave và Boss Rush có `rewardMul = 1`; thưởng thật đến từ nhiệm vụ và boss rơi. `Prestige.grantXp` nhận cùng hệ số.

### 6.3 Nhiệm vụ ngày/tuần và thành tựu

Sự kiện `runEnd` mang thêm trường `mode`. Nhiệm vụ về **thời gian sống sót** và thành tựu Sentencia/Arceus chỉ tính ở ván Thường; "hạ boss" và "đạt cấp" tính ở mọi chế độ.

### 6.4 Ranking online

Chế độ khác Thường **không** gọi `Ranking.runStarted/submitSolo/submitGroup`.

### 6.5 Menu

- Nút "Jugar" (`data-go="play"`, menu.js:19) **giữ nguyên**, vẫn là ván Thường.
- Thêm mục menu **"Modes"** mở bảng 4 thẻ: Normal, Wave, Boss Rush, cùng công tắc Hardcore. Mỗi thẻ có mô tả ngắn và kỷ lục. Bấm thẻ thì bắt đầu ván solo.
- Trong phòng co-op, host thấy bộ chọn cùng loại ở `LobbyUI` (hàng phía trên nút bắt đầu). `start()` (social-ui.js:273) thêm `mode:{type,hc}` vào `cfg`. **Khách biết chế độ khi ván bắt đầu** (banner đầu ván); lobby của khách có ghi chú "The host picks the mode". Lý do: danh sách phòng nằm trong Firebase, và thêm trường vào phòng là đổi cấu trúc server/luật, ngoài ràng buộc của dự án.

### 6.6 Chống nhiễm dữ liệu từ chế độ mới

- `endRun` **không** cập nhật `stats.bestTime` và `stats.bestGroupTime` khi chế độ khác Thường (hai số này nuôi nhiệm vụ, thành tựu và ranking của ván Thường).
- `Progress.event('runEnd')` gửi `time: 0` khi chế độ khác Thường, nên nhiệm vụ "aguanta N minutos" không tăng; `level` và `coins` vẫn tính.
- `Progress.kill` hiện coi mọi boss hạ trong arena là legendary đã vượt (`s.legends`, thành tựu `leg_*`). Khi chế độ khác Thường, truyền `legend: 0` (boss vẫn tính cho nhiệm vụ "hạ boss").

## 7. Co-op

- Cấu hình `start` mang `mode:{type,hc}`; mỗi máy gọi `Modes.begin` với cùng giá trị.
- Host chạy `spawn` và theo dõi tiến độ (host biết vị trí và trạng thái mọi người chơi).
- **Một sự kiện mạng mới chung `['md', ...]`** cho trạng thái chế độ: loại, pha, `n` (đợt hoặc chặng), nhiệm vụ, tiến độ, mặt nạ bit (đèn đã thắp, v.v.). Wave và Boss Rush dùng chung. Khách chỉ vẽ theo trạng thái nhận được.
- `js/net/codec.js` mã hóa mọi giá trị kiểu JSON nên **không cần sửa**; chỉ thêm `case 'md'` vào bộ xử lý sự kiện của `coop.js`, ghi `docs/MULTIPLAYER_PROTOCOL.md`, và test trong `tests/net.test.cjs`. Boss Rush dùng cờ `rush: true` trong cấu hình `arena` sẵn có để các máy khách dựng đúng arena (không thêm gói tin).
- Dữ liệu chung chỉ ở phạm vi ván: `md` không bao giờ ghi vào save.
- Thưởng nhiệm vụ: mỗi máy tự nhận cho mình khi nhận `md` báo hoàn thành (cùng nguyên tắc vé wish: không cần vật phẩm rơi chung).
- Hardcore: host áp hệ số quái; luật người chơi mỗi máy tự áp cho mình.

## 8. Kiểm thử

Runner Node (`node --test tests/*.test.cjs`). Mới:

- `tests/modes.test.cjs`: registry; `normal` có hook rỗng; `begin/end` dọn sạch.
- `tests/hardcore.test.cjs`: `scaleEnemy`; reroll bằng 0; hồi máu −50% ở mọi nguồn; không hồi sinh.
- `tests/wave.test.cjs`: máy trạng thái 3 pha; `quota(n)` và trần; thời gian ảo; hệ số sau đợt 27; nhiệm vụ chọn giống nhau từ cùng seed; chu kỳ boss.
- `tests/bossrush.test.cjs`: chuỗi 10 chặng; kết thúc đúng.
- `tests/net.test.cjs`: `md` mã hóa/giải mã; `start` có `mode`.
- Chạy lại toàn bộ 348 test hiện có. Wave đối chiếu `tests/helpers/balance-sim.cjs` và `tests/difficulty.test.cjs`.
- Lệnh gỡ lỗi: `G.Modes.debug('wave', true)`, `G.Modes.debugWave(25)`, `G.Modes.debug('bossrush')`.

## 9. Thứ tự làm

Mỗi bước có test và đưa lên bản thử riêng được:

1. Lõi `G.Modes` + Hardcore (Thường chạy y như cũ).
2. Menu "Modes" + kỷ lục + thưởng + chặn ranking + loại nhiệm vụ "sống sót".
3. Boss Rush solo.
4. Wave solo (nhiệm vụ nhóm số liệu).
5. Co-op: sự kiện `md`, bộ chọn ở `LobbyUI`, `mode` trong `start`.
6. Nhiệm vụ bản đồ của Wave (giải cứu, dẫn đường, thắp sáng).

## 10. Rủi ro đã biết

- Dựng arena ngay từ đầu ván cho Boss Rush chưa xác nhận (bước 3).
- Chưa kiểm mọi nguồn hồi máu có đi qua `healMul` (bước 1).
- Wave vô hạn có thể chạm trần hiệu năng ở đợt cao; đã có trần số quái và cần đo FPS.
- Nhiệm vụ "hạ boss" ở Boss Rush có thể hoàn thành rất nhanh (xem 6.3).
- Chưa ai chơi thử; mọi hằng số (hệ số Hardcore, `quota`, hệ số sau đợt 27, bảng thưởng) là ước tính, gom thành các bảng hằng số để chỉnh và chạy lại test cân bằng.
- Không commit tự động: theo `CLAUDE.md`, chỉ commit khi chủ dự án yêu cầu.

## 11. Tệp dự kiến

Mới: `js/systems/modes.js`, `modes-wave.js`, `modes-bossrush.js`, `js/ui/modes-ui.js`, `tests/{modes,hardcore,wave,bossrush}.test.cjs`.
Sửa: `dev.html`, `js/main.js` (`NEED`), `js/game.js`, `js/systems/{spawner,events,rift}.js`, `js/entities/player.js`, `js/ui/{menu,run-ui,hud,social-ui}.js`, `js/net/{coop,codec}.js`, `js/core/db.js`, `js/data/changelog.js`, `docs/MULTIPLAYER_PROTOCOL.md`, `docs/HANDOFF.md`, `tests/net.test.cjs`.
