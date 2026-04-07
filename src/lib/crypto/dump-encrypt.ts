/**
 * Шифрование резервной копии: PBKDF2 + AES-256-GCM.
 * В файле нет читаемых текстов переписки — только соль, iv и шифротекст (base64).
 */

const ITERATIONS = 210_000;
const SALT_LEN = 16;

export type EncryptedDumpFile = {
  v: 3;
  alg: "AES-GCM-256";
  kdf: "PBKDF2-SHA256";
  iterations: number;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
};

function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Сериализует объект в зашифрованный JSON (объект EncryptedDumpFile). */
export async function encryptDumpObject(
  plain: unknown,
  password: string
): Promise<EncryptedDumpFile> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(plain));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext
  );
  return {
    v: 3,
    alg: "AES-GCM-256",
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    saltB64: b64encode(salt.buffer),
    ivB64: b64encode(iv.buffer),
    ciphertextB64: b64encode(ciphertext),
  };
}

/** Расшифровка EncryptedDumpFile → объект (после JSON.parse внутреннего). */
export async function decryptDumpObject(
  file: EncryptedDumpFile,
  password: string
): Promise<unknown> {
  const salt = b64decode(file.saltB64);
  const iv = b64decode(file.ivB64);
  const key = await deriveKey(password, salt);
  const ciphertext = b64decode(file.ciphertextB64);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
  } catch {
    throw new Error("Неверный пароль или повреждённый файл");
  }
  const text = new TextDecoder().decode(plain);
  return JSON.parse(text) as unknown;
}

export function isEncryptedDumpEnvelope(data: unknown): data is EncryptedDumpFile {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return o.v === 3 && o.alg === "AES-GCM-256" && typeof o.ciphertextB64 === "string";
}
