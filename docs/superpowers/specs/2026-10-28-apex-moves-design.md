# Chiêu mới cho Apex — thiết kế

Ngày: 2026-10-28 · Trạng thái: chờ chủ dự án duyệt spec

## Mục tiêu
Apex (boss legendary của rift đặc biệt phút 25) hiện chỉ là legendary thường nhân chỉ số (`Rift.APEX = { hp: 6, dmg: 1.8, spd: 1.2, shots: 1.5 }`). Làm cho Apex **khác hẳn về cách chơi**: mỗi Apex có một chiêu đặc trưng theo hệ của nó, và khi xuống dưới 50% máu nó "quá tải" (Overdrive).

Độ khó (chủ dự án chọn 2026-10-28): **chỉ thắng được khi đã nâng Rank/Prestige cao**; build mới gần như không hạ được, build Rank cao + kỹ năng thì hạ được. Vì vậy chiêu nặng về **né tránh**, không one-shot.

Không đổi: chỉ số `APEX`, phần thưởng (vé wish), `ARENA_TIME` (120 s), luật thua/thắng, sprite, gói tin co-op (`codec.js`), hành vi của legendary thường.

## Phạm vi
Trong phạm vi: 18 chiêu đặc trưng (một hệ một chiêu), các phép dựng dùng chung, cơ chế Overdrive, test, trang xem thử, changelog.
Ngoài phạm vi: sprite mới; đổi phần thưởng; giai đoạn thứ hai của boss (đổi hình/arena); cân lại `APEX`.

## Hiện trạng (đã đọc code)
- Boss legendary có 4 đòn (`enemy.js: bossInit/bossMove/bossStart/bossCast/bossEnd`): `slam` + (`dash` hoặc `leap`) và hai đòn tầm xa lấy từ `rain | beam | nova | volley` theo hệ. Dưới 50% máu: `enrage()` (tốc độ ×1,15, chờ ngắn hơn, đôi khi nối đòn; `ai.fury`).
- `bossStart(id, pl)` đặt `ai.cast = { id, t, wind, after, ang }`; `bossCast` bắn/ra đòn khi `c.t >= c.wind`.
- Đòn dùng `G.Hazards.add` (`zone` hình tròn, `beam` hình chữ nhật; có `delay`, sát thương `dmg`, `type`, `color`, `cat`) và `shoot(ax, ay, spread, n, k)`.
- Co-op: chỉ host chạy AI; `Hazards.add` tự broadcast `['hz', {...}]`, `shoot` gọi `Coop.enemyShot`. Mọi hazard đều đi qua gói đã có.
- `Hazards.update`: tại thời điểm nổ (`h.t >= h.delay`) mà người chơi nằm trong hình thì `pl.invuln = 0` rồi `pl.hurt(dmg)`. **Mỗi hazard bỏ qua thời gian bất tử, nên các hazard chồng lên nhau cộng dồn sát thương.** `inside()` với `zone` là hình tròn bán kính `r + pl.r*0.6` (hình vẽ là ellipse).
- Arena: `ARENA_R = 11` tile; một tile = `Tiles.T (16) × Sprites.PX (2)` = 32 px; người chơi bị giữ trong `(r − 1.4) × 32` ≈ 307 px quanh `arena.x, arena.y`.
- Apex được tạo ở `rift.js: spawnLegend` (`apexDef`, `e.apex = true`); `shotDmg() = def.shotDmg × (dmg / def.dmg)`.

## Thiết kế

### 1. Cấu trúc
- File mới `js/data/apex-moves.js`, `G.ApexMoves`, đặt ngay trước `js/entities/enemy.js` trong `dev.html` (cần có khi tạo boss). Thêm vào `NEED` của `js/main.js` **không** cần (thiếu file thì Apex về hành vi cũ).
- `G.ApexMoves` có:
  - `MOVES: Record<type, { id, name, desc, wind, build(ctx) }>` — 18 hệ.
  - `of(types) -> move` — chiêu của hệ **đầu tiên** trong `types` (hệ chính; giống cách `bossInit` chọn).
  - `start(boss, pl, cast) -> void` — gọi từ `bossStart`: đặt `cast.wind`, dựng hazard/đạn của chiêu, nói tên chiêu (`G.Spawner.say`, chỉ host).
  - `PRIMS` — các phép dựng dùng chung (mục 3), để test.
