#!/usr/bin/env python3

from __future__ import annotations

import html
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
SOURCE_MD = DOCS_DIR / "AHSO_STANDARD_CONTRACT_TEMPLATE_VN.md"
OUTPUT_HTML = DOCS_DIR / "AHSO_STANDARD_CONTRACT_TEMPLATE_VN.html"
OUTPUT_DOCX = DOCS_DIR / "AHSO_STANDARD_CONTRACT_TEMPLATE_VN.docx"


def format_inline(text: str) -> str:
    escaped = html.escape(text.strip())
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", escaped)
    return escaped


def close_lists(parts: list[str], stack: list[str]) -> None:
    while stack:
      tag = stack.pop()
      parts.append(f"</{tag}>")


def heading_class(level: int, text: str) -> str:
    if "DANH MỤC PHỤ LỤC" in text or "KHUYẾN NGHỊ ÁP DỤNG" in text:
        return ' class="page-break"'
    if level == 1:
        return ' class="contract-title"'
    return ""


def render_markdown_to_html(markdown_text: str) -> str:
    parts: list[str] = []
    list_stack: list[str] = []

    for raw_line in markdown_text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()

        if not stripped:
            close_lists(parts, list_stack)
            continue

        if stripped == "---":
            close_lists(parts, list_stack)
            parts.append("<hr />")
            continue

        if stripped.startswith("> "):
            close_lists(parts, list_stack)
            parts.append(f'<p class="note">{format_inline(stripped[2:])}</p>')
            continue

        heading_match = re.match(r"^(#{1,3})\s+(.*)$", stripped)
        if heading_match:
            close_lists(parts, list_stack)
            level = len(heading_match.group(1))
            text = heading_match.group(2).strip()
            parts.append(f"<h{level}{heading_class(level, text)}>{format_inline(text)}</h{level}>")
            continue

        ul_match = re.match(r"^-\s+(.*)$", stripped)
        if ul_match:
            if list_stack and list_stack[-1] != "ul":
                close_lists(parts, list_stack)
            if not list_stack or list_stack[-1] != "ul":
                parts.append("<ul>")
                list_stack.append("ul")
            parts.append(f"<li>{format_inline(ul_match.group(1))}</li>")
            continue

        ol_match = re.match(r"^\d+\.\s+(.*)$", stripped)
        if ol_match:
            if list_stack and list_stack[-1] != "ol":
                close_lists(parts, list_stack)
            if not list_stack or list_stack[-1] != "ol":
                parts.append("<ol>")
                list_stack.append("ol")
            parts.append(f"<li>{format_inline(ol_match.group(1))}</li>")
            continue

        close_lists(parts, list_stack)
        parts.append(f"<p>{format_inline(stripped)}</p>")

    close_lists(parts, list_stack)

    body = "\n".join(parts)
    return f"""<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>Mẫu chuẩn AHSO - Hợp đồng cung cấp thiết bị, phần mềm và dịch vụ triển khai</title>
    <style>
      @page {{
        margin: 22mm 18mm 22mm 22mm;
      }}
      body {{
        font-family: "Times New Roman", serif;
        font-size: 12pt;
        line-height: 1.55;
        color: #111827;
      }}
      h1, h2, h3 {{
        margin: 0 0 10pt;
      }}
      h1.contract-title {{
        text-align: center;
        font-size: 18pt;
        text-transform: uppercase;
        margin-top: 10pt;
      }}
      h2 {{
        font-size: 13.5pt;
        margin-top: 16pt;
        text-transform: uppercase;
      }}
      h3 {{
        font-size: 12pt;
        margin-top: 10pt;
      }}
      p {{
        margin: 0 0 8pt;
        text-align: justify;
      }}
      ul, ol {{
        margin: 0 0 8pt 20pt;
      }}
      li {{
        margin-bottom: 4pt;
      }}
      hr {{
        border: none;
        border-top: 1px solid #cbd5e1;
        margin: 12pt 0;
      }}
      .note {{
        font-size: 10.5pt;
        color: #475569;
        padding: 8pt 10pt;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
      }}
      .page-break {{
        page-break-before: always;
      }}
      code {{
        font-size: 10.5pt;
        background: #f3f4f6;
        padding: 1pt 3pt;
      }}
    </style>
  </head>
  <body>
{body}
  </body>
</html>
"""


def main() -> None:
    if not SOURCE_MD.exists():
        raise SystemExit(f"Không tìm thấy file nguồn: {SOURCE_MD}")

    markdown_text = SOURCE_MD.read_text(encoding="utf-8")
    html_text = render_markdown_to_html(markdown_text)
    OUTPUT_HTML.write_text(html_text, encoding="utf-8")

    subprocess.run(
        [
            "textutil",
            "-convert",
            "docx",
            str(OUTPUT_HTML),
            "-output",
            str(OUTPUT_DOCX),
        ],
        check=True,
    )

    print(f"Đã tạo HTML: {OUTPUT_HTML}")
    print(f"Đã tạo DOCX: {OUTPUT_DOCX}")


if __name__ == "__main__":
    main()
