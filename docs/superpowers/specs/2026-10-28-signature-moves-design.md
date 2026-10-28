# Move đặc trưng của loài hiếm (Signature moves) — thiết kế

Ngày: 2026-10-28 · Trạng thái: chờ chủ dự án duyệt spec

## Mục tiêu
Cho mỗi trong ~172 loài hiếm một **move riêng, độc nhất** ("skill riêng") — không phải hiệu ứng hình ảnh. Người chơi mở khóa move đó khi dòng tiến hóa đạt **Rank 5★** và đang là đúng loài đó (bắt đầu ván hoặc tiến hóa trong ván). Move nằm ở **ô đặc trưng thứ 5**, không tốn một trong 4 ô thường, và đủ mạnh để người chơi muốn dùng nó thay cho nhóm bốn move đã ghép.

Đây gộp hai ý cũ trong HANDOFF: "VFX giai đoạn 1b (move mới có gameplay)" và "giai đoạn 2 (172 loài hiếm)".

## Quyết định của chủ dự án (2026-10-28)
1. Nhận bằng **mở khóa theo Rank**, giống pasiva unique (mốc **5★**, sau mốc 3★ của pasiva unique).
2. Quy mô: **mỗi loài một move có tên riêng**; 87 legendary/mythical **thiết kế tay**, phần còn lại sinh từ mẫu theo hệ và bậc.
3. Vị trí: **ô đặc trưng thứ 5**, không tốn ô thường (phím riêng `0`; 5–8 là sphere).
4. Cơ chế ghép (Vínculo) **giữ tối đa 4 move một nhóm** như cũ — không có "nhóm 5 move". Move đặc trưng **ghép được với tối đa 2 buff khác** (move `kind: 'buff'`), và chỉ với buff.
5. Sức mạnh: move đặc trưng phải **đủ mạnh để xứng đáng không chọn nhóm 4 move đã ghép** (kể cả khi đứng một mình hoặc kèm 2 buff).

## Phạm vi
Trong phạm vi: dữ liệu và bộ sinh cho ~172 move, danh mục cơ chế riêng (`G.SigFX`), cấp phát theo Rank/loài, ô thứ 5 và luật ghép với buff, UI (HUD, thẻ ghép, tạm dừng, ficha), co-op, VFX bằng hình đã có, tiếng Anh, test, trang xem thử, changelog.
Ngoài phạm vi: `kind` mới; shape VFX mới (dùng lại hình của VFX 1a); đổi cân bằng các `kind` hiện có; move riêng theo shiny; nhóm ghép 5 move; đổi cách cấp Rank.

## Hiện trạng (đã đọc code)
- `js/data/moves.js`: 103 move, 23 `kind`; mỗi `kind` có thang nâng cấp (`LADDERS`, 4 mức → `maxLvl` 5). `Moves.ALL`, `BY_ID`, `POOL[type]`, `poolFor(mon)`, `instance(id, lvl)`, `levelUp`, `startFor`.
- `Player` (`js/entities/player.js`): `moves` (mọi move đã học), `slots` (mỗi ô là một **nhóm** `[move, …]`), `active`, `maxMoves = 4`, `addMove(id)` (cần chỗ trống), `arrange()`, `activeGroup()` — `combat.js:24` chạy **mọi move của nhóm đang hoạt động** cùng lúc; chỉ nhóm của ô đang chọn chạy (đổi bằng 1–4/Q/E).
- Vínculo (fusión): mỗi legendary hạ trong rift cho một `bond`. `bondOptions()` + `fuse(moves, group)` gộp các move **rời** (`slots` có đúng 1 move) thành nhóm, `BOND_MAX = 4`. UI: `game.js: offerBond` và `run-ui.js: showBond`.
- Cấp move qua mạng: id chuỗi (`mv`, sự kiện `c` → `Combat.ghostCast(pl, id, lvl, aim, evolved)`), kiểm bằng `G.Moves.BY_ID[id]`; `codec.js` không mã hoá chỉ số move.
- Rank: `G.Rank.starsOf(dex)` (theo dòng, qua `root`), `bonus(dex)` có `uniqueOn` ở ≥ 3★. `G.MEGA_FROM[megaDex] = baseDex`.
- Dòng và loài: `G.Mons.lineage`, `isBase`, `Player.evolve/setLook/megaUp`; người chơi chỉ chọn **dạng gốc** làm partner, nên phần lớn 172 loài là dạng tiến hóa (Charizard, Gengar, Garchomp…) đạt được **khi tiến hóa trong ván**.
- `leg` trong `pokedex.js` đánh dấu legendary/singular; `tools/cache/{gamedata,mega,evolutions}.json` có số liệu cho danh sách loài (HANDOFF 4.12: 87 + 75 + 10 = 172).

