# Hướng dẫn làm việc

- Đọc PRD hoặc ticket của phase hiện tại, rồi đối chiếu với hành vi và kiểm thử của phase trước.
- Giữ mô phỏng 60 tick/giây trong `game.js`. `view.js` xử lý bàn phím và hiển thị, `headless.js` đọc kịch bản và ghi JSONL.
- Khi đổi thông số, cập nhật `game.contract.json` để cả trình duyệt và headless dùng cùng giá trị.
- Chạy `npm ci` để cài, `npm start` để chơi và `npm test` để kiểm chứng Test Contract. Khi đổi giao diện, thử trình duyệt hỗ trợ WebGL 2.
- Ghi lệnh, kết quả đã quan sát và giới hạn kiểm chứng vào `docs/proof/`.