- `enemy.js`:
  - `bossInit`: nếu `this.apex`, thêm `'sig'` vào `ai.ranged` (ba đòn tầm xa) và lưu `ai.sig = G.ApexMoves.of(this.types)`.
  - `bossStart`: `case 'sig': G.ApexMoves.start(this, pl, c); break;`.
  - `bossCast`: `case 'sig'` nổ `after` kết thúc như đòn khác; khi `ai.fury`, sau `c.wind + echoDelay` gọi echo (mục 4).
- Legendary thường (`!this.apex`) không đổi: `bossInit` giữ nguyên.

### 2. Mười tám chiêu
Mô tả mẫu; số cụ thể (bán kính, số lượng, delay) chốt trong plan rồi chỉnh sau khi chơi thử. Tên và mô tả chỉ tiếng Anh (như các text Apex hiện có, không vào `lang-en.js`).

| Hệ | Chiêu | Mẫu |
|---|---|---|
| normal | Hyper Burst | 2 vòng vùng nở dần, chừa một khe |
| fire | Inferno Spiral | xoắn ốc 8 vùng bung từ boss ra ngoài |
| water | Tidal Wave | bức tường vùng quét ngang đấu trường, chừa một làn |
| grass | Thorn Field | 10 vùng rải rác + 4 tia gai |
| electric | Chain Storm | tia từ boss tới từng người chơi, 3 nhịp |
| ice | Frost Cross | thập tự 4 tia quét 3 bước |
| fighting | Seismic Combo | 3 cú dậm nở dần (70 / 110 / 150) |
| poison | Toxic Bloom | vùng dưới chân người chơi + 6 vùng quanh |
| ground | Fissure Lines | 3 tia dài cách 120° |
| flying | Cyclone | 2 tia quét rộng + chùm đạn |
| psychic | Mind Crush | vùng đặt lên người chơi (chậm 0,8 s) + vòng 8 vùng quanh boss |
| bug | Swarm Rain | 12 vùng nhỏ + chùm đạn |
| rock | Meteor Storm | 8 vùng rơi lệch nhịp |
| ghost | Phantom Trap | tam giác vùng quanh người chơi rồi thu hẹp |
| dragon | Draconic Breath | quạt 7 tia quét + vòng |
| dark | Black Hole | vòng vùng thu hẹp từ r 220 xuống 60 |
| steel | Iron Barrage | 5 tia song song dịch dần |
| fairy | Moonlit Petals | vòng 12 đạn chậm + vùng |

Hệ kép: dùng hệ đầu của `types` (một chiêu cho mỗi Apex; boss legendary không đổi chiêu giữa trận).

### 3. Phép dựng dùng chung (`PRIMS`)
Mỗi phép nhận `ctx = { boss, pl, players, arena: { x, y, r }, type, color, dmg, fury }` và trả về danh sách hazard đã `Hazards.add` (để test đếm). Tất cả chỉ dùng `Hazards.add` (`zone`/`beam`) và `boss.shoot`:
`ring(n, r, delay, gapAngle?)`, `spiral(n, r0, r1, turns, stagger)`, `sweep(nBeams, spread, steps, stepAngle)`, `rain(n, r, spread, stagger)`, `target(players, r, delay)`, `lanes(n, width, axis, gap)`, `converge(rings, r0, r1, stagger)`.
Mỗi hazard mang `cat: boss.cat`, `type: boss.atkType`, `dmg` đã tính (xem mục 5).

### 4. Overdrive (dưới 50% máu, `ai.fury`)
- Đòn `sig` chiếm ít nhất một nửa số đòn tầm xa được chọn.
- Mỗi lần ra `sig` có một echo sau `1,2 s`: lặp lại chiêu với góc xoay 30° hoặc vị trí người chơi mới, sát thương ×0,7, delay giữ nguyên. Không lồng echo (echo của echo không có).
- Không đổi chỉ số (đã có `enrage()` tăng tốc).

