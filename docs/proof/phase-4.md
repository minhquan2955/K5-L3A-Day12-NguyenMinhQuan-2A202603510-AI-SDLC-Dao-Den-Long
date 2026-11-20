# Kiểm chứng Phase 4

- AC-01–02. `node bench.js --seed 42 --duration 30 --out bench.json` chạy Three.js trong Chrome trên Windows 11 build 26200, Intel Core i5-13500H, cửa sổ yêu cầu 1280×720. Báo cáo ghi 144,70 FPS trung bình, 79,51 FPS ở nhóm 1% khung hình chậm nhất và 1.384 ms tải cảnh. Đây là số đo tham khảo, chưa chạy trên máy chấm. Xem [bench.json](../../bench.json).
- AC-03. `node soak.js --seed 7 --nights 10 --out soak.json` chạy 10 đêm, không crash, RSS 49,4 → 56,1 MB (+13,6%). Xem [soak.json](../../soak.json).
- AC-04–05. `npm test` kiểm tra tên, thứ tự và top 10, khởi động lại server rồi so sánh dữ liệu trên API và file export.
- AC-06–08. Đã triển khai đổi phím, cảnh báo, giảm chuyển động và chữ lớn. Kiểm tra giao diện tương tác chưa hoàn tất vì công cụ điều khiển Chrome không đọc được URL cửa sổ. Chưa có ảnh 1280×720 cho mục này.
- AC-09–10. Cài và chạy từ README bằng `npm ci` và `npm start`. Workflow chạy khi đẩy tag `phase-4` để kiểm tra hồi quy, đóng gói bản web và tạo Release `v1.0.0`.
- AC-11. Có [retro](../retro.md) tổng hợp bốn phase.
- AC-12. Chưa có video demo.
