# Phase 1 · Kiểm chứng và ghi chép

Kiểm tra trên Windows 11 với Node.js 24.14.0 và Chrome dùng WebGL 2. `npm ci` cài thành công từ bản sao manifest và lockfile trong thư mục trống. Chưa chạy trên máy macOS hoặc Linux.

| Yêu cầu | Cách kiểm tra và kết quả |
| --- | --- |
| Đảo 3D, Mây, 5 đèn, đom đóm, Bóng Mực, HUD | Chrome tải cảnh WebGL 2 và hiển thị HUD `0/5`. Giữ D đến khi nhặt đom đóm, HUD và điểm cập nhật. [Ảnh lúc mới vào đảo](phase-1-browser.png). |
| Thắp đèn, sáng dần, thắng | Phát lại thao tác bàn phím từ màn mặc định với seed 42 bằng đồng hồ khung hình điều khiển được. Sau 1.521 tick, HUD hiển thị `5/5` và hộp thoại thắng báo 998 điểm. Lần chụp ảnh bằng SwiftShader bỏ lệnh vẽ ở các khung trung gian để tăng tốc, rồi vẽ lại khung cuối. [Ảnh màn thắng](phase-1-win.png). |
| Thua và chơi lại | Đứng yên sau khi nhặt đom đóm cho tới khi hết sinh lực. Bấm **Chơi lại**, HUD trở về 3 sinh lực, 0 đom đóm và 2:30. |
| Điều khiển, điểm và Test Contract v1.0 | `npm test` đạt 7/7. Bao gồm chuẩn hóa chuyển động, camera yaw, nhảy, giữ input, giới hạn nhặt, thắp đèn, pulse, vùng an toàn, mất sinh lực, hết giờ, snapshot, seed âm, tính tất định và dữ liệu sai trả mã 2. |

Ví dụ chạy không truyền input với seed 42, dừng sớm ở tick 577 khi hết sinh lực.

```sh
node headless.js --seed 42 --night 1 --ticks 600 --out out.jsonl
```

```json
{"type":"end","ticks":577,"state":"lost","score":0}
```

## Giả định

- Vòng đảo giữ người chơi trong phạm vi 34 m. Không bật hình phạt rơi đảo và không rơi đom đóm khi bị chạm.
- Camera cố định góc nhìn, bám vị trí Mây. Nhảy đổi độ cao hiển thị. Nhặt, nạp, tỏa sáng và va chạm dùng khoảng cách ngang XZ theo contract.
- E nạp vào đèn chưa sáng gần nhất trong tầm. Khi có nhiều đèn cùng khoảng cách, ưu tiên đèn có ID nhỏ hơn. Có thể nạp từng phần. Điểm thời gian và sinh lực chỉ cộng khi thắng.
- Bản web dùng seed 42 để lặp lại màn khi chơi lại. Màn mặc định có hai Bóng Mực, thêm một con mỗi 15 giây cho đến khi đủ năm. Các đối tượng trang trí và bản đồ nhỏ chỉ nằm trong phần hiển thị.

## Nhật ký AI

- Dùng Codex với Superpowers và Ponytail để đọc PRD, viết kiểm thử CLI trước, triển khai mô phỏng dùng chung và kiểm tra lại bằng Chrome. Đối chiếu cách tải mô-đun với [tài liệu cài đặt Three.js](https://threejs.org/manual/pages/installation.html).
- Kiểm chứng phát hiện `parseArgs` từ chối seed âm truyền rời và pulse có thể đẩy Bóng Mực vào vùng đèn. Đã thêm ca kiểm tra tái hiện trước khi sửa.
- Ước tính khoảng 10–15 nghìn token đầu ra dựa trên lượng mã, kiểm thử và ghi chép tạo trong phiên. Không có số đo token hoặc chi phí từ phiên chạy.
