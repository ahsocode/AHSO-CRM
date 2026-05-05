# AHSO CRM — Document Templates Implementation Plan

**Scope**: 16 professional document templates (Vietnamese + optional Vietnamese-English bilingual)
**Engine**: Handlebars (.hbs) → HTML → Puppeteer → PDF
**Style**: Modern sans-serif (Pre-sales) | Classic sans-serif (Sales, Delivery, Acceptance, Financial)
**Font**: Inter + Be Vietnam Pro (fallback: Roboto, Arial Unicode MS) — full Vietnamese diacritics support

---

## 📐 Final Specifications (Agreed)

| Spec | Decision |
|---|---|
| **Font family** | Sans-serif: `'Inter', 'Be Vietnam Pro', 'Roboto', Arial, sans-serif` — **Vietnamese-safe** fallback chain |
| **Document number** | `[PREFIX]-[YYYY]-[CUSTOMER_CODE]-[SEQUENCE]-v[VERSION]` → e.g. `BG-2026-VNM001-001-v1`, `HD-2026-THACO002-003-v2` |
| **Preview/Download UX** | Integrated button (not separate page) in existing modules: Customers → Quotes/Contracts tabs, Projects detail, Quotes detail, Contracts detail |
| **Data source** | `Settings` module (company info, logo, policies) + related entity (Quote/Contract/Customer) |
| **Bilingual mode** | Per-customer toggle `language: 'vi' \| 'vi-en'` stored on Customer record |
| **Number of templates** | All 16 |
| **Font warning** | Inter alone misses some Vietnamese glyphs → MUST include `Be Vietnam Pro` or `Roboto` as explicit fallback with `unicode-range` for Vietnamese subset |

---

## 🎨 Style Guide

### Modern (Pre-sales group)
- **Primary**: #1A5276 (AHSO brand blue)
- **Accent**: #E67E22 (orange)
- **Layout**: Full-bleed header with brand color band, generous whitespace, card-based sections, subtle icons
- **Typography**: Bold large headings (28-32pt), body 10.5pt, tight line-height 1.45

### Classic (Sales, Delivery, Acceptance, Financial groups)
- **Primary**: #1A1A1A (near black)
- **Accent**: #1A5276 (subtle blue for links/emphasis only)
- **Layout**: Traditional Vietnamese legal document (CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM header, title centered uppercase, justified paragraphs, formal signature blocks with dotted underlines)
- **Typography**: Body 11pt, headings 13-14pt bold uppercase, line-height 1.6

---

## 🗂️ Template Inventory (16 total)

| # | Code | Name (VI) | Group | Style | Prefix |
|---|---|---|---|---|---|
| 1 | QUOTATION | Báo giá | Pre-sales | Modern | BG |
| 2 | PROPOSAL | Đề xuất dự án | Pre-sales | Modern | DX |
| 3 | SURVEY_REPORT | Báo cáo khảo sát | Pre-sales | Modern | KS |
| 4 | CONTRACT | Hợp đồng kinh tế | Sales | Classic | HD |
| 5 | CONTRACT_ADDENDUM | Phụ lục hợp đồng | Sales | Classic | PL |
| 6 | NDA | Thỏa thuận bảo mật | Sales | Classic | NDA |
| 7 | DELIVERY_NOTE | Biên bản giao hàng | Delivery | Classic | GH |
| 8 | DOC_HANDOVER | Biên bản bàn giao tài liệu | Delivery | Classic | BGTL |
| 9 | INSTALLATION_REPORT | Biên bản lắp đặt | Delivery | Classic | LD |
| 10 | ACCEPTANCE_REPORT | Biên bản nghiệm thu | Acceptance | Classic | NT |
| 11 | PARTIAL_ACCEPTANCE | Biên bản nghiệm thu từng phần | Acceptance | Classic | NTTP |
| 12 | WARRANTY_CERT | Giấy chứng nhận bảo hành | Acceptance | Classic | BH |
| 13 | MAINTENANCE_RECORD | Biên bản bảo trì | Acceptance | Classic | BT |
| 14 | PAYMENT_REQUEST | Đề nghị thanh toán | Financial | Classic | TT |
| 15 | PAYMENT_RECEIPT | Phiếu thu | Financial | Classic | PT |
| 16 | AR_RECONCILIATION | Biên bản đối chiếu công nợ | Financial | Classic | DCN |

---

## 🏗️ Architecture

```
backend/src/documents/
├── documents.module.ts
├── documents.controller.ts        # GET /documents/:type/:entityId/preview | /download
├── documents.service.ts            # orchestrates render
├── document-number.service.ts      # generate/persist doc numbers
├── pdf-renderer.service.ts         # Puppeteer wrapper
├── template-registry.ts            # maps DocumentType → template path + data loader
│
├── helpers/
│   ├── format-currency.ts          # 1,234,567 VND or "Một triệu hai trăm..."
│   ├── format-date.ts              # dd/MM/yyyy or "ngày 19 tháng 04 năm 2026"
│   ├── number-to-words.ts          # Vietnamese number → words (for contracts)
│   ├── bilingual.ts                # {{t "key"}} helper reads i18n bundle
│   └── table-rows.ts               # line-item table helpers
│
├── i18n/
│   ├── vi.json                     # Vietnamese strings
│   └── en.json                     # English strings (for bilingual mode)
│
├── templates/
│   ├── _partials/
│   │   ├── header-modern.hbs       # Pre-sales brand header
│   │   ├── header-classic.hbs      # CỘNG HÒA XÃ HỘI CHỦ NGHĨA header
│   │   ├── footer-page.hbs         # page number, company footer
│   │   ├── signature-block.hbs     # dotted line + name/title/date
│   │   ├── company-info.hbs        # seller party block
│   │   ├── customer-info.hbs       # buyer party block
│   │   └── legal-footer.hbs        # fine print, version, date
│   │
│   ├── styles/
│   │   ├── base.css                # @font-face, Vietnamese fallback, print margins
│   │   ├── modern.css              # Pre-sales Modern style
│   │   └── classic.css             # Classic Vietnamese legal style
│   │
│   └── <type>/
│       ├── vi.hbs                  # Vietnamese-only
│       └── vi-en.hbs               # Bilingual two-column
│
└── dto/
    ├── render-document.dto.ts
    └── document-type.enum.ts
```

### Prisma additions
```prisma
model Document {
  id            String       @id @default(cuid())
  type          DocumentType
  number        String       @unique   // "BG-2026-VNM001-001-v1"
  version       Int          @default(1)
  language      String       @default("vi") // "vi" | "vi-en"
  entityType    String       // "quote" | "contract" | "customer" | "project"
  entityId      String
  customerId    String?
  pdfPath       String?      // cached PDF location
  renderedAt    DateTime?
  createdAt     DateTime     @default(now())
  createdById   String
  createdBy     User         @relation(fields: [createdById], references: [id])
  customer      Customer?    @relation(fields: [customerId], references: [id])

  @@index([entityType, entityId])
  @@index([customerId])
}

enum DocumentType {
  QUOTATION
  PROPOSAL
  SURVEY_REPORT
  CONTRACT
  CONTRACT_ADDENDUM
  NDA
  DELIVERY_NOTE
  DOC_HANDOVER
  INSTALLATION_REPORT
  ACCEPTANCE_REPORT
  PARTIAL_ACCEPTANCE
  WARRANTY_CERT
  MAINTENANCE_RECORD
  PAYMENT_REQUEST
  PAYMENT_RECEIPT
  AR_RECONCILIATION
}

// Customer additions
model Customer {
  // ... existing fields
  code        String?  @unique  // "VNM001" — auto-generated from name+sequence
  language    String   @default("vi")  // "vi" | "vi-en"
}
```

---

## 🗺️ Execution Order

