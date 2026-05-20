import { ConfigService } from "@nestjs/config";

export function getAiRequestTimeoutMs(configService: ConfigService) {
  return configService.get<number>("AI_REQUEST_TIMEOUT_MS") ?? 30000;
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}
