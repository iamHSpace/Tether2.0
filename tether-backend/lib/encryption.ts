/**
 * AES-256-GCM symmetric encryption for storing OAuth tokens at rest.
 *
 * Format stored in DB:  <iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * The encryption key is derived from ENCRYPTION_SECRET using SHA-256 so the
 * raw secret can be any length.  GCM provides both confidentiality and
 * integrity — the authTag will catch any tampering.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { encryption as cfg } from "@/lib/config";

function deriveKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET is not set");
  // SHA-256 always gives us exactly 32 bytes (256 bits) regardless of secret length
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(cfg.ivBytes);

  const cipher = createCipheriv(cfg.algorithm, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decrypt(stored: string): string {
  const key = deriveKey();
  const parts = stored.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivHex, tagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(cfg.algorithm, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}
