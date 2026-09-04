export const DOCUMENT_LAYOUT_CSS = `
/* Each .schema-document__page is exactly one A4 sheet.
   @page margin: 0 overrides base.css so the 210×297 mm div maps 1-to-1
   to the PDF page without CSS margin stacking. */
@page {
  size: A4;
  margin: 0;
}

.schema-document {
  background: #f8fafc;
  color: #0f172a;
  font-family: "Be Vietnam Pro", "Segoe UI", sans-serif;
}

.schema-document__page {
  position: relative;
  width: 210mm;
  height: 297mm;
  margin: 0 auto 12mm;
  background: #ffffff;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.schema-document__box {
  position: absolute;
  box-sizing: border-box;
  overflow: hidden;
}

.schema-document__text {
  white-space: pre-wrap;
}

.schema-document__text-inner {
  max-width: 100%;
  width: 100%;
}

.schema-document__image {
  width: 100%;
  height: 100%;
}

.schema-document__image img {
  width: 100%;
  height: 100%;
  display: block;
}

.schema-document__table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.schema-document__table thead th {
  background: #e2e8f0;
  font-weight: 700;
}

.schema-document__table th,
.schema-document__table td {
  border: 1px solid #cbd5e1;
  padding: 1.6mm 1.8mm;
  vertical-align: top;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: normal;
}

.schema-document__kv-row {
  display: grid;
  grid-template-columns: var(--label-width, 30%) 1fr;
  gap: 2mm;
  padding: 1mm 0;
  border-bottom: 1px solid rgba(203, 213, 225, 0.6);
}

.schema-document__kv-row:last-child {
  border-bottom: none;
}

.schema-document__kv-label {
  font-weight: 700;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.schema-document__kv-value {
  display: block;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.schema-document__signature {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8mm;
  height: 100%;
}

.schema-document__signature-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  text-align: center;
  height: 100%;
}

.schema-document__signature-space {
  flex: 1;
  min-height: 12mm;
}

@media print {
  .schema-document {
    background: transparent;
  }

  .schema-document__page {
    box-shadow: none;
    margin: 0 auto;
    break-after: page;
  }
}
`;
