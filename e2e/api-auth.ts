import { readFileSync } from "fs";
import { resolve } from "path";

const STORAGE_STATE_PATH = resolve(__dirname, ".auth", "admin.json");

export function getStoredAdminAccessToken() {
  const storageState = JSON.parse(readFileSync(STORAGE_STATE_PATH, "utf8")) as {
    origins?: Array<{
      localStorage?: Array<{ name: string; value: string }>;
    }>;
  };

  const token = storageState.origins
    ?.flatMap((origin) => origin.localStorage ?? [])
    .find((entry) => entry.name === "ahso_e2e_access_token")?.value;

  if (!token) {
    throw new Error("Không tìm thấy token admin E2E trong storage state.");
  }

  return token;
}

export function getUserIdFromAccessToken(accessToken: string) {
  const [, payload] = accessToken.split(".");

  if (!payload) {
    throw new Error("Access token E2E không đúng định dạng JWT.");
  }

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as {
    sub?: string;
  };

  if (!decoded.sub) {
    throw new Error("Access token E2E không có user id.");
  }

  return decoded.sub;
}
