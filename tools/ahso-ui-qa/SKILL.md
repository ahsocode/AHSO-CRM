---
name: ahso-ui-qa
description: Kiểm tra giao diện và chức năng AHSO CRM trước khi push — kiểm tra tĩnh rẻ, e2e Playwright trên stack Docker cô lập, và kiểm tra trực quan có giới hạn token chỉ cho trang vừa sửa. Dùng mỗi khi Henry nói "test giao diện", "QA trước khi push", "kiểm tra UI", "review giao diện sau khi sửa", hoặc sau khi sửa bất kỳ file nào trong frontend/ của AHSO CRM.
---

# AHSO CRM — UI QA trước khi push

Mục tiêu: **bắt lỗi trước khi push** với chi phí token thấp nhất. Phần lớn việc kiểm tra do
script và Playwright làm (0 token). Claude chỉ nhìn giao diện ở những trang vừa thay đổi.

## Bậc kiểm tra (luôn đi từ rẻ đến đắt, dừng khi có lỗi)

| Bậc | Ai chạy | Lệnh | Chi phí |
|---|---|---|---|
| 1. Tĩnh | Claude (sandbox) hoặc Mac | `npm run qa:static` | vài giây, ~0 token |
| 2. Type/lint/unit | Mac | `npm run qa:prepush -- --fast` | ~3 phút, 0 token |
| 3. E2E chuyên sâu | Mac (Docker) | `npm run qa:prepush` | ~10 phút, 0 token |
| 4. Trực quan | Claude + Chrome | chỉ các trang trong diff | ~1–2k token/trang |

> Sandbox của Claude **không chạy được** Docker, Vitest, Playwright (node_modules cài trên macOS).
> Bậc 2–3 phải chạy trên Mac của Henry. Claude giao lệnh, Henry dán **chỉ phần lỗi** về.

## Quy trình

1. **Xác định phạm vi** (không đọc lại codebase):
   ```bash
   git diff --name-only origin/main...HEAD; git status --short
   ```
   Đối chiếu `references/route-map.md` → danh sách trang + `--grep` cho Playwright.

2. **Bậc 1 — tĩnh** (chạy được trong sandbox):
   ```bash
   python3 tools/ahso-ui-qa/scripts/static_checks.py          # file đã đổi so với origin/main
   python3 tools/ahso-ui-qa/scripts/static_checks.py --all    # toàn bộ (trước release lớn)
   ```
   Sửa hết dòng `ERROR` trước khi đi tiếp. `WARN e2e … strict-mode risk` → mở selector đó trong
   `e2e/`, thêm `{ exact: true }` hoặc làm nhãn trong UI là duy nhất (ưu tiên sửa UI).

3. **Viết/cập nhật e2e cho chức năng vừa sửa** — đây là "test chuyên sâu", chạy miễn phí mãi về sau:
   - Chức năng mới/sửa hành vi → thêm test vào `e2e/ui-regression.spec.ts` (hoặc spec của module).
   - Đổi nhãn/chuỗi mà e2e đang dùng → sửa selector cùng commit (bậc 1 báo `ERROR e2e`).
   - Test **không được** lưu dữ liệu ngoài seed rồi để lại; tạo gì thì xóa trong `finally`.

4. **Bậc 2–3 — giao cho Henry chạy trên Mac:**
   ```bash
   npm run qa:prepush                       # đầy đủ
   npm run qa:prepush -- --grep "Báo giá"   # chỉ test liên quan (nhanh khi lặp sửa)
   ```
   Lần đầu: `npm run qa:prepush -- --install-hook` để tự chạy khi `git push`
   (bỏ qua khẩn cấp: `SKIP_QA=1 git push`).

