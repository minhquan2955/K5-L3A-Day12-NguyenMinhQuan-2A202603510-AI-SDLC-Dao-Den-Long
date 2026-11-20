# PRD-2 — Đèn cạn dầu

**Phase 3** · **Change Request, ưu tiên rất cao** · **Tag `phase-3`** · **Test Contract `1.2`**

## 1. Mục tiêu

Thay mục tiêu từ thắp hết đèn sang giữ đủ số đèn sáng đến bình minh. Đèn đang sáng tiêu hao nhiên liệu và Bóng Mực có thể hút dầu. Các luật Phase 1–2 không bị Ticket-03 thay thế tiếp tục áp dụng.

Sáng tạo từ phase trước được giữ nếu không xung đột luật mới, số liệu chuẩn, Test Contract hoặc đầu ra headless. Ghi quyết định thay đổi mô hình trạng thái đèn và điều kiện thắng trong ADR hoặc ghi chú tương đương. Cập nhật hoặc loại bỏ test cũ bị ảnh hưởng kèm lý do, không bỏ qua âm thầm.

## 2. Nhiên liệu đèn

### AC-01 — Nhiên liệu và châm dầu

- Nhiên liệu tối đa mỗi đèn là 100. Khi thắp lần đầu hoặc thắp lại, đặt fuel = 100.
- Đèn đang sáng hao 1,0 đơn vị/giây, tương đương `1/60` mỗi tick ở 60 tick/giây.
- Tương tác chọn đèn nhận được gần nhất, hòa thì ID nhỏ hơn. Đèn nhận được là đèn chưa sáng hoặc đèn đang sáng nhưng chưa đầy dầu. Đèn sáng đầy dầu không được chọn.
- Châm đèn đang sáng dùng `used = min(đang mang, ceil((100 − fuel) / 10))`; nhiên liệu mới là `min(100, fuel + 10 × used)`; trừ `used` đom đóm.
- Tính nội bộ bằng đơn vị nguyên `1/60` để tránh sai số số thực. Chỉ làm tròn khi xuất dữ liệu.
- Khi fuel ≤ 0, đèn tắt, `deposited = 0`, phát `lantern_out`, ánh sáng môi trường giảm và `ever_lit` vẫn là true.
- Đèn chưa từng sáng cần 10 đom đóm. Đèn đã từng sáng cần 5 đom đóm để thắp lại. Mỗi lần thắp đặt fuel = 100.
- Đèn đang sáng có thanh nhiên liệu. Khi fuel < 30, đèn và thanh nhiên liệu nhấp nháy chậm 1 Hz.

**Kiểm chứng:** scenario xác nhận hao dầu theo tick, snapshot fuel làm tròn một chữ số, tắt đúng ngưỡng, `ever_lit`, chi phí thắp lại, đèn đầy không nhận tương tác, và chọn đèn theo khoảng cách rồi ID.

## 3. Bóng Mực hút dầu

### AC-02 — Vùng an toàn và chọn mục tiêu

- Đèn sáng có fuel < 30 mất vùng an toàn. Fuel đúng 30 vẫn giữ vùng bán kính 6 m.
- Chỉ Bóng Mực `wander` chọn đèn yếu. Chọn đèn đang sáng có fuel < 30 gần nhất, hòa theo ID nhỏ hơn. Nếu không có đèn yếu thì chọn đèn tắt gần nhất như trước.
- Bóng Mực đang `chase` không đổi mục tiêu.

### AC-03 — Trạng thái `drain`

