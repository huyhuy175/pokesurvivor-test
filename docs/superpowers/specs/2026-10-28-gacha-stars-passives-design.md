# Gacha con sao, passive common/unique y boss de rift phút 25 — thiết kế

Ngày: 2026-10-28

## Mục tiêu

Để người chơi trải nghiệm được nhiều Pokémon mà không phải cày gacha:

- Vé gacha **giữ hiếm** (không đổi tỉ lệ rơi, rarity hay pity). Người chơi tiến chậm, có thời gian thử từng con.
- Pokémon trùng **không đổi ra tiền** nữa mà dùng để **nâng sao** (kiểu Genshin), tối đa 10 sao.
- Có item rất khó kiếm để lấy Pokémon chưa có, rơi từ **boss rift đặc biệt ở phút 25**.
- Passive tách thành **common** (theo hệ) và **unique** (theo dây tiến hóa) để con yếu vẫn đáng chọn và con hiếm vẫn đặc biệt.

## Phạm vi loại trừ

Tỉ lệ rarity (`RATES`), pity 70, số vé nhận khi chơi, các banner theo thế hệ, Forja tiến hóa, Sentencia của Arceus (phút 30), giao thức cooperativo (chỉ thêm một cờ vào cấu hình arena).

## 1. Sao

- `save.dupes[dexGốc]` = số bản trùng đã nhận (0 đến 15). **Sao tính ra từ số này**, không lưu riêng, nên save cũ coi như 0 bản trùng và không cần migrate.
- Khóa theo **dạng cơ bản** của dây tiến hóa. Tiến hóa ở Forja không đổi sao.
- Bản trùng shiny cộng chung vào cùng bộ đếm.
- Mốc sao: sao vàng 1 đến 5 ở 1, 2, 3, 4, 5 bản trùng; sao đỏ 6 đến 10 ở 7, 9, 11, 13, 15. Bản trùng thứ 16 trở đi đổi ra tiền theo `REFUND` như hiện nay.
- Hiệu ứng (hằng số ở đầu module, chỉnh được):

| Sao | Nhận được |
|---|---|
| 1, 2 | +2% HP và +2% sát thương mỗi sao |
| 3 | Mở passive unique |
| 4, 5 | +2,5% HP và +2,5% sát thương mỗi sao |
| 6 | Passive common +20% |
| 7 | +3% HP và +3% sát thương |
| 8 | Passive unique +25% |
| 9 | +3% HP và +3% sát thương |
| 10 | Cả hai passive +50%, thẻ có viền đỏ |

Chỉ số tối đa khoảng +15%, cộng dồn (nhân) với Prestigio.

**Tên trong game: "Rank".** Hệ Prestigio (`js/systems/prestige.js`) đã có "sao" riêng (`save.plv[dex].star`, +10% mỗi sao, tối đa 5). Để không nhầm, hệ mới gọi là **Rank** (trong code `G.Rank`, `save.dupes`), còn sao của Prestigio đổi biểu tượng sang ♦. Hai hệ cộng dồn; hệ số Apex (mục 5) tính theo tổng của cả hai.

- Hiển thị: hàng 5 sao vàng trên thẻ, sao đỏ đè lên; bảng tiến độ ghi số bản trùng còn thiếu cho sao kế tiếp.

## 2. Passive

### Common (theo hệ)

- 18 passive common, mỗi hệ một cái, lấy theo **hệ chính** của Pokémon. Mỗi cái ghép 2 đến 3 hiệu ứng có chủ đề rõ ràng, dùng lại các mẫu của `js/data/passive-fx.js`.
- Hệ số theo dạng tiến hóa: dạng 1 ×1,0; dạng 2 ×1,3; dạng 3 ×1,6 (chỉnh được). Có từ 0★.

### Unique (theo dây tiến hóa)

- Khoảng 450 passive, một cái mỗi dây, mở ở 3★, giữ nguyên khi tiến hóa.
- Sinh bằng `tools/gen_passives.js` từ kho cơ chế mới (khoảng 30 mẫu, thay đổi cách chơi: nổ khi chết, hồi sinh một lần, đạn xuyên...). Một số con nổi bật (starter, legendary, mythical) viết tay ghi đè.
- **Độ hiếm khác nhau về đẳng cấp cơ chế, không về con số:**
  - Ngân sách sức mạnh gần phẳng, lệch tối đa khoảng ±10 đến 15% theo độ hiếm (con yếu bù nhẹ).
  - 1★ đến 3★: kho cơ bản (dễ hiểu, an toàn).
  - 4★: thêm kho nâng cao (có điều kiện, phối hợp).
  - 5★, legendary, mythical: kho tối thượng dành riêng (đổi lối chơi). Phần lớn viết tay. Tiền lệ: các mẫu `cond: true` hiện chỉ dành cho rareza 5.
  - Lợi thế chỉ số gốc (`bst`) của con hiếm giữ nguyên. Thẻ 4★ và 5★ có viền riêng; tên unique 5★ hiện màu vàng.

### Kỹ thuật

- `G.PASSIVES` (một passive mỗi dex) được thay bằng `G.PASSIVES_COMMON` (theo hệ) và `G.PASSIVES_UNIQUE` (theo dex gốc).
- `G.AbilityFX` (`js/data/ability-fx.js`, hàm trả passive của Pokémon) lấy cả hai, áp hệ số sao và dạng tiến hóa, rồi gộp thành một hiệu ứng với cùng các móc hiện có (`out`, `kill`, `tick`...). Nếu thiếu dữ liệu thì dùng `generic(mon)` như hiện nay.
- Cooperativo: mỗi máy chạy passive của chính người chơi đó, không cần giao thức mới.