**MUST run Phase 0 first** — all 16 template prompts depend on the foundation.

```
Phase 0 (Foundation)        ← BLOCKING — run first
   ↓
Phase 1-3 (Pre-sales)        ← Can run in parallel after Phase 0
Phase 4-6 (Sales)            ← Can run in parallel after Phase 0
Phase 7-9 (Delivery)         ← Can run in parallel after Phase 0
Phase 10-13 (Acceptance)     ← Can run in parallel after Phase 0
Phase 14-16 (Financial)      ← Can run in parallel after Phase 0
```

Each phase below = **1 self-contained prompt** you can paste into a fresh agent.

---

# 🧱 PHASE 0 — Foundation (RUN FIRST)

**Prompt for Agent:**

```
TASK: Build the shared foundation for 16 PDF document templates in AHSO CRM.
This is Phase 0 — all 16 subsequent template implementations depend on this.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
STACK: NestJS 10 + Prisma + Puppeteer + Handlebars + Next.js 14 + Tailwind

DELIVERABLES:

1. PRISMA MIGRATION
   Add to backend/prisma/schema.prisma:
   - model Document (id, type, number, version, language, entityType, entityId,
     customerId, pdfPath, renderedAt, createdAt, createdById, relations)
   - enum DocumentType with 16 values: QUOTATION, PROPOSAL, SURVEY_REPORT,
     CONTRACT, CONTRACT_ADDENDUM, NDA, DELIVERY_NOTE, DOC_HANDOVER,
     INSTALLATION_REPORT, ACCEPTANCE_REPORT, PARTIAL_ACCEPTANCE,
     WARRANTY_CERT, MAINTENANCE_RECORD, PAYMENT_REQUEST, PAYMENT_RECEIPT,
     AR_RECONCILIATION
   - Add Customer.code (String?, @unique) and Customer.language (String, default "vi")
   - Run: npx prisma migrate dev --name documents_module

2. DOCUMENTS MODULE SKELETON
   Create backend/src/documents/:
   - documents.module.ts (import PrismaModule, SettingsModule, UploadModule)
   - documents.controller.ts with endpoints:
       GET  /documents/:type/:entityId/preview?lang=vi|vi-en   → returns HTML
       POST /documents/:type/:entityId/render                  → returns {pdfUrl, number}
       GET  /documents/:type/:entityId/download                → streams PDF
       GET  /documents                                          → list (paginated)
   - documents.service.ts (orchestrator: load data → render hbs → call puppeteer)
   - document-number.service.ts:
       generate(type, customerCode, version) →
         "[PREFIX]-[YYYY]-[CUSTOMER_CODE]-[SEQ]-v[VERSION]"
         e.g. "BG-2026-VNM001-001-v1"
       PREFIX map: QUOTATION=BG, PROPOSAL=DX, SURVEY_REPORT=KS,
         CONTRACT=HD, CONTRACT_ADDENDUM=PL, NDA=NDA,
         DELIVERY_NOTE=GH, DOC_HANDOVER=BGTL, INSTALLATION_REPORT=LD,
         ACCEPTANCE_REPORT=NT, PARTIAL_ACCEPTANCE=NTTP,
         WARRANTY_CERT=BH, MAINTENANCE_RECORD=BT,
         PAYMENT_REQUEST=TT, PAYMENT_RECEIPT=PT, AR_RECONCILIATION=DCN
       Sequence is per-type per-year, zero-padded to 3 digits.
   - pdf-renderer.service.ts: wraps Puppeteer (reuse logic from
     backend/src/quotes/quotes-pdf.service.ts). Loads Handlebars, registers
     partials + helpers, renders HTML, outputs PDF buffer.
   - template-registry.ts: maps DocumentType → {templatePath, dataLoader, prefix, style}

3. HANDLEBARS HELPERS (backend/src/documents/helpers/)
   - format-currency.ts: {{currency amount}} → "1.234.567 VND",
     {{currency amount "words"}} → "Một triệu hai trăm ba mươi tư nghìn..."
   - format-date.ts: {{date d}} → "19/04/2026",
     {{date d "long"}} → "ngày 19 tháng 04 năm 2026",
     {{date d "long-en"}} → "April 19, 2026"
   - number-to-words.ts: Vietnamese number → words (for contract amounts)
     Reference library: vntk or hand-roll (0-999 tỷ tỷ range)
   - bilingual.ts: {{t "key"}} looks up i18n/vi.json or i18n/en.json based on
     language param in template context. For vi-en mode, outputs
     '<span class="vi">{vi}</span><span class="en">{en}</span>'
   - table-rows.ts: {{#eachWithIndex items}}, {{sum items "field"}},
     {{subtotal items}}, {{vat items rate}}, {{grand-total items rate}}

4. i18n BUNDLES (backend/src/documents/i18n/)
   - vi.json and en.json with keys for common labels:
     "company_info", "customer_info", "doc_number", "doc_date", "subject",
     "description", "qty", "unit_price", "total", "subtotal", "vat",
     "grand_total", "in_words", "signed_by", "date_place", "page",
     "seller", "buyer", "party_a", "party_b", "witness",
     "delivery_date", "warranty_period", "acceptance_date",
     (Add ~60 common keys — agent should brainstorm full list)

5. SHARED PARTIALS (backend/src/documents/templates/_partials/)
   - header-modern.hbs: Full-bleed color band with {{company.logo}},
     {{company.name}}, doc title, doc number, doc date.
     Uses .modern-header CSS class.
   - header-classic.hbs: Traditional VN legal header:
     "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM / Độc lập - Tự do - Hạnh phúc"
     centered with dashed underline, then document title uppercase centered,
     doc number and date right-aligned.
   - footer-page.hbs: Page number {{page}} / {{totalPages}}, company tagline,
     small AHSO CRM watermark.
   - signature-block.hbs: Two-column "ĐẠI DIỆN BÊN A / ĐẠI DIỆN BÊN B"
     with dotted signature line, name placeholder, title, date.
     Accepts props: {partyA: {label, name, title}, partyB: {...}}.
   - company-info.hbs: Seller block with name, tax code, address, phone,
     email, bank account (from Settings).
   - customer-info.hbs: Buyer block with customer.name, taxCode, address,
     representative, phone, email.
   - legal-footer.hbs: Version, template version, render timestamp, fine print.

6. CSS STYLES (backend/src/documents/templates/styles/)
   - base.css:
       @font-face for Inter (latin) + Be Vietnam Pro (vietnamese subset)
       unicode-range ensures Vietnamese chars render from Be Vietnam Pro
       Fallback: 'Roboto', 'Arial Unicode MS', sans-serif
       @page { size: A4; margin: 20mm 18mm 22mm 18mm; }
       Base body typography, print-safe colors, page-break helpers.
       IMPORTANT: Embed fonts as base64 or reference locally — Puppeteer must
       have fonts available offline. Test with 'ă â ê ô ơ ư đ' characters.
   - modern.css: Pre-sales brand band, orange accents, card sections,
     rounded corners, subtle shadows (print-safe).
   - classic.css: Formal legal layout, justified text, dotted signature lines,
     uppercase section headings, serif-like weight hierarchy using only sans-serif.

7. FRONTEND: INTEGRATED PREVIEW/DOWNLOAD UI
   Do NOT create a separate /documents page. Instead:
   - Create frontend/components/shared/document-actions.tsx:
       Dropdown button "Tạo tài liệu" with options filtered by entity type.
       Opens modal with language toggle (vi | vi-en) + Preview/Download buttons.
   - Create frontend/hooks/use-documents.ts: preview, render, download mutations.
   - Integrate into:
       frontend/app/(dashboard)/quotes/[id]/_components/  → "Xuất Báo giá"
       frontend/app/(dashboard)/contracts/[id]/_components/  → "Xuất Hợp đồng"
       frontend/app/(dashboard)/customers/[id]/_components/  → full dropdown
       frontend/app/(dashboard)/projects/[id]/_components/  → "Xuất Đề xuất", "Báo cáo khảo sát"

8. ADMIN SETTINGS FOR DOCUMENTS
   Add to frontend/app/(dashboard)/admin/:
   - company-info/page.tsx: extend existing form with bank account fields
     (bankName, bankAccount, bankAccountName, bankBranch, swift).
   - Add settings keys: company.bankName, company.bankAccount, etc.
   - policies/page.tsx: extend with document-related policy fields
     (paymentTerms, warrantyPeriodMonths, deliveryTerms, etc.)

9. CUSTOMER LANGUAGE TOGGLE
   - frontend/app/(dashboard)/customers/[id]/edit/_components/customer-form.tsx:
     add Select field "Ngôn ngữ tài liệu" with options "Tiếng Việt" | "Song ngữ Việt-Anh"
   - Default new customers to "vi".

10. CUSTOMER CODE GENERATION
    - When creating a customer, auto-generate code from first 3 letters of
      shortName/name (uppercase, ASCII-folded from Vietnamese) + 3-digit
      sequence, e.g. "Vinamilk" → "VNM001", "Thaco" → "THA002".
    - Handle collisions by incrementing sequence.
    - Expose in customer list + detail.

11. SEED DATA UPDATE
    - Update backend/prisma/seed.ts to set customer.code and customer.language
      for the 4 existing customers (VNM001, THA002, CHR003, DNP004).

12. UNIT TESTS (minimum)
    - document-number.service.spec.ts: test sequence generation, prefix map
    - format-currency.spec.ts: VND formatting + Vietnamese words
    - format-date.spec.ts: all format modes
    - Sample template render test: render QUOTATION/vi.hbs with mock data →
      assert HTML contains expected strings.

13. DOCUMENTATION
    - Create docs/DOCUMENT_TEMPLATES.md documenting:
      - How to add a new template
      - Helper reference
      - i18n key conventions
      - Partial reference
      - Testing approach

VERIFICATION:
- npx prisma migrate dev succeeds
- npm run build (backend) passes
- npm run build (frontend) passes
- GET /documents returns [] (empty list)
- Start dev server, open any customer detail → "Tạo tài liệu" dropdown renders
- No actual templates exist yet (that's Phases 1-16) but the infrastructure
  must be ready to plug them in.

DO NOT implement any of the 16 specific templates — that is explicitly out of scope
for Phase 0. Those will be delivered in Phases 1-16. Only build the foundation.
```

