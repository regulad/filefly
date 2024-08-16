import { createHash, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const randomBytesPromise = promisify(randomBytes);

export async function generateClientState(): Promise<{
  clientState: string;
  hashedClientState: string;
}> {
  const secretBuffer = await randomBytesPromise(32);
  const clientState = secretBuffer.toString("base64");
  const hashedClientState = hashClientState(clientState);

  return { clientState, hashedClientState };
}

export function hashClientState(clientStateBase64: string): string {
  const hash = createHash("sha256");
  // get the bytes of the base 64
  const buffer = Buffer.from(clientStateBase64, "base64");
  hash.update(buffer);
  return hash.digest("hex");
}

export function validateClientState(
  receivedClientState: string,
  storedHashedClientState: string,
): boolean {
  const receivedHashedClientState = hashClientState(receivedClientState);
  return receivedHashedClientState === storedHashedClientState;
}
