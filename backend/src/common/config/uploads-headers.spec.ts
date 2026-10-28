import {
  SVG_CONTENT_SECURITY_POLICY,
  blockPrivateUploadsMiddleware,
  getUploadResponseHeaders,
  isBlockedUploadPath,
  uploadsHeadersMiddleware
} from "./uploads-headers";

describe("getUploadResponseHeaders", () => {
  it("sandboxes SVG files with a restrictive CSP and nosniff", () => {
    const headers = getUploadResponseHeaders("/logos/abc.svg");

    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Security-Policy"]).toBe(SVG_CONTENT_SECURITY_POLICY);
    expect(headers["Content-Security-Policy"]).toContain("sandbox");
    expect(headers["Content-Disposition"]).toBeUndefined();
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("serves PDF inline without sandbox CSP (keeps Chrome PDF viewer working)", () => {
    const headers = getUploadResponseHeaders("/files/abc.pdf");

    expect(headers).toEqual({ "X-Content-Type-Options": "nosniff" });
  });

  it("serves PNG inline with nosniff only so <img> logos/avatars keep rendering", () => {
    const headers = getUploadResponseHeaders("/avatars/abc.PNG");

    expect(headers).toEqual({ "X-Content-Type-Options": "nosniff" });
  });

  it.each(["/files/p.js", "/files/x.xhtml", "/files/x.html", "/files/x.bin", "/files/noext", "/files/x%2Ejs", "/files/x.js."])(
    "forces download as opaque binary for %s",
    (path) => {
      const headers = getUploadResponseHeaders(path);

      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Content-Disposition"]).toBe("attachment");
      expect(headers["Content-Type"]).toBe("application/octet-stream");
      expect(headers["Content-Security-Policy"]).toBeUndefined();
    }
  );

  it("treats malformed percent-encoding as unknown", () => {
    expect(getUploadResponseHeaders("/files/%E0%A4%A.png")["Content-Disposition"]).toBe("attachment");
  });
});

describe("uploadsHeadersMiddleware", () => {
  it("sets the computed headers and calls next", () => {
    const setHeader = jest.fn();
    const next = jest.fn();

    uploadsHeadersMiddleware(
      { path: "/files/p.js" } as never,
      { setHeader } as never,
      next
    );

    expect(setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(setHeader).toHaveBeenCalledWith("Content-Disposition", "attachment");
    expect(setHeader).toHaveBeenCalledWith("Content-Type", "application/octet-stream");
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("isBlockedUploadPath", () => {
  it.each([
    "/documents/a.pdf",
    "/business-documents/a.pdf",
    "/surveys/a.pdf",
    "/email-attachments/a.pdf",
    "/Documents/a.pdf",
    "/%64ocuments/a.pdf",
    "//documents/a.pdf",
    "/./documents/a.pdf",
    "/files/../documents/a.pdf",
    "/files/%2e%2e/documents/a.pdf",
    "/documents%2fa.pdf",
    "/files%5c..%5cdocuments/a.pdf",
    "/files/a%00.pdf",
    "/%zz"
  ])("blocks %s", (path) => {
    expect(isBlockedUploadPath(path)).toBe(true);
  });

  it.each(["/files/a.pdf", "/logos/logo.svg", "/avatars/u.png", "/files/documents-report.pdf", "/"])(
    "allows %s",
    (path) => {
      expect(isBlockedUploadPath(path)).toBe(false);
    }
  );

  it("middleware answers 404 for blocked paths and calls next otherwise", () => {
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const next = jest.fn();

    blockPrivateUploadsMiddleware({ path: "/%64ocuments/a.pdf" } as never, { status } as never, next);
    expect(status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();

    blockPrivateUploadsMiddleware({ path: "/files/a.pdf" } as never, { status } as never, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