---

# 📄 PHASE 1 — QUOTATION (Báo giá) — Modern Style

**Prompt for Agent:**

```
TASK: Implement the QUOTATION template (Báo giá) for AHSO CRM.
Depends on: Phase 0 foundation (must be complete).

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: QUOTATION | PREFIX: BG | STYLE: Modern (Pre-sales)

DATA SOURCE: backend Quote entity (Quote + QuoteItem[] + Customer + Settings)

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/QUOTATION/vi.hbs
   - backend/src/documents/templates/QUOTATION/vi-en.hbs

2. SECTIONS (in order)
   a) Modern brand header ({{> header-modern}}) with "BÁO GIÁ / QUOTATION"
      title, document number, date, validity.
   b) Seller / Company info block ({{> company-info}})
   c) Customer info block ({{> customer-info}}) with attention-to person
   d) Subject line: "V/v: {{quote.subject}}"
   e) Intro paragraph (from i18n: "quotation.intro") thanking customer
   f) Line items table:
      Columns: STT | Mô tả / Description | ĐVT | SL | Đơn giá | Thành tiền
      Uses {{#each items}} with {{format-currency}} and table-rows helpers.
   g) Totals block: Tạm tính / Subtotal, VAT (from policy setting),
      Tổng cộng / Grand Total + "Bằng chữ / In words:" ({{currency amount "words"}})
   h) Commercial terms section (from settings/policy):
      - Hiệu lực báo giá / Validity period (default 30 days)
      - Điều kiện thanh toán / Payment terms
      - Thời gian giao hàng / Delivery time
      - Bảo hành / Warranty
   i) Notes (quote.notes, optional)
   j) Signature block ({{> signature-block}}) — seller only for quotes
      "Đại diện bên bán / Seller Representative"
   k) Footer: {{> footer-page}}, {{> legal-footer}}

3. DATA LOADER (register in template-registry.ts)
   async loadQuotationData(quoteId) →
     { quote, items, customer, company, policy, docNumber, date, language }

4. BILINGUAL RULES
   vi.hbs: Vietnamese labels only.
   vi-en.hbs: Two-column labels where applicable "Mô tả / Description",
     running English translations for intro paragraph and terms.

5. STYLE (modern.css additions if needed)
   - Orange accent bar above totals table
   - Light gray alternating row backgrounds
   - Bold primary-color for grand total
   - "VALIDITY: 30 DAYS" stamp-style badge top-right of items table

6. INTEGRATION UI
   Add to frontend/app/(dashboard)/quotes/[id]/_components/quote-actions.tsx:
   - Button "Xuất Báo giá" → opens DocumentActions modal with type=QUOTATION
   - Language toggle defaults to customer.language
   - Preview opens in-app iframe; Download triggers PDF save.

7. TEST
   - backend/src/documents/templates/QUOTATION/quotation.spec.ts: render
     with seed quote Q-001 → assert HTML contains quote number, customer
     name, subtotal, and Vietnamese diacritic characters render correctly.
   - Manual check: /quotes/[seedQuoteId] → click "Xuất Báo giá" → verify PDF.

VERIFICATION:
- Preview and download both work from /quotes/[id]
- Vietnamese chars (ă â ê ô ơ ư đ) render without tofu/boxes
- Numbers format as VND with thousand separators
- Grand total appears in words below totals
- Document number auto-generated: BG-2026-[CUSTCODE]-###-v1
- Both vi and vi-en variants tested
```

---

# 📄 PHASE 2 — PROPOSAL (Đề xuất dự án) — Modern

**Prompt for Agent:**

```
TASK: Implement the PROPOSAL template (Đề xuất dự án) for AHSO CRM.
Depends on: Phase 0 foundation.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: PROPOSAL | PREFIX: DX | STYLE: Modern

DATA SOURCE: Project entity + Customer + Settings + linked Quote (optional)

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/PROPOSAL/vi.hbs
   - backend/src/documents/templates/PROPOSAL/vi-en.hbs

2. SECTIONS (pitch-deck style, modern)
   a) Cover page with brand band, large project title, customer logo area,
      "ĐỀ XUẤT DỰ ÁN / PROJECT PROPOSAL" subtitle, doc number, date.
      page-break-after: always.
   b) "Executive Summary / Tóm tắt điều hành" — 1 page, 3 bullet blocks:
      Bối cảnh, Giải pháp đề xuất, Giá trị mang lại.
   c) "Hiện trạng & Thách thức / Current State & Challenges" — dynamic from
      project.surveyNotes or project.description.
   d) "Giải pháp đề xuất / Proposed Solution" — scope list, architecture diagram
      placeholder ({{#if project.architectureImageUrl}}<img>{{/if}}).
   e) "Phạm vi công việc / Scope of Work" — table of deliverables.
   f) "Timeline / Lộ trình triển khai" — horizontal timeline with milestones
      (rendered as CSS flexbox of milestone cards).
   g) "Đội ngũ thực hiện / Team" — optional, from settings or skipped.
   h) "Chi phí đầu tư / Investment Summary" — pulled from linked quote if
      exists, otherwise "Xem báo giá chi tiết đính kèm".
   i) "Điều khoản & Cam kết / Terms & Commitments" — from policies.
   j) Signature block (seller only, Modern style: single centered block).
   k) Page footer.

3. DATA LOADER
   loadProposalData(projectId) →
     { project, customer, company, milestones, linkedQuote?, policies, ... }

4. STYLE
   - Uses modern.css, adds:
     .proposal-cover, .section-card, .timeline-dots, .team-grid
   - Each major section starts on new page (page-break-before: always)
     except first.
   - Accent orange for section numbers (01, 02, 03 ...).

5. INTEGRATION UI
   Add to frontend/app/(dashboard)/projects/[id]/_components/project-actions.tsx:
   - "Xuất Đề xuất dự án" button in actions menu.

6. TEST
   - Render proposal.spec.ts with seed project → assert sections present.

VERIFICATION:
- Cover page renders with brand colors
- Timeline visualizes milestones
- Customer logo placeholder shown if customer.logo exists
- vi-en variant shows bilingual section headings
```

