# VFX theo hệ (giai đoạn 1a) — thiết kế

Ngày: 2026-10-28 · Trạng thái: đã sửa theo review (28-10), plan ở `docs/superpowers/plans/2026-10-28-type-vfx.md`

> Đánh số: "1a / 1b / giai đoạn 2" ở đây là các bước của riêng mảng VFX, không liên quan "Giai đoạn 1/2/3" (tiến hóa / Lò / Mega) trong HANDOFF.

## Mục tiêu
Làm hiệu ứng skill phong phú hơn mà không tốn tiền: sinh bằng code (không AI trả phí, không GPU, không PNG mới).
Move cùng hệ phải nhìn khác nhau, hình có animation mượt hơn, và đạn trúng đích có hiệu ứng riêng theo hệ.

## Phạm vi
Trong phạm vi: hình VFX mới cho 18 hệ, gán lại bảng `MOVE`, animation nhiều khung, hiệu ứng trúng đích, test, trang xem thử, changelog.
Ngoài phạm vi (spec riêng, làm sau):
- 1b: move mới có gameplay (sát thương, cooldown, `kind`, learnset, chuỗi dịch).
- Giai đoạn 2: hiệu ứng riêng cho Pokémon hiếm. Nhóm "hiếm" đã chốt = 172 loài (87 legendary/mythical + 75 có Mega + 10 pseudo-legendary không Mega; xem HANDOFF 4.12); spec riêng viết sau khi 1a xong.
- Map/tile và Pokémon mới.

Không đổi gameplay, không đổi balance, không thêm dependency, không thêm chuỗi cần dịch.

## Hiện trạng
- `js/entities/vfx.js` (437 dòng): 23 hình trong `SHAPES`, 19 palette, bảng `MOVE` (102 mục; `moves.js` có 103 move, thiếu duy nhất `nasty-plot`), `TYPE_SHAPE`, `forMove`, `forType`.
- Mỗi hình là hàm `gen(P, f)` ghi ký tự vào lưới (`o d m l w`, `L` = sáng bán trong suốt), rồi tô bằng palette. Hình có `frames` 1-3.
- Nhiều move cùng hệ dùng chung hình (ví dụ 7 move đất/đá đều là `rock` + trail `dirt`).
- `G.FX` (`fx.js`) có `sp`, `trail`, `ring`, `burst`; `projectile.js` đã gọi `G.FX.trail`.

## Thiết kế

### 1. Cấu trúc file
- `vfx.js` giữ lõi (lưới, palette, cache, `draw`, `forMove`). Thêm hai API:
  - `G.VFX.add(shapes)`: đăng ký thêm hình vào `SHAPES`.
  - `G.VFX.addMoves(table)`: gộp thêm mục vào bảng `MOVE` (mục sau ghi đè mục trước).
- Hai file mới, đặt ngay sau `vfx.js` trong khối `scripts:begin` của `dev.html`:
  - `js/entities/vfx-shapes-1.js`: lửa, nước, cỏ, điện, băng, đất, đá, thép, giác đấu.
  - `js/entities/vfx-shapes-2.js`: độc, bay, bọ, ma, rồng, bóng tối, tiên, tâm linh, thường.
- `build.js` tự gom hai file theo khối đó. Nếu thiếu file thì game vẫn chạy (hình rơi về `ball`/hình hệ mặc định), nên không thêm vào `NEED` của `main.js`.

### 2. Hình mới
- Mỗi hệ có 2-3 hình đặc trưng, tổng khoảng 45. Ví dụ: lửa (cột lửa, vòng lửa, sao băng lửa), nước (sóng, xoáy, tia), ma (linh hồn, mặt quỷ).
- Theo quy ước hiện tại: lưới ký tự, mặc định hướng sang phải, có `dir` hoặc `spin` nếu cần.
- Hình có nhiều khung được sinh theo tham số `f / frames` (vòng lặp liền mạch), không vẽ tay từng khung.

