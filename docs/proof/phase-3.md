# Phase 3 — kiểm chứng

## Quyết định mô hình (ADR)

Phase 3 thay trạng thái đèn chỉ có `lit/deposited` bằng fuel nguyên nội bộ theo đơn vị 1/60, cùng `ever_lit` và `relit_count`. Snapshot chỉ làm tròn fuel để dễ đọc. Mỗi tick đèn sáng mất 1/60 fuel; mỗi Bóng Mực đang hút mất thêm 5/60. Hết fuel tắt đèn nhưng giữ `ever_lit`, để lần sau cần 5 đom đóm thay vì 10. Đèn sáng đủ fuel không nhận tương tác, đèn thiếu fuel được nạp theo số đom đóm nguyên tối thiểu.

Điều kiện thắng đổi từ thắp hết đèn (`all_lit`) sang còn sống đến bình minh và giữ ít nhất `ceil(0.6 × số đèn)` đèn sáng. Kiểm tra hết Ngọn Lửa chạy trước điều kiện bình minh để `no_flames` luôn được ưu tiên. Thắp đủ đèn không kết thúc đêm sớm.

### Thay đổi tương thích

- Test cũ kỳ vọng `all_lit` thắng ngay khi đèn cuối được thắp đã được thay bằng kiểm tra tiếp tục chơi đến bình minh.
- Thời lượng đêm thành 240/270/300 giây; điểm thưởng thời gian bị bỏ.
- Snapshot đèn thêm `fuel`, `ever_lit`, `relit_count`; snapshot người chơi thêm `capacity`; snapshot Bóng Mực có `target_lantern_id`.
- Contract 1.2 thêm event `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` có trường `relight`.

## Bằng chứng headless

Các JSONL trong `docs/proof/v1.2/` là đầu ra chạy thật của headless, không chỉnh tay. Tái tạo tại thư mục gốc:

```sh
node headless.js --seed 42 --night 1 --ticks 60 --snapshot-every 60 --scenario docs/proof/v1.2/fuel-drain.scenario.json --out docs/proof/v1.2/fuel-drain.jsonl
node headless.js --seed 42 --night 1 --ticks 1 --scenario docs/proof/v1.2/relight.scenario.json --inputs docs/proof/v1.2/relight.inputs.json --out docs/proof/v1.2/relight.jsonl
node headless.js --seed 42 --night 1 --ticks 2 --scenario docs/proof/v1.2/dawn.scenario.json --out docs/proof/v1.2/dawn.jsonl
node headless.js --seed 42 --night 1 --ticks 0 --scenario docs/proof/v1.2/capacity.scenario.json --out docs/proof/v1.2/capacity.jsonl
npm test
```

Quan sát được: hai Bóng Mực làm fuel giảm từ 29 xuống 18 sau 60 tick; đèn tắt được châm lại bằng 5 đom đóm và trả fuel về 100; 3/5 đèn sáng thắng khi bình minh với `dawn_survived`; năm lần thắp đưa sức chứa lên 20. Bộ test bao gồm ngưỡng fuel 30, hút dầu cộng dồn, nạp đúng 30 khi có Bóng Mực trong vùng an toàn, ưu tiên `no_flames` ở tick bình minh và không thắng sớm.

## Giao diện

Đã mở game trong trình duyệt WebGL cục bộ, vào Settings, bật **Bảng màu dễ phân biệt**, tải lại trang và mở Settings lần nữa. Checkbox vẫn bật. Đã quan sát thanh fuel, trạng thái đèn sáng/tắt, nhấp nháy fuel thấp và HUD sức chứa trong giao diện. Ảnh giao diện không được lưu thành tệp trong thư mục bằng công cụ trình duyệt của phiên này.

## Chạy kiểm tra

`npm test` — 38 test passed, 0 failed (Node test runner, khoảng 20 giây).