---

# 📄 PHASE 3 — SURVEY_REPORT (Báo cáo khảo sát) — Modern

**Prompt for Agent:**

```
TASK: Implement SURVEY_REPORT template (Báo cáo khảo sát) for AHSO CRM.
Depends on: Phase 0 foundation.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: SURVEY_REPORT | PREFIX: KS | STYLE: Modern

DATA SOURCE: Project + Activities(type=SURVEY) + Customer + Settings

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/SURVEY_REPORT/vi.hbs
   - backend/src/documents/templates/SURVEY_REPORT/vi-en.hbs

2. SECTIONS
   a) Modern header: "BÁO CÁO KHẢO SÁT / SURVEY REPORT"
   b) Meta info block: Ngày khảo sát, Địa điểm, Người khảo sát,
      Người tiếp đón bên khách hàng.
   c) "Mục tiêu khảo sát / Survey Objectives" — bullet list.
   d) "Phương pháp khảo sát / Methodology" — text paragraph.
   e) "Hiện trạng ghi nhận / Findings" — numbered findings with
      photo placeholders ({{#each findings}}<div class="finding">).
      Support embedded images if project.surveyPhotos[] exists.
   f) "Đánh giá & Phân tích / Analysis" — SWOT-style mini grid
      (Điểm mạnh, Điểm yếu, Cơ hội, Rủi ro).
   g) "Kết luận & Khuyến nghị / Conclusions & Recommendations"
   h) "Bước tiếp theo / Next Steps" — checklist.
   i) Signature block: Surveyor + Customer representative (two-column).
   j) Attachments list (if any).

3. DATA LOADER
   loadSurveyReportData(projectId) →
     { project, customer, company, surveyActivities, findings, photos, ... }

4. STYLE
   - Card-based finding blocks with image frames
   - SWOT grid 2x2 with distinct color per quadrant (all print-safe)

5. INTEGRATION UI
   Add to projects/[id] actions: "Xuất Báo cáo khảo sát"

VERIFICATION:
- Findings render with optional images
- SWOT grid prints correctly
- Meta info populated from first SURVEY activity
```

---

# 📄 PHASE 4 — CONTRACT (Hợp đồng kinh tế) — Classic

**Prompt for Agent:**

```
TASK: Implement CONTRACT template (Hợp đồng kinh tế) for AHSO CRM.
Depends on: Phase 0 foundation.
CRITICAL: Must comply with Vietnamese commercial contract law formatting.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: CONTRACT | PREFIX: HD | STYLE: Classic

DATA SOURCE: Contract + Milestones + linked Quote + Customer + Settings

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/CONTRACT/vi.hbs
   - backend/src/documents/templates/CONTRACT/vi-en.hbs

2. SECTIONS (Vietnamese legal contract structure)
   a) Classic header ({{> header-classic}}):
      CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
      Độc lập - Tự do - Hạnh phúc
      ————————————
      HỢP ĐỒNG KINH TẾ / ECONOMIC CONTRACT
      Số: HD-YYYY-CUST-###-v#
      (centered, uppercase, bold)
   b) Preamble: "Căn cứ Bộ luật Dân sự 2015; Luật Thương mại 2005; ..."
      (from i18n, comma-separated legal references)
   c) "Hôm nay, ngày {{date}}, tại {{location}}, chúng tôi gồm:"
   d) BÊN A (BEN MUA) / Party A (Buyer) — full customer block:
      - Tên công ty, Mã số thuế, Địa chỉ, Điện thoại, Email
      - Đại diện: {{customer.representative}}, Chức vụ
      - Tài khoản ngân hàng
   e) BÊN B (BÊN BÁN) / Party B (Seller) — full company block from Settings
   f) "Sau khi thỏa thuận, hai bên thống nhất ký hợp đồng với các điều khoản sau:"
   g) ĐIỀU 1: ĐỐI TƯỢNG HỢP ĐỒNG / Subject Matter
      Scope description from contract.subject + linked quote items summary
   h) ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG / Contract Value
      "Tổng giá trị hợp đồng: {{currency contract.totalAmount}}"
      "Bằng chữ: {{currency contract.totalAmount 'words'}}"
      VAT breakdown
   i) ĐIỀU 3: PHƯƠNG THỨC THANH TOÁN / Payment Terms
      Milestone-based payment schedule table
   j) ĐIỀU 4: THỜI GIAN VÀ ĐỊA ĐIỂM GIAO HÀNG / Delivery
   k) ĐIỀU 5: BẢO HÀNH / Warranty (from policies)
   l) ĐIỀU 6: QUYỀN VÀ NGHĨA VỤ CỦA BÊN A / Party A Rights & Obligations
   m) ĐIỀU 7: QUYỀN VÀ NGHĨA VỤ CỦA BÊN B / Party B Rights & Obligations
   n) ĐIỀU 8: PHẠT VI PHẠM VÀ BỒI THƯỜNG / Penalties
   o) ĐIỀU 9: BẢO MẬT THÔNG TIN / Confidentiality
   p) ĐIỀU 10: BẤT KHẢ KHÁNG / Force Majeure
   q) ĐIỀU 11: GIẢI QUYẾT TRANH CHẤP / Dispute Resolution
   r) ĐIỀU 12: HIỆU LỰC HỢP ĐỒNG / Effective Date
      "Hợp đồng có hiệu lực kể từ ngày ký. Hợp đồng được lập thành 04 bản
       có giá trị pháp lý như nhau, mỗi bên giữ 02 bản."
   s) Signature block ({{> signature-block}}) — both parties
      with company stamp placeholder ("ĐÓNG DẤU")

3. DATA LOADER
   loadContractData(contractId) →
     { contract, milestones, linkedQuote?, items, customer, company,
       policies, legalReferences, ... }

4. STYLE (classic.css)
   - Justified text body
   - Article headings (ĐIỀU 1, ĐIỀU 2...) bold uppercase, 13pt
   - Sub-items indented
   - Payment schedule table with borders
   - Stamp circle placeholder in signature area

5. i18n ADDITIONS
   Expand vi.json/en.json with all contract-specific legal phrases.

6. INTEGRATION UI
   frontend/app/(dashboard)/contracts/[id] → "Xuất Hợp đồng" button.

7. TEST
   - Render with seed contract → assert all 12 articles present,
     "Bằng chữ" generates Vietnamese words for contract amount,
     legal preamble references correct laws.

VERIFICATION:
- PDF passes visual review vs sample Vietnamese commercial contract
- Number-in-words correct for amounts up to 100 billion VND
- Stamp placeholder visible
- vi-en version: English translation in right column per article
```

---

# 📄 PHASE 5 — CONTRACT_ADDENDUM (Phụ lục hợp đồng) — Classic

**Prompt for Agent:**

