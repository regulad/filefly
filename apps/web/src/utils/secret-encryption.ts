import * as crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

function getKey(): Buffer {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- scoped
  const base64Key = process.env.SECRET_ENCRYPTION_KEY;
  if (!base64Key) {
    throw new Error("SECRET_ENCRYPTION_KEY environment variable is not set");
  }
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("Invalid key length. Expected 32 bytes.");
  }
  return key;
}

export function encrypt(text: string): { iv: string; encryptedData: string } {
  const key = getKey();
  const iv: Buffer = crypto.randomBytes(16);
  const cipher: crypto.Cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted: Buffer = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  return {
    iv: iv.toString("base64"),
    encryptedData: encrypted.toString("base64"),
  };
}

export function decrypt(iv: string, encryptedData: string): string {
  const key = getKey();
  const decipher: crypto.Decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "base64"),
  );
  const decrypted: Buffer = Buffer.concat([
    decipher.update(Buffer.from(encryptedData, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export default {
  encrypt,
  decrypt,
};