## Thiết kế

### 1. Danh sách loài (từ dữ liệu, có test)
`SIG_SPECIES` = hợp của: (1) `leg` (87); (2) loài có dạng Mega, trừ con đã là legendary (75); (3) pseudo-legendary không có Mega (`bst ≥ 580`, 10). Bộ sinh `tools/gen_signature.js` tính danh sách từ `tools/cache/*.json`; test đối chiếu số lượng với dữ liệu trong game (không gõ tay).
Mega dùng move của **loài gốc** của nó (`MEGA_FROM`), nên không có move riêng cho 94 dạng Mega.

### 2. Dữ liệu và bộ sinh
- `js/data/signature-moves.js`: `G.SIG[dex] = { id: 'sig-<dex>', name, type, kind, <thông số của kind>, fx: <id cơ chế riêng>, fxv: <giá trị>, desc }`. Sinh bởi `tools/gen_signature.js` từ `tools/signature_design.json` (87 legendary viết tay) + mẫu theo hệ × bậc (basic/advanced) cho 85 loài còn lại. Tên và mô tả chỉ tiếng Anh.
- Đăng ký: `G.Moves.register(def)` đặt vào `BY_ID` (và gắn `ups = LADDERS[kind]`, `maxLvl`) nhưng **không** vào `ALL` hay `POOL` ⇒ không lẫn vào 103 move thường, không hiện trong thẻ "move mới" và không ảnh hưởng `tests/vfx.test.cjs` (103 move).
- `G.SIG_OF(dex) -> def | null`: tra theo loài (Mega → loài gốc).

### 3. Cơ chế riêng (`G.SigFX`)
Danh mục ~25 cơ chế nhỏ gắn vào `kind` có sẵn, mỗi cái có `text(v)` mô tả tiếng Anh và móc vào combat (ví dụ: nổ lan khi trúng, đạn quay về, để lại vùng làm chậm, tia nhân đôi ở nửa sau, tăng sát thương theo số kẻ địch bị trúng). Không tạo `kind` mới: `SigFX` chỉ bổ sung hành vi qua các móc của `combat.js` (`afterHit`, `payload`, `fields`). 87 legendary mỗi con chọn một cơ chế + `kind` riêng; 85 loài còn lại lấy cơ chế theo hệ/bậc từ mẫu. Danh mục cụ thể được chốt trong plan (xem "Điểm mở").

### 4. Sức mạnh
- Hàm `G.Moves.dps(def, lvl = 1)`: DPS danh nghĩa = `dmg × lần / cd` hiệu chỉnh theo từng `kind` (hệ số do test hiệu chuẩn từ 103 move thường), dùng cho mọi `kind` trừ `buff`.
Hằng số `SIG_POWER` (đã chỉnh còn **4,0** khi cài đặt: 3,0 cho thấy move đặc trưng chỉ bằng ~0,64 một nhóm 4 move ở cấp 3): `dps(sig) × POWER(fx) / trung vị(dps của 97 move gây sát thương)` phải nằm trong **[0,83×SIG_POWER; 1,17×SIG_POWER]** cho cả 171 move (test). `AREA` (hệ số mỗi kind của `dps`) được chuẩn hóa theo dữ liệu khi nạp `moves.js`. Lý do: một nhóm 4 move ghép chạy 4 move cùng lúc, nên move đặc trưng đứng một mình cần tương đương nhiều move thường; kèm 2 buff thì còn mạnh hơn.
- Cơ chế riêng không cộng thêm sức mạnh ngoài dải (hệ số của `fx` nằm trong tính `dps`).
- Số 3,0 và dải là ước tính; chỉnh sau khi chơi thử (cùng nhóm hằng số cần chỉnh như `Rift.APEX`).

