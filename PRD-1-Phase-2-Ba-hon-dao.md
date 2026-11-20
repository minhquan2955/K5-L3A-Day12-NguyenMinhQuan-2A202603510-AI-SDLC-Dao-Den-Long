# PRD-1 — Ba hòn đảo

**Phase 2** · **Ưu tiên cao** · **Tag nộp `phase-2`** · **Test Contract `1.1`**

## 1. Mục tiêu và phạm vi

Chuẩn hóa cảm giác điều khiển và luật chơi của Đêm 1, mở rộng Đảo Đèn Lồng thành ba Đêm có thể chơi liên tiếp. Mỗi Đêm dùng bản đồ và bộ thông số quy định bên dưới. Bộ chấm có thể chọn từng Đêm qua chế độ headless, kiểm tra tính năng mới và chạy lại các kiểm tra Phase 1 với thông số chuẩn.

Các phần sáng tạo ở Phase 1 được giữ và có thể bổ sung nhân vật, kẻ địch hoặc chi tiết mới. Phần sáng tạo phải giữ nguyên thông số, bản đồ, Test Contract và kết quả headless. Có thể tắt những bổ sung này khi chạy headless.

## 2. Luật chơi chuẩn

Logic chạy cố định **60 tick/giây**, dùng mét và giây. Y hướng lên. Các giá trị sau thay thế thông số tự chọn ở Phase 1.

| Hạng mục | Yêu cầu |
|---|---|
| Chạy | 6,0 m/s. Tăng tốc đến tốc độ chạy và dừng trong tối đa 0,1 s. Điều khiển trên không đầy đủ, trừ lúc vận tốc phóng từ bục được giữ theo luật bản đồ. |
| Nhảy | Chỉ nhảy khi chạm đất. Vận tốc ban đầu theo Y là 7,0 m/s, trọng lực −20 m/s². |
| Lướt | 14 m/s trong 0,2 s (12 tick), hồi 1,5 s (90 tick) tính từ lúc bắt đầu. Đi theo hướng di chuyển hiện tại hoặc hướng nhìn nếu đứng yên. Lướt trên không giữ nguyên độ cao. Mây vẫn có thể bị hit khi lướt. |
| Mang và nhặt đom đóm | Tối đa 10. Tự nhặt khi cách theo XZ ≤ 1,0 m và chênh cao giữa chân Mây và mặt đất nơi đặt đom đóm ≤ 1,5 m. |
| Sinh đom đóm | Bắt đầu với 20 con tại 20 điểm khác nhau, trần 30. Tại tick 240, 480, … sinh thêm một con ở điểm trống nếu dưới trần. Hết điểm trống thì bỏ lượt. |
| Nạp đèn | Đèn cần tổng cộng 10 đom đóm và giữ tiến độ qua các lần nạp. Mỗi lần bấm ở trong bán kính 2,0 m, chọn một đèn chưa sáng gần nhất, phá hòa theo ID nhỏ hơn. Nạp `min(đang mang, còn thiếu)`. |
| Vùng an toàn | Đèn sáng tạo vùng bán kính 6 m. Bóng Mực ở ngoài bị chặn ở mép. Bóng đang ở trong lúc đèn vừa sáng bị đẩy tới mép trong tối đa 30 tick và không gây sát thương trong lúc bị đẩy. |
| Tỏa Sáng | Tốn 3 đom đóm, bán kính 5 m, hồi 3 s. Thiếu đom đóm thì không kích hoạt. Tâm ở chân Mây cộng 0,8 m theo Y. Chốt mục tiêu ngay tick kích hoạt theo khoảng cách 3D đến tâm Bóng Mực ≤ 5 m. |
| Tỏa Sáng lên Bóng Mực | Choáng 120 tick. Trong 15 tick đầu, đẩy ngang tổng 4 m, dừng ở vật cản và dùng hướng +X nếu trùng vị trí. Trúng lần nữa thì làm mới choáng và đẩy lùi. Bóng không chết. |
| Bóng Mực | Chạy 4,0 m/s ở Đêm 1 và 2, 4,5 m/s ở Đêm 3. Phát hiện ở 12 m và bỏ đuổi ở 18 m. Sinh hai con ở tick 300, sau đó mỗi lượt một con theo lịch từng Đêm. Hết điểm hợp lệ thì bỏ lượt. ID `S1`, `S2`, … theo thứ tự sinh. |
| Chạm và bị đánh | XZ ≤ 1,0 m và chênh cao ≤ 1,5 m. Mỗi tick mất tối đa một Ngọn Lửa. Bóng gây hit lùi 2 m trong 60 tick theo trạng thái `recoil`. Mây mất một Ngọn Lửa, bất tử 90 tick và rơi `floor(đang mang / 2)` đom đóm trên vành 1,5–2,5 m. Đom đóm rơi tồn tại 480 tick, nhặt được từ tick sau. Bóng chạm khi Mây bất tử không tạo hiệu ứng. |
| Rơi khỏi đảo | Khi Y < −10, mỗi lần rơi được xử lý đúng một lần, kể cả khi bất tử. Mất một Ngọn Lửa và toàn bộ đom đóm đang mang. Nếu còn Ngọn Lửa, chờ 60 tick, trong lúc chờ không nhặt và không bị chạm. Sau đó hồi sinh tại điểm xuất phát với vận tốc 0, bất tử 90 tick. Hết Ngọn Lửa thì thua ngay. |
| Ngọn Lửa và giờ | Hồi đầy 3 Ngọn Lửa đầu mỗi Đêm. Giới hạn Đêm 1, 2 và 3 lần lượt là 300, 330 và 360 s. |
| Thắng và thua | Sau mỗi tick, ưu tiên theo thứ tự: hết Ngọn Lửa thì thua `no_flames`. Nếu còn sống và mọi đèn đã sáng thì thắng, kể cả đúng tick hết giờ. Nếu còn đèn tắt và hết giờ thì thua `dawn`. |
| Điểm | +10 mỗi đom đóm nạp, +100 mỗi đèn thắp, +5 mỗi Bóng Mực trúng Tỏa Sáng mỗi lần, kể cả lúc đang choáng. Khi thắng, cộng `floor(giây còn lại) × 2 + 50 × Ngọn Lửa còn lại`. Tổng điểm game chỉ cộng điểm của các Đêm đã thắng. |

