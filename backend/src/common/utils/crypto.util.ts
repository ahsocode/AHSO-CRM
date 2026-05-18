import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey() {
  const rawKey = process.env.ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("ENCRYPTION_KEY là bắt buộc để mã hóa mật khẩu email");
  }

  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  if (rawKey.length === 32) {
    return Buffer.from(rawKey, "utf8");
  }

  throw new Error("ENCRYPTION_KEY phải là 32 ký tự hoặc 64 ký tự hex");
}

export function encrypt(text: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(cipherText: string) {
  const [ivHex, authTagHex, encryptedHex] = cipherText.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Dữ liệu mã hóa không hợp lệ");
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]).toString("utf8");
}
