import { execFile } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { dirname } from "path";
import { PdfRendererService } from "./pdf-renderer.service";

jest.mock("child_process", () => ({
  execFile: jest.fn()
}));

describe("PdfRendererService", () => {
  const execFileMock = execFile as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders via WeasyPrint CLI with execFile, timeout, and temp-file cleanup", async () => {
    let tempDir = "";
    execFileMock.mockImplementation(
      (
        command: string,
        args: string[],
        _options: { timeout?: number; maxBuffer?: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        expect(command).toBe("weasyprint");
        tempDir = dirname(args[0]);
        writeFileSync(args[1], Buffer.from("weasy-pdf"));
        callback(null, "", "");
      }
    );

    const service = new PdfRendererService();
    const pdf = await service.render("<html><body>quote</body></html>");

    expect(pdf.toString("utf-8")).toBe("weasy-pdf");
    expect(execFileMock).toHaveBeenCalledWith(
      "weasyprint",
      expect.any(Array),
      expect.objectContaining({ timeout: 60_000 }),
      expect.any(Function)
    );
    expect(existsSync(tempDir)).toBe(false);
  });

  it("rejects with a descriptive error when WeasyPrint exits with a non-zero code", async () => {
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        _options: unknown,
        callback: (error: Error & { code?: number; signal?: string } | null) => void
      ) => {
        const err = Object.assign(new Error("failed"), { code: 1 });
        callback(err);
      }
    );

    const service = new PdfRendererService();
    await expect(service.render("<html></html>")).rejects.toThrow("WeasyPrint PDF rendering failed");
  });
});
