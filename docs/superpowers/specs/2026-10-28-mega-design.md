# Giai đoạn 3 — Mega Tiến Hóa (thiết kế)

Ngày: 2026-10-28. Trạng thái: đã duyệt, đã triển khai (xem `docs/superpowers/plans/2026-10-28-mega.md`).

> **Điều chỉnh khi triển khai (thắng nội dung bên dưới nếu mâu thuẫn):** (1) Mega nằm ở `G.MEGA_DEX` + `G.DEX_BY`, **không** trong mảng `G.DEX` (tránh làm quái, gacha, grieta, bộ đếm Pokédex). (2) Có **94** dạng (gồm Mega mới của Legends Z-A), không phải 48; chỉ số = max(dạng gốc, Mega). (3) Passive Mega = passive của dạng gốc. (4) Co-op dùng lại sự kiện `evo`, không thêm `mega`. (5) Thẻ Mega dùng `type: 'mevo'`. (6) Nhiệm vụ tuần thưởng 2 tinh thể hệ chính của compañero. (7) Không có dòng "Mega de" trong ficha (Mega không có trong lưới Pokédex): ficha dạng gốc liệt kê các dạng Mega; tinh thể xem ở tab Mega của Lò. (8) Chưa có bộ tải sprite thật: dùng aura, xem `docs/MEGA_ASSETS.md`. (9) Dòng changelog Mega đánh dấu `'en-only'`. Nối tiếp `2026-10-27-evolution-phase1-design.md` và `2026-10-27-evolution-forge-design.md`.

## 1. Mục tiêu

Thêm một đích cuối cho Pokémon trong ván (Mega, bước cuối vĩnh viễn) và một mục tiêu dài hạn ngoài ván: farm **Tinh thể Mega** theo hệ + Mảnh để mở khóa dạng Mega ở Lò, rồi lên Mega trong ván bằng cấp cao + Đá Mega. **Lên Mega phải tăng chỉ số rõ rệt.**

Ngoài phạm vi: Gigantamax, Z-move, đa dạng hóa chiêu (giai đoạn sau), phát hành, mọi thay đổi server/DB/chi phí.

## 2. Dữ liệu

- Mỗi dạng Mega là một mục `G.DEX` riêng: `dex >= 10000`, trường `mega: baseDex` (Mega X/Y là hai mục riêng). Sprite, passive, Pokédex và `G.DB.owns` dùng cơ chế sẵn có.
- ~48 dạng, sinh bởi `tools/fetch_mega.js` (Node, PokeAPI, cache `tools/cache/mega.json`, giống `fetch_evolutions.js`). Chỉ số (`hp/spd/atk/pa/sa/df/sd`, `bst`) tính từ BST thật của Mega bằng đúng công thức đã dùng cho dex gốc, nên tăng tự nhiên (~+100 BST). `rarity` do công thức độ hiếm sẵn có; Mega không vào gacha.
- Quan hệ: `G.EVO` không đổi; thêm `G.MEGA[baseDex] = [megaDex…]` và `G.MEGA_FROM[megaDex] = baseDex` (sinh ra cùng file dữ liệu `js/data/mega.js`).
- Passive: sinh qua `tools/gen_passives.js` + `passive_design.json` (cùng pipeline, đã tính theo độ hiếm).
- Ai có Mega: Pokémon ở dạng cuối chuỗi hoặc dạng đơn lẻ, theo game chính.
- Mega **không làm compañero** (`G.Mons.isBase` sai) và không có tiến hóa tiếp theo. Dạng gốc không mất khi mở khóa.

## 3. Nguyên liệu và Lò

- 18 loại **Tinh thể Mega** theo hệ: `save.crystals[type]`, lưu vào sổ cái của `core/db.js` (mỗi thiết bị ghi [kiếm, tiêu], gộp lấy max từng mục, clamp ≤ 1e9 trong `sanitize`), cùng cơ chế với `sh`.
- Nguồn (ước tính, chỉnh sau khi chơi thử): boss rơi 1 tinh thể theo hệ của boss; rương lớn rơi 1 tinh thể theo một trong hai hệ của Pokémon người chơi; nhiệm vụ tuần thưởng tinh thể. Lưu ngay khi rơi (như Mảnh/vé), màn kết thúc có dòng tổng.
- Giá mở khóa ở Lò (`G.Forge`, thêm `offersMega()` / `buyMega(to)`): 8 tinh thể hệ chính nếu Mega một hệ, 6 + 6 nếu hai hệ; cộng Mảnh `{thường: 400, X/Y: 450}`. Điều kiện: đã sở hữu dạng gốc.
- Lỗi trả về giống `buy`: `unknown | owned | locked | shards | crystals`.

