# Game chỉ còn tiếng Anh (cập nhật 2026-10-28)

## Quyết định
- Game chỉ hiển thị **tiếng Anh**. Đã bỏ español, français, italiano, português, 中文 và bộ chọn ngôn ngữ.
- Code nguồn **vẫn viết bằng tiếng Tây Ban Nha** và dùng nó làm khóa dịch; `js/data/lang-en.js` (cùng các `G.I18n.add` trong file dữ liệu) dịch sang tiếng Anh lúc chạy. Không đổi chuỗi nguồn để tránh vỡ save, id, giao thức mạng và test.
- **Chưa có tiếng Việt.** Nếu muốn thêm: tạo từ điển Việt (~1.000 dòng, cùng khóa với `lang-en.js`), thêm vào `choices` trong `js/core/locales.js`, và khôi phục bộ chọn ngôn ngữ trong `js/ui/settings-ui.js`.

## Đã bỏ
- `js/data/lang-fr.js`, `lang-it.js`, `lang-pt.js`, `lang-zh-cn*.js`, `lang-zh-hant*.js`, `lang-updates.js`
- thư mục `js/lang/` và `tools/build_langs.js` (`tools/build.js` không còn bước sinh từ điển)
- mục "Idioma" trong Cài đặt; các nhánh fr/it/pt/zh trong `i18n.js`, `boot.js`, `noframe.js`
- `<html lang="en">` trong `dev.html`

## Đã thêm / sửa bản dịch
- `lang-en.js` (cuối file): tên tính cách của bài test starter (leal, tímido, caótico…), chữ hướng dẫn Gmail ở màn hình đăng nhập, toàn bộ màn hình Moderación, nhãn `Pasiva` → `Passive`, `Hoy/Semana/Mes`.
- `js/ui/mod-ui.js`: dịch từng mảnh chữ bằng `G.T` / `G.I18n.f` để không bị lẫn Tây Ban Nha–Anh.
- `js/data/passive-fx.js`, `js/data/ability-fx.js`: tên hệ trong mô tả passive được dịch ("+12% damage with Grass moves."); passive mặc định giờ là tiếng Anh.
- `js/data/changelog.js`: thêm dòng cho ngày 2026-10-28.
- `tests/i18n.test.cjs`: viết lại cho game một ngôn ngữ.
- Cập nhật `CLAUDE.md`, `docs/HANDOFF.md`, `docs/LOCALIZATION.md`.

## Việc còn lại
- `index.html`, `js/app.min.js`, `version.json` **vẫn là bản cũ**: cần `node tools/build.js` (quy trình ở `CLAUDE.md`) để người chơi nhận thay đổi.
- Các file `lang-*.js`, `js/lang/*`, `build_langs.js` đã `git rm` (staged), chưa commit.
- Chữ Tây Ban Nha còn sót: chuỗi ghép lúc chạy có thể lọt qua. Cách tìm: chơi thử, thấy chuỗi nào chưa dịch thì thêm khóa tiếng Tây Ban Nha → tiếng Anh vào cuối `lang-en.js`.
- Chưa chạy `balance.test.cjs` và `difficulty.test.cjs` sau thay đổi này (các test còn lại đều pass).