5. **Bậc 4 — trực quan, chỉ khi diff đụng layout/style** (đọc skill `anthropic-skills:chrome-browser` trước):
   - Chạy trên stack QA đang mở (`--keep` → http://localhost:3100) hoặc production **chỉ đọc**.
   - **Ngân sách:** tối đa 1 screenshot `scale: 0.5` cho mỗi trang trong phạm vi; kiểm tra chữ/cấu trúc
     bằng `get_page_text` / `find` / `javascript_tool` thay vì chụp thêm.
   - Đối chiếu `references/visual-checklist.md`. Không lưu/gửi/xóa dữ liệu thật trên production.
   - Đóng mọi tab đã mở trước khi kết thúc.

6. **Báo cáo** (ngắn): bậc nào pass/fail, lỗi đã sửa, việc còn lại. Không mô tả lại từng bước.

## Bẫy đã gặp (đừng lặp lại)

- **Dịch nhãn tạo chữ trùng** trên cùng trang → Playwright strict mode fail. Bậc 1 bắt được (`eyebrow`, `e2e WARN`).
- **Sửa một dòng lỗi e2e rồi push ngay** → test fail ở dòng kế tiếp. Luôn đọc hết test đó và chạy `--grep` trên Mac.
- **Grep chỉ bắt chữ giữa thẻ JSX** → sót chuỗi trong prop (`eyebrow=`, `placeholder=`…). `static_checks.py` quét cả prop.
- **Màu gán theo index mảng** → "Hoàn thành" màu đỏ. Màu trạng thái luôn lấy `CHART_STAGE_COLORS[status]`.
- **Số rút gọn cho tiền báo giá** ("1,4 tr") → báo giá/hợp đồng luôn hiển thị số đầy đủ (`formatVND`).
- **Git object hỏng trên exFAT:** commit từ sandbox từng ghi một tree object dạng thô chưa nén → 4 commit
  không push được. `prepush.sh` chạy `git fsck --connectivity-only` đầu tiên. Cách sửa đã dùng: tìm thư mục
  có tree hỏng, dựng lại các entry, xác nhận bằng mã băm khớp **trước khi** ghi (`git mktree`), không bao giờ
  xóa object khi chưa có bản sao. Sau mỗi lần commit từ sandbox: `git fsck --connectivity-only --no-dangling`.
- **Ổ TRANSCEND (exFAT):** sandbox có thể đọc file bị cắt ngắn; bậc 1 báo `ERROR fsync` → ghi lại file từ phía Mac.
  File rác `._*` làm vỡ jest/vitest → `prepush.sh` tự xóa.
- **Selector e2e dạng regex** (`/Xuất CSV \+ Excel/i`) không lộ ra khi grep chuỗi nguyên văn → đổi nhãn
  làm vỡ test. `static_checks.py` kiểm tra cả regex selector; vẫn nên `grep -rn "<từ khóa>" e2e/` khi đổi nhãn nút.
- **Chữ ghép từ biểu thức** (`{n} milestone`, `` `${n} mốc` ``, `Owner: {name}`) và câu tiếng Việt lẫn từ
  tiếng Anh: script bắt được; chuỗi **toàn tiếng Anh** = ERROR (chặn push), **câu Việt lẫn từ vay mượn**
  (template, export, draft…) = WARN loanword — dọn theo đợt, không chặn push.
- **Lệnh gửi cho Henry:** không kèm chú thích `# ...` cuối dòng — zsh trên macOS không coi `#` là chú thích
  khi gõ trực tiếp, phần sau `#` bị truyền thành tham số.
- **Mở tab mới** từng làm đăng xuất mọi tab — mọi thay đổi ở `lib/api-client.ts`, `lib/auth.ts`,
  `dashboard-shell.tsx`, `middleware.ts` phải chạy `--grep "phiên"` + `auth.spec.ts`.
- **Dialog lồng trong `<form>`:** `Dialog` của dự án không dùng portal → dialog đặt trong form cha thì
  Enter submit form cha, còn `form.reset()` (không tham số) gọi `form.reset()` gốc của trình duyệt và xóa
  sạch form cha. Luôn render dialog **ngoài** `</form>` và reset bằng giá trị cụ thể `reset({...})`.
- **`<select>` gán giá trị trước khi option tải xong** (`?projectId=` trên báo giá/hợp đồng) → ô chọn trống.
  Gán lại bằng `setValue` trong `useEffect` khi danh sách đã về. Test: `expect(locator).toHaveValue(id)`.
- **Effect reset form ghi đè dữ liệu người dùng đang nhập** khi query refetch → chặn bằng `formState.isDirty`.
- **`onError` dùng câu chung chung** ("Không thể xác nhận phiếu.") che mất lý do từ backend → luôn
  `getApiErrorMessage(error, "<câu mặc định>")`.
- **Endpoint quên guard:** khi thêm controller, mọi `@Get` đều phải có `JwtAuthGuard` + quyền phù hợp.
  Kiểm tra nhanh trên stack QA: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3101/api/<route>` phải ra 401.
- **`docker compose up` fail, postgres exit (1) sau ~1s:** ổ đĩa Docker Desktop đầy do build cache/image cũ
  (`initdb: No space left on device`). Dọn: `docker builder prune -f` rồi `docker image prune -a -f`
  (không prune volume — có dữ liệu dev). Xem dung lượng: `docker system df`.
- **Chuỗi trong e2e không phải selector** (dữ liệu test, thông báo từ backend) → thêm `// qa-static: not-ui`
  cuối dòng để `static_checks.py` bỏ qua.

## Tiết kiệm token khi điều phối model rẻ hơn

- Giao Haiku: bậc 1, sửa chuỗi/nhãn, sửa selector e2e theo output lỗi.
- Giao Sonnet: viết e2e mới, sửa lỗi hành vi.
- Opus chỉ khi đụng auth/phiên hoặc lỗi e2e không rõ nguyên nhân sau 1 lần sửa.
- Khi Henry dán lỗi Playwright: chỉ cần khối `title + Error + Locator + dòng code`, không cần toàn bộ log.