## 4. Trong ván

- `G.Evo` mở rộng (hoặc `G.Mega` tách file nếu `evolution.js` quá dài): điều kiện lên Mega = cấp **36** + có **Đá Mega** + đã sở hữu dạng Mega. Đá Mega rơi từ boss/rương lớn (chỉ khi đủ điều kiện), cấp trực tiếp cho người chơi cục bộ.
- Hiện thẻ "Mega" trong màn lên cấp (như thẻ `mevo`). Dùng lại `Player.evolve`: giữ cấp, chiêu, nâng cấp (perks); máu theo tỉ lệ; passive/chỉ số đổi theo dạng Mega.
- **Thưởng Mega cố định** (ước tính): +15% sát thương, +20% máu tối đa (hồi 25% máu khi biến đổi), +8% tốc độ di chuyển, +10% tỉ lệ chí mạng. Đi qua trường Player sẵn có; hoàn tác được (`passiveDelta` mở rộng) nên không cộng dồn.
- Xếp hạng/thống kê dùng `startDex`.

## 5. Giao diện

- Lò: tab "Mega" (sprite, tinh thể đủ/thiếu, giá Mảnh; phân trang 30, lọc độ hiếm). Số tinh thể xem trong popup (thanh trên cùng đã chật trên điện thoại).
- Ficha dạng Mega: dòng "Mega de" bấm nhảy về dạng gốc; không nút chọn compañero.
- Màn kết thúc: dòng tinh thể nhận được.
- Ngôn ngữ: mọi chuỗi mới của Mega (tên, mô tả, nhãn Lò, thẻ, thông báo, passive) **chỉ viết bằng tiếng Anh**, không dịch sang es/fr/it/pt/zh và không thêm hàng vào `lang-updates.js` (giống passive riêng: chỉ tiếng Anh). Chuỗi đưa thẳng bằng tiếng Anh trong code, qua `G.T`/`G.I18n.f` như thường để nếu sau này dịch thì vẫn hoạt động; ngôn ngữ khác tự rơi về tiếng Anh. Changelog `2026-10-28` (`new`) vẫn theo quy định es + en.

## 6. Co-op

Sự kiện mạng `mega` (cùng kiểu `evo`, không dùng `ev`): host/đồng đội cập nhật dạng hiển thị. Cập nhật `js/net/codec.js`, `js/net/coop.js` và `docs/MULTIPLAYER_PROTOCOL.md`; test trong `tests/net.test.cjs`. Đá và tinh thể cấp cho người chơi cục bộ.

## 7. Sprite và asset

37/109 dạng đầy đủ tải từ SpriteCollab (script riêng, lưu local, game không gọi internet); các dạng còn lại dùng sprite dạng gốc + tint + aura Mega (hiệu ứng nhẹ, không thêm asset). Viết `docs/MEGA_ASSETS.md` hướng dẫn chủ dự án tạo/thêm sprite thủ công (kích thước, hoạt ảnh Idle/Walk/Attack, tên file, `sprites-meta.js`).

## 8. Kiểm thử và cân bằng

Test viết trước: `tests/mega.test.cjs` (dữ liệu: mỗi Mega có gốc hợp lệ; giá; mua/lỗi; sổ cái tinh thể gộp save; điều kiện lên Mega; thưởng cố định hoàn tác không cộng dồn; Mega không vào gacha, không làm compañero), mở rộng `forge.test.cjs`, codec trong `net.test.cjs`, `i18n.test.cjs` (nếu test đòi đủ 5 ngôn ngữ cho chuỗi Mega thì loại các chuỗi này khỏi kiểm tra, vì chủ ý chỉ tiếng Anh). Chạy lại `balance.test.cjs`, `difficulty.test.cjs` để Mega không lệch cân bằng cuối ván. Toàn bộ `node --test tests/*.cjs` phải pass.

## 9. Rủi ro và điểm ước tính

Mốc cấp 36, giá, lượng tinh thể rơi và thưởng chỉ số đều là **ước tính**, chỉnh sau khi chơi thử. Quy trình: spec → plan → thực thi (test trước) → reviewer độc lập một lần ở cuối → một đợt sửa lỗi. Không commit/push cho đến khi chủ dự án yêu cầu.
