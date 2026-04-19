import { ConfigService } from "@nestjs/config";
import { existsSync } from "fs";
import puppeteer from "puppeteer";

const EXECUTABLE_CANDIDATES = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome"
];

function resolveExecutablePath(configService: ConfigService) {
  const configuredPath = configService.get<string>("PUPPETEER_EXECUTABLE_PATH");

  if (configuredPath) {
    return configuredPath;
  }

  return EXECUTABLE_CANDIDATES.find((candidate) => existsSync(candidate));
}

export async function renderPdfBuffer(html: string, configService: ConfigService) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: resolveExecutablePath(configService),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();
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
    await browser.close();
  }
}
