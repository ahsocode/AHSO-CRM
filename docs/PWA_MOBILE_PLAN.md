# PWA & Mobile Optimization — AHSO CRM

> **Dành cho Agent thực hiện:** Đọc toàn bộ file này trước khi bắt tay vào code.
> Thực hiện đúng thứ tự Sprint. Mỗi Sprint là một unit làm việc độc lập.
> Không thêm package mới. Không thay đổi backend hay database.

---

## Ngữ cảnh dự án

- **Repo:** `AHSO-CRM/frontend/` — Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui
- **Deploy:** Docker Compose, self-hosted VPS, production tại `crm.ahso.vn`
- **Quy tắc code:** Xem `CLAUDE.md` ở root repo — đặc biệt 5 luật thiết kế cứng
- **Không** thay đổi backend (`AHSO-CRM/backend/`)
- **Không** cài thêm npm package nếu không được ghi rõ trong task

---

## Hiện trạng — đã có sẵn (KHÔNG làm lại)

| Thứ | File | Trạng thái |
|-----|------|-----------|
| Manifest | `public/manifest.json` | Tồn tại nhưng thiếu icons |
| Service Worker | `public/service-worker.js` | Tồn tại, cache static assets |
| Mobile bottom nav | `components/layout/mobile-bottom-nav.tsx` | Hoạt động tốt, 5 tab |
| Sidebar ẩn trên mobile | `components/layout/sidebar.tsx` | `hidden md:flex` — OK |
| Calendar horizontal scroll | `app/(dashboard)/calendar/_components/` | Đã có `overflow-x-auto` |
| Apple PWA meta tags | `app/layout.tsx` | Đã có `apple-mobile-web-app-capable` |

---

## Sprint 1 — PWA Foundation

**Mục tiêu:** "Add to Home Screen" hoạt động trên iOS Safari và Android Chrome. Nội dung không bị MobileBottomNav che.

**Thời gian ước tính:** 2–3 giờ

---

### Task 1.1 — Tạo icon PNG

**Không cần code.** Tạo 3 file ảnh PNG và đặt vào `frontend/public/`:

| File | Kích thước | Mục đích |
|------|-----------|---------|
| `icon-192.png` | 192×192px | Android homescreen |
| `icon-512.png` | 512×512px | Android splash / maskable |
| `apple-touch-icon.png` | 180×180px | iOS homescreen |

**Yêu cầu thiết kế:**
- Background: `#1a5276` (màu primary của AHSO)
- Foreground: logo chữ "A" hoặc logo-mark trắng, căn giữa
- Logo SVG hiện có ở `frontend/public/logo-mark.svg` — dùng làm nguồn

**Nếu môi trường có ImageMagick:**
```bash
cd frontend/public
convert -background "#1a5276" -gravity center -resize 144x144 -extent 192x192 logo-mark.svg icon-192.png
convert -background "#1a5276" -gravity center -resize 384x384 -extent 512x512 logo-mark.svg icon-512.png
convert -background "#1a5276" -gravity center -resize 130x130 -extent 180x180 logo-mark.svg apple-touch-icon.png
```

**Nếu không có ImageMagick:** Tạo file PNG đơn giản bằng Canvas API (script Node.js):
```javascript
// scripts/generate-icons.mjs
import { createCanvas } from "canvas";
import { writeFileSync } from "fs";

function makeIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a5276";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(size * 0.45)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", size / 2, size / 2);
  writeFileSync(outputPath, canvas.toBuffer("image/png"));
}

makeIcon(192, "frontend/public/icon-192.png");
makeIcon(512, "frontend/public/icon-512.png");
makeIcon(180, "frontend/public/apple-touch-icon.png");
```

---

### Task 1.2 — Cập nhật `public/manifest.json`

**File:** `frontend/public/manifest.json`

**Nội dung mới hoàn chỉnh (thay toàn bộ file):**
```json
{
  "name": "AHSO CRM",
  "short_name": "AHSO CRM",
  "description": "CRM quản lý vòng đời bán hàng kỹ thuật công nghiệp cho AHSO",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "display_override": ["standalone", "browser"],
  "orientation": "portrait-primary",
  "background_color": "#f4f7fb",
  "theme_color": "#1a5276",
  "lang": "vi",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    }
  ]
}
```