### 5. Cấp phát và ô thứ 5
- `Player.sig` (một move hoặc `null`) và `Player.syncSignature()`: gọi khi bắt đầu ván (`Game.startRun`) và sau mỗi `evolve/setLook/megaUp`. Nếu `G.SIG_OF(this.dex)` tồn tại và `G.Rank.starsOf(this.dex) ≥ 5 (theo dòng, qua Rank.root)` thì `sig` = `instance(id, lvl cũ hoặc 1)`; ngược lại gỡ.
- Cùng một move không bị cấp hai lần; tiến hóa giữa hai loài đều có move thì đổi sang move mới và **giữ cấp** (đã nâng bằng thẻ).
- Ô thứ 5 là một phần của `slots` nhưng **không tính vào `maxMoves`** (4 ô thường vẫn đủ chỗ cho `addMove`). `slots` có tối đa 5 nhóm; phím 5 và chu kỳ Q/E đi qua cả 5.
- `Player.sig` tham gia `moves` (để thẻ nâng cấp, thống kê và "tóm tắt tạm dừng" thấy nó) nhưng bị loại khỏi `moves.length` dùng cho "cần chỗ trống".
- Rank được kiểm lúc cấp, nên rút bản trùng không làm mất giữa ván.

### 6. Luật ghép (Vínculo)
- Nhóm thường: không đổi (tối đa 4, **không** chứa move đặc trưng).
- Nhóm có move đặc trưng: gồm `sig` + **tối đa 2** buff (`kind: 'buff'`), tổng ≤ 3. Chỉ buff đang rời (đứng một mình trong ô thường) mới ghép được; ghép tiêu một vínculo như thường lệ. Ghép xong, ô buff được giải phóng (nhường chỗ cho move thường).
- `bondOptions()`: khi có move đặc trưng và còn chỗ buff, trả thêm lựa chọn `mode: 'sig'` với `loose` = buff đang rời; không buff rời thì không có lựa chọn đó. Thẻ `showBond` hiển thị "Se lanzará a la vez que <sig>" (tiếng Anh trong game).
- Không có buff nào bị ép: nếu người chơi không có buff, `sig` chạy một mình.
- Cinta Elección (`choiceband`) giữ nguyên ý nghĩa: không đổi ô.

### 7. UI
- HUD (`ui/hud.js`): vẽ tối đa 5 ô; ô thứ 5 có viền đặc biệt (ví dụ vàng), icon lấy từ `G.Icons` bằng `'move:' + id` (cần icon cho id `sig-*`: dùng emblem của hệ + huy hiệu "★").
- Thẻ ghép, màn tạm dừng ("Tus ataques"), ficha Pokédex: hiển thị move đặc trưng của loài (mờ + "Unlocks at 5★" khi chưa đủ Rank; sáng khi đủ), cùng chỗ với dòng unique của pasiva.
- Tên và mô tả chỉ tiếng Anh (như tên pasiva); không vào `lang-en.js`.

### 8. VFX
Mỗi move đặc trưng có mục `VFX.MOVE['sig-<dex>']` (proj/beam/melee/aura/trail/hit) dùng lại hình của VFX 1a; hai move cùng hệ trong nhóm đặc trưng khác nhau ít nhất ở hình, estela hoặc `hit` (cùng ràng buộc test như 103 move). Không thêm shape mới.

### 9. Co-op
- Id chuỗi `sig-<dex>` đã đi qua `mv` và sự kiện `c`; mọi máy dùng cùng dữ liệu `G.SIG` nên `BY_ID` khớp. `codec.js` và giao thức **không đổi**.
- Mỗi máy chạy move của chính người chơi của nó (như hiện nay); `ghostCast` của đồng đội chạy `sig` như move thường.
- Máy cũ chưa có dữ liệu `G.SIG`: id lạ bị `BY_ID` loại (hành vi hiện có), không lỗi.

### 10. Lưu ý dữ liệu và khả năng tương thích
- Không thêm trường vào save: Rank và loài đã đủ để suy ra move; cấp của move chỉ sống trong ván.
- Bản build cũ chạy cùng lúc: không ảnh hưởng save.