- Khi cách đèn mục tiêu ≤ 2 m theo XZ, Bóng Mực vào `drain`, đứng yên và hút 5 fuel/giây (`5/60` mỗi tick). Đèn vẫn tự hao 1 fuel/giây. Nhiều Bóng Mực hút cùng đèn thì cộng dồn.
- Từ `drain`, sang `chase` nếu Mây vào trong 6 m; sang `stunned` nếu trúng Tỏa Sáng; sang `wander` nếu đèn tắt, fuel được châm lên ≥ 30 hoặc Bóng Mực cách đèn > 2 m. Hết choáng thì về `wander`.
- Khi đèn được châm lên ≥ 30 lúc có Bóng Mực trong vùng 6 m, đẩy chúng ra mép vùng trong tối đa 30 tick và không gây sát thương lúc bị đẩy.

**Kiểm chứng:** scenario bao gồm chọn mục tiêu khi `wander`, giữ mục tiêu khi `chase`, vào/ra `drain`, hút cộng dồn, hao dầu đồng thời, choáng và đẩy ra khi dầu được châm. Event `fuel_drain` phát mỗi 60 tick trong lúc hút.

## 4. Thắng thua và thứ tự tick

### AC-04 — Giữ đảo sáng tới bình minh

- Thời lượng Đêm 1/2/3 là 240/270/300 giây. Thắp đủ đèn không kết thúc Đêm sớm.
- Mây thắng nếu còn sống khi hết giờ và số đèn đang sáng ở tick cuối đạt ít nhất `ceil(0.6 × tổng số đèn)`. Ngưỡng Đêm 1 là 3/5, Đêm 2 là 4/6, Đêm 3 là 5/7.
- Hết Ngọn Lửa thì thua ngay, gồm cả tick cuối, với lý do `no_flames`. Hết giờ dưới ngưỡng đèn thì thua `dawn`. Thắng có lý do `dawn_survived`.
- Giữ thứ tự xử lý tick của Ticket-02. Ở bước 2 trừ hao dầu tự nhiên và dầu bị hút. Ngay sau bước 2, đèn fuel ≤ 0 tắt. Xét thắng thua sau mọi cập nhật của tick, và ưu tiên hết Ngọn Lửa trước cả ở tick bình minh.

**Kiểm chứng:** kiểm tra không có thắng sớm, ngưỡng từng Đêm, trạng thái đèn sau cập nhật dầu ở tick cuối và ưu tiên `no_flames`.

## 5. Sức chứa và điểm

### AC-05 — Sức chứa tăng theo số lần thắp

- Sức chứa mỗi Đêm là `min(20, 10 + 2 × successful_lights)`.
- `successful_lights` đếm lần thắp thành công, gồm thắp lại. Đèn được đánh dấu sẵn trong scenario không tính. Đặt lại bằng 0 đầu Đêm.
- HUD hiển thị số đang mang / sức chứa hiện tại.

### AC-06 — Tính điểm mới

| Sự kiện | Điểm |
|---|---:|
| Mỗi đom đóm nạp vào đèn, gồm thắp mới, thắp lại, châm dầu | +5 |
| Thắp lần đầu | +100 |
| Thắp lại | +40 |
| Bóng Mực trúng Tỏa Sáng | +5 mỗi con, hoặc +15 nếu ngay trước đó đang `drain` |
| Bình minh khi thắng, mỗi đèn đang sáng | +50 + `floor(fuel)` |
| Bình minh khi thắng, mỗi Ngọn Lửa còn lại | +50 |

Bỏ thưởng thời gian. Tổng điểm game và điểm khi chơi lại giữ nguyên Ticket-02. Kiểm tra điểm qua event thực tế, không cộng khi đèn đầy hoặc tương tác không tiêu thụ đom đóm.

## 6. Chế độ dễ phân biệt màu

### AC-07 — Cài đặt màu

- Thêm cài đặt **Bảng màu dễ phân biệt**, được lưu giữa các lần mở game.
- Khi bật, viền và mắt Bóng Mực đổi từ `#7A3CFF` sang `#00B3FF`.
- Màu cảnh báo UI đổi từ `#FF5A5F` sang `#FFFFFF`, kèm biểu tượng `⚠`.
- Đèn tắt xẹp 20% và có vết rách trên giấy để phân biệt trạng thái mà không cần màu. Đèn sắp hết dầu tiếp tục nhấp nháy.

