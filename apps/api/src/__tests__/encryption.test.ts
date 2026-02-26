import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../lib/encryption.js";

describe("encryption", () => {
  it("encrypts and decrypts a string correctly", () => {
    const original = "my-secret-oauth-token-12345";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(original);
    expect(encrypted).not.toBe(original);
  });

  it("produces different ciphertext for same plaintext (due to random IV)", () => {
    const original = "same-text";
    const encrypted1 = encrypt(original);
    const encrypted2 = encrypt(original);

    expect(encrypted1).not.toBe(encrypted2);
    expect(decrypt(encrypted1)).toBe(original);
    expect(decrypt(encrypted2)).toBe(original);
  });

  it("throws on invalid encrypted text", () => {
    expect(() => decrypt("invalid")).toThrow();
  });
});
