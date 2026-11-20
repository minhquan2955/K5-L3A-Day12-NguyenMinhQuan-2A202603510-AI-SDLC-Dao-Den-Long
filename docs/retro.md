# Retro Đảo Đèn Lồng

## Bốn phase

| Phase | Kết quả và bài học |
|---|---|
| 1 | Three.js đưa bản đầu lên trình duyệt và mô phỏng 60 Hz đặt nền cho kiểm tra tất định. Tách phần mô phỏng khỏi hiển thị giúp kiểm tra vị trí, va chạm và thắp đèn nhanh. |
| 2 | Thêm ba bản đồ, Gió Lạc, gió và kỹ năng. F ban đầu chưa theo ý người chơi; yêu cầu ngắm theo chuột được phát hiện khi thử điều khiển và được thêm vào test hồi quy. Tag từng chỉ tồn tại local; kiểm tra ref trên GitHub phát hiện thiếu và đã đẩy bổ sung. |
| 3 | Fuel nguyên theo đơn vị 1/60 giữ tính tất định. Test ban đầu kỳ vọng fuel hiển thị 29 ngay sau khi nạp tới 30. Snapshot làm tròn nên vẫn hiện 30.0 ở tick đầu. Kiểm tra thêm tick thứ 30 và vị trí Bóng Mực đã xác nhận cả hao dầu lẫn đẩy khỏi vùng an toàn. |
| 4 | Dùng cùng renderer để đo và cùng mô phỏng để chạy soak. Rà luồng input phát hiện phím di chuyển bị đưa nhầm vào nhóm phím kích hoạt một lần. Bài kiểm tra bảng điểm qua lần khởi động lại bắt được race khi chờ tiến trình con thoát. |

## Dùng AI

AGENTS.md giữ ba ranh giới hữu ích: mô phỏng 60 Hz, giao diện và CLI JSONL. Contract và các tình huống seed cố định cho phép so sánh hành vi qua các phase. Cách tiết kiệm công nhất là đọc PRD hiện tại cùng các test liên quan, tái sử dụng renderer và chạy một bộ hồi quy khi tích hợp.

Ước tính thô từ độ dài hội thoại và kết quả lệnh nhìn thấy là cỡ 40.000–80.000 token cho cả bốn phase. Không có số liệu thanh toán để xác nhận. Nếu làm lại, sẽ lưu ngay kết quả mỗi đợt kiểm tra, kiểm tra tag trên remote sau mỗi lần đẩy và bố trí quay demo từ lần thử game đầu tiên.
