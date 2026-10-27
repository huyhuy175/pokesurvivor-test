# Lò Tiến Hóa y Mảnh Tiến Hóa — Spec (giai đoạn 2)

Giai đoạn 2 của "tiến hóa + Mega". Giai đoạn 1 (tiến hóa trong ván, cần Đá Tiến Hóa và dạng đã sở hữu) đã xong; spec: `2026-10-27-evolution-design.md`/plan phase 1. Giai đoạn 3 (Mega) dùng cùng cửa hàng.

## Mục tiêu
Người chơi mở khóa dạng tiến hóa ngoài ván bằng một đồng tiền mới, **Mảnh Tiến Hóa (Evolution Shard)**, ở một cửa hàng mới, **Lò Tiến Hóa**. Gacha không còn ra dạng tiến hóa.

## Quyết định đã chốt với chủ dự án
- Mua cần sở hữu dạng gốc (tiền thân trực tiếp); dạng gốc không mất; giá theo độ hiếm của dạng đích.
- Tiền tệ mới tách khỏi Đá Tiến Hóa (đá dùng trong ván).
- Nguồn mảnh: boss/rương trong ván, nhiệm vụ, thành tựu.
- Cửa hàng chỉ bán dạng tiến hóa ở giai đoạn này.
- Gacha loại mọi Pokémon có tiền thân (`G.EVO_FROM`); chủ dự án chấp nhận pool mỏng (độ hiếm 4: 38 con, độ hiếm 3: 65).
- **Chỉ dạng thường (không có tiền thân) chọn làm compañero được.** Dạng tiến hóa chỉ xem trước trong sưu tập; để có chúng trong ván phải tiến hóa trong ván (cần dạng đó đã sở hữu, do gacha cũ hoặc Lò). Mục đích: không ai vào ván với dạng mạnh nhất.
- Mọi dạng trong `G.EVO` mua được (kể cả huyền thoại); mua làm tăng số sở hữu nên tính vào thành tựu sưu tập.

## 1. Mảnh Tiến Hóa và sổ cái (`js/core/db.js`)
- `save.shards` (số nguyên ≥ 0). Khóa sổ cái `sh` trong `CUR`, giống `c`/`t1`/`t10`: mỗi thiết bị ghi [kiếm, tiêu]; `merge`, `ledOf`, `balOf`, `curKeys`, `isCurKey` lo gộp. Sanitize ở chỗ đọc save (như `s.coins = n(s.coins)`). Save cũ không có `shards`: coi là 0 y saldo `base` 0.
- `Progress.grant(r)`: hỗ trợ `r.shards`. `rewardText` muestra "N mảnh". Tooltip/lista de recompensas de misiones y logros usan `rewardText`.
- Hiển thị: thanh trên cùng (`refreshCoins`) cạnh xu; icono `shard` 12×12 en `icons.js`; màn kết thúc ván.

## 2. Nguồn mảnh
- Trong ván: `pl.shards` tăng khi hạ boss (+3) và mở rương lớn (+1) — cùng móc `G.Evo.onKill`/`onChest` của giai đoạn 1, nhưng **không** phụ thuộc điều kiện đủ để tiến hóa (luôn rơi). Cộng vào kho ngay khi rơi (`G.Progress.grant` + `commit('run')`), không đợi hết ván: không mất nếu đóng tab hoặc chết (như vé). Co-op: mỗi máy cộng cho người chơi cục bộ (giống đá), không cần sự kiện mạng mới.
- Nhiệm vụ ngày/tuần và thành tựu: thêm `shards` vào `reward` của các định nghĩa hiện có (`data/missions.js`, `data/achievements.js`). Ước tính: ngày 2–4, tuần 8–12, thành tựu theo bậc 5–40. Số cụ thể ghi trong plan; chỉnh sau khi chơi thử.
- Con số ước tính: 6–10 mảnh/ván.

