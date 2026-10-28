import { posix } from "path";
import type { NextFunction, Request, Response } from "express";

/**
 * Response headers for files served statically from /uploads.
 *
 * Uploaded files are served from the API origin, so anything the browser could execute
 * there (HTML, XHTML, JS, SVG with script) would run with access to the API origin.
 * These rules are the primary defence; upload-time validation is best-effort on top.
 */

// Extensions that UploadService can produce (see its extensionMap) plus ".jpeg" for
// older files. Everything else - including ".bin" and any legacy ".js"/".xhtml"/".html"
// stored before the extension fix - is forced to download as an opaque binary.
export const UPLOAD_ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".doc",
  ".xls",
  ".ppt",
  ".zip",
  ".txt",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".mp4",
  ".mov",
  ".webm"
]);

// Sandboxed CSP for SVG: no script, no plugins, no network; inline styles stay allowed so
// logos still render. Images embedded via <img> ignore CSP, so logos keep working there.
export const SVG_CONTENT_SECURITY_POLICY = "sandbox; default-src 'none'; style-src 'unsafe-inline'";

export function getUploadResponseHeaders(requestPath: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff"
  };
  const extension = resolveExtension(requestPath);

  if (extension === null || !UPLOAD_ALLOWED_EXTENSIONS.has(extension)) {
    headers["Content-Disposition"] = "attachment";
    headers["Content-Type"] = "application/octet-stream";
    return headers;
  }

  if (extension === ".svg") {
    headers["Content-Security-Policy"] = SVG_CONTENT_SECURITY_POLICY;
  }

  // PDFs deliberately get no sandbox CSP: it breaks Chrome's built-in PDF viewer.
  return headers;
}

/**
 * Express middleware to mount on "/uploads" BEFORE useStaticAssets. serve-static/send
 * keeps a Content-Type that is already set, so the octet-stream override sticks.
 */
export function uploadsHeadersMiddleware(request: Request, response: Response, next: NextFunction) {
  const headers = getUploadResponseHeaders(request.path);
  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }
  next();
}

function resolveExtension(requestPath: string): string | null {
  let decodedPath: string;
  try {
    // send() decodes the path before reading from disk, so check the decoded form
    // (e.g. "x%2Ejs" must be treated as ".js").
    decodedPath = decodeURIComponent(requestPath.split("?")[0] ?? "");
  } catch {
    return null;
  }

  // Trailing dots/spaces are not meaningful on all filesystems; treat them as unknown.
  if (/[.\s]$/.test(decodedPath)) {
    return null;
  }

  const extension = posix.extname(decodedPath).toLowerCase();
  return extension || null;
}

// Folders that hold private business files. They are only ever served through
// authenticated endpoints, never as static files.
export const PRIVATE_UPLOAD_FOLDERS: ReadonlySet<string> = new Set([
  "documents",
  "business-documents",
  "surveys",
  "email-attachments"
]);

/**
 * True when a request path (relative to the "/uploads" mount, still percent-encoded)
 * must not be served statically. Decides on the DECODED path because serve-static decodes
 * before touching the disk; matching the raw URL lets "/%64ocuments/x", "//documents/x",
 * "/files/../documents/x" or "/documents%2fx" through. Anything ambiguous is blocked.
 */
export function isBlockedUploadPath(requestPath: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath.split("?")[0] ?? "");
  } catch {
    return true;
  }

  if (decoded.includes("\\") || decoded.includes("\0")) {
    return true;
  }

  const segments = decoded.split("/").filter((segment) => segment !== "");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return true;
  }

  const folder = segments[0]?.toLowerCase();
  return folder !== undefined && PRIVATE_UPLOAD_FOLDERS.has(folder);
}

export function blockPrivateUploadsMiddleware(request: Request, response: Response, next: NextFunction) {
  if (isBlockedUploadPath(request.path)) {
    response.status(404).send("Không tìm thấy tài liệu.");
    return;
  }
  next();
}
