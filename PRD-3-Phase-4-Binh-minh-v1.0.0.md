# PRD-3 — Bình minh v1.0.0

**Phase 4** · **Non-functional và Release, ưu tiên cao** · **Tag `phase-4` + GitHub Release `v1.0.0`** · **Test Contract `1.3`**

## 1. Mục tiêu và phạm vi

Đưa game thành sản phẩm có thể phát hành, đo hiệu năng được, chạy ổn định lâu dài, có bảng xếp hạng cục bộ, hỗ trợ tiếp cận và dễ cài đặt. Tất cả yêu cầu dưới đây có phép đo hoặc checklist nghiệm thu.

Sáng tạo từ các phase trước được giữ nếu không làm đổi luật, số liệu, Test Contract hoặc đầu ra headless. Trong benchmark và soak test, nội dung sáng tạo phải được tắt hoặc không ảnh hưởng phép đo để các bài dùng cùng cảnh chuẩn. Contract v1.0–v1.2 tiếp tục áp dụng.

## 2. Chế độ benchmark

### AC-01 — Lệnh và cảnh đo chuẩn

Chương trình cung cấp lệnh benchmark theo `bench_cmd` trong `game.contract.json`, có thể chạy theo dạng:

```text
<bench_cmd> --seed 42 --duration 30 --out bench.json
```

Lệnh mở cửa sổ 1280×720, không toàn màn hình. Tắt VSync nếu engine cho phép; nếu không, README ghi rõ giới hạn đó. Tải Đêm 1 với toàn bộ hiệu ứng và ánh sáng của chế độ chơi thường.

Khi bắt đầu đo, cảnh chuẩn có đúng 200 Bóng Mực trạng thái `wander`, rải đều trên đảo theo seed 42, đúng 100 đom đóm (được vượt trần gameplay), và đèn L1–L3 đang sáng với fuel 100. Tắt sinh thêm thực thể, sát thương, nhặt đom đóm, hao dầu và điều kiện kết thúc Đêm. Bóng Mực vẫn di chuyển theo luật `wander`.

Không nhận input người chơi. Mây đứng yên tại `(0, 0, 0)`. Camera bay vòng tròn quanh `(0, 0, 0)` bán kính 30 m, ở Y = 15 m, luôn nhìn vào tâm. Bắt đầu tại `(30, 15, 0)`, quay ngược chiều kim đồng hồ khi nhìn từ trên xuống, một vòng trong 15 s.

### AC-02 — Đo và xuất kết quả benchmark

- Bỏ 3 s đầu để khởi động, sau đó đo đúng số giây `--duration` rồi thoát mã 0.
- Ghi `bench.json` với các trường và kiểu dữ liệu sau:

```json
{
  "contract_version": "1.3",
  "avg_fps": 87.3,
  "p1_low_fps": 52.1,
  "frame_ms_p95": 14.2,
  "frames": 2619,
  "load_ms": 2400,
  "peak_mem_mb": 512,
  "vsync_off": true,
  "renderer": "mô tả engine/renderer và phiên bản",
  "os": "tự điền"
}
```

| Trường | Định nghĩa |
|---|---|
| `frames` | Số khung hình `N` trong khoảng đo. |
| `avg_fps` | `1000 × N / Σ dt_i`, với `dt_i` là thời lượng mỗi khung tính bằng ms. |
| `p1_low_fps` | `k = max(1, ceil(0.01 × N))`; lấy `k` giá trị `dt` lớn nhất. Kết quả là `1000 / trung bình(k giá trị đó)`. |
| `frame_ms_p95` | Phân vị 95 của `dt` tính bằng ms. |
| `load_ms` | Thời gian từ khi tiến trình bắt đầu đến khung hình đầu tiên của cảnh benchmark. |
| `peak_mem_mb` | RSS cao nhất của tiến trình trong lúc đo. Nếu bản web không đọc được, ghi `null` và giải thích trong README. |
| `vsync_off` | `true` nếu tắt được VSync, nếu không thì `false`. |
| `renderer` | Mô tả engine/renderer và phiên bản. |
| `os` | Hệ điều hành đang đo. |

Trên máy chấm do giảng viên công bố, ngưỡng đạt là `avg_fps ≥ 60`, `p1_low_fps ≥ 30` và `load_ms ≤ 10000`. Kết quả tự đo của học viên phục vụ tham khảo. Ghi máy đo và cấu hình trong bằng chứng.

## 3. Soak test

### AC-03 — Chạy 10 Đêm liên tục

Chương trình cung cấp lệnh theo `soak_cmd` trong `game.contract.json`, có thể chạy theo dạng:

```text
<soak_cmd> --seed 7 --nights 10 --out soak.json
```

Chạy 10 Đêm trong cùng một tiến trình, luân phiên Đêm 1 → 2 → 3. Đêm thứ `i` dùng seed `7 + i` và chạy đến khi kết thúc hoặc đạt thời lượng chuẩn. Input giả lập tất định theo seed: mỗi 30 tick chọn lại hướng di chuyển; mỗi tick xác suất 5% nhảy, 3% lướt, 2% Tỏa Sáng, 10% tương tác.

Ghi `mem_start_mb` là RSS sau khi tải xong Đêm đầu tiên. Ghi `mem_end_mb` là RSS sau khi reset xong Đêm cuối cùng. Xuất JSON có cấu trúc sau:

```json
{
  "nights": 10,
  "crashes": 0,
  "results": ["lost", "won", "lost"],
  "mem_start_mb": 120,
  "mem_end_mb": 131,
  "duration_s": 84.2
}
```