---

### Task 1.3 — Thêm apple-touch-icon vào root layout

**File:** `frontend/app/layout.tsx`

Trong `<head>`, thêm 2 dòng sau dòng `apple-mobile-web-app-status-bar-style`:
```tsx
<meta name="apple-mobile-web-app-title" content="AHSO CRM" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

Đồng thời, cập nhật `viewport` export để ngăn iOS auto-zoom khi tap vào input:
```tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false
};
```

---

### Task 1.4 — Đăng ký Service Worker trong Providers

**File:** `frontend/components/providers.tsx`

Thêm `useEffect` đăng ký SW vào component `AppProviders`. Đây là client component nên dùng được `useEffect`.

```tsx
useEffect(() => {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .catch(() => {
        // SW registration failure is non-critical — silently ignore
      });
  }
}, []);
```

**Lưu ý:** Chỉ thêm `useEffect`, không đổi logic khác trong file.

---

### Task 1.5 — Fix content-area padding bottom

**Vấn đề:** `MobileBottomNav` là `fixed bottom-0` cao ~60px. Content cuối trang bị che trên mobile.

**File:** `frontend/components/layout/content-area.tsx`

Tìm element wrapper chính (thường là `<main>` hoặc `<div>` bao content), thêm `pb-20 md:pb-0`:

```tsx
// Trước
<main className="flex-1 overflow-y-auto p-4 md:p-6">
// Sau
<main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
```

*Nếu file dùng className khác, tìm element wrapper ngoài cùng của content và thêm `pb-20 md:pb-0`.*

---

### Task 1.6 — Safe area inset cho MobileBottomNav (iPhone notch)

**File:** `frontend/components/layout/mobile-bottom-nav.tsx`

Thêm padding bottom cho safe area (iPhone X trở lên có home indicator):

```tsx
// Tìm element <nav> ngoài cùng, thêm style inline:
<nav
  className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/96 px-2 pt-2 shadow-[0_-10px_30px_rgba(21,67,96,0.12)] backdrop-blur-xl print:hidden md:hidden"
  style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
>
```

*Dùng `style` inline thay vì Tailwind vì `env()` CSS function không hỗ trợ qua Tailwind utility.*

---

### Task 1.7 — Thêm offline fallback page

**File mới:** `frontend/public/offline.html`

Tạo file HTML thuần (không cần React):

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AHSO CRM — Không có kết nối</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Be Vietnam Pro", sans-serif;
      background: #f4f7fb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      padding: 40px 32px;
      text-align: center;
      max-width: 360px;
      width: 100%;
      box-shadow: 0 4px 24px rgba(26,82,118,0.10);
    }
    .icon {
      width: 56px;
      height: 56px;
      background: #d6eaf8;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    h1 {
      color: #1a5276;
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    p {
      color: #5d6d7e;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    button {
      background: #1a5276;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 12px 28px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }
    button:active { background: #154360; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a5276" stroke-width="2">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9"></path>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
    </div>
    <h1>Mất kết nối mạng</h1>
    <p>AHSO CRM cần kết nối internet để hoạt động. Kiểm tra wifi hoặc dữ liệu di động rồi thử lại.</p>
    <button onclick="window.location.reload()">Thử lại</button>
  </div>
</body>
</html>
```

---

### Task 1.8 — Cập nhật Service Worker với offline fallback

**File:** `frontend/public/service-worker.js`

Tìm dòng:
```javascript
const PRECACHE_ASSETS = ["/manifest.json"];
```
Sửa thành:
```javascript
const PRECACHE_ASSETS = ["/manifest.json", "/offline.html"];
```

Trong `fetch` event handler, tìm comment `// All other same-origin requests` và **trước** dòng return đó, thêm:
```javascript
// Navigation requests (HTML pages): try network, fall back to offline page
if (request.mode === "navigate") {
  event.respondWith(
    fetch(request).catch(() => caches.match("/offline.html"))
  );
  return;
}
```

---

### Verify Sprint 1

Sau khi hoàn thành tất cả task trên, kiểm tra:

```bash
cd frontend
npm run typecheck   # 0 errors
npm run build       # build thành công
```

Kiểm tra thủ công trên Chrome DevTools:
1. Application → Manifest → kiểm tra icons, display, start_url
2. Application → Service Workers → trạng thái "Activated and running"
3. Network tab → Offline → reload trang → phải thấy trang `offline.html`

---

## Sprint 2 — Mobile Responsive Lists

**Mục tiêu:** Danh sách khách hàng và Dashboard dễ đọc trên màn hình 375–430px (iPhone).

**Thời gian ước tính:** 3–4 giờ

---

### Task 2.1 — Dashboard KPI cards: 2 cột trên mobile

**File:** `frontend/app/(dashboard)/dashboard/_components/kpi-cards.tsx`

Tìm div wrapper của các KPI card (thường có `xl:grid-cols-4`), sửa:
```tsx
// Trước
<div className="grid gap-4 xl:grid-cols-4">
// Sau
<div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
```

**Lưu ý:** Chỉ sửa className grid, không đổi nội dung card.

---

### Task 2.2 — Dashboard Revenue chart: responsive height

**File:** `frontend/app/(dashboard)/dashboard/_components/revenue-chart.tsx`

Tìm container bao `<ResponsiveContainer>` hoặc chart wrapper, đảm bảo height responsive:
```tsx
// Nếu đang dùng fixed height kiểu h-[280px]:
<div className="h-[200px] md:h-[280px]">
```

---

### Task 2.3 — Customer list: mobile card layout

**File:** `frontend/app/(dashboard)/customers/_components/customer-table.tsx`

Đây là task lớn nhất Sprint 2. Hiện tại mỗi customer row dùng grid 5 cột (`lg:grid-cols-[...]`). Cần thêm mobile card layout song song.

**Cách tiếp cận:** Trong vòng lặp render từng item, thêm 2 phiên bản:

```tsx
{items.map((item) => (
  <div key={item.id} className="...wrapper...">

    {/* Desktop row — chỉ hiện trên lg+ */}
    <div className="hidden lg:grid lg:grid-cols-[1.3fr_1fr_220px_90px_180px] ...">
      {/* --- Giữ nguyên toàn bộ code desktop hiện tại --- */}
    </div>

    {/* Mobile card — chỉ hiện dưới lg */}
    <Link href={`/customers/${item.id}`} className="flex items-center gap-3 p-4 lg:hidden">
      <AvatarInitials
        name={item.name}
        className="h-10 w-10 shrink-0 rounded-full bg-primary-bg text-sm text-primary"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{item.name}</p>
        <p className="truncate text-xs text-text-secondary">
          {item.phone ?? item.email ?? item.taxCode ?? "—"}
        </p>
      </div>
      <StatusBadge status={item.status} className="shrink-0" />
      <AppIcon name="chevron-right" className="h-4 w-4 shrink-0 text-text-muted" />
    </Link>

  </div>
))}
```

**Quan trọng:**
- Import `Link` từ `next/link` nếu chưa có
- `AvatarInitials`, `StatusBadge`, `AppIcon` đã được import trong file — dùng lại
- Không xoá code desktop
- `item.phone`, `item.email`, `item.taxCode` — kiểm tra type `CustomerListItem` trong `lib/types.ts` để dùng đúng field name

---

### Task 2.4 — Customer filters: horizontal scroll trên mobile

**File:** `frontend/app/(dashboard)/customers/_components/customer-filters.tsx`

Tìm div chứa các filter buttons/chips (status filter, type filter...). Wrap trong:
```tsx
<div className="overflow-x-auto pb-1">
  <div className="flex min-w-max gap-2">
    {/* filter buttons giữ nguyên */}
  </div>
</div>
```

Nếu filter đang là `flex flex-wrap gap-2` → đổi `flex-wrap` thành `flex-nowrap` + thêm `overflow-x-auto` wrapper.

---

### Verify Sprint 2

```bash
npm run typecheck
npm run build
```

Test thủ công:
- Mở Chrome DevTools → Toggle Device Toolbar → chọn iPhone 14 Pro (393px)
- `/customers`: thấy card layout (avatar + tên + status + chevron)
- `/dashboard`: thấy 2 cột KPI trên mobile