```
TASK: Implement CONTRACT_ADDENDUM template (Phụ lục hợp đồng).
Depends on: Phase 0 foundation + Phase 4 (shares legal patterns with CONTRACT).

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: CONTRACT_ADDENDUM | PREFIX: PL | STYLE: Classic

DATA SOURCE: Contract + Addendum data (new entity or Contract.addendums)

DELIVERABLES:

1. PRISMA UPDATE (if not done in Phase 4)
   Add model ContractAddendum {
     id, contractId (FK), number (Int), reason, changes (Json),
     signedAt, createdAt, createdById
   }
   Run migration: addendum_table

2. TEMPLATE FILES
   - backend/src/documents/templates/CONTRACT_ADDENDUM/vi.hbs
   - backend/src/documents/templates/CONTRACT_ADDENDUM/vi-en.hbs

3. SECTIONS
   a) Classic header: "PHỤ LỤC HỢP ĐỒNG / CONTRACT ADDENDUM"
      "Số: PL-YYYY-CUST-###-v# | Phụ lục số: {{addendum.number}}"
      "Hợp đồng gốc số: {{contract.number}} ký ngày {{contract.signedAt}}"
   b) Preamble: legal references (same as contract)
   c) Party A + Party B blocks (same format)
   d) "Căn cứ Hợp đồng số {{contract.number}} ký ngày {{contract.signedAt}},
       hai bên thống nhất bổ sung, sửa đổi các điều khoản như sau:"
   e) ĐIỀU 1: NỘI DUNG SỬA ĐỔI / Changes
      Table showing:
      | Điều khoản gốc | Nội dung sửa đổi | Lý do |
      rendered from addendum.changes JSON
   f) ĐIỀU 2: GIÁ TRỊ THAY ĐỔI (nếu có) / Value Adjustments
      Original amount, delta, new total
   g) ĐIỀU 3: HIỆU LỰC / Effective Date
      "Phụ lục này là bộ phận không thể tách rời của Hợp đồng và có hiệu lực
       kể từ ngày ký. Các điều khoản khác của Hợp đồng gốc vẫn giữ nguyên."
   h) Signature block (both parties + stamp)

4. DATA LOADER
   loadAddendumData(addendumId) →
     { addendum, contract, customer, company, changes, ... }

5. INTEGRATION UI
   - frontend/app/(dashboard)/contracts/[id]/addendums/new/page.tsx: form
     to create addendum (contractId preselected)
   - Contract detail page: list of addendums with "Xuất phụ lục" per row

VERIFICATION:
- Addendum number increments per-contract (PL-2026-VNM001-001-v1, -002, ...)
- Changes table renders from JSON
- Value delta correct if amount changed
```

---

# 📄 PHASE 6 — NDA (Thỏa thuận bảo mật) — Classic

**Prompt for Agent:**

```
TASK: Implement NDA template (Thỏa thuận bảo mật thông tin).
Depends on: Phase 0 foundation.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: NDA | PREFIX: NDA | STYLE: Classic

DATA SOURCE: Customer + Settings (no separate NDA entity — rendered on-demand)

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/NDA/vi.hbs
   - backend/src/documents/templates/NDA/vi-en.hbs

2. SECTIONS
   a) Classic header: "THỎA THUẬN BẢO MẬT THÔNG TIN / NON-DISCLOSURE AGREEMENT"
      Số: NDA-YYYY-CUST-###-v#
   b) Preamble: legal references (Bộ luật Dân sự, Luật SHTT...)
   c) Parties block (A=Discloser/Company, B=Receiver/Customer or vice-versa
      — provide toggle in UI: "Who discloses?")
   d) ĐIỀU 1: ĐỊNH NGHĨA THÔNG TIN MẬT / Definition of Confidential Info
   e) ĐIỀU 2: PHẠM VI BẢO MẬT / Scope
   f) ĐIỀU 3: NGHĨA VỤ CỦA BÊN NHẬN / Receiver's Obligations
   g) ĐIỀU 4: LOẠI TRỪ / Exclusions (already public, pre-existing knowledge)
   h) ĐIỀU 5: THỜI HẠN BẢO MẬT / Duration (default 3 years, from settings)
   i) ĐIỀU 6: HOÀN TRẢ / XÓA THÔNG TIN / Return/Destruction
   j) ĐIỀU 7: VI PHẠM VÀ BỒI THƯỜNG / Breach & Damages
   k) ĐIỀU 8: LUẬT ÁP DỤNG & TRANH CHẤP / Governing Law
   l) ĐIỀU 9: HIỆU LỰC / Effective Date
   m) Signature block both parties + stamps

3. RENDER CONTEXT OPTIONS
   Request body supports: {
     ndaDurationYears: 3,
     discloserSide: "company" | "customer",
     customerId,
   }

4. INTEGRATION UI
   - Customer detail page: "Tạo NDA" option in Document dropdown
   - Modal asks: who discloses, duration, before generating

VERIFICATION:
- Both discloser orientations render correctly
- Duration customizable
- All 9 articles present with legal phrasing
```

---

# 📄 PHASE 7 — DELIVERY_NOTE (Biên bản giao hàng) — Classic

**Prompt for Agent:**

```
TASK: Implement DELIVERY_NOTE template (Biên bản giao hàng).
Depends on: Phase 0 foundation.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: DELIVERY_NOTE | PREFIX: GH | STYLE: Classic

DATA SOURCE: Contract + linked items/products + Customer + Settings

DELIVERABLES:

1. PRISMA (if needed)
   Add model Delivery {
     id, contractId, deliveryDate, location, recipientName, recipientTitle,
     notes, items Json (array of {name, qty, unit, serialNumber?}),
     status, createdAt, createdById
   }

2. TEMPLATE FILES
   - backend/src/documents/templates/DELIVERY_NOTE/vi.hbs
   - backend/src/documents/templates/DELIVERY_NOTE/vi-en.hbs

3. SECTIONS
   a) Classic header: "BIÊN BẢN GIAO HÀNG / DELIVERY NOTE"
      Số: GH-YYYY-CUST-###-v#
   b) "Căn cứ Hợp đồng số {{contract.number}} ký ngày {{contract.signedAt}}"
   c) "Hôm nay, ngày {{deliveryDate}}, tại {{location}}"
   d) BÊN GIAO HÀNG / Deliverer (Company block)
   e) BÊN NHẬN HÀNG / Receiver (Customer block) with representative name
   f) "Hai bên cùng tiến hành giao nhận với chi tiết như sau:"
   g) Items table:
      STT | Tên hàng hóa / Item | ĐVT | SL | Số serial / Ghi chú | Tình trạng
   h) "Tổng số mặt hàng: {{items.length}}"
   i) "Tình trạng hàng hóa: đầy đủ, nguyên vẹn theo đúng hợp đồng"
   j) "Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản"
   k) Signature block: Deliverer + Receiver

4. STYLE
   Classic style with itemized table, borders, last-row total count.

5. INTEGRATION UI
   - Contract detail page → "Biên bản giao hàng" button (opens form to
     enter delivery date, location, recipient, then generate PDF)

VERIFICATION:
- Items table populates from form input or linked contract items
- Both parties sign
- Document number auto-increments
```

---

# 📄 PHASE 8 — DOC_HANDOVER (Biên bản bàn giao tài liệu) — Classic

**Prompt for Agent:**