## Kiểm thử
- `tests/signature-moves.test.cjs`:
  - danh sách khớp dữ liệu: 87 + 75 + 10, không trùng, mọi loài là dòng đạt được (có thể là dạng tiến hóa);
  - mỗi move: id `sig-<dex>` duy nhất, tên tiếng Anh không dấu Tây Ban Nha, `kind` ∈ 23 `kind` (không phải `buff`), `fx` ∈ `G.SigFX`, `desc` hợp lệ;
  - **sức mạnh**: `dps(sig)/trung vị ∈ [2,5; 3,5]` cho mọi move; 103 move thường không đổi;
  - đăng ký: có trong `BY_ID`, **không** trong `ALL`/`POOL`, `ups` đúng thang của `kind`;
  - cấp phát: Rank 4★ → không có `sig`; 5★ → có; đổi loài → đổi/gỡ, giữ cấp; Mega dùng loài gốc; `maxMoves` vẫn 4 và `addMove` hoạt động khi đã có `sig`;
  - ghép: `sig` + 1 buff, `sig` + 2 buff (xong); buff thứ 3 và move thường vào nhóm `sig` bị từ chối; nhóm thường không nhận `sig`; không có buff → không có lựa chọn `'sig'`; ghép giải phóng ô buff;
  - VFX: mỗi `sig` có mục `MOVE`, hình tồn tại, không trùng bộ trong cùng hệ.
- `tests/balance.test.cjs`: thêm một mô phỏng "move đặc trưng vs nhóm 4 move ghép" trong `tests/helpers/balance-sim.cjs` với ngưỡng ước tính.
- `tools/signature-preview.html` (dev): chọn loài, hiện tên, mô tả, hình, DPS danh nghĩa so với trung vị.
- Chơi thử: `G.DB.save.dupes = {…: 15}` để đạt 5★, rồi chọn loài/tiến hóa.

## Phát hành
Theo CLAUDE.md: sửa `dev.html` (thẻ script `signature-moves.js` và `sigfx.js` sau `moves.js`), mục `new` trong `js/data/changelog.js` (es + en), `node tools/build.js`. Commit/push chỉ khi chủ dự án yêu cầu. Không thêm vào `NEED` của `js/main.js`: `Player` kiểm tra `G.SIG_OF` có tồn tại, thiếu file thì không có move đặc trưng.

## Tiêu chí hoàn thành
1. Test mới và các test hiện có qua (`node --test tests/*.cjs`).
2. 172 loài có move riêng; trang xem thử hiện đủ.
3. Ở Rank 5★, loài hiếm có ô thứ 5; ghép với tối đa 2 buff hoạt động; nhóm thường không đổi.
4. Move đặc trưng đứng một mình có DPS danh nghĩa trong dải đã chọn.
5. Co-op: đồng đội thấy move đặc trưng (kiểm bằng test; chơi thật cần hai người).

## Điểm mở cho plan
- Danh mục `G.SigFX` cụ thể (khoảng 25 cơ chế) và móc nào của `combat.js` cần thêm.
- Hiệu chuẩn `Moves.dps` theo `kind` (bảng hệ số) và chọn dải test.
- Mẫu cho 85 loài (hệ × bậc) và danh sách thiết kế tay cho 87 legendary (nguồn tên: move đặc trưng gốc trong game chính, khi có).
- Cách `Player.sig` ảnh hưởng thống kê/"tóm tắt tạm dừng" và nhóm ô hiển thị trong HUD ở màn hình nhỏ (5 ô).
- Cách xử lý co-op nếu hai máy khác phiên bản dữ liệu (đề xuất: bỏ qua id lạ).

## Rủi ro
- Cân bằng: sức mạnh gấp ~3 lần move thường có thể làm các loài hiếm lấn át; giảm bằng test dải, bằng việc gắn vào Rank 5★ (cần 5 bản trùng) và chỉnh sau khi chơi thử.
- Khối lượng nội dung (172 tên, mô tả, cơ chế): giảm bằng bộ sinh/mẫu và chỉ viết tay 87 legendary.
- Độ phức tạp của ô thứ 5 trong `slots`/HUD/`arrange` (các bản đồ phím cố định "Atajos"): kiểm kỹ trong plan.
