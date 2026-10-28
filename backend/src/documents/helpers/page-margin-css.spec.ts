import { buildPageMarginCss, escapeCssString } from "./page-margin-css";

describe("buildPageMarginCss", () => {
  it("prints company · document number bottom-left and Trang x / y bottom-right", () => {
    const css = buildPageMarginCss({ company: { name: "CÔNG TY TNHH AHSO" }, docNumber: "GH-2026-012-01" }, "vi");
    expect(css).toContain('content: "CÔNG TY TNHH AHSO · GH-2026-012-01";');
    expect(css).toMatch(/@bottom-right\s*\{\s*content: "Trang " counter\(page\) " \/ " counter\(pages\);/);
  });

  it("uses a bilingual page label for vi-en and omits a missing document number", () => {
    const css = buildPageMarginCss({ company: { name: "AHSO" } }, "vi-en");
    expect(css).toContain('content: "AHSO";');
    expect(css).toContain('content: "Trang / Page " counter(page)');
  });

  it("cannot be broken out of by settings values", () => {
    const css = buildPageMarginCss({ company: { name: 'X"; } body { display:none } </style><script>' } }, "vi");
    expect(css).not.toContain("</style>");
    expect(css).not.toContain('X";');
    expect(escapeCssString('a\\b"c\nd<e')).toBe('a\\\\b\\"c d\\3C e');
  });
});
