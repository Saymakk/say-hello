/** Алфавит без 0/O и 1/I — проще диктовать и читать с QR. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function randomShortCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < length; i++) {
    s += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return s;
}