Ngưỡng đạt là `crashes = 0` và `mem_end_mb ≤ 1.2 × mem_start_mb`. Lưu JSON thật do lệnh chạy tạo ra, không chỉnh sửa thủ công.

## 4. Bảng xếp hạng cục bộ

### AC-04 — Lưu và xem điểm

- Sau màn Bình Minh khi thắng Đêm 3, hoặc sau khi thua ở bất kỳ Đêm nào, cho người chơi nhập tên để lưu điểm.
- Tên dài 3–12 ký tự ASCII, chỉ gồm `[A-Za-z0-9_]`. Hỗ trợ tiếng Việt có dấu là phần cộng thêm, không bắt buộc.
- Mỗi mục gồm `name`, `score` (tổng điểm các Đêm đã thắng), `nights_won` (0–3), `achieved_at` (ISO 8601 có múi giờ) và `seed`.
- Lưu tối đa top 10, sắp xếp `score` giảm dần. Nếu bằng điểm, người đạt trước đứng trên.
- Lưu trên ổ đĩa cục bộ và giữ dữ liệu sau khi đóng/mở lại game.
- Có màn hình Bảng xếp hạng truy cập được từ menu chính.

### AC-05 — Xuất bảng xếp hạng

Lệnh `<run_cmd> --export-leaderboard out.json` xuất JSON dạng `{"entries": [ ... ]}` theo đúng thứ tự xếp hạng. Kiểm tra tên hợp lệ/không hợp lệ, top 10, điểm hòa theo thời gian đạt, dữ liệu sau khởi động lại và thứ tự file xuất.

## 5. Tính năng tiếp cận

### AC-06 — Đổi phím

Cho phép gán lại mọi hành động: bốn hướng di chuyển, nhảy, lướt, tương tác, Tỏa Sáng và tạm dừng. Phát hiện phím trùng và thông báo cho người dùng. Có nút **Khôi phục mặc định**. Lưu thiết lập qua lần chạy sau.

### AC-07 — Phụ đề và chỉ báo hình ảnh

Hiển thị chỉ báo cho Bóng Mực xuất hiện, gồm mũi tên hướng ở mép màn hình; gió sắp thổi; 10 giây cuối; và đèn fuel < 30. Chỉ báo phải dễ nhận ra khi người chơi không nghe âm thanh.

### AC-08 — Giảm chuyển động và cỡ chữ

- Có tùy chọn giảm chuyển động để tắt rung camera và hiệu ứng chớp màn hình.
- Cỡ chữ UI tối thiểu 18 px tại 1280×720.
- Có tùy chọn chữ lớn với hệ số ×1,25.

Kiểm tra các cài đặt trong game, lưu trạng thái qua lần mở tiếp theo và lưu ảnh bằng chứng tại độ phân giải yêu cầu.

## 6. Đóng gói và tài liệu phát hành

### AC-09 — Clone sạch và chạy game

Từ một bản clone sạch, người dùng làm theo README trong tối đa 3 lệnh là cài đặt/chạy được game. Thử quy trình trên thư mục hoặc máy sạch.

README có mô tả ngắn, ảnh chụp hoặc GIF, yêu cầu hệ thống, cài đặt, điều khiển, cách chạy test, headless, benchmark và soak test. Nêu rõ VSync nếu không thể tắt hoặc RSS nếu không đo được trên bản web.

### AC-10 — Hồ sơ phát hành

- `CHANGELOG.md` có mục cho cả bốn phase.
- `CREDITS.md` liệt kê nguồn mọi asset, âm thanh và công cụ AI tạo nội dung.
- Repo có `LICENSE`.
- GitHub Release `v1.0.0` có bản chạy được: file thực thi, thư mục web tĩnh hoặc Docker image kèm hướng dẫn sử dụng.

## 7. Test Contract v1.3

- `contract_version` là `"1.3"`.
- `game.contract.json` thêm `bench_cmd` và `soak_cmd`.
- Mọi yêu cầu Test Contract v1.0–v1.2 vẫn được giữ nguyên.
- Lệnh benchmark và soak test phải tạo output đúng schema và ngưỡng trong các mục 2–3 của PRD này.

## 8. Retro và video demo

### AC-11 — Retro

Tạo retro dài 1–2 trang, tên và vị trí tự chọn. Nội dung tổng hợp Evaluation của bốn phase, điều gì hiệu quả hoặc không hiệu quả khi làm với AI, các lần AI sai và cách phát hiện, harness hữu ích nhất trong `AGENTS.md`/skill/hook, tổng token hoặc chi phí AI ước tính, cách tiết kiệm token và điều sẽ làm khác nếu bắt đầu lại.

### AC-12 — Video demo

Video `.mp4` dưới 5 phút, đính kèm GitHub Release `v1.0.0` hoặc lưu tại `docs/demo/demo.mp4`. Video có đoạn chơi trực tiếp và bằng chứng game chạy đúng, gồm test, headless và benchmark. Đặt đường dẫn video ở đầu README và bảo đảm người xem mở được.

## 9. Điều kiện hoàn thành Phase 4

- Có bằng chứng cho yêu cầu Phase 4, gồm kết quả benchmark và soak test thật do chính lệnh tương ứng tạo ra. Commit `bench.json` và `soak.json` vào repo.
- Tag `phase-4` và GitHub Release `v1.0.0` có bản chạy được.
- Mọi test ẩn Phase 1–3 còn hiệu lực tiếp tục đạt.
- Repo public, có đủ harness AI, ghi chép và tài liệu theo yêu cầu nộp bài.
- Có retro 1–2 trang và video demo `.mp4` dưới 5 phút.
