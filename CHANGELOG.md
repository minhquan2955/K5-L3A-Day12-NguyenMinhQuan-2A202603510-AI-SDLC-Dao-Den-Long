# Changelog

## Phase 4 — PRD-3 / Test Contract 1.3

- Thêm benchmark Three.js và soak 10 đêm qua CLI.
- Thêm bảng xếp hạng cục bộ, đổi phím, chữ lớn, giảm chuyển động và cảnh báo bằng hình.
- Đóng gói bản web chạy qua máy chủ Node cục bộ.

## Phase 3 — PRD-2 / Test Contract 1.2

### Thay đổi tương thích

- Điều kiện thắng chuyển từ thắp tất cả đèn sang sống tới bình minh với tối thiểu 60% số đèn còn sáng; thắp hết đèn không còn kết thúc sớm.
- Thời lượng mỗi đêm tăng thành 240/270/300 giây. Điểm thưởng thời gian bị bỏ.
- Đèn tiêu hao fuel, có thể được nạp, tắt và thắp lại với chi phí thấp hơn. Snapshot thêm `fuel`, `ever_lit`, `relit_count`; contract thêm event `refuel`, `lantern_out`, `fuel_drain`.
- Bóng Mực có thể hút fuel từ đèn yếu và bị đẩy khỏi vùng an toàn khi đèn được nạp lại.
- Sức chứa đom đóm tăng 2 sau mỗi lần thắp thành công, tối đa 20; HUD hiển thị sức chứa hiện tại.
- Thêm tùy chọn bảng màu dễ phân biệt và lưu trạng thái trong trình duyệt.
- Điểm từ mỗi đom đóm nạp vào đèn là +5; thắp lần đầu +100, thắp lại +40, và điểm bình minh dựa trên fuel/Ngọn Lửa còn lại.

Quyết định trạng thái và bằng chứng kiểm chứng: [docs/proof/phase-3.md](docs/proof/phase-3.md).

## Phase 2 — PRD-1 / Test Contract 1.1

- Thêm Đêm 2 và 3, cầu, bục nhảy, Gió Lạc, gió mạnh và Bùa Gió. Thêm F và R ngắm theo chuột.

## Phase 1 — PRD-0 / Test Contract 1.0

- Bản Three.js đầu tiên có Đảo Bến, đom đóm, đèn, Bóng Mực và mô phỏng headless.