## 3. Lò Tiến Hóa (`js/data/forge.js` dữ liệu/logic, `js/ui/forge-ui.js` giao diện)
- `G.Forge.price(dex)`: theo `rarity` dạng đích: `{1:20, 2:40, 3:80, 4:160, 5:300}`.
- `G.Forge.offers()`: danh sách `{from, to, price}` với `from` sở hữu, `to ∈ G.EVO[from]`, `to` chưa sở hữu; dedupe theo `to` (nhiều tiền thân → ofrecer una vez, mostrando la primera propiedad).
- `G.Forge.buy(to)`: kiểm tra (đủ mảnh, đủ điều kiện), trừ mảnh qua sổ cái, thêm `save.owned[to]` như gacha (không shiny, không hoàn tiền), gọi `G.DB.commit(true)`; trả `{ok, reason}`. Idempotente: comprar dos veces no cobra dos veces.
- Màn hình mới `scr-forge` trong `dev.html` + mục menu `data-go="forge"`; dùng bố cục kiểu `shop-ui.js` pero más simple (lista cuộn, bộ lọc theo độ hiếm, nút Mua). Không cần cảnh pixel-art.
- Dạng mua được **không** chọn được làm compañero (mục 4b); nó là đích tiến hóa trong ván (điều kiện "đã sở hữu" của giai đoạn 1 tự thỏa) y se puede ver en la colección.

## 4. Gacha (`js/systems/gacha.js`)
- `pool()`/`poolNear()`/lista de destacados loại `p` nếu `G.EVO_FROM[p.dex]`. `poolNear` giữ cơ chế rơi về độ hiếm gần nhất khi pool rỗng. Tỉ lệ rút giữ nguyên. Pity no cambia.
- Dạng đã sở hữu không bị ảnh hưởng.

## 4b. Chọn compañero (`js/ui/menu.js`, `js/core/db.js`)
- `G.Mons.isBase(dex)` = `!G.EVO_FROM[dex]` (định nghĩa duy nhất; Forge và gacha dùng chung).
- Ficha de la colección (`showDetail`): si `!isBase(dex)`, no hay botón "Elegir de compañero"; en su lugar una nota "Dạng tiến hóa: chỉ xem trước. Chọn dạng gốc y tiến hóa trong ván" (el Pokémon sigue mostrándose completo si lo posees: stats, pasiva, movimientos). Nada más cambia en la ficha.
- Migración: al cargar/fusionar una partida (donde se sanea `partner`), si `partner` no es base, pasa a su dạng gốc más temprana que tenga (subiendo por `G.EVO_FROM`, prefiriendo una poseída; si ninguna, la primera); `partnerShiny` solo se conserva si el nuevo compañero tiene shiny. `merge` aplica la misma regla. Aplica también a `starter`. Las mejoras por Pokémon (`pupg`) del compañero antiguo no se tocan.
- No hay otros puntos de elección de compañero (co-op, social y ranking leen `save.partner`), así que `startDex` de una run siempre es dạng thường.

## 5. Dọn dẹp kèm theo
- `dev.html`: mục menu Kecleon ghi "Mentas, Cápsulas y MT" → "Mentas y MT" (cápsulas ya retiradas); chuỗi en/xx trong `lang-en.js`/`lang-updates.js`.

## 6. Văn bản, changelog, tài liệu
- Chuỗi mới tiếng Tây Ban Nha (tên Lò, Mảnh, nút, lỗi) trong `lang-updates.js` đủ 5 ngôn ngữ + `lang-en.js`; changelog es/en ngày hiện tại (new: Lò Tiến Hóa y Mảnh; chg: gacha sin evoluciones).

## 7. Kiểm thử
- Sổ cái: dos dispositivos con `shards`; gastar en uno no reaparece al fusionar; save sin `shards`.
- `grant({shards})`; `rewardText`.
- Forge: `price`; `offers` (cadenas múltiples, ya poseído, sin tiền thân); `buy` (éxito, sin mảnh, sin dạng gốc, duplicado, no deja shiny).
- Gacha: ningún resultado en 10 000 tiradas por banner tiene `G.EVO_FROM`; pools nunca vacíos.
- `isBase`; migración de `partner`/`starter` evolucionado (con y sin base poseída; shiny); `merge` no reintroduce un compañero evolucionado; la ficha no ofrece el botón para dạng tiến hóa (test de la función que decide si hay botón).
- Misiones/logros: toda `reward.shards` es entero positivo.
- `pl.shards` en boss/rương y banco al final (incl. muerte); i18n test pasa.

## Fuera de alcance
Mega (giai đoạn 3), venta de objetos, rebalanceo de tasas del gacha, nuevos eventos de red.

## Riesgos conocidos
- Pool mỏng de rareza 4/3 en gacha → muchos duplicados (reembolso existente). Mitigación posible más adelante: excepciones.
- Precios y recompensas son estimaciones a ajustar tras playtest.
