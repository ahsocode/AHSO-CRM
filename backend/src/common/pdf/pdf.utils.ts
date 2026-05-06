import { ConfigService } from "@nestjs/config";
import { existsSync } from "fs";
import puppeteer, { type Browser } from "puppeteer";

const EXECUTABLE_CANDIDATES = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome"
];

// Close the browser after this many ms of inactivity to reclaim ~300 MB.
// A new render will relaunch it transparently.
const IDLE_CLOSE_MS = 5 * 60 * 1000;

function resolveExecutablePath(configService: ConfigService) {
  const configured = configService.get<string>("PUPPETEER_EXECUTABLE_PATH");
  if (configured) return configured;
  return EXECUTABLE_CANDIDATES.find((p) => existsSync(p));
}

let sharedBrowser: Browser | null = null;
let launchPromise: Promise<Browser> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleIdleClose() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    idleTimer = null;
    if (sharedBrowser?.connected) {
      await sharedBrowser.close().catch(() => undefined);
      sharedBrowser = null;
    }
  }, IDLE_CLOSE_MS);
}

async function getBrowser(configService: ConfigService): Promise<Browser> {
  // A new render is starting — cancel any pending idle-close.
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

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
    // Start the idle countdown — browser closes if no PDF is requested within 5 min.
    scheduleIdleClose();
  }
}
