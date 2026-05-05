import { ConfigService } from "@nestjs/config";
import { existsSync } from "fs";
import puppeteer, { type Browser } from "puppeteer";

const EXECUTABLE_CANDIDATES = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome"
];

function resolveExecutablePath(configService: ConfigService) {
  const configured = configService.get<string>("PUPPETEER_EXECUTABLE_PATH");
  if (configured) return configured;
  return EXECUTABLE_CANDIDATES.find((p) => existsSync(p));
}

// Singleton browser — reused across all PDF renders to avoid the ~300 MB
// startup cost on every request. A new page is opened and closed per render,
// keeping memory overhead low while the process stays warm.
let sharedBrowser: Browser | null = null;
let launchPromise: Promise<Browser> | null = null;

async function getBrowser(configService: ConfigService): Promise<Browser> {
  if (sharedBrowser?.connected) return sharedBrowser;

  // Deduplicate concurrent first-launch calls.
  if (!launchPromise) {
    launchPromise = puppeteer
      .launch({
        headless: true,
        executablePath: resolveExecutablePath(configService),
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--single-process"
        ]
      })
      .then((b) => {
        sharedBrowser = b;
        launchPromise = null;

        // If Chromium crashes, clear the reference so the next call re-launches.
        b.on("disconnected", () => {
          sharedBrowser = null;
        });

        return b;
      })
      .catch((err) => {
        launchPromise = null;
        throw err;
      });
  }

  return launchPromise;
}

export async function renderPdfBuffer(html: string, configService: ConfigService) {
  const browser = await getBrowser(configService);
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "14mm",
        right: "12mm",
        bottom: "14mm",
        left: "12mm"
      }
    });
  } finally {
    await page.close();
  }
}