---

## Sprint 3 — Detail Pages & Form UX

**Mục tiêu:** Trang chi tiết khách hàng dùng được trên mobile. Form không bị iOS zoom.

**Thời gian ước tính:** 3–4 giờ

---

### Task 3.1 — Ngăn iOS auto-zoom khi focus input

**Vấn đề:** iOS Safari tự zoom khi input có font-size < 16px. App dùng text-[13.5px] cho input.

**File:** `frontend/app/globals.css`

Thêm vào cuối file:
```css
/* Prevent iOS Safari auto-zoom on input focus */
@media (max-width: 768px) {
  input,
  textarea,
  select,
  [role="combobox"] {
    font-size: 16px !important;
  }
}
```

---

### Task 3.2 — Customer detail: tab bar horizontal scroll

**File:** `frontend/app/(dashboard)/customers/_components/customer-detail-client.tsx`

Tìm phần render tabs (component `Tabs` từ shadcn/ui hoặc custom tab bar). Wrap `TabsList` trong container scroll:

```tsx
{/* Nếu dùng shadcn Tabs: */}
<div className="overflow-x-auto border-b border-border">
  <TabsList className="h-auto w-max gap-0 rounded-none bg-transparent p-0">
    <TabsTrigger value="info" className="min-w-max ...">Thông tin</TabsTrigger>
    <TabsTrigger value="contacts" className="min-w-max ...">Liên hệ</TabsTrigger>
    <TabsTrigger value="projects" className="min-w-max ...">Dự án</TabsTrigger>
    <TabsTrigger value="activities" className="min-w-max ...">Hoạt động</TabsTrigger>
  </TabsList>
</div>
```

Hoặc nếu tab là custom div, tìm flex container và thêm `overflow-x-auto` wrapper + `min-w-max` trên children.

---

### Task 3.3 — Customer detail: PageHeader action buttons collapse trên mobile

**File:** `frontend/components/layout/page-header.tsx` (hoặc trong `customer-detail-client.tsx`)

Tìm phần action buttons (Sửa, Xóa, PDF...). Trên mobile ẩn label, chỉ hiện icon:

```tsx
{/* Action button: icon luôn hiện, label ẩn trên xs */}
<Button variant="outline" size="sm" className="gap-2 min-h-[44px]">
  <AppIcon name="edit" className="h-4 w-4" />
  <span className="hidden sm:inline">Chỉnh sửa</span>
</Button>
```

---

### Task 3.4 — Project kanban: cải thiện trải nghiệm touch

**File:** `frontend/app/(dashboard)/projects/_components/project-kanban-board.tsx`

**3.4a — Column min-height:** Tìm div của mỗi kanban column, thêm `min-h-[120px]`:
```tsx
<div className="flex min-h-[120px] flex-col gap-3 p-3">
  {/* project cards */}
</div>
```

**3.4b — Swipe hint trên mobile:** Thêm hint text bên dưới header kanban, chỉ hiện trên mobile:
```tsx
<p className="mb-2 text-center text-xs text-text-muted md:hidden">
  Vuốt ngang để xem thêm cột →
</p>
```

**3.4c — Touch target:** Đảm bảo nút "Chuyển giai đoạn" (nếu có) có `min-h-[44px] min-w-[44px]`.

---

### Task 3.5 — Offline toast notification

**File:** `frontend/components/providers.tsx`

Tìm component `AppProviders`, thêm `useEffect` sau (đặt sau `useEffect` SW registration từ Task 1.4):

```tsx
useEffect(() => {
  if (typeof window === "undefined") return;

  const handleOffline = () => {
    // Dùng toast system hiện có của project
    // Kiểm tra project đang dùng toast gì (sonner, shadcn toast, hay custom)
    // và gọi theo đúng API
    console.warn("AHSO CRM: Mất kết nối internet");
  };

  const handleOnline = () => {
    console.info("AHSO CRM: Đã kết nối lại");
  };

  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("online", handleOnline);
  };
}, []);
```

**Quan trọng:** Trước khi viết toast call, đọc file `components/providers.tsx` hiện tại để biết project đang dùng toast library nào (Sonner, shadcn toast, hay hook `useToast`). Dùng đúng API đó.