```
TASK: Implement DOC_HANDOVER template (Biên bản bàn giao tài liệu).
Depends on: Phase 0 foundation.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: DOC_HANDOVER | PREFIX: BGTL | STYLE: Classic

DATA SOURCE: Project or Contract + list of documents being handed over

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/DOC_HANDOVER/vi.hbs
   - backend/src/documents/templates/DOC_HANDOVER/vi-en.hbs

2. SECTIONS
   a) Classic header: "BIÊN BẢN BÀN GIAO TÀI LIỆU / DOCUMENT HANDOVER"
   b) Reference to Contract/Project
   c) Date, Location
   d) Party A (Handover), Party B (Receiver)
   e) Documents table:
      STT | Tên tài liệu / Document | Loại / Type (bản gốc/bản sao) |
      Số lượng | Ghi chú
   f) Total count
   g) Confirmation clause: "Bên nhận xác nhận đã nhận đủ số lượng tài liệu
      nêu trên trong tình trạng nguyên vẹn"
   h) Signature block

3. RENDER CONTEXT
   Form input: documents: Array<{name, type, qty, notes}>

4. INTEGRATION UI
   - Project/Contract detail → "Bàn giao tài liệu" button → form → PDF

VERIFICATION:
- Dynamic document list renders
- Type column supports: "Bản gốc", "Bản sao có công chứng", "Bản mềm", "USB"
```

---

# 📄 PHASE 9 — INSTALLATION_REPORT (Biên bản lắp đặt) — Classic

**Prompt for Agent:**

```
TASK: Implement INSTALLATION_REPORT template (Biên bản lắp đặt).
Depends on: Phase 0 foundation.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: INSTALLATION_REPORT | PREFIX: LD | STYLE: Classic

DATA SOURCE: Contract + installation event details (form input)

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/INSTALLATION_REPORT/vi.hbs
   - backend/src/documents/templates/INSTALLATION_REPORT/vi-en.hbs

2. SECTIONS
   a) Classic header: "BIÊN BẢN LẮP ĐẶT / INSTALLATION REPORT"
   b) Reference to Contract
   c) Installation info:
      - Địa điểm lắp đặt / Installation location
      - Ngày bắt đầu / Start date
      - Ngày hoàn thành / End date
      - Đội lắp đặt / Installation team
      - Đại diện bên khách hàng giám sát / Customer supervisor
   d) Both parties block
   e) Installed items table:
      STT | Hạng mục / Item | Model/Serial | Vị trí lắp đặt | Tình trạng
   f) "Kết quả kiểm tra / Inspection Results":
      - Kiểm tra nguồn điện / Power check
      - Kiểm tra kết nối / Connection test
      - Chạy thử / Trial run
      - Ghi chú / Notes
   g) "Đào tạo sử dụng / User Training" checklist (did/didn't conduct)
   h) Signature block + stamp

3. RENDER CONTEXT
   Form input: installationItems[], inspectionResults, trainingConducted

4. INTEGRATION UI
   - Contract detail → "Biên bản lắp đặt" button

VERIFICATION:
- Inspection checklist renders as checkboxes
- Training section conditional
```

---

# 📄 PHASE 10 — ACCEPTANCE_REPORT (Biên bản nghiệm thu) — Classic

**Prompt for Agent:**

```
TASK: Implement ACCEPTANCE_REPORT template (Biên bản nghiệm thu toàn bộ).
Depends on: Phase 0 foundation.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: ACCEPTANCE_REPORT | PREFIX: NT | STYLE: Classic

DATA SOURCE: Contract + Milestones + Project + Customer + Settings

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/ACCEPTANCE_REPORT/vi.hbs
   - backend/src/documents/templates/ACCEPTANCE_REPORT/vi-en.hbs

2. SECTIONS
   a) Classic header: "BIÊN BẢN NGHIỆM THU / ACCEPTANCE REPORT"
      Số: NT-YYYY-CUST-###-v#
   b) Preamble with legal reference + contract reference
   c) "Hôm nay, ngày {{acceptanceDate}}, tại {{location}}"
   d) Thành phần tham gia nghiệm thu / Acceptance Committee:
      - Đại diện Bên A (khách hàng): name, title
      - Đại diện Bên B (nhà cung cấp): name, title
      - (optional) Đại diện tư vấn giám sát: name, title
   e) ĐIỀU 1: NỘI DUNG NGHIỆM THU / Scope of Acceptance
      Description from contract.subject + milestones list
   f) ĐIỀU 2: CĂN CỨ NGHIỆM THU / Basis
      References: Contract, technical specs, quality standards
   g) ĐIỀU 3: KẾT QUẢ NGHIỆM THU / Acceptance Results
      Table per milestone/deliverable:
      | Hạng mục | Yêu cầu | Thực tế | Đánh giá | Kết luận |
      Final row: "Kết luận chung: ĐẠT / KHÔNG ĐẠT"
   h) ĐIỀU 4: TỒN TẠI VÀ KIẾN NGHỊ / Open Items & Recommendations
   i) ĐIỀU 5: KẾT LUẬN / Conclusion
      "Bên A đồng ý nghiệm thu và tiếp nhận toàn bộ..."
   j) Signature block (3 columns if consultant involved)
   k) "Biên bản được lập thành 04 bản..."

3. DATA LOADER
   loadAcceptanceData(contractId, { acceptanceDate, location, committee,
     deliverableResults, openItems, finalConclusion })

4. STYLE
   Formal legal Classic, results table with pass/fail color coding
   (green "ĐẠT" / red "KHÔNG ĐẠT") that prints readable in grayscale too.

5. INTEGRATION UI
   - Contract detail → "Biên bản nghiệm thu" form modal → generate PDF

VERIFICATION:
- All milestones in results table
- Final conclusion ĐẠT/KHÔNG ĐẠT rendered prominently
- 3-party signature variant works
```

---

# 📄 PHASE 11 — PARTIAL_ACCEPTANCE (Biên bản nghiệm thu từng phần) — Classic

**Prompt for Agent:**

```
TASK: Implement PARTIAL_ACCEPTANCE template (Biên bản nghiệm thu từng phần).
Depends on: Phase 0 + Phase 10 (shares structure).

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: PARTIAL_ACCEPTANCE | PREFIX: NTTP | STYLE: Classic

DATA SOURCE: Contract + specific Milestone(s) to accept

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/PARTIAL_ACCEPTANCE/vi.hbs
   - backend/src/documents/templates/PARTIAL_ACCEPTANCE/vi-en.hbs

2. SECTIONS
   Same structure as ACCEPTANCE_REPORT but:
   - Title: "BIÊN BẢN NGHIỆM THU TỪNG PHẦN / PARTIAL ACCEPTANCE REPORT"
   - Scope: only selected milestone(s), not full contract
   - "Giai đoạn nghiệm thu: {{milestone.name}}" prominent header
   - "Phần trăm hoàn thành hợp đồng: {{completionPercent}}%"
   - Payment trigger reference: "Là cơ sở để thanh toán đợt {{paymentPhase}}
     theo Điều 3 của Hợp đồng"
   - Results table only for accepted milestone
   - Remaining work summary at bottom

3. RENDER CONTEXT
   Form input: milestoneIds[] (which milestones to include),
   completionPercent, paymentPhase

4. INTEGRATION UI
   - Contract detail → milestone row → "Nghiệm thu giai đoạn này" button

VERIFICATION:
- Only selected milestones appear in results
- Completion % calculated
- Payment phase reference correct
```

---

# 📄 PHASE 12 — WARRANTY_CERT (Giấy chứng nhận bảo hành) — Classic

**Prompt for Agent:**

