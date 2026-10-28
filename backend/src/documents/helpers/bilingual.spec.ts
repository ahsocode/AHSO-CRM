import Handlebars from "handlebars";
import { buildBilingualHelper, interpolate } from "./bilingual";

const bundles = {
  vi: { greet: "Hôm nay, ngày {{date}}, tại {{location}}, chúng tôi gồm:", plain: "Bên A" },
  en: { greet: "Today, on {{date}}, at {{location}}, we are:", plain: "Party A" }
};

function render(source: string, context: Record<string, unknown>) {
  const hbs = Handlebars.create();
  hbs.registerHelper("t", buildBilingualHelper({ bundles }));
  return hbs.compile(source)(context);
}

describe("t helper interpolation (audit E-01)", () => {
  it("fills {{params}} from the helper hash in vi", () => {
    expect(render('{{t "greet" date=d location=loc}}', { language: "vi", d: "28 tháng 10 năm 2026", loc: "TP.HCM" })).toBe(
      "Hôm nay, ngày 28 tháng 10 năm 2026, tại TP.HCM, chúng tôi gồm:"
    );
  });

  it("fills both languages in vi-en", () => {
    expect(render('{{t "greet" date=d location=loc}}', { language: "vi-en", d: "28/10/2026", loc: "HCMC" })).toBe(
      '<span class="lang-vi">Hôm nay, ngày 28/10/2026, tại HCMC, chúng tôi gồm:</span>' +
        '<span class="lang-en">Today, on 28/10/2026, at HCMC, we are:</span>'
    );
  });

  it("HTML-escapes interpolated values in both modes", () => {
    const evil = { d: "<b>x</b>", loc: '"&' };
    expect(render('{{t "greet" date=d location=loc}}', { language: "vi", ...evil })).not.toContain("<b>");
    expect(render('{{t "greet" date=d location=loc}}', { language: "vi-en", ...evil })).not.toContain("<b>");
  });

  it("never leaves a raw placeholder when a param is missing", () => {
    expect(render('{{t "greet" date=d}}', { language: "vi", d: "x" })).not.toContain("{{");
    expect(interpolate("a {{x}} b {{ y }}", { x: 1 })).toBe("a 1 b ");
  });

  it("keeps plain keys and falls back to the key itself", () => {
    expect(render('{{t "plain"}}', { language: "vi" })).toBe("Bên A");
    expect(render('{{t "missing_key"}}', { language: "vi" })).toBe("missing_key");
  });
});