### Thứ tự xử lý mỗi tick

1. Đọc input, xử lý pause trước. Nếu vừa tạm dừng thì dừng bước tại đây.
2. Giảm các bộ đếm thời gian, hồi chiêu, bất tử, choáng, thời hạn bùa, TTL đom đóm rơi và thời gian hồi bùa.
3. Di chuyển Mây, gồm nhảy, lướt, bục nhảy và gió. Kiểm tra rơi khỏi đảo.
4. Nhặt đom đóm và bùa.
5. Tương tác với đèn.
6. Cập nhật vùng an toàn.
7. Xử lý Tỏa Sáng.
8. Di chuyển Bóng Mực và Gió Lạc.
9. Xử lý va chạm Gió Lạc cướp trước, sau đó Bóng Mực gây hit. Xét theo ID tăng dần.
10. Sinh đom đóm, Bóng Mực và Gió Lạc theo lịch. Thực thể mới tương tác được từ tick sau.
11. Xét thắng hoặc thua.
12. Ghi snapshot khi đến lượt.

Khi tạm dừng, `tick` tiếp tục tăng. `sim_tick`, thời gian, hồi chiêu, spawn và TTL đứng yên. Snapshot ghi `state: "paused"`.

## 3. Bản đồ ba Đêm

Tọa độ theo thứ tự `(x, y, z)`. Góc đo từ +X, ngược chiều kim đồng hồ khi nhìn từ trên xuống trên mặt phẳng XZ.