---

### Verify Sprint 3

```bash
npm run typecheck
npm run build
```

Test thủ công:
- iPhone simulator hoặc Chrome DevTools mobile
- `/customers/[id]`: tabs scroll ngang được, buttons hiện icon-only trên mobile
- Focus vào input trên mobile: trang không zoom
- `/projects`: thấy hint "Vuốt ngang..."

---

## Sprint 4 — TanStack Query Offline Config

**Mục tiêu:** Dữ liệu đã load không bị mất khi mạng chập chờn. Không retry vô ích khi offline.

**Thời gian ước tính:** 1–2 giờ

---

### Task 4.1 — Cập nhật QueryClient config

**File:** `frontend/components/providers.tsx`

Tìm nơi khởi tạo `QueryClient` (thường dùng `useState` hoặc `useRef`). Cập nhật options:

```tsx
const [queryClient] = useState(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,   // 5 phút — không refetch nếu data còn "fresh"
          gcTime: 30 * 60 * 1000,      // 30 phút — giữ cache trong memory
          retry: (failureCount, error) => {
            // Không retry khi offline
            if (typeof window !== "undefined" && !window.navigator.onLine) {
              return false;
            }
            // Không retry lỗi 4xx (client errors)
            if (error instanceof Error && "status" in error) {
              const status = (error as { status: number }).status;
              if (status >= 400 && status < 500) return false;
            }
            return failureCount < 2;
          }
        }
      }
    })
);
```

---

### Verify Sprint 4

```bash
npm run typecheck
npm run build
```

---

## Checklist cuối — Trước khi commit

Chạy lần lượt:

```bash
# 1. TypeScript
cd frontend && npm run typecheck

# 2. Lint
npm run lint

# 3. Build
npm run build
```

Kiểm tra thủ công qua Chrome DevTools (Mobile viewport 393px):

- [ ] Manifest hiển thị đúng icon, name, display trong Application tab
- [ ] Service Worker status: "Activated and running"
- [ ] Network → Offline → reload → hiện trang offline.html
- [ ] Dashboard: KPI cards 2 cột trên mobile
- [ ] Customer list: card layout (avatar + tên + status) trên mobile
- [ ] Customer detail: tabs scroll ngang
- [ ] Kanban: swipe hint hiện trên mobile
- [ ] Focus vào input form: trang không zoom
- [ ] Content cuối trang không bị MobileBottomNav che

---

## Commit message khi xong

```
feat(pwa): PWA setup + mobile responsive improvements

- Add proper icons (192x192, 512x512, apple-touch-icon 180x180)
- Update manifest.json with icons, orientation, display_override
- Register service worker in AppProviders
- Add offline fallback page (public/offline.html)
- Fix content-area padding-bottom for MobileBottomNav
- Add safe-area-inset for iPhone home indicator
- Customer list: add mobile card layout (< lg breakpoint)
- Customer filters: horizontal scroll on mobile
- Dashboard KPI cards: 2-column grid on mobile
- Customer detail: tab bar horizontal scroll on mobile
- Project kanban: min-height columns + swipe hint on mobile
- Prevent iOS auto-zoom: font-size 16px on mobile inputs
- QueryClient: add staleTime, gcTime, offline retry logic

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Ghi chú quan trọng cho Agent

1. **Đọc file trước khi sửa** — Dùng Read tool để đọc file hiện tại, tìm đúng chỗ chèn code
2. **Không đổi business logic** — Chỉ thêm CSS classes và layout wrappers
3. **Không xóa code cũ** — Thêm mobile layout song song với desktop layout
4. **TypeScript strict** — Không dùng `any`. Kiểm tra types từ `lib/types.ts`
5. **Không cài package mới** — Không cần thêm gì vào `package.json`
6. **Verify sau mỗi Sprint** — Chạy `typecheck` và `build` sau mỗi sprint, không gộp tất cả rồi verify một lần
7. **Toast library** — Trước Task 3.5, đọc `components/providers.tsx` để biết dùng toast gì
8. **CSS variables** — Không hardcode hex color, dùng `text-primary`, `bg-primary`, etc.