```
TASK: Implement WARRANTY_CERT template (Giấy chứng nhận bảo hành).
Depends on: Phase 0 foundation.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: WARRANTY_CERT | PREFIX: BH | STYLE: Classic

DATA SOURCE: Contract + delivered items + warranty policy from Settings

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/WARRANTY_CERT/vi.hbs
   - backend/src/documents/templates/WARRANTY_CERT/vi-en.hbs

2. SECTIONS
   a) Classic header: "GIẤY CHỨNG NHẬN BẢO HÀNH / WARRANTY CERTIFICATE"
      Số: BH-YYYY-CUST-###-v#
   b) Customer info (warranty holder)
   c) Issuer info (company)
   d) Warranted items table:
      STT | Sản phẩm / Product | Serial | Ngày bàn giao / Delivery Date |
      Thời hạn bảo hành / Warranty Period | Ngày hết hạn / Expiry
   e) "ĐIỀU KHOẢN BẢO HÀNH / Warranty Terms":
      - Phạm vi bảo hành / Coverage (from policies)
      - Loại trừ bảo hành / Exclusions
      - Quy trình yêu cầu bảo hành / Claim process
      - Thời gian phản hồi / Response SLA
   f) Contact for warranty claims
   g) Signature + stamp (issuer only)
   h) Barcode/QR code placeholder for online verification (optional)

3. DATA LOADER
   loadWarrantyData(contractId) → {
     items with serialNumber, deliveryDate, warrantyMonths (from policies),
     computed expiryDate per item
   }

4. STYLE
   - Certificate-style border (classic decorative frame)
   - Company seal prominent
   - QR code top-right (using qrcode lib if available, else placeholder)

5. INTEGRATION UI
   - Contract detail → "Giấy bảo hành" button per item or full contract

VERIFICATION:
- Expiry dates calculated correctly (deliveryDate + warrantyMonths)
- Exclusions list from policy setting
- Print quality certificate-grade
```

---

# 📄 PHASE 13 — MAINTENANCE_RECORD (Biên bản bảo trì) — Classic

**Prompt for Agent:**

```
TASK: Implement MAINTENANCE_RECORD template (Biên bản bảo trì).
Depends on: Phase 0 foundation.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: MAINTENANCE_RECORD | PREFIX: BT | STYLE: Classic

DATA SOURCE: Contract (or standalone maintenance event) + Customer

DELIVERABLES:

1. PRISMA (if needed)
   Add model Maintenance {
     id, contractId?, customerId, maintenanceDate, technician,
     itemsServiced Json, findings, actionsT Taken, nextScheduledDate?,
     status, createdAt, createdById
   }

2. TEMPLATE FILES
   - backend/src/documents/templates/MAINTENANCE_RECORD/vi.hbs
   - backend/src/documents/templates/MAINTENANCE_RECORD/vi-en.hbs

3. SECTIONS
   a) Classic header: "BIÊN BẢN BẢO TRÌ / MAINTENANCE RECORD"
   b) Contract reference (if applicable)
   c) Maintenance info:
      - Ngày bảo trì / Date
      - Địa điểm / Location
      - Kỹ thuật viên / Technician
      - Đại diện khách hàng / Customer Rep
      - Loại bảo trì / Type (Định kỳ / Đột xuất / Theo yêu cầu)
   d) Serviced items table:
      STT | Thiết bị | Serial | Nội dung kiểm tra | Kết quả | Hành động
   e) "Phát hiện / Findings" text section
   f) "Khuyến nghị / Recommendations"
   g) "Vật tư thay thế / Parts replaced" (if any) — table with costs
   h) "Lần bảo trì tiếp theo / Next scheduled maintenance: {{date}}"
   i) Signature block (technician + customer)

4. INTEGRATION UI
   - Contract detail → "Biên bản bảo trì" button
   - Standalone: /customers/[id] → "Lịch sử bảo trì" tab → "Tạo biên bản"

VERIFICATION:
- Items table supports findings per item
- Parts table optional
- Next date populated if scheduled
```

---

# 📄 PHASE 14 — PAYMENT_REQUEST (Đề nghị thanh toán) — Classic

**Prompt for Agent:**

```
TASK: Implement PAYMENT_REQUEST template (Đề nghị thanh toán).
Depends on: Phase 0 foundation.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: PAYMENT_REQUEST | PREFIX: TT | STYLE: Classic

DATA SOURCE: Contract + Milestone (payment phase) + Customer + Settings

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/PAYMENT_REQUEST/vi.hbs
   - backend/src/documents/templates/PAYMENT_REQUEST/vi-en.hbs

2. SECTIONS
   a) Classic header: "ĐỀ NGHỊ THANH TOÁN / PAYMENT REQUEST"
      Số: TT-YYYY-CUST-###-v#
   b) To: Customer block with attention-to (finance dept)
   c) From: Company block
   d) "Căn cứ Hợp đồng số {{contract.number}}, Biên bản nghiệm thu số
       {{acceptanceReportNumber}} (nếu có)"
   e) Payment details:
      - Đợt thanh toán / Payment phase: {{phase}} / {{totalPhases}}
      - Tỷ lệ / Percentage: {{percent}}%
      - Số tiền / Amount: {{currency amount}}
      - Bằng chữ / In words: {{currency amount "words"}}
      - VAT: {{currency vatAmount}}
      - Tổng đề nghị thanh toán / Total: {{currency grandTotal}}
   f) Bank info block (from Settings):
      - Tên tài khoản
      - Số tài khoản
      - Ngân hàng
      - Chi nhánh
      - Swift code (for vi-en mode)
   g) Thời hạn thanh toán / Payment deadline: {{deadlineDate}}
      (default 15 days from issue date, from policy)
   h) "Nội dung chuyển khoản / Transfer memo":
      "TT HD {{contract.number}} dot {{phase}}"
   i) Signature block (issuer only) + stamp

3. DATA LOADER
   loadPaymentRequestData(contractId, milestoneId) → {
     contract, milestone, customer, company, bankInfo, vatRate,
     computedAmounts, deadlineDate, transferMemo
   }

4. STYLE
   - Large amount box (bordered, bold, prominent)
   - Bank info in highlighted card
   - Barcode/QR of bank transfer (vietnamese VietQR format) — optional

5. INTEGRATION UI
   - Contract detail → milestone row → "Đề nghị thanh toán" button
   - Auto-populates from milestone.percent and contract.totalAmount

VERIFICATION:
- Amount calculation: contract.total * milestone.percent / 100
- VAT added correctly
- Bank info from Settings
- Transfer memo auto-generated
```

---

# 📄 PHASE 15 — PAYMENT_RECEIPT (Phiếu thu) — Classic

**Prompt for Agent:**

```
TASK: Implement PAYMENT_RECEIPT template (Phiếu thu).
Depends on: Phase 0 foundation.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: PAYMENT_RECEIPT | PREFIX: PT | STYLE: Classic

DATA SOURCE: Payment entity + Contract + Customer + Settings

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/PAYMENT_RECEIPT/vi.hbs
   - backend/src/documents/templates/PAYMENT_RECEIPT/vi-en.hbs

2. SECTIONS
   a) Compact classic header: "PHIẾU THU / PAYMENT RECEIPT"
      Số: PT-YYYY-CUST-###-v#
      Ngày: {{date}}
   b) Company block (top-left compact)
   c) Receipt details table (2-column key-value):
      - Người nộp tiền / Payer: {{customer.name}}
      - Địa chỉ / Address: {{customer.address}}
      - MST / Tax ID: {{customer.taxCode}}
      - Lý do nộp / Reason: Thanh toán Hợp đồng {{contract.number}} đợt {{phase}}
      - Số tiền / Amount: {{currency payment.amount}}
      - Bằng chữ / In words: {{currency payment.amount "words"}}
      - Hình thức / Method: {{payment.method}} (Chuyển khoản / Tiền mặt / Thẻ)
      - Tham chiếu / Reference: {{payment.transactionRef}}
   d) "Kèm theo chứng từ gốc / Original documents attached: ..."
   e) 3-column signature block at bottom:
      Người nộp / Payer | Kế toán / Accountant | Thủ quỹ / Treasurer
      (all with dotted lines for signatures)
   f) Company stamp placeholder bottom-right

3. STYLE
   - Compact form-style layout (fits half A4 or full A5)
   - Bordered boxes around each field
   - Classic Vietnamese accounting form aesthetic (gần giống mẫu BTC)
   - Option: A5 landscape variant via ?size=a5

4. DATA LOADER
   loadReceiptData(paymentId) → {
     payment, contract, customer, company, method, reference
   }

5. INTEGRATION UI
   - Contract detail → payment row → "Phiếu thu" button

VERIFICATION:
- Compact form-like layout
- 3-signature layout correct
- Method dropdown renders correctly
- Amount in words
```