Kiểm tra cài đặt sau khi khởi động lại và lưu ảnh giao diện cho thấy đèn sáng/tắt khác nhau.

## 7. Test Contract v1.2

Các phần v1.1 không bị Ticket-03 thay đổi tiếp tục áp dụng.

| Bề mặt | Yêu cầu v1.2 |
|---|---|
| Phiên bản và tuning | `contract_version: "1.2"`; thêm `fuel_max: 100`, `fuel_decay_per_s: 1.0`, `fuel_per_mote: 10`, `relight_cost: 5`, `win_ratio: 0.6`, `drain_per_s: 5`, `low_fuel_threshold: 30`, `capacity_max: 20`; đặt `night1_duration_s: 240`, `night2_duration_s: 270`, `night3_duration_s: 300`. |
| Snapshot đèn | Thêm `fuel` (số thực một chữ số thập phân, đèn tắt có fuel 0), `ever_lit`, `relit_count`. |
| Snapshot người chơi | Thêm `capacity`. |
| Snapshot Bóng Mực | Có trạng thái `drain`. |
| Scenario | Đèn nhận `lit`, `fuel`, `ever_lit`; player thêm `successful_lights`; `shades[]` thêm `target_lantern_id`. Đèn `lit: true` thiếu fuel mặc định fuel 100. |
| Event `refuel` | `{lantern_id, amount, fuel}`. |
| Event `lantern_out` | `{lantern_id}`. |
| Event `fuel_drain` | `{lantern_id, shade_id, fuel}`, ghi mỗi 60 tick khi hút dầu. |
| Event `lantern_lit` | Thêm `relight: true|false`. |
| Kết thúc game | `game_over.reason` thêm `dawn_survived`. Không dùng `all_lit`. |

Lệnh chạy và schema nền v1.0–v1.1 tiếp tục theo Test Contract trước đó, trừ các mục được Ticket-03 thay đổi rõ ràng.

## 8. Kiểm thử, ghi chép và bàn giao

- Có scenario headless cho nhiên liệu, châm dầu, hết dầu, thắp lại, chọn mục tiêu, hút dầu, thắng bình minh, sức chứa, điểm và trường contract mới.
- Cập nhật hoặc loại bỏ test cũ bị luật mới làm sai, ghi lý do. Mọi test ẩn Phase 1–2 không bị thay thế tiếp tục đạt.
- Viết ADR hoặc ghi chú tương đương mô tả thay đổi mô hình trạng thái đèn và luật thắng.
- Thêm changelog liệt kê các thay đổi phá vỡ tương thích trong Phase 3.
- Lưu bằng chứng thật, khớp mã tại tag `phase-3`. Commit các cập nhật và gắn, push tag trước hạn.
- Kiểm tra giao diện cho thanh dầu, nhấp nháy dưới 30, HUD sức chứa và chế độ dễ phân biệt màu.

## 9. Trường hợp biên

- Fuel đúng 30 còn vùng an toàn, dưới 30 thì mất vùng an toàn.
- Đèn cạn dầu cùng tick với va chạm hoặc kết thúc Đêm.
- Đèn đầy không được chọn. Châm dầu dùng phép làm tròn lên theo số đom đóm nguyên cần thiết.
- Thắp lại đèn đã sáng dùng 5 đom đóm và đặt fuel về 100.
- Nhiều Bóng Mực hút một đèn trong khi đèn vẫn tự hao dầu.
- Châm dầu từ dưới 30 lên đúng 30 khi Bóng Mực ở trong vùng 6 m.
- Hết Ngọn Lửa đúng tick bình minh luôn trả `no_flames`.
- Đủ đèn sáng trước khi hết giờ vẫn tiếp tục đến bình minh.
- Đèn `lit: true` trong scenario thiếu fuel khởi tạo fuel = 100.