### Đêm 1 — Đảo Bến

- Đảo tròn tâm `(0, 0, 0)`, bán kính 40 m. Ngoài đảo là biển mây. Mây xuất phát tại `(0, 0, 0)` và nhìn về +Z.
- Đèn L1–L5 theo thứ tự `(0, 0, 25)`, `(23.8, 0, 7.7)`, `(14.7, 0, −20.2)`, `(−14.7, 0, −20.2)`, `(−23.8, 0, 7.7)`.
- Đom đóm có 8 điểm ở bán kính 12 m mỗi 45° và 16 điểm ở bán kính 33 m mỗi 22,5°.
- Bóng Mực có 12 điểm ở bán kính 37 m, bắt đầu 15° và cách nhau 30°. Điểm sinh cách Mây ≥ 15 m. Sinh hai con ở tick 300, sau đó một con mỗi 480 tick, tối đa 6 con.

### Đêm 2 — Đảo Cau

- Đảo A tâm `(0, 0, 0)` và đảo B tâm `(70, 0, 0)`, mỗi đảo bán kính 28 m. Cầu tre không lan can nối hai đảo trong `x ∈ [26, 44]` và `z ∈ [−2, 2]`.
- Bục nhảy bán kính 1 m tại `(20, 0, 18)` và `(50, 0, −18)`. Khi chân Mây chạm bục, vận tốc Y là 14 m/s và vận tốc ngang 24 m/s hướng về tâm đảo kia. Giữ vận tốc phóng ngang đến khi chạm đất. Phím di chuyển không ghi đè và vẫn có thể lướt. Chuyến bay khoảng 1,4 s và đáp trên đảo đích.
- Mỗi đảo có 4 điểm đom đóm ở bán kính 10 m tại 0°, 90°, 180°, 270° và 8 điểm ở bán kính 22 m mỗi 45°. Mỗi đảo có 8 điểm Bóng Mực ở bán kính 26 m, bắt đầu 22,5° và cách nhau 45°.
- Đèn L1–L6 theo thứ tự `(0, 0, 20)`, `(17, 0, −10)`, `(−17, 0, −10)`, `(70, 0, 20)`, `(87, 0, −10)`, `(53, 0, −10)`.
- Bóng Mực sinh hai con ở tick 300, sau đó một con mỗi 420 tick (7 s), tối đa 8 con.

### Đêm 3 — Đảo Chuông

- Tầng 0 bao phủ đảo tròn bán kính 45 m ở Y = 0. Tầng 1 ở Y = 3, là nửa vành khăn bán kính 12–24 m với `z > 0`. Tầng 2 ở Y = 6, là đĩa bán kính 8 m ở tâm. Mép tầng là vách đứng và bước ra khỏi mép thì rơi xuống tầng dưới.
- Hai dốc thẳng rộng 3 m ở góc 30° và 150°. Chân dốc ở bán kính 30 m, Y = 0. Đỉnh dốc ở bán kính 24 m, Y = 3.
- Bục nhảy bán kính 1 m tại `(0, 3, 13)` phóng Mây với vận tốc Y 12 m/s và vận tốc ngang 8 m/s theo −Z. Giữ vận tốc phóng ngang đến khi chạm đất để đáp lên tầng 2.
- Tháp chuông ở tâm tầng 2, hình trụ bán kính 2 m, cao 8 m, không leo được.
- Có 30 điểm đom đóm. Tầng 0 có 18 điểm ở bán kính 34 m, mỗi 20° từ 0°. Tầng 1 có 8 điểm ở bán kính 18 m, từ 20° đến 160° mỗi 20°. Tầng 2 có 4 điểm ở bán kính 5 m tại 45°, 135°, 225° và 315°.
- Đèn L1–L7 theo thứ tự `(0, 6, 6)`, `(18, 3, 10)`, `(−18, 3, 10)`, `(35, 0, −10)`, `(−35, 0, −10)`, `(20, 0, −35)`, `(−20, 0, −35)`.
- Bóng Mực có 16 điểm ở bán kính 43 m, mỗi 22,5°. Sinh hai con ở tick 300, sau đó một con mỗi 360 tick (6 s), tối đa 10 con.
- Cứ 30 s có gió mạnh theo hướng ngẫu nhiên. Gió đẩy Mây 2 m/s trong 5 s. Lá bay và âm thanh báo trước 2 s.

