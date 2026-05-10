import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "ssg_session";
export const STATE_COOKIE = "ssg_oauth_state";

export type Session = {
  accessToken: string;
  refreshToken: string;
  // Unix ms when the access token expires
  expiresAt: number;
};

function readKey(): Buffer {
  const hex = process.env.SESSION_SECRET;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "SESSION_SECRET missing or wrong length (need 32-byte hex; run: openssl rand -hex 32)",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptJson(value: unknown): string {
  const key = readKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptJson<T>(payload: string): T | null {
  try {
    const key = readKey();
    const data = Buffer.from(payload, "base64url");
    if (data.length < 12 + 16 + 1) return null;
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const enc = data.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(dec.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const STATE_MAX_AGE_SECONDS = 600; // 10 minutes
