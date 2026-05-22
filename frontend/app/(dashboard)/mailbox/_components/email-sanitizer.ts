import DOMPurify from "isomorphic-dompurify";

export function sanitizeEmailHtml(html?: string | null, showImages = false): string {
  if (!html) return "";

  // Block external tracking images before sanitize
  if (!showImages) {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "IMG") {
        const src = node.getAttribute("src") ?? "";
        if (/^https?:/i.test(src)) {
          node.setAttribute("data-blocked-src", src);
          node.removeAttribute("src");
        }
      }
    });
  }

  // Strip CSS expressions and behavior: directives from inline styles
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const style = node.getAttribute("style");
    if (style && /expression\s*\(|behavior\s*:/i.test(style)) {
      node.removeAttribute("style");
    }
  });

  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "meta", "base"],
    // Keep inline styles (needed for email formatting) but filter via hook above
  });

  DOMPurify.removeAllHooks();
  return clean;
}
