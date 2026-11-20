# Phase 2 · Ba hòn đảo và Test Contract 1.1

[PRD-1 Ba hòn đảo](../../PRD-1-Phase-2-Ba-hon-dao.md) thay bản nháp Phase 2. Các ca hồi quy giữ cấu trúc và input v1.0 ở những điểm PRD mới không thay. F và R vẫn ngắm bằng chuột, cùng HUD hồi chiêu, nón lá có đèn và bản đồ nhỏ.

| Yêu cầu | Cách chạy và mong đợi | Kết quả quan sát |
| --- | --- | --- |
| Ba bản đồ, di chuyển, lướt và rơi | `npm test` kiểm tra chạy, gia tốc, góc camera, rơi, pause và đích bục nhảy. | Qua cầu Đêm 2 không chạm vực. Bục Đêm 2 đưa Mây sang bờ còn lại dù giữ phím ngược. Dốc và bục Đêm 3 đưa Mây lần lượt lên Y = 3 và Y = 6. Đạt. |
| Gió Lạc, Bùa Gió và gió mạnh | [Các kịch bản và JSONL](v1.1/README.md) kiểm tra cướp trước khi Bóng Mực gây hit, thu hồi đom đóm, thời hạn bùa, gió và lịch sinh. | Đạt. Có [ảnh cảnh báo gió và đồng hồ đỏ](v1.1-wind.png) từ Chrome. |
| Thứ tự thắng/thua, điểm và các Đêm | Chạy ca hồi quy và một lượt tự động Đêm 1 từ bản đồ mặc định. Thử ba lần chuyển Đêm trên Chrome với scenario đặt sẵn bấy nhiêu đèn đã sáng để còn một đèn cần nạp. | Đêm 1 mặc định kết thúc ở tick 13.409 với 1.367 điểm và đủ 3 Ngọn Lửa. Trên Chrome, nút tiếp tục chuyển qua ba màn giới thiệu, đèn cuối mở [Bình Minh](v1.1-dawn.png) với 3.024 điểm cộng từ ba Đêm thử nghiệm. Đạt. |
| Tạm dừng và cài đặt | Từ menu và trong Đêm, đổi âm lượng thành 40% và độ nhạy chuột thành 125%. Tải lại và kiểm tra mức lưu, tạm dừng bằng P/Esc rồi tiếp tục. | Cả hai giá trị vẫn giữ sau khi tải lại. Đổi âm lượng xuống 37% cập nhật gain thành 0,37. Cùng vị trí chuột, độ nhạy 50% và 150% cho hai hướng F khác nhau. Khi pause, đồng hồ đứng yên. Sau khi thua do hết giờ, Chơi lại mở đúng Đêm vừa thua. [Ảnh menu](v1.1-menu.png) và [ảnh pause](v1.1-pause.png). Đạt. |
| Âm thanh, HUD và bảng màu | Chạy Chrome. Đối chiếu màu cấu hình, thanh 10 ô, ba vị trí HUD trên cao, prompt nạp và hồi chiêu. Kiểm tra lệnh phát Web Audio cho nền, lướt, gió và đếm ngược. | [Đêm 1](v1.1-hud.png), [Đêm 2](v1.1-night-2.png), [Đêm 3](v1.1-night-3.png). Các lệnh phát đã kiểm tra hoạt động. Mức sáng môi trường lấy trực tiếp từ công thức 0,15 + 0,55 × tỷ lệ đèn sáng. |
| Giữ F và R | Nạp sẵn đom đóm cho Mây, đưa chuột sang trái và sang phải trên Chrome, nhấn F rồi R. | Bản đồ nhỏ xác nhận Mây dịch chuyển về phía chuột ở cả hai lần. F tiêu 1 đom đóm và R tiêu 2. [Ảnh bên trái](v1.1-f-left.png), [ảnh bên phải](v1.1-f-right.png). Đạt. |

## Chạy và hiệu năng

- `npm test` đạt 31/31, bao gồm giữ phím, biên khoảng cách, pause, choáng, RNG, TTL, kiểm tra JSONL và ca hồi quy theo luật PRD-1.
- Headless Đêm 3 chạy đủ 21.600 tick trong 186,4 ms, có lịch sinh thực thể tự nhiên. Scenario đo để Mây bất tử và tắt gió nhằm tránh kết thúc sớm. [Lệnh đo và đầu ra thật](v1.1/README.md).
- Chrome ở 1280×720 đo khoảng **60 FPS** trong 5 giây bằng `requestAnimationFrame` sau khi vào lại Đêm 1. Canvas có đúng 1280×720 pixel, WebGL dùng ANGLE Direct3D11 trên Intel Iris Xe. Máy dùng Windows 11, Intel Core i5-13500H (16 luồng logic), RAM khoảng 15,6 GiB và Node.js 24.14.0. Lần ép chạy bằng SwiftShader đạt khoảng 16 FPS; kết quả đạt mốc 30 FPS dùng GPU. Chưa đo trên macOS/Linux.
- Lượt đi trọn ba Đêm trên trình duyệt dùng scenario đặt sẵn tiến độ. Lượt chơi mặc định được phát lại headless đầy đủ cho Đêm 1. Việc phát âm được kiểm tra qua lệnh Web Audio trong Chrome, chưa thu âm bằng thiết bị ngoài.

## Quy ước và nhật ký AI

- Đêm 2 xuất phát ở tâm đảo A, Đêm 3 ở `(0, 0, −10)`. Cả hai nhìn +Z. Điểm sương chọn từ các vòng cố định gần mép đảo, dùng seed qua cùng bộ sinh ngẫu nhiên với gameplay.
- `player.invuln` tính bằng giây còn lại, `ttl_s` của đom đóm thường và `wind.dir_deg` khi gió không hoạt động đều là `null`. `night_start` ghi ở bước mô phỏng đầu tiên. Tick bỏ pause tiếp tục mô phỏng ngay.
- R giữ hiệu ứng choáng và thưởng +5 khi người chơi chủ động bắn. Các lượt headless chuẩn không có F/R vẫn theo công thức PRD-1. Tia chuột lấy mặt phẳng ngang ở độ cao Mây đang đứng để ngắm được trên các tầng.
- Dùng Codex, Superpowers và Ponytail để đối chiếu PRD, làm riêng mô phỏng, contract và giao diện rồi chạy kiểm tra tích hợp. Kiểm tra hình ảnh phát hiện tháp che Mây khi đứng phía sau, nên tháp được làm mờ trong góc đó. Token đầu ra ước tính khoảng 15–25 nghìn theo lượng mã và kiểm thử; không có số đo trực tiếp.