## 4. Tính năng và tiêu chí nghiệm thu

### AC-01 — Gió Lạc

- **Sinh và phát hiện.** Ở Đêm 2 và 3, thử tại tick 1200 và 2400 với điểm sương hợp lệ. Gió Lạc sinh ở điểm sương ngẫu nhiên, có ID `D1`, `D2`, … và tối đa hai con. Đêm 1 không sinh tự nhiên. Trạng thái `idle` lượn 2 m/s, chuyển `chase` 7 m/s khi Mây có ≥ 5 đom đóm và cách ≤ 15 m. Kiểm tra mỗi tick và về `idle` nếu mất điều kiện trước khi cướp.
- **Cướp và bỏ chạy.** Khi chạm theo XZ ≤ 1,2 m, Gió Lạc cướp `min(3, đang mang)`, chỉ cướp một lần, rồi `flee` ra xa Mây với 7 m/s trong 240 tick. Sau đó chuyển `removed` cùng số đã cướp. Mây giữ nguyên Ngọn Lửa. Thử cả khi Mây bất tử hoặc đứng trong vùng an toàn vì hai trạng thái đó không chặn Gió Lạc.
- **Tỏa Sáng.** Trúng khi `chase` thì Gió Lạc chạy đi mà chưa cướp. Trúng khi `flee` và đang mang đồ thì thả toàn bộ đom đóm đã cướp tại chỗ dưới dạng đom đóm rơi và biến mất sau 120 tick.

### AC-02 — Bùa Gió

- Đêm 2 có `C1` tại `(35, 0, 0)`. Đêm 3 có `C1` và `C2` tại `(30, 0, 25)` và `(−30, 0, 25)`. Bùa là lá đỏ viền vàng, nhặt theo cùng luật khoảng cách và độ cao như đom đóm.
- Khi nhặt, hiệu lực là 600 tick. Nhặt tiếp làm mới thời hạn về 600 tick. Trong hiệu lực, Mây chạy 7,2 m/s và có thể lướt lại sau khi lướt xong mà không chờ hồi chiêu. Mỗi lần lướt cần một lần nhấn mới, nhấn khi đang lướt bị bỏ qua. Lướt vẫn là 14 m/s trong 12 tick.
- Sau 2700 tick kể từ khi nhặt, bùa xuất hiện lại. Đối chiếu số đếm và trạng thái `available` trong snapshot.

### AC-03 — Chuỗi ba Đêm và kết quả

- Từ menu chính, vào màn giới thiệu có tên đảo và lời Ông Đăng, sau đó vào chơi rồi hiện kết quả. Thắng Đêm 1 hoặc 2 thì tiếp tục đến Đêm sau. Thua thì có thể chơi lại chính Đêm vừa thua.
- Thắng Đêm 3 thì hiện màn hình Bình Minh với tổng điểm các Đêm đã thắng. Đối chiếu công thức điểm, số Ngọn Lửa và thứ tự ưu tiên thắng/thua ở tick cuối.

### AC-04 — Tạm dừng

- `Esc` hoặc `P` mở tạm dừng. Trong nhiều tick tạm dừng, vị trí và các bộ đếm mô phỏng đứng yên, còn `tick` tăng và snapshot có `state: "paused"`. Tiếp tục đưa mô phỏng chạy lại.
- Menu tạm dừng có bốn lựa chọn hoạt động đúng gồm **Tiếp tục**, **Chơi lại Đêm**, **Cài đặt** và **Về menu**.

### AC-05 — Cài đặt

