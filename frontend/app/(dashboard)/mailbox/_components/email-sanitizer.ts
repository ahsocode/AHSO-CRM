import DOMPurify from "dompurify";

export function replaceCidImageReferences(html: string, cid: string, dataUrl: string): string {
  const cleanCid = cid.replace(/^<|>$/g, "");
  const variants = new Set([
    cleanCid,
    encodeURIComponent(cleanCid),
    cleanCid.replace(/@/g, "%40")
  ]);

  let nextHtml = html;
  for (const variant of variants) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    nextHtml = nextHtml.replace(new RegExp(`cid:${escaped}`, "gi"), dataUrl);
  }

  return nextHtml;
}

export function sanitizeEmailHtml(html?: string | null, showImages = false): string {
  if (!html) return "";

  // DOMPurify needs a real browser DOM. Never return raw email HTML during SSR;
  // the client hydrates and sanitizes before rendering inside the sandboxed iframe.
  if (typeof window === "undefined") return "";

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
    ADD_DATA_URI_TAGS: ["img"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "meta", "base"],
    // Keep inline styles (needed for email formatting) but filter via hook above
  });

  DOMPurify.removeAllHooks();
  return clean;
}