## 3. Gacha (`js/systems/gacha.js`)

- Trúng Pokémon đã có: `dupes[dexGốc]++` và không hoàn tiền cho đến bản thứ 15. Từ bản thứ 16 trả `REFUND` như cũ (shiny ×3 như hiện nay).
- Kết quả mỗi lần quay có thêm `star`: sao mới nếu bản trùng này làm lên sao, để UI hiện hiệu ứng.
- Mọi thứ khác (tỉ lệ, pity, shiny, Amuleto Iris, ×10 có Épica bảo đảm, ×100) giữ nguyên.

## 4. Item

Lưu trong `save.bag` với id `wishsure`, `wishtype`, `wishany` (khớp định dạng sổ `b:[a-z0-9]{1,12}`). Thêm vào `G.Shop.ITEMS` để `db.js` chấp nhận mà không phải sửa. Tối đa 999 mỗi loại. Không bán ở tiệm. Chỉ áp dụng cho **dạng cơ bản**; Pokémon chọn được không tính pity.

| Item | Tác dụng |
|---|---|
| Vé Bảo Đảm (`wishsure`) | Tick ở màn ×10: lượt cuối bắt buộc là Pokémon chưa có trong banner đó. Nếu banner đã đủ thì ô bị khóa và không tốn vé. |
| Vé Chọn Hệ (`wishtype`) | Khi dùng, bốc ngẫu nhiên một hệ còn Pokémon chưa có và **lưu lại ngay** (đóng game không reroll được). Chọn một Pokémon chưa có thuộc hệ đó, mọi thế hệ. |
| Vé Chọn Tự Do (`wishany`) | Chọn bất kỳ Pokémon chưa có. |

Nếu không còn Pokémon nào để chọn thì không cho dùng và không trừ vé.

## 5. Rift đặc biệt phút 25 (`js/systems/rift.js`)

- Ở 25:00 host mở rift đặc biệt (cờ `special` trong cấu hình arena, kèm tin nhắn `rift` / `arena` hiện có). Chỉ một lần mỗi run, không nằm trong vòng đếm xác suất 20/40/60/80/100%.
- Nếu lúc đó đang có rift thường hoặc đang ở arena, đợi xong rồi mở. Rift thường vẫn ngừng mở từ phút 28 như cũ, nên vẫn trước Sentencia (phút 30).
- Boss: một legendary ngẫu nhiên ở dạng **Apex** (máu, sát thương, tốc độ nhân hệ số lớn, thêm vài chiêu), trong `ARENA_TIME = 120` giây.
- Thắng: **mỗi người chơi tự tung** phần thưởng: 80% Vé Bảo Đảm, 15% Vé Chọn Hệ, 5% Vé Chọn Tự Do. Không cho vé gacha và tiền như rift thường.
- Thua (hết giờ hoặc cả nhóm gục): về chỗ cũ, không mất gì, run tiếp tục.
- Hệ số Apex là hằng số chỉnh được. Cân bằng bằng cách chơi thử với build 10★ và build mới: mục tiêu là chỉ thắng được khi đã nâng sao cao ngoài game, cộng với lựa chọn tốt và build mạnh trong run.

## Dữ liệu và tương thích

- Thêm `save.dupes`. Phải đi qua `sanitize` và phần gộp nhiều thiết bị trong `js/core/db.js`: khi gộp lấy **giá trị lớn hơn** theo từng dex, để chơi hai máy không mất bản trùng.
- Bộ đếm sao và tiến độ vẫn nằm trong save đồng bộ lên đám mây như hiện tại.
- `js/data/passives.js` vẫn là file sinh tự động, không sửa tay.
- Luật dự án: sửa `dev.html` (thêm file mới vào khối `scripts`), không sửa `index.html`; chạy `build.js`, `export_data.js`, `make_seo_pages.py` khi phát hành.

## Văn bản, changelog, SEO

- Chữ mới viết thẳng bằng tiếng Anh trong code (game chỉ có tiếng Anh).
- Thêm mục vào `js/data/changelog.js` (cặp es / en, mục `new` / `chg`) với ngày của hôm đó.
- Trang SEO `pokedex/`, `en/` đang đọc `G.PASSIVES`: khi đổi sang common/unique phải cập nhật `tools/export_data.js` và `tools/make_seo_pages.py`.

## Kiểm thử

Node (`node --test tests/`):

- Số sao suy ra đúng từ số bản trùng ở các mốc 0, 1, 5, 7, 15, 16.
- Quay trùng: tăng `dupes`, không hoàn tiền đến bản 15, hoàn tiền từ bản 16.
- Tung phần thưởng 80/15/5 (kiểm tra phân phối với seed cố định).
- Whitelist túi giữ 3 id mới và tôn trọng giới hạn 999.
- Vé Bảo Đảm thật sự ra Pokémon chưa có; Vé Chọn Hệ chỉ bốc hệ còn Pokémon chưa có.
- Ghép passive common và unique đúng hệ số sao và dạng tiến hóa.
- Gộp save hai thiết bị lấy `dupes` lớn hơn.
- Bộ `tests/i18n.test.cjs` và toàn bộ suite xanh.

Thủ công (`dev.html`): quay trùng và thấy lên sao; mở passive unique ở 3★; tiến hóa giữ unique và tăng common; chờ đến phút 25 thấy rift đặc biệt, thắng và thua; dùng ba loại vé; thử cooperativo với hai máy.

## Hằng số cần chốt khi cân bằng

Chỉ số theo sao, hệ số dạng tiến hóa, hệ số Apex (máu, sát thương, tốc độ), độ lệch ngân sách theo rarity, danh sách unique viết tay.