- Đổi âm lượng và độ nhạy chuột, xác nhận hiệu ứng trong game. Đóng và mở lại game, cả hai giá trị vẫn được lưu.

### AC-06 — Âm thanh

- Có nhạc nền Đêm. Nghe được hiệu ứng tương ứng khi nhặt, thắp đèn, Tỏa Sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện và trong phần đếm ngược 10 s cuối. Ở Đêm 3, nghe âm thanh cảnh báo trước gió 2 s cùng hiệu ứng lá bay.

### AC-07 — HUD

- Trên trái hiển thị Ngọn Lửa. Trên giữa hiển thị `mm:ss`, chuyển đỏ và nhấp nháy khi ≤ 30 s. Trên phải hiển thị số đèn `k/n` và điểm.
- Dưới giữa có thanh đom đóm 10 ô cập nhật theo số đang mang. Dưới phải có biểu tượng hồi chiêu Lướt và Tỏa Sáng.
- Khi đứng gần đèn có thể nạp, hiện `E — Nạp ánh sáng (x/10)`. Khi đèn chưa sáng gần nhất nằm ngoài màn hình, hiện mũi tên hướng đến đèn đó.

### AC-08 — Màu và ánh sáng

Các thành phần liệt kê dùng màu chuẩn, sai lệch tối đa 10% mỗi kênh RGB. Chi tiết khác được tự chọn màu.

| Thành phần | Màu theo thứ tự |
|---|---|
| Trời đêm / sương | `#0E1430` / `#1B2350` |
| Cỏ / cát / gỗ / biển mây | `#2F5D50` / `#C9B48A` / `#6B4A2F` / `#12384A` |
| Đèn sáng / lõi / đèn tắt | `#FFB347` / `#FFE9B0` / `#5B5F6E` |
| Đom đóm lõi / quầng | `#FFF6C2` / `#FFE58A` |
| Bóng Mực thân / viền / choáng | `#120A1A` / `#7A3CFF` / `#3A3450` |
| Áo Mây / khăn Mây và Bùa Gió | `#E8E2D0` / `#C8102E` |
| Viền vàng và điểm số / Gió Lạc | `#F2C14E` / `#8FA3B8` |
| UI nguy hiểm / chữ UI | `#FF5A5F` / `#F5F1E6` |

Đo hoặc đối chiếu giá trị cấu hình ở các mốc tiến độ. Cường độ ánh sáng môi trường phải bằng `0.15 + 0.55 × (đèn sáng / tổng đèn)`, từ `0.15` lúc chưa thắp đến `0.70` lúc tất cả đèn sáng.

## 5. Test Contract v1.1

Phần dưới liệt kê thay đổi của v1.1. Những phần v1.0 không được thay trong Ticket-02 tiếp tục áp dụng. Đối chiếu PRD-0 khi cần chi tiết lệnh chạy, cấu trúc gốc và các kiểu dữ liệu chưa được nêu lại.

| Bề mặt | Yêu cầu v1.1 |
|---|---|
| Khai báo | `contract_version: "1.1"`. `tuning` khớp các số chuẩn, thêm `dash_speed: 14`, `dash_duration_s: 0.2`, `dash_cooldown_s: 1.5`, `night2_duration_s: 330`, `night3_duration_s: 360`. |
| Chọn Đêm | `--night` nhận `1`, `2`, `3`. |
| Snapshot gốc | Thêm `night` và `wind {active, dir_deg}`. |
| Snapshot `player` | Thêm `vel`, `grounded`, `invuln`, `dash_cd_s`, `pulse_cd_s`, `charm_s`. |
| Mảng snapshot | `motes` gồm `id`, `pos`, `kind` (`random` hoặc `dropped`), `ttl_s`. `drifters` gồm `id`, `pos`, `state`, `stolen`. `charms` gồm `id`, `available`, `respawn_s`. |
| Scenario | Thêm `player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}`, `shades[].{state, state_ticks_left}`, `drifters`, `charms`, `random_drifters` và `wind_enabled`. Hai mảng `drifters` và `charms` thay thế danh sách mặc định tương ứng. |
| Input | `dash` và `pause` chỉ kích hoạt khi chuyển `false` → `true`. |
| Trạng thái Bóng Mực | Dùng đúng `spawning`, `wander`, `chase`, `recoil`, `stunned`. |
| Hiệu năng | Một Đêm đầy đủ, tối đa 21.600 tick, chạy headless trong ≤ 30 s. |