---

# 📄 PHASE 16 — AR_RECONCILIATION (Biên bản đối chiếu công nợ) — Classic

**Prompt for Agent:**

```
TASK: Implement AR_RECONCILIATION template (Biên bản đối chiếu công nợ).
Depends on: Phase 0 foundation.
FINAL TEMPLATE — after this, all 16 are complete.

REPO: /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM
TEMPLATE CODE: AR_RECONCILIATION | PREFIX: DCN | STYLE: Classic

DATA SOURCE: Customer + all Contracts + all Payments (aggregate view)

DELIVERABLES:

1. TEMPLATE FILES
   - backend/src/documents/templates/AR_RECONCILIATION/vi.hbs
   - backend/src/documents/templates/AR_RECONCILIATION/vi-en.hbs

2. SECTIONS
   a) Classic header: "BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ / AR RECONCILIATION"
      Số: DCN-YYYY-CUST-###-v#
      Kỳ đối chiếu: từ {{periodFrom}} đến {{periodTo}}
      (default: calendar year to date)
   b) Party A (Seller/Creditor = Company)
   c) Party B (Buyer/Debtor = Customer)
   d) "Hai bên cùng thống nhất đối chiếu công nợ như sau:"
   e) ĐIỀU 1: SỐ DƯ ĐẦU KỲ / Opening Balance
      "Số dư nợ đầu kỳ: {{currency openingBalance}}"
   f) ĐIỀU 2: PHÁT SINH TRONG KỲ / Transactions During Period
      - Bảng 1: Phát sinh tăng / Invoices issued
        | Số HĐ | Ngày | Nội dung | Giá trị |
      - Bảng 2: Phát sinh giảm / Payments received
        | Số phiếu thu | Ngày | Nội dung | Giá trị |
      Subtotals for each
   g) ĐIỀU 3: SỐ DƯ CUỐI KỲ / Closing Balance
      "Tổng phát sinh tăng: {{currency totalDebits}}"
      "Tổng phát sinh giảm: {{currency totalCredits}}"
      "Số dư nợ cuối kỳ: {{currency closingBalance}}"
      "Bằng chữ: {{currency closingBalance 'words'}}"
   h) ĐIỀU 4: XÁC NHẬN / Confirmation
      "Hai bên xác nhận số liệu trên là chính xác và đồng ý ký xác nhận
       để làm cơ sở hạch toán, theo dõi công nợ."
   i) Signature block both parties + stamps
   j) "Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị pháp lý
       như nhau."

3. DATA LOADER
   loadReconciliationData(customerId, periodFrom, periodTo) → {
     customer, company,
     openingBalance,  // sum(invoices before periodFrom) - sum(payments before)
     invoices: Contract[] within period,
     payments: Payment[] within period,
     totalDebits, totalCredits,
     closingBalance,
   }
   Handles edge cases: no transactions, overpayment (credit balance), etc.

4. STYLE
   - Financial statement look: monospace-friendly number alignment
   - Right-aligned currency columns
   - Bold subtotals
   - Bordered section for closing balance

5. INTEGRATION UI
   - /customers/[id] detail → tab "Công nợ" → "Xuất biên bản đối chiếu"
     → date range picker + generate PDF
   - Optionally /reports/ar-reconciliation page with bulk multi-customer

6. TEST
   - backend test: opening + sum(debits) - sum(credits) = closing
   - Edge: customer with no transactions returns empty tables
   - Edge: negative closing balance (customer overpaid) shows "Công ty nợ
     khách hàng: {{amount}}"

VERIFICATION:
- Math: opening + debits - credits = closing (absolute assertion)
- Period filter respects dates (inclusive)
- Both invoice and payment tables show correct transactions
- Closing balance in words
- All 16 templates now complete — final verification: run all PDF renders
  end-to-end, verify Vietnamese characters, numbers, bilingual toggle all work.
```

---

## ✅ Completion Verification (After all 17 phases)

Run this verification script:

```bash
cd /Users/ngohung/Documents/AHSO/Claude/WORK/CRM/AHSO-CRM/backend
npm run test:e2e -- documents
```

Manual checks:
1. Admin panel → Company Info: fill full bank details
2. Customer edit → set language to "vi-en"
3. For each of the 16 document types, render both vi and vi-en variants
4. Verify Vietnamese diacritics (ă â đ ê ô ơ ư) render in PDF, not as tofu
5. Verify amounts format as VND with thousand separators
6. Verify "Bằng chữ" (in words) generates grammatical Vietnamese
7. Verify document numbers increment correctly per-type per-year
8. Verify bilingual mode shows Vietnamese + English side-by-side
9. Verify classic docs have legal preamble; modern docs have brand band
10. Verify signature blocks, stamps, dotted lines render correctly
11. Print one classic and one modern doc on real A4 → check margins, readability
12. Verify all document records persist in Document table with pdfPath

---

## 📊 Effort Estimate

| Phase | Est. hours | Complexity |
|---|---|---|
| Phase 0 Foundation | 12-16h | High (infrastructure) |
| Phase 1 QUOTATION | 4-5h | Medium (reference impl) |
| Phase 2 PROPOSAL | 5-6h | Medium (complex layout) |
| Phase 3 SURVEY_REPORT | 4-5h | Medium |
| Phase 4 CONTRACT | 8-10h | **High** (legal compliance) |
| Phase 5 CONTRACT_ADDENDUM | 3-4h | Low (reuses Phase 4) |
| Phase 6 NDA | 4-5h | Medium |
| Phase 7 DELIVERY_NOTE | 3-4h | Low |
| Phase 8 DOC_HANDOVER | 2-3h | Low |
| Phase 9 INSTALLATION_REPORT | 3-4h | Low |
| Phase 10 ACCEPTANCE_REPORT | 5-6h | Medium |
| Phase 11 PARTIAL_ACCEPTANCE | 2-3h | Low (reuses 10) |
| Phase 12 WARRANTY_CERT | 4-5h | Medium |
| Phase 13 MAINTENANCE_RECORD | 3-4h | Low |
| Phase 14 PAYMENT_REQUEST | 4-5h | Medium |
| Phase 15 PAYMENT_RECEIPT | 3-4h | Low |
| Phase 16 AR_RECONCILIATION | 5-6h | Medium (math) |
| **Total** | **~75-95h** | |

Parallelization: After Phase 0, all 16 templates can run concurrently = ~16-20h wall-clock with 5 parallel agents.

---

## 🎯 How to Use This Plan

**Option A — Sequential (safest):**
1. Paste "PHASE 0" prompt to Agent → wait for completion → verify build passes.
2. Paste "PHASE 1" prompt → verify.
3. Continue through Phase 16.

**Option B — Parallel (fastest):**
1. Paste "PHASE 0" prompt → wait for completion.
2. Open 5 agents simultaneously, paste Phases 1, 4, 7, 10, 14 (one per group lead).
3. As each finishes, queue the next in its group.

**Option C — Grouped (balanced):**
Merge prompts within a group (e.g., Phases 1-3 into one "Pre-sales group" prompt)
to reduce agent spin-up overhead. Risk: larger context per agent.

---

**Last updated**: 2026-04-19
**Status**: Ready for execution
**Owner**: AHSO Vietnam
