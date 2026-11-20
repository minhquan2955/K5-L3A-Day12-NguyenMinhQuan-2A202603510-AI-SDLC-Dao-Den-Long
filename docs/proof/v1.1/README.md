# Các lượt chạy headless của Test Contract 1.1

Chạy từ thư mục gốc trên Windows 11, Node.js 24.14.0 và Intel Core i5-13500H (16 luồng logic). Mỗi tệp JSONL bên dưới là đầu ra của lệnh tương ứng, với seed cố định 42.

```powershell
node headless.js --night 1 --seed 42 --ticks 24 --snapshot-every 4 --scenario docs/proof/v1.1/dash-pause.scenario.json --inputs docs/proof/v1.1/dash-pause.inputs.json --out docs/proof/v1.1/dash-pause.jsonl
node headless.js --night 2 --seed 42 --ticks 2702 --snapshot-every 386 --scenario docs/proof/v1.1/drifter-charm.scenario.json --inputs docs/proof/v1.1/drifter-charm.inputs.json --out docs/proof/v1.1/drifter-charm.jsonl
node headless.js --night 1 --seed 42 --ticks 62 --snapshot-every 31 --scenario docs/proof/v1.1/fall-dawn.scenario.json --inputs docs/proof/v1.1/fall-dawn.inputs.json --out docs/proof/v1.1/fall-dawn.jsonl
node headless.js --night 3 --seed 42 --ticks 2100 --snapshot-every 300 --scenario docs/proof/v1.1/wind.scenario.json --out docs/proof/v1.1/wind.jsonl
node headless.js --night 1 --seed 42 --ticks 18000 --snapshot-every 1800 --inputs docs/proof/v1.1/night1-win.inputs.json --out docs/proof/v1.1/night1-win.jsonl
Measure-Command { node headless.js --night 3 --seed 42 --ticks 21600 --snapshot-every 3600 --scenario docs/proof/v1.1/full-night.scenario.json --out docs/proof/v1.1/full-night.jsonl }
```

| Ca | Mong đợi | Quan sát | Kết quả |
| --- | --- | --- | --- |
| Lướt và tạm dừng | Giữ nút chỉ lướt một lần. Tạm dừng giữ nguyên vị trí và đồng hồ mô phỏng. | Có `dash` ở tick 1, `paused` ở tick 5 và `resumed` ở tick 13. Snapshot tick 8 và 12 đều có `sim_tick: 4` và cùng vị trí. | Đạt |
| Gió Lạc và Bùa Gió | Cướp 3 đom đóm dù Mây bất tử trong vùng an toàn, trả lại khi trúng Tỏa Sáng. Bùa cho lướt liên tiếp và tự hồi. | Nhặt bùa và bị cướp ở tick 1, Gió Lạc thả 3 đom đóm ở tick 2. Mây lướt ở tick 3 và 15. Bùa vắng ở snapshot 386 và có lại ở 2702. | Đạt |
| Rơi và thắp đèn đúng lúc bình minh | Rơi khi bất tử vẫn mất một Ngọn Lửa và toàn bộ đom đóm. Thắp đèn cuối ở tick hết giờ vẫn thắng. | Rơi ở tick 1, mất 7 đom đóm và còn 2 Ngọn Lửa. Nhặt thêm một đom đóm và thắp L1 ở tick 62. Kết thúc `won` với 210 điểm. | Đạt |
| Gió mạnh | Gió bắt đầu ở tick 1800, tắt ở 2100 và đẩy khoảng 10 m. | `wind.active` đúng ở 1800 và sai ở 2100. Vị trí đổi từ `(0, 0, −25)` đến `(9.999, 0, −25.147)`. | Đạt |
| Thắng Đêm 1 với bản đồ mặc định | Gom đủ ánh sáng và thắp đủ năm đèn trong 18.000 tick với điểm sinh tự nhiên. | `all_lit` ở tick 13.409 và được 1.367 điểm, còn 3 Ngọn Lửa. | Đạt |
| Thời gian chạy Đêm 3 | Hoàn thành 21.600 tick trong tối đa 30 giây. | `end.ticks` bằng 21.600 và `game_over` do `dawn`. Đồng hồ `Stopwatch` đo cả tiến trình và ghi JSONL trong 186,4 ms. Snapshot cuối có 30 đom đóm, 10 Bóng Mực và 2 Gió Lạc. Mây bất tử và gió tắt để lượt chạy kết thúc đúng hạn. | Đạt |

`npm test` kiểm tra thêm trạng thái và thời điểm giữa các snapshot lưu ở đây. Các ca headless kiểm tra mô phỏng, còn bằng chứng giao diện nằm trong báo cáo Phase 2.