### 5. Ràng buộc độ khó (đo được bằng test)
Với một lần ra chiêu (tính cả echo nếu có), mô phỏng trên lưới điểm của đấu trường:
- **Sát thương mỗi hazard** ≤ `shotDmg() × 1,5` (echo ≤ `1,05`).
- **Độ chồng**: trong mỗi nhóm hazard nổ gần nhau (cách nhau < 0,25 s) không điểm nào bị quá 2 hazard phủ; trên cả lượt không quá 3 (các nhịp nối tiếp nhau né được, nên không tính ≤ 2 cho cả lượt — chỉnh khi cài đặt, 28-10).
- **Vùng an toàn**: tại mỗi thời điểm nổ (nhóm hazard có `delay` cách nhau < 0,25 s) vẫn còn ≥ 35% diện tích đấu trường không bị phủ bởi nhóm đó.
- Thời gian báo trước (`delay`) ≥ 0,7 s cho `zone`/`beam` chính, ≥ 0,45 s cho hazard "nhắm vào người chơi" (`target`).
- Tổng số hazard một lần ra ≤ 40 (giữ gói `hz` và vẽ gọn).
Các số trên là ước tính; chỉnh sau khi chơi thử. Test dùng chính `Hazards.inside` (xuất ra để test) nên hình học khớp game.

### 6. Co-op
- Chỉ host chạy AI (không đổi). Hazard/đạn đã được broadcast; không thêm sự kiện, không đổi `codec.js`, không đổi `MULTIPLAYER_PROTOCOL.md` (ghi chú một dòng: Apex dùng các hazard sẵn có).
- Banner tên chiêu (`Spawner.say`) đi qua tin `say` đã có, nên khách cũng thấy (sửa 28-10 sau review: bản đầu ghi nhầm là chỉ host).
- `players` trong `ctx` = mọi người chơi còn sống (`G.Game.everyone()`).

### 7. Kiểm thử và xem thử
- `tests/apex-moves.test.cjs`: nạp `apex-moves.js` (+ `hazards.js` thật, G giả) và kiểm:
  - đủ 18 hệ có chiêu, mỗi chiêu có tên và mô tả tiếng Anh không dấu Tây Ban Nha;
  - `of(['fire','flying'])` trả chiêu hệ lửa;
  - các ràng buộc mục 5 cho từng chiêu (1, 2 và 4 người chơi; `Math.random` cố định);
  - Overdrive: cùng `ai` có `fury` thì có echo, không echo khi chưa fury, không lồng echo;
  - Apex thường vs legendary thường: chỉ Apex có `'sig'` trong `ai.ranged`;
  - không có gói tin mới: số loại sự kiện `broadcast` ngoài `hz` bằng 0 khi một chiêu chạy.
- Điều chỉnh `tests/rift-special.test.cjs` nếu `bossInit` bị chạm.
- `tools/apex-preview.html` (chỉ dùng khi phát triển, không vào build): chọn hệ và `fury`, vẽ đấu trường từ trên xuống, chiếu các hazard theo thời gian (vùng/tia dần đầy rồi nổ), kèm chỉ số "vùng an toàn" và "độ chồng". Đây là kiểm tra cảm giác chính vì máy không chấm được "dễ né".
- Chơi thử trong game: `G.Rift.debugSpecial('fire')` rồi các hệ khác; cần xem né được không và tốc độ nhịp.

### 8. Phát hành
Theo CLAUDE.md: sửa `dev.html`, thêm mục `chg`/`new` vào `js/data/changelog.js` (es + en), `node tools/build.js`. Commit/push chỉ khi chủ dự án yêu cầu.

## Tiêu chí hoàn thành
1. Test mới và các test hiện có qua (`node --test tests/*.cjs`).
2. `tools/apex-preview.html` hiện đủ 18 chiêu; mỗi chiêu có ít nhất một đường né rõ ràng bằng mắt.
3. Trong game, Apex của mọi hệ ra chiêu đặc trưng; Overdrive thêm echo; không có thông báo lỗi.
4. Co-op: khách thấy hazard của chiêu như hazard thường (kiểm bằng test; chơi thật cần hai người).
5. Legendary thường không đổi hành vi.

## Rủi ro
- Cảm giác "né được" khó đo bằng máy: giảm bằng trang xem thử, ràng buộc mục 5 và một vòng chơi thử của chủ dự án trước khi chỉnh số.
- `pl.invuln = 0` ở mỗi hazard khiến sát thương cộng dồn: giữ độ chồng ≤ 2 và hazard "nhắm vào người chơi" delay dài hơn.
- Chiêu dùng `target` có thể ép người chơi vào nhau trong co-op: chấp nhận (cùng hazard `zone` hiện có).
- Sát thương Apex tăng theo `dmg × 1,8` và `power` (Prestige × Rank) nhưng Prestige × Rank chỉ nhân máu: sát thương chiêu mới không tự cân theo build; cần chỉnh sau khi chơi thử.
