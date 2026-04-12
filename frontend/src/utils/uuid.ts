/**
 * Generate a RFC 4122 v4 UUID.
 * Uses the Web Crypto API which is available in all modern browsers and Node 19+.
 */
export function randomUUID(): string {
  return crypto.randomUUID();
}