| Event | Payload được bổ sung |
|---|---|
| `dash` | `{}` |
| `charm_picked` | `{charm_id, charm_ticks}` |
| `drifter_steal` | `{drifter_id, amount, carried}` |
| `drifter_drop` | `{drifter_id, amount}` |
| `night_start` | `{night}` |
| `paused`, `resumed` | `{}` cho mỗi event |
| `player_hit` do rơi | Thêm `lost`. |

## 6. Kiểm chứng và điều kiện chốt phase

- Ghi bằng chứng theo yêu cầu được kiểm tra, lệnh hoặc thao tác đã chạy, kết quả mong đợi, kết quả thực tế và trạng thái đạt/chưa đạt. Lưu đầu vào và đầu ra thật của các scenario cùng mã ở tag `phase-2`.
- Có ít nhất một scenario headless cho mỗi tính năng mới theo DoD. Dùng snapshot hoặc event để kiểm tra phần logic mà contract bộc lộ, như lướt, pause, Gió Lạc, Bùa Gió, gió mạnh và các trường hợp thắng/thua. Bổ sung bằng chứng từ bản thường cho menu, lưu cài đặt, âm thanh, HUD, màu và hiệu ứng hình ảnh.
- Ưu tiên kiểm tra các trường hợp biên gồm nạp đèn khi bằng khoảng cách, đèn vừa sáng có Bóng Mực bên trong, Tỏa Sáng làm mới choáng, Gió Lạc cướp trước khi Bóng Mực hit, rơi khi đang bất tử, giữ nút lướt hoặc pause, và hoàn tất đèn cuối đúng tick hết giờ.
- Chạy lại kiểm tra Phase 1 với thông số chuẩn. Mọi test ẩn Phase 1 phải tiếp tục đạt.
- Đo và lưu thời gian của một Đêm headless đầy đủ (≤ 30 s) và FPS trung bình của bản thường (**≥ 30 FPS ở 1280×720**). Ghi cấu hình máy và cách đo kèm kết quả.
- Cập nhật `AGENTS.md` hoặc tệp tương đương và các skill đang dùng theo phạm vi Phase 2. Git phải thể hiện những thay đổi này. Commit mã, spec, kiểm thử và bằng chứng rồi gắn và push tag `phase-2`.

## 7. Điểm cần đối chiếu khi triển khai

- Lấy cấu trúc v1.0 và lệnh headless từ PRD-0. Đối chiếu riêng kiểu dữ liệu và quy ước cho các trường mới nếu tài liệu đang dùng chưa quy định, chẳng hạn `invuln`, `ttl_s` với đom đóm thường và `wind.dir_deg` khi gió tắt.
- Ticket nêu tọa độ xuất phát và hướng nhìn cụ thể cho Đêm 1. Nếu tài liệu lab không quy định các giá trị tương ứng cho Đêm 2 và 3, ghi rõ giả định của dự án. Làm tương tự với các chi tiết chưa khóa như thứ tự chọn điểm sinh hợp lệ hoặc cách xác định các điểm sương nếu dữ liệu bản đồ chưa định nghĩa.
- Với yêu cầu thuần giao diện, ghi rõ bằng chứng bổ sung từ bản thường. Nếu chưa rõ cách áp dụng yêu cầu scenario headless cho phần không xuất hiện trong contract, đối chiếu với trợ giảng hoặc Coach trước khi chốt tiêu chí kiểm chứng.