### 3. Animation
- Hình chủ chốt có 4-6 khung. `G.VFX.draw` và các chỗ gọi (`fx.js`, `projectile.js`, `combat.js`) đã truyền `frame`, nên chỉ cần tốc độ đổi khung hợp lý.
- Trường mới `hit` trong mục `MOVE` (ví dụ `hit: 'splash'`). Hàm mới `G.FX.hit(kind, pal, x, y)` tạo sprite tạm vài khung tại điểm trúng, đi qua `G.FX.sp` nên bị giới hạn bởi `CAP_SPRITES` theo chất lượng đồ họa.
- Điểm gọi `G.FX.hit` (đã xác định bằng cách đọc code): chỉ có **hai** nơi áp sát thương lên quái trong `js/systems/combat.js`: hàm `hit(pl, e, …, m)` (mọi `kind` trừ đạn bay: melee, beam, aura, chain, dash, nova/field, mine, meteor, vortex, shove, stun…) và vòng lặp đạn trong `resolve` (nơi hiện chỉ có `G.FX.sp('impact')` ngẫu nhiên 50%, cùng nhánh đạn "fantasma" của đồng đội). Cả hai gọi `G.FX.hit(G.VFX.hitFor(m), pal, x, y)`. `forMove` được ghi nhớ theo `m.id` để `hit()` (gọi rất nhiều lần với aura/orbit) không cấp phát đối tượng mới.
- Mặc định mỗi hệ có một `hit` (`TYPE_HIT`); `hit` trong `MOVE` chỉ để ghi đè. FX.hit có ngân sách mỗi khung hình theo chất lượng đồ họa để aura/orbit không làm tràn sprite.
- Co-op: mỗi máy chạy đòn của người chơi của mình (xem `docs/MULTIPLAYER_PROTOCOL.md`). VFX chỉ là hình ảnh cục bộ, không thêm gói tin và không đổi `codec.js`.

### 4. Gán lại move
Mọi move trong `moves.js` có một mục trong `MOVE`. Hai move cùng hệ phải khác nhau ít nhất ở một trong: hình (`proj`/`beam`/`melee`/`aura`), `trail`, `hit`. Bảng đối chiếu move → hiệu ứng là một sản phẩm của kế hoạch triển khai, để chủ dự án duyệt trước khi gộp.

### 5. Kiểm thử
- `tests/vfx.test.cjs` (runner Node, nạp `vfx.js` và hai file hình bằng `new Function('G', …)` với `G.Sprites`, `G.U`, `document` giả):
  - mọi hình được nhắc trong `MOVE` và `TYPE_SHAPE` đều tồn tại;
  - mọi `gen()` chạy hết các khung mà không lỗi và cho ít nhất một ô khác rỗng;
  - mọi move trong `moves.js` có mục trong `MOVE`;
  - trong cùng một hệ không có hai move giống hệt nhau về bộ (`proj`, `beam`, `melee`, `aura`, `trail`, `hit`).
- `tools/vfx-preview.html` (chỉ dùng khi phát triển): lưới tất cả hình theo hệ và palette, có chạy animation, để xem bằng mắt. Đây là kiểm tra chất lượng chính vì máy không chấm "đẹp".
- Chạy thử một run trong `dev.html` với các move đã đổi, kiểm tra không tụt FPS khi nhiều hiệu ứng.

### 6. Phát hành
Theo CLAUDE.md: sửa `dev.html`, chạy `node tools/build.js` (và các bước export/SEO nếu cần), thêm mục `new`/`chg` vào `js/data/changelog.js` bằng tiếng Tây Ban Nha và tiếng Anh. Commit và push chỉ khi chủ dự án yêu cầu.

## Tiêu chí hoàn thành
1. Test mới và các test hiện có đều qua (`node --test tests/*.cjs`; Node 24 cần glob).
2. Trang xem thử hiển thị đủ hình mới của cả 18 hệ, animation chạy được.
3. Không còn hai move cùng hệ trông giống hệt nhau.
4. Trong `dev.html`, đòn trúng đích hiện hiệu ứng riêng theo hệ ở mọi loại đòn.
5. Bản build `--expose` chạy được, không lỗi console.

## Rủi ro
- Chất lượng thẩm mỹ của hình sinh bằng code: giảm rủi ro bằng trang xem thử và vòng duyệt của chủ dự án theo từng nhóm hệ.
- Tụt FPS khi nhiều sprite tạm: dùng `CAP_SPRITES` hiện có và ưu tiên hình nhỏ.
