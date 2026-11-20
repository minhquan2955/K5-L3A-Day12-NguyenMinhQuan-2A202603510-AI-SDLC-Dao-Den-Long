# Hướng dẫn làm việc

- Đọc PRD hoặc ticket của phase hiện tại, rồi đối chiếu với hành vi và kiểm thử của phase trước.
- Giữ mô phỏng 60 tick/giây trong `game.js`. `view.js` xử lý bàn phím và hiển thị, `headless.js` đọc kịch bản và ghi JSONL.
- Khi đổi thông số, cập nhật `game.contract.json` để cả trình duyệt và headless dùng cùng giá trị.
- Chạy `npm ci` để cài, `npm start` để chơi và `npm test` để kiểm chứng Test Contract. Khi đổi giao diện, thử trình duyệt hỗ trợ WebGL 2.
- Ghi lệnh, kết quả đã quan sát và giới hạn kiểm chứng vào `docs/proof/`.
- Dùng [PRD-1 Ba hòn đảo](PRD-1-Phase-2-Ba-hon-dao.md) cho Test Contract v1.1. Giữ cấu trúc v1.0 ở những phần PRD-1 không thay và chạy lại các ca hồi quy với thông số mới.
- Dùng `simTick` cho mọi thời hạn gameplay. `tick` tiếp tục tăng trong lúc pause. Kiểm tra lịch sinh, TTL và cooldown quanh các tick biên.
- Đặt bản đồ và truy vấn mặt đất trong `maps.js`, chuyển động trong `movement.js`, Bóng Mực/Gió Lạc trong `enemies.js`. Giữ hiệu ứng, chuột và âm thanh ở `view.js`; F và R vẫn ngắm theo chuột.
